import "server-only";
import { getAuthDb } from "../db/client";
import { env } from "../env";
import { buildAuth } from "./build";
import { sendSignInCode } from "./mailer";

function createAuth() {
  const { BETTER_AUTH_SECRET, BETTER_AUTH_URL } = env();
  return buildAuth({
    db: getAuthDb(),
    secret: BETTER_AUTH_SECRET,
    baseURL: BETTER_AUTH_URL,
    sendCode: sendSignInCode,
  });
}

let instance: ReturnType<typeof createAuth> | undefined;

export function getAuth() {
  return (instance ??= createAuth());
}
