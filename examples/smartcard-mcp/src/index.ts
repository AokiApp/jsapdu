import { startServer } from "./server.js";

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  globalThis.darkhole.error("Uncaught Exception:", error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  globalThis.darkhole.error(
    "Unhandled Rejection at:",
    promise,
    "reason:",
    reason,
  );
  process.exit(1);
});

// Graceful shutdown
process.on("SIGINT", () => {
  globalThis.darkhole.log("\nReceived SIGINT. Graceful shutdown...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  globalThis.darkhole.log("\nReceived SIGTERM. Graceful shutdown...");
  process.exit(0);
});

// Start the server
try {
  startServer();
} catch (error) {
  globalThis.darkhole.error("Failed to start server:", error);
  process.exit(1);
}
