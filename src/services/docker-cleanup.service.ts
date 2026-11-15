import Docker from "dockerode";

import Execution from "../models/execution.model";

const docker = new Docker();

const ACTIVE_EXECUTION_STATUSES = ["running", "cancelling"];

const ACTIVE_HEARTBEAT_THRESHOLD_MS = 60_000;

export const cleanupOrphanedContainers = async (): Promise<void> => {
  console.log("[DOCKER CLEANUP] Starting orphaned container cleanup");

  const containers = await docker.listContainers({
    all: true,
    filters: {
      label: ["compiler.managed=true"],
    },
  });

  let removedCount = 0;
  let preservedCount = 0;

  for (const containerInfo of containers) {
    const executionId = containerInfo.Labels?.["compiler.executionId"];

    if (!executionId) {
      console.warn(
        `[DOCKER CLEANUP] Container ${containerInfo.Id} has no execution ID`,
      );
    } else {
      const execution = await Execution.findById(executionId).select(
        "status lastHeartbeatAt",
      );

      // Preserve executions that are genuinely active.
      if (
        execution &&
        ACTIVE_EXECUTION_STATUSES.includes(execution.status) &&
        execution.lastHeartbeatAt &&
        Date.now() - execution.lastHeartbeatAt.getTime() <
          ACTIVE_HEARTBEAT_THRESHOLD_MS
      ) {
        preservedCount++;
        continue;
      }
    }

    // No execution, or execution is no longer active.
    const container = docker.getContainer(containerInfo.Id);

    try {
      if (containerInfo.State === "running") {
        await container.stop({ t: 1 });
      }

      await container.remove({ force: true });

      removedCount++;

      console.log(`[DOCKER CLEANUP] Removed container ${containerInfo.Id}`);
    } catch (error) {
      console.error(
        `[DOCKER CLEANUP] Failed to remove container ${containerInfo.Id}:`,
        error,
      );
    }
  }

  console.log(
    `[DOCKER CLEANUP] Finished. Removed: ${removedCount}, Preserved: ${preservedCount}`,
  );
};
