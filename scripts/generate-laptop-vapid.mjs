import { writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
const require = createRequire(
  new URL("../artifacts/api-server/package.json", import.meta.url),
);
const { generateVAPIDKeys } = await import(
  pathToFileURL(require.resolve("web-push")).href
);
const keys = generateVAPIDKeys();
// Exclusive creation prevents accidental key rotation and broken existing subscriptions.
await writeFile(
  ".env.laptop-watch.local",
  `VAPID_PUBLIC_KEY=${keys.publicKey}\nVAPID_PRIVATE_KEY=${keys.privateKey}\n`,
  { flag: "wx", mode: 0o600 },
);
console.log(
  "Keys saved to ignored .env.laptop-watch.local. Copy into server secret settings; never commit or paste into chat.",
);
