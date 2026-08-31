import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protect /admin/* and /kitchen/* routes
  const isProtectedRoute = pathname.startsWith('/admin') || pathname.startsWith('/kitchen') || pathname.startsWith('/pos');

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

  // Super Admin & Admin have access to everything
  const isAdmin = role === 'admin' || role === 'super_admin';
  if (isAdmin) {
    return supabaseResponse;
  }

  // Paths accessible to ALL authenticated users with any valid role
  const isAllRolePath =
    pathname === '/admin' ||
    pathname === '/admin/' ||
    pathname === '/admin/profile' ||
    pathname.startsWith('/admin/profile/');

  if (isAllRolePath) {
    return supabaseResponse;
  }

  // Default baseline permissions per role
  let isDefaultAllowed = false;
  if (role === 'pos' && (pathname === '/pos' || pathname.startsWith('/pos/'))) {
    isDefaultAllowed = true;
  } else if (role === 'kitchen' && (pathname === '/kitchen' || pathname.startsWith('/kitchen/'))) {
    isDefaultAllowed = true;
  } else if (role === 'waiter' && (pathname.startsWith('/admin/tables') || pathname.startsWith('/admin/orders') || pathname.startsWith('/kitchen'))) {
    isDefaultAllowed = true;
  }

  if (isDefaultAllowed) {
    return supabaseResponse;
  }

  // Dynamic permission check: verify if this role was granted access to pathname in role_menu_permissions table
  const { data: perm } = await supabase
    .from('role_menu_permissions')
    .select('id, sidebar_menu_items!inner(href)')
    .eq('role', role)
    .eq('sidebar_menu_items.href', pathname)
    .maybeSingle();

  if (perm) {
    return supabaseResponse;
  }

  // Deny access if no permission found
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('error', 'unauthorized');
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/kitchen/:path*',
    '/pos/:path*',
  ],
};
