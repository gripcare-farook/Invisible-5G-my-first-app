import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
const require = createRequire(new URL('../artifacts/api-server/package.json', import.meta.url));
const { build } = require('esbuild');
// Keep the bundle beside the test so fixture URLs retain their meaning.
const outfile = 'tests/.laptop-watch-test.mjs';
try {
  await build({entryPoints:['tests/laptop-watch.test.mjs'],outfile,bundle:true,platform:'node',format:'esm',packages:'external'});
  const result = spawnSync(process.execPath,['--test',outfile],{stdio:'inherit'});
  process.exitCode = result.status ?? 1;
} finally { await rm(outfile,{force:true}); }
