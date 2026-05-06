// Force all admin routes to be dynamic (no static prerendering)
// This is needed because they use Supabase client which requires env vars at build time
export const dynamic = 'force-dynamic';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
