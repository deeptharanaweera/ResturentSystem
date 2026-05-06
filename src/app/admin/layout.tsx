import AdminSidebar from '@/components/layout/AdminSidebar';

export const dynamic = 'force-dynamic';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminSidebar>{children}</AdminSidebar>;
}
