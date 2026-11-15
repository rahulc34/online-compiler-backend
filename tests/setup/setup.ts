import { afterAll, afterEach, beforeAll } from "vitest";

import {
  clearTestDatabase,
  connectTestDatabase,
  disconnectTestDatabase,
} from "./test-database";

beforeAll(async () => {
  await connectTestDatabase();
});

afterEach(async () => {
  await clearTestDatabase();
});

afterAll(async () => {
  await disconnectTestDatabase();
});
