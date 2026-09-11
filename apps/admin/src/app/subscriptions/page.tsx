"use client";
import { useEffect, useState } from "react";
import { useAdmin } from "@/lib/adminAuth";
import { StatusBadge, EmptyRow, dateFmt } from "@/components/ui";

export default function SubscriptionsPage() {
  const { adminFetch } = useAdmin();
  const [rows, setRows] = useState<any[] | null>(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const p = new URLSearchParams(); if (status) p.set("status", status);
    adminFetch(`/admin/billing/subscriptions?${p}`).then((r) => r.json()).then((d) => setRows(d.items)).catch(() => setRows([]));
  }, [status, adminFetch]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-black">Subscriptions</h1>
      <select className="input w-44" value={status} onChange={(e) => setStatus(e.target.value)}>
        <option value="">All statuses</option>
        {["ACTIVE", "EXPIRED", "CANCELLED", "PENDING", "FAILED"].map((s) => <option key={s}>{s}</option>)}
      </select>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr><th className="px-4 py-3">User</th><th className="px-4 py-3">Plan</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Started</th><th className="px-4 py-3">Expires</th></tr>
          </thead>
          <tbody>
            {!rows ? <EmptyRow colSpan={5} text="Loading…" /> : rows.length === 0 ? <EmptyRow colSpan={5} text="No subscriptions." /> :
              rows.map((s) => (
                <tr key={s.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium">{s.mobile}</td>
                  <td className="px-4 py-3">{s.plan}</td>
                  <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                  <td className="px-4 py-3 text-slate-400">{dateFmt(s.startedAt)}</td>
                  <td className="px-4 py-3 text-slate-400">{dateFmt(s.expiresAt)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
