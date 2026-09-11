"use client";
// Gates the whole web app behind an active subscription:
//   not logged in            -> /login  (enter mobile -> Continue)
//   logged in, no active sub -> /subscription
//   logged in + active sub   -> full app (home, browse, watch, …)
// From /login, "Continue" decides: an active customer gets an OTP and logs in; a
// new/lapsed one is sent to /subscription (no OTP). /subscription stays reachable
// while logged out so that no-OTP flow can complete.
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { Header } from "./Header";

// Always reachable regardless of auth/subscription (legal + support).
const ALWAYS = ["/terms", "/privacy", "/help", "/contact", "/refund"];

export function AppShell({ children }: { children: ReactNode }) {
  const { loading, loggedIn, me } = useAuth();
  const active = me?.subscription.isActive ?? false;
  const pathname = usePathname();
  const router = useRouter();

  const isAlways = ALWAYS.includes(pathname);
  // When logged out, both the subscription page (default) and login are reachable.
  const loggedOutOk = pathname === "/subscription" || pathname === "/login";

  // Is the current path allowed for the current auth/subscription state?
  const allowed =
    isAlways ||
    (!loggedIn && loggedOutOk) ||
    (loggedIn && !active && pathname === "/subscription") ||
    (loggedIn && active && pathname !== "/login" && pathname !== "/subscription");

  useEffect(() => {
    if (loading || isAlways) return;
    if (!loggedIn) {
      if (!loggedOutOk) router.replace("/login");
    } else if (!active) {
      if (pathname !== "/subscription") router.replace("/subscription");
    } else if (pathname === "/login" || pathname === "/subscription") {
      router.replace("/");
    }
  }, [loading, loggedIn, active, pathname, isAlways, loggedOutOk, router]);

  // Header only in the full app (not on the login/subscription gates).
  const showHeader = !loading && loggedIn && active && pathname !== "/login";

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-base">
        <div className="brand-gradient animate-pulse text-2xl font-black">Masti Malai</div>
      </div>
    );
  }

  return (
    <>
      {showHeader && <Header />}
      {allowed ? (
        <main>{children}</main>
      ) : (
        // A brief holding state while the redirect effect runs.
        <div className="grid min-h-screen place-items-center bg-base">
          <div className="brand-gradient animate-pulse text-2xl font-black">Masti Malai</div>
        </div>
      )}
      {showHeader && (
        <footer className="mt-16 border-t border-white/5 px-4 py-8 text-sm text-muted sm:px-8">
          <div className="brand-gradient mb-2 text-lg font-black">Masti Malai</div>
          <p>Entertainment Ka Full Tadka.</p>
          <div className="mt-3 flex flex-wrap gap-4">
            <a href="/help" className="hover:text-white">Help</a>
            <a href="/terms" className="hover:text-white">Terms</a>
            <a href="/privacy" className="hover:text-white">Privacy</a>
            <a href="/subscription" className="hover:text-white">Plans</a>
          </div>
        </footer>
      )}
    </>
  );
}
