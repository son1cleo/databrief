import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  if (!req.auth) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Forwarded so (app)/layout.tsx can branch on the current route without
  // a client component (e.g. to skip the dashboard chrome on /onboarding).
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", req.nextUrl.pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/upload/:path*",
    "/reports/:path*",
    "/settings/:path*",
    "/onboarding/:path*",
    "/brand-kit/:path*",
  ],
};
