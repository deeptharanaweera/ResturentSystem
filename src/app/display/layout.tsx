import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Order Status Display | Live Kitchen Progress',
  description: 'Live order tracking and pickup status board for customers',
};

export default function DisplayLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-[#07080f] text-white select-none overflow-hidden">{children}</div>;
}
