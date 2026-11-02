// Creates the database and roles, runs migrations, and fills in .env.local.
// Needs DATABASE_ADMIN_URL in .env.local, such as postgres://postgres:PASSWORD@localhost:5432/postgres
import { randomBytes } from "node:crypto";
import { appendFileSync, readFileSync } from "node:fs";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

const DB_NAME = "inventory";
const adminUrl = process.env.DATABASE_ADMIN_URL;
if (!adminUrl) {
  console.error("Add DATABASE_ADMIN_URL to .env.local first.");
  process.exit(1);
}

const admin = new pg.Client({ connectionString: adminUrl });
await admin.connect();
const { rowCount } = await admin.query("select 1 from pg_database where datname = $1", [DB_NAME]);
if (!rowCount) await admin.query(`create database ${DB_NAME}`);
await admin.end();
console.log(`Database "${DB_NAME}" ready.`);

const url = new URL(adminUrl);
url.pathname = `/${DB_NAME}`;

const pool = new pg.Pool({ connectionString: url.href });
await migrate(drizzle(pool), { migrationsFolder: "./drizzle/migrations" });
console.log("Migrations applied.");

const envFile = readFileSync(".env.local", "utf8");
const lines: string[] = [];

for (const [role, key] of [
  ["inventory_app", "DATABASE_URL"],
  ["inventory_auth", "DATABASE_AUTH_URL"],
] as const) {
  if (new RegExp(`^${key}=`, "m").test(envFile)) continue;
  const password = randomBytes(24).toString("hex");
  await pool.query(`alter role ${role} login password '${password}'`);
  const roleUrl = new URL(url.href);
  roleUrl.username = role;
  roleUrl.password = password;
  lines.push(`${key}=${roleUrl.href}`);
}
if (!/^BETTER_AUTH_SECRET=/m.test(envFile)) lines.push(`BETTER_AUTH_SECRET=${randomBytes(32).toString("hex")}`);
if (!/^BETTER_AUTH_URL=/m.test(envFile)) lines.push("BETTER_AUTH_URL=http://localhost:3000");
if (lines.length) appendFileSync(".env.local", `\n${lines.join("\n")}\n`);

await pool.end();
console.log("Done. .env.local is updated.");
