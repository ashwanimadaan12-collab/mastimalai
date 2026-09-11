"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAdmin, type Permission } from "@/lib/adminAuth";

const NAV: { href: string; label: string; perm: Permission; icon: string }[] = [
  { href: "/", label: "Dashboard", perm: "dashboard.view", icon: "▤" },
  { href: "/movies", label: "Movies", perm: "content.view", icon: "🎬" },
  { href: "/series", label: "Web Series", perm: "content.view", icon: "📺" },
  { href: "/homepage", label: "Homepage", perm: "home.view", icon: "🏠" },
  { href: "/plans", label: "Plans", perm: "billing.view", icon: "💳" },
  { href: "/subscriptions", label: "Subscriptions", perm: "billing.view", icon: "🧾" },
  { href: "/payments", label: "Payments", perm: "billing.view", icon: "₹" },
  { href: "/users", label: "Users", perm: "users.view", icon: "👥" },
  { href: "/admins", label: "Admins", perm: "admins.manage", icon: "🛡" },
  { href: "/audit", label: "Audit Log", perm: "audit.view", icon: "📝" },
];

export function AppFrame({ children }: { children: ReactNode }) {
  const { me, loading, logout, can } = useAdmin();
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === "/login";

  useEffect(() => {
    if (!loading && !me && !isLogin) router.replace("/login");
    if (!loading && me && isLogin) router.replace("/");
  }, [loading, me, isLogin, router]);

  if (isLogin) return <>{children}</>;

  if (loading || !me)
    return <div className="grid min-h-screen place-items-center text-slate-400">Loading…</div>;

  const items = NAV.filter((n) => can(n.perm));

  return (
    <div className="flex min-h-screen">
      <aside className="fixed hidden h-screen w-60 flex-col bg-sidebar px-3 py-5 text-slate-300 md:flex">
        <div className="px-2 text-xl font-black text-white">
          Masti Malai <span className="text-brand">Admin</span>
        </div>
        <nav className="mt-6 flex flex-1 flex-col gap-1">
          {items.map((n) => {
            const active = pathname === n.href || (n.href !== "/" && pathname.startsWith(n.href));
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                  active ? "bg-brand text-white" : "hover:bg-white/5"
                }`}
              >
                <span className="w-5 text-center">{n.icon}</span>
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto border-t border-white/10 pt-3 text-xs">
          <div className="px-2 text-slate-400">{me.email}</div>
          <div className="px-2 text-brand">{me.role.replace("_", " ")}</div>
        </div>
      </aside>

      <div className="flex-1 md:ml-60">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
          <div className="text-sm text-slate-500">
            {NAV.find((n) => n.href === pathname)?.label ?? "Admin"}
          </div>
          <div className="flex items-center gap-3">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-brand text-sm font-bold text-white">
              {me.name.slice(0, 1)}
            </span>
            <button onClick={logout} className="text-sm text-slate-500 hover:text-red-600">
              Log out
            </button>
          </div>
        </header>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
