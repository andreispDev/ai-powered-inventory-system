// Provisions the first Developer. They activate by signing in with this Google account.
import pg from "pg";

const email = process.env.BOOTSTRAP_DEVELOPER_EMAIL?.trim().toLowerCase();
const adminUrl = process.env.DATABASE_ADMIN_URL;
if (!email || !adminUrl) {
  console.error("Add BOOTSTRAP_DEVELOPER_EMAIL and DATABASE_ADMIN_URL to .env.local first.");
  process.exit(1);
}

const url = new URL(adminUrl);
url.pathname = "/inventory";
const client = new pg.Client({ connectionString: url.href });
await client.connect();

const { rowCount } = await client.query(
  `insert into app_user (name, email, role) values ($1, $2, 'developer') on conflict (email) do nothing`,
  [email.split("@")[0], email],
);
await client.end();
console.log(rowCount ? `Developer ${email} provisioned.` : `${email} already exists, so nothing changed.`);
