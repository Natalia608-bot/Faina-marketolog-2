import { spawn, type ChildProcess } from "node:child_process";

const children: ChildProcess[] = [];

function startProcess(name: string, command: string, args: string[]) {
  const child = spawn(command, args, {
    stdio: "inherit",
    env: process.env,
  });

  child.on("exit", (code, signal) => {
    console.error(
      `[start] ${name} exited: code=${code ?? "null"} signal=${signal ?? "null"}`
    );
  });

  child.on("error", (error) => {
    console.error(`[start] ${name} error:`, error);
  });

  children.push(child);

  console.log(`[start] ${name} started, pid=${child.pid ?? "unknown"}`);

  return child;
}

const web = startProcess("web", "bun", ["src/server/index.ts"]);
const worker = startProcess("worker", "bun", ["worker/inbox-worker.ts"]);

console.log("[start] Faina web + worker starting");

let shuttingDown = false;

function shutdown(signal: NodeJS.Signals) {
  if (shuttingDown) return;

  shuttingDown = true;

  console.log(`[start] ${signal} received — stopping web + worker`);

  for (const child of children) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }

  setTimeout(() => {
    for (const child of children) {
      if (!child.killed) {
        child.kill("SIGKILL");
      }
    }

    process.exit(0);
  }, 5000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

web.on("exit", (code) => {
  if (!shuttingDown && code !== 0) {
    console.error("[start] web process stopped unexpectedly");
    process.exit(1);
  }
});

worker.on("exit", (code) => {
  if (!shuttingDown && code !== 0) {
    console.error("[start] worker process stopped unexpectedly");
    process.exit(1);
  }
});
