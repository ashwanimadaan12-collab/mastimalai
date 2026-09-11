import type { Metadata } from "next";
import "./globals.css";
import { AdminAuthProvider } from "@/lib/adminAuth";
import { AppFrame } from "@/components/AppFrame";

export const metadata: Metadata = {
  title: "Masti Malai Admin",
  description: "Content & subscription management for Masti Malai OTT.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AdminAuthProvider>
          <AppFrame>{children}</AppFrame>
        </AdminAuthProvider>
      </body>
    </html>
  );
}
