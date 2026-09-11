"use client";
import { useEffect, useState } from "react";
import { useAdmin } from "@/lib/adminAuth";
import { StatusBadge, EmptyRow, dateFmt } from "@/components/ui";

interface Row {
  id: string; mobile: string; email?: string | null; profiles: number; createdAt: string;
  subscription: { status: string; isActive: boolean; planName?: string | null };
}

export default function UsersPage() {
  const { adminFetch, can } = useAdmin();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [q, setQ] = useState("");

  const load = () => {
    const p = new URLSearchParams(); if (q) p.set("q", q);
    adminFetch(`/admin/users?${p}`).then((r) => r.json()).then((d) => setRows(d.items)).catch(() => setRows([]));
  };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const suspend = async (id: string) => {
    if (!confirm("Suspend this user? All their sessions will be revoked.")) return;
    await adminFetch(`/admin/users/${id}/suspend`, { method: "POST" });
    alert("Sessions revoked.");
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-black">Users</h1>
      <form onSubmit={(e) => { e.preventDefault(); load(); }} className="flex gap-2">
        <input className="input w-64" placeholder="Search by mobile…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn-ghost">Search</button>
      </form>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr><th className="px-4 py-3">Mobile</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Profiles</th><th className="px-4 py-3">Subscription</th><th className="px-4 py-3">Joined</th><th className="px-4 py-3"></th></tr>
          </thead>
          <tbody>
            {!rows ? <EmptyRow colSpan={6} text="Loading…" /> : rows.length === 0 ? <EmptyRow colSpan={6} text="No users." /> :
              rows.map((u) => (
                <tr key={u.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium">{u.mobile}</td>
                  <td className="px-4 py-3 text-slate-500">{u.email ?? "—"}</td>
                  <td className="px-4 py-3">{u.profiles}</td>
                  <td className="px-4 py-3">
                    {u.subscription.isActive ? <StatusBadge status="ACTIVE" /> : <StatusBadge status={u.subscription.status} />}
                    {u.subscription.planName && <span className="ml-2 text-xs text-slate-400">{u.subscription.planName}</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-400">{dateFmt(u.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    {can("users.manage") && <button onClick={() => suspend(u.id)} className="text-sm text-red-500 hover:underline">Suspend</button>}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
