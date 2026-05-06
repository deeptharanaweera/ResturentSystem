import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Savoria — Restaurant Management System",
  description: "Premium restaurant management system with real-time kitchen dashboard, digital menu ordering, and billing.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#1a1a2e',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#f1f5f9',
            },
          }}
        />
      </body>
    </html>
  );
}
