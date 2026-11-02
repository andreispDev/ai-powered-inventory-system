import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/access-denied"];

/** Optimistic check only: real authorization happens next to the data, in requireActor and guard. */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic =
    PUBLIC_PATHS.includes(pathname) ||
    (process.env.NODE_ENV !== "production" && pathname.startsWith("/dev/"));

  if (!isPublic && !getSessionCookie(request)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", crypto.randomUUID());
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!api/|_next/static|_next/image|images/|favicon.ico).*)"],
};
