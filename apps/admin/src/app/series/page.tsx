"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAdmin } from "@/lib/adminAuth";
import { StatusBadge, EmptyRow, dateFmt } from "@/components/ui";

interface Row {
  id: string; title: string; slug: string; access: string; status: string;
  year?: number | null; _count?: { seasons: number }; createdAt: string;
}

export default function SeriesList() {
  const { adminFetch, can } = useAdmin();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const p = new URLSearchParams();
    if (status) p.set("status", status);
    adminFetch(`/admin/content/series?${p}`).then((r) => r.json()).then((d) => setRows(d.items)).catch(() => setRows([]));
  }, [status, adminFetch]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black">Web Series</h1>
        {can("content.manage") && <Link href="/series/new" className="btn-primary">+ New Series</Link>}
      </div>
      <select className="input w-44" value={status} onChange={(e) => setStatus(e.target.value)}>
        <option value="">All statuses</option>
        {["DRAFT", "PUBLISHED", "SCHEDULED", "UNPUBLISHED", "ARCHIVED"].map((s) => <option key={s}>{s}</option>)}
      </select>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr><th className="px-4 py-3">Title</th><th className="px-4 py-3">Access</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Seasons</th><th className="px-4 py-3">Created</th></tr>
          </thead>
          <tbody>
            {!rows ? <EmptyRow colSpan={5} text="Loading…" /> : rows.length === 0 ? <EmptyRow colSpan={5} text="No series found." /> :
              rows.map((s) => (
                <tr key={s.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/series/${s.id}`} className="font-semibold text-ink hover:text-brand">{s.title}</Link>
                    <div className="text-xs text-slate-400">/{s.slug}</div>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={s.access} /></td>
                  <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                  <td className="px-4 py-3">{s._count?.seasons ?? 0}</td>
                  <td className="px-4 py-3 text-slate-400">{dateFmt(s.createdAt)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
