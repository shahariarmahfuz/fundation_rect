import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Static assets and internal endpoints are public
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  const sessionToken = request.cookies.get('session_token')?.value;

  // Unauthenticated visitors trying to access private pages are redirected to /login
  if (!sessionToken && pathname !== '/login') {
    const returnUrl = encodeURIComponent(pathname);
    const loginUrl = new URL(`/login?return_url=${returnUrl}`, request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Authenticated visitors visiting /login are redirected to home
  if (sessionToken && pathname === '/login') {
    const homeUrl = new URL('/', request.url);
    return NextResponse.redirect(homeUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static Next.js internals
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
