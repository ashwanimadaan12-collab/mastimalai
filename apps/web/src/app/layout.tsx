import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = {
  title: {
    default: "Masti Malai OTT — Entertainment Ka Full Tadka",
    template: "%s — Masti Malai OTT",
  },
  description:
    "Stream movies, web series, originals and regional content in Hindi, Punjabi, Tamil, Telugu, Bengali and more on Masti Malai OTT.",
  openGraph: {
    siteName: "Masti Malai OTT",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-base text-gray-100">
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
