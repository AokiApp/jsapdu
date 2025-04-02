import { afterEach, vi, expect } from "vitest";

// Clean up any mocked resources after each test
afterEach(() => {
  // Reset any mocked state
  vi.restoreAllMocks();
});

// Configure test environment
vi.mock("pcsclite", () => {
  return {
    default: () => {
      throw new Error("pcsclite should be mocked in tests");
    }
  };
});

// Add custom matchers if needed
expect.extend({
  toBeValidResponse(received) {
    const pass = received &&
      typeof received.sw1 === "number" &&
      typeof received.sw2 === "number";
    
    return {
      pass,
      message: () =>
        pass
          ? "Expected response not to be valid APDU response"
          : "Expected response to be valid APDU response"
    };
  }
});

// Declare custom matcher types
declare global {
  interface Assertion<T = any> {
    toBeValidResponse(): void;
  }
}