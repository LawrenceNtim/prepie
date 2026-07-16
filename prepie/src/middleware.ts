import { NextResponse, type NextRequest } from "next/server";
import { isAuthorized } from "@/lib/site-lock";

// Single-user site lock. See src/lib/site-lock.ts for the rules; this file
// only wires it to the request pipeline and the browser's Basic Auth prompt.
export function middleware(request: NextRequest) {
  if (
    isAuthorized(request.headers.get("authorization"), process.env.SITE_PASSWORD)
  ) {
    return NextResponse.next();
  }
  return new NextResponse("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="prepie"' },
  });
}

export const config = {
  // Everything except Next's static assets. The .ics API route stays behind
  // the lock on purpose — downloads happen from an already-authed browser.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
