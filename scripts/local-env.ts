import { execFileSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
if (existsSync(".env.local") && !process.argv.includes("--force"))
  throw new Error(
    ".env.local already exists. Use --force only to replace it with local Supabase settings.",
  );
const status = JSON.parse(
  execFileSync("pnpm", ["exec", "supabase", "status", "-o", "json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }),
);
writeFileSync(
  ".env.local",
  `NEXT_PUBLIC_SUPABASE_URL=${status.API_URL}\nNEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${status.PUBLISHABLE_KEY || status.ANON_KEY}\nSUPABASE_SERVICE_ROLE_KEY=${status.SERVICE_ROLE_KEY}\nNEXT_PUBLIC_APP_URL=http://localhost:3000\n`,
  { mode: 0o600 },
);
console.log(
  "Local Supabase configuration saved to .env.local (ignored by Git). No keys printed.",
);
