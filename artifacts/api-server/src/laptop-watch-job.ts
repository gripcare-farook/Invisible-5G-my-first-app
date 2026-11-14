import { pool } from "@workspace/db";
import { runChecks } from "./laptop-watch/worker";
runChecks()
  .catch(() => {
    console.error(
      "Laptop Watch job failed; inspect monitoring status and server secrets.",
    );
    process.exitCode = 1;
  })
  .finally(() => pool.end());
