import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/admin/session";

// Optimistic check only (no signature/expiry verification here — that
// happens in the Data Access Layer for every admin page/route). This just
// bounces obviously-unauthenticated requests before they render.
export function proxy(request: NextRequest) {
  const hasSessionCookie = request.cookies.has(SESSION_COOKIE_NAME);
  if (!hasSessionCookie) {
    const loginUrl = new URL("/admin/login", request.url);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  // Every /admin/* route except /admin/login itself (which must stay reachable
  // for an unauthenticated visitor, or this would redirect in a loop).
  matcher: ["/admin", "/admin/((?!login).*)"],
};
