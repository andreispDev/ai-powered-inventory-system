export type SignInUser = { emailVerified: boolean; status: "invited" | "active" | "deactivated" };

/** Decides whether an account may get a session. Everything not listed is denied. */
export function canStartSession(user: SignInUser | undefined): boolean {
  return !!user && user.emailVerified && user.status !== "deactivated";
}

/** An account keeps the Google identity it first signed in with. */
export function canLinkGoogle(existingGoogleSub: string | undefined, incomingSub: string): boolean {
  return existingGoogleSub === undefined || existingGoogleSub === incomingSub;
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/** Sessions roll while in use, but end 7 days after sign-in regardless. */
export function isPastAbsoluteLimit(createdAt: Date, now = new Date()): boolean {
  return now.getTime() - createdAt.getTime() > SEVEN_DAYS_MS;
}
