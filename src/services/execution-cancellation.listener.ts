import redisConnection from "../config/redis";
import Execution from "../models/execution.model";
import { cancelExecutionContainer } from "./execution-container.registry";

const EXECUTION_CANCEL_CHANNEL = "execution:cancel";

const subscriber = redisConnection.duplicate();

export const startCancellationListener = async () => {
  await subscriber.subscribe(EXECUTION_CANCEL_CHANNEL);

  subscriber.on("message", async (channel, message) => {
    if (channel !== EXECUTION_CANCEL_CHANNEL) return;

    try {
      const payload: unknown = JSON.parse(message);

      if (
        typeof payload !== "object" ||
        payload === null ||
        !("executionId" in payload) ||
        typeof payload.executionId !== "string"
      ) {
        console.error("Invalid execution cancellation event");
        return;
      }

      const { executionId } = payload;

      // Find and terminate the execution's Docker container.
      const terminated = await cancelExecutionContainer(executionId);

      if (!terminated) {
        console.warn(`No active container found for execution ${executionId}`);
        return;
      }

      // Mark cancelled only after container termination succeeds.
      await Execution.updateOne(
        {
          _id: executionId,
          status: "cancelling",
        },
        {
          $set: { status: "cancelled" },
        },
      );

      console.log(`Execution ${executionId} cancelled successfully`);
    } catch (error) {
      console.error("Execution cancellation event failed:", error);
    }
  });

  console.log("Execution cancellation listener started");
};
