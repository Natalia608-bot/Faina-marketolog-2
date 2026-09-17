import { spawn } from "bun";

const children = [
  spawn({
    cmd: ["bun", "src/server/index.ts"],
    stdout: "inherit",
    stderr: "inherit",
    stdin: "inherit",
  }),

  spawn({
    cmd: ["bun", "worker/inbox-worker.ts"],
    stdout: "inherit",
    stderr: "inherit",
    stdin: "inherit",
  }),
];

console.log("[start] Faina web + worker starting");

let shuttingDown = false;

async function shutdown(signal: string) {
  if (shuttingDown) return;

  shuttingDown = true;

  console.log(`[start] ${signal} received — stopping web + worker`);

  for (const child of children) {
    try {
      child.kill(signal === "SIGINT" ? "SIGINT" : "SIGTERM");
    } catch {
      // child may already be stopped
    }
  }

  await Promise.allSettled(
    children.map((child) => child.exited),
  );

  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

const results = await Promise.all(
  children.map(async (child) => ({
    pid: child.pid,
    exitCode: await child.exited,
  })),
);

console.error("[start] child process exited:", results);

process.exit(1);
