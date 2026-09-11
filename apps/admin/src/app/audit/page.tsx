"use client";
import { useEffect, useState } from "react";
import { useAdmin } from "@/lib/adminAuth";
import { EmptyRow } from "@/components/ui";

export default function AuditPage() {
  const { adminFetch } = useAdmin();
  const [rows, setRows] = useState<any[] | null>(null);
  useEffect(() => {
    adminFetch("/admin/dashboard/audit?limit=100").then((r) => r.json()).then((d) => setRows(d.items)).catch(() => setRows([]));
  }, [adminFetch]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-black">Audit Log</h1>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr><th className="px-4 py-3">When</th><th className="px-4 py-3">Admin</th><th className="px-4 py-3">Action</th><th className="px-4 py-3">Summary</th></tr>
          </thead>
          <tbody>
            {!rows ? <EmptyRow colSpan={4} text="Loading…" /> : rows.length === 0 ? <EmptyRow colSpan={4} text="No activity yet." /> :
              rows.map((a) => (
                <tr key={a.id} className="border-t border-slate-100">
                  <td className="px-4 py-2.5 whitespace-nowrap text-slate-400">{new Date(a.createdAt).toLocaleString("en-IN")}</td>
                  <td className="px-4 py-2.5">{a.adminName}</td>
                  <td className="px-4 py-2.5"><code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{a.action}</code></td>
                  <td className="px-4 py-2.5 text-slate-600">{a.summary}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
