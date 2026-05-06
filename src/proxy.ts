import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only protect /admin/* and /kitchen/* routes
  const isProtectedRoute = pathname.startsWith('/admin') || pathname.startsWith('/kitchen');

  if (!isProtectedRoute) {
    return NextResponse.next();
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session - IMPORTANT: do NOT remove this
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Not logged in — redirect to login
  if (!user) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Check user role from user_roles table
  const { data: userRole } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single();

  const role = userRole?.role;

  // No role assigned — deny access
  if (!role) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('error', 'no_role');
    return NextResponse.redirect(loginUrl);
  }

  // Admin routes require 'admin' role, except for tables/orders which waiters can access
  if (pathname.startsWith('/admin')) {
    const isWaiterAllowedPath = pathname.startsWith('/admin/tables') || pathname.startsWith('/admin/orders');
    if (role !== 'admin' && !(role === 'waiter' && isWaiterAllowedPath)) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('error', 'unauthorized');
      return NextResponse.redirect(loginUrl);
    }
  }

  // Kitchen routes require 'admin' or 'kitchen' role
  if (pathname.startsWith('/kitchen') && role !== 'admin' && role !== 'kitchen') {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('error', 'unauthorized');
    return NextResponse.redirect(loginUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/kitchen/:path*',
  ],
};
