import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import FloatingVisitBadge from "@/components/common/FloatingVisitBadge";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SMH - School MindX Hub",
  description: "School MindX Hub - Nền tảng quản lý học tập và giảng dạy nội bộ",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
  verification: {
    google: "DJ3D3ajvpMTNuCUgASg_GM4o86X_tBhZRf7QydXzuyc",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        <meta name="google-site-verification" content="DJ3D3ajvpMTNuCUgASg_GM4o86X_tBhZRf7QydXzuyc" />
      </head>
      <body className={`${inter.className} transition-colors duration-300 antialiased`}>
        <ThemeProvider>
          <FloatingVisitBadge />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}