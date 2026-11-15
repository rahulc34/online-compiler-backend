import Docker from "dockerode";

const activeContainers = new Map<string, Docker.Container>();
const pendingCancellations = new Set<string>();

export const registerExecutionContainer = async (
  executionId: string,
  container: Docker.Container,
): Promise<void> => {
  activeContainers.set(executionId, container);

  if (pendingCancellations.has(executionId)) {
    try {
      await container.kill();
    } catch (error) {
      console.error(
        `[CANCEL] Failed to kill pending execution ${executionId}:`,
        error,
      );
      throw error;
    }
  }
};

export const unregisterExecutionContainer = (executionId: string): void => {
  activeContainers.delete(executionId);
  pendingCancellations.delete(executionId);
};

export const cancelExecutionContainer = async (
  executionId: string,
): Promise<boolean> => {
  const container = activeContainers.get(executionId);

  if (!container) {
    // Remember cancellation until the container registers.
    pendingCancellations.add(executionId);
    return false;
  }

  try {
    await container.kill();
    return true;
  } catch (error) {
    console.error(
      `[CANCEL] Failed to kill container for execution ${executionId}:`,
      error,
    );

    return false;
  }
};
