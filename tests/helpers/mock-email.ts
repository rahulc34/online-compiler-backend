import { vi } from "vitest";

const { mockSendMail } = vi.hoisted(() => ({
  mockSendMail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../src/services/mail.service", () => ({
  sendMail: mockSendMail,
}));

export { mockSendMail };
