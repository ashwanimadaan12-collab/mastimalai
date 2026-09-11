"use client";
import { useEffect, useState } from "react";
import { useAdmin } from "@/lib/adminAuth";
import { StatusBadge, EmptyRow, dateFmt, rupees } from "@/components/ui";

export default function PaymentsPage() {
  const { adminFetch } = useAdmin();
  const [rows, setRows] = useState<any[] | null>(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const p = new URLSearchParams(); if (status) p.set("status", status);
    adminFetch(`/admin/billing/payments?${p}`).then((r) => r.json()).then((d) => setRows(d.items)).catch(() => setRows([]));
  }, [status, adminFetch]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-black">Payments</h1>
      <select className="input w-44" value={status} onChange={(e) => setStatus(e.target.value)}>
        <option value="">All statuses</option>
        {["SUCCESS", "CREATED", "PENDING", "FAILED"].map((s) => <option key={s}>{s}</option>)}
      </select>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr><th className="px-4 py-3">User</th><th className="px-4 py-3">Plan</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Order</th><th className="px-4 py-3">Date</th></tr>
          </thead>
          <tbody>
            {!rows ? <EmptyRow colSpan={6} text="Loading…" /> : rows.length === 0 ? <EmptyRow colSpan={6} text="No payments." /> :
              rows.map((p) => (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium">{p.mobile}</td>
                  <td className="px-4 py-3">{p.plan}</td>
                  <td className="px-4 py-3">{rupees(p.amount)}</td>
                  <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-400">{p.orderId}</td>
                  <td className="px-4 py-3 text-slate-400">{dateFmt(p.createdAt)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
