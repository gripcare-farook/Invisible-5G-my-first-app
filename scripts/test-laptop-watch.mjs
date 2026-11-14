import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { rm } from "node:fs/promises";
import path from "node:path";
const require = createRequire(
  new URL("../artifacts/api-server/package.json", import.meta.url),
);
const { build } = require("esbuild");
// Keep the bundle beside the test so fixture URLs retain their meaning.
const outfile = "tests/.laptop-watch-test.mjs";
try {
  await build({
    entryPoints: ["tests/laptop-watch.test.mjs"],
    outfile,
    bundle: true,
    platform: "node",
    format: "esm",
    packages: "external",
  });
  const result = spawnSync(process.execPath, ["--test", outfile], {
    stdio: "inherit",
  });
  process.exitCode = result.status ?? 1;
  if (!process.exitCode) {
    const integration = "artifacts/api-server/.laptop-watch-tests.mjs";
    try {
      await build({
        entryPoints: ["tests/laptop-integration.test.mjs"],
        outfile: integration,
        bundle: true,
        platform: "node",
        format: "esm",
        packages: "external",
        plugins: [
          {
            name: "isolated-postgres",
            setup(b) {
              b.onResolve({ filter: /^@workspace\/db$/ }, () => ({
                path: path.resolve("tests/laptop-test-db.mjs"),
              }));
            },
          },
        ],
      });
      process.exitCode =
        spawnSync(process.execPath, ["--test", integration], {
          stdio: "inherit",
        }).status ?? 1;
    } finally {
      await rm(integration, { force: true });
    }
  }
} finally {
  await rm(outfile, { force: true });
}
