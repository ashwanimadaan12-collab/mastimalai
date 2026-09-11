"use client";
import { useEffect, useState } from "react";
import { useAdmin } from "@/lib/adminAuth";
import { rupees, dateFmt, StatusBadge } from "@/components/ui";

interface Dashboard {
  kpis: {
    totalUsers: number;
    newUsers24h: number;
    activeSubscribers: number;
    publishedTitles: number;
    revenueTodayPaise: number;
    revenueMonthPaise: number;
  };
  recentUsers: { id: string; mobile: string; email?: string | null; createdAt: string }[];
  recentPayments: { id: string; mobile: string; plan: string; amount: number; status: string; createdAt: string }[];
}

export default function DashboardPage() {
  const { adminFetch } = useAdmin();
  const [d, setD] = useState<Dashboard | null>(null);

  useEffect(() => {
    adminFetch("/admin/dashboard").then((r) => r.json()).then(setD).catch(() => setD(null));
  }, [adminFetch]);

  if (!d) return <div className="text-slate-400">Loading dashboard…</div>;

  const cards = [
    { label: "Total Users", value: d.kpis.totalUsers.toLocaleString("en-IN") },
    { label: "New (24h)", value: d.kpis.newUsers24h.toLocaleString("en-IN") },
    { label: "Active Subscribers", value: d.kpis.activeSubscribers.toLocaleString("en-IN") },
    { label: "Published Titles", value: d.kpis.publishedTitles.toLocaleString("en-IN") },
    { label: "Revenue Today", value: rupees(d.kpis.revenueTodayPaise) },
    { label: "Revenue This Month", value: rupees(d.kpis.revenueMonthPaise) },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black">Dashboard</h1>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="card p-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{c.label}</div>
            <div className="mt-2 text-2xl font-black text-ink">{c.value}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card overflow-hidden">
          <h2 className="border-b border-slate-100 px-4 py-3 font-bold">Recent Signups</h2>
          <table className="w-full text-sm">
            <tbody>
              {d.recentUsers.map((u) => (
                <tr key={u.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-2.5 font-medium">{u.mobile}</td>
                  <td className="px-4 py-2.5 text-slate-500">{u.email ?? "—"}</td>
                  <td className="px-4 py-2.5 text-right text-slate-400">{dateFmt(u.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card overflow-hidden">
          <h2 className="border-b border-slate-100 px-4 py-3 font-bold">Latest Payments</h2>
          <table className="w-full text-sm">
            <tbody>
              {d.recentPayments.map((p) => (
                <tr key={p.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-2.5 font-medium">{p.mobile}</td>
                  <td className="px-4 py-2.5 text-slate-500">{p.plan}</td>
                  <td className="px-4 py-2.5">{rupees(p.amount)}</td>
                  <td className="px-4 py-2.5 text-right"><StatusBadge status={p.status} /></td>
                </tr>
              ))}
              {d.recentPayments.length === 0 && (
                <tr><td className="px-4 py-6 text-center text-slate-400">No payments yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
