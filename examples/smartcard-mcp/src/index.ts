import { startServer } from "./server.js";

// Handle uncaught exceptions
process.on("uncaughtException", () => {
  process.exit(1);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", () => {
  process.exit(1);
});

// Graceful shutdown
process.on("SIGINT", () => {
  process.exit(0);
});

process.on("SIGTERM", () => {
  process.exit(0);
});

// Start the server
try {
  startServer();
} catch {
  process.exit(1);
}
