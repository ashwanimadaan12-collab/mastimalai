"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAdmin } from "@/lib/adminAuth";
import { StatusBadge, EmptyRow, dateFmt } from "@/components/ui";

interface Row {
  id: string;
  title: string;
  slug: string;
  access: string;
  status: string;
  year?: number | null;
  language?: { name: string } | null;
  createdAt: string;
}

export default function MoviesList() {
  const { adminFetch, can } = useAdmin();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");

  const load = () => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (status) p.set("status", status);
    adminFetch(`/admin/content/movies?${p}`)
      .then((r) => r.json())
      .then((d) => setRows(d.items))
      .catch(() => setRows([]));
  };
  useEffect(load, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black">Movies</h1>
        {can("content.manage") && (
          <Link href="/movies/new" className="btn-primary">+ New Movie</Link>
        )}
      </div>

      <div className="flex gap-2">
        <form onSubmit={(e) => { e.preventDefault(); load(); }} className="flex gap-2">
          <input className="input w-64" placeholder="Search title…" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="btn-ghost">Search</button>
        </form>
        <select className="input w-44" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {["DRAFT", "PUBLISHED", "SCHEDULED", "UNPUBLISHED", "ARCHIVED"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Access</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Year</th>
              <th className="px-4 py-3">Language</th>
              <th className="px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody>
            {!rows ? (
              <EmptyRow colSpan={6} text="Loading…" />
            ) : rows.length === 0 ? (
              <EmptyRow colSpan={6} text="No movies found." />
            ) : (
              rows.map((m) => (
                <tr key={m.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/movies/${m.id}`} className="font-semibold text-ink hover:text-brand">
                      {m.title}
                    </Link>
                    <div className="text-xs text-slate-400">/{m.slug}</div>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={m.access} /></td>
                  <td className="px-4 py-3"><StatusBadge status={m.status} /></td>
                  <td className="px-4 py-3">{m.year ?? "—"}</td>
                  <td className="px-4 py-3">{m.language?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-400">{dateFmt(m.createdAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
