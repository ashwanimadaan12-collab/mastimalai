"use client";
import { useEffect, useState } from "react";
import { useAdmin } from "@/lib/adminAuth";
import { Modal, Field, StatusBadge, EmptyRow, dateFmt } from "@/components/ui";

const ROLES = ["SUPER_ADMIN", "CONTENT_ADMIN", "MARKETING_ADMIN", "SUPPORT_ADMIN", "ANALYST"];

export default function AdminsPage() {
  const { adminFetch, me } = useAdmin();
  const [rows, setRows] = useState<any[] | null>(null);
  const [edit, setEdit] = useState<any | "new" | null>(null);

  const load = () => { adminFetch("/admin/admins").then((r) => r.json()).then((d) => setRows(d.items)).catch(() => setRows([])); };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black">Admin Users</h1>
        <button onClick={() => setEdit("new")} className="btn-primary">+ New Admin</button>
      </div>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Last login</th><th className="px-4 py-3"></th></tr>
          </thead>
          <tbody>
            {!rows ? <EmptyRow colSpan={6} text="Loading…" /> :
              rows.map((a) => (
                <tr key={a.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium">{a.name}{a.id === me?.id && <span className="ml-1 text-xs text-brand">(you)</span>}</td>
                  <td className="px-4 py-3 text-slate-500">{a.email}</td>
                  <td className="px-4 py-3"><span className="text-xs font-semibold">{a.role.replace("_", " ")}</span></td>
                  <td className="px-4 py-3"><StatusBadge status={a.isActive ? "ACTIVE" : "EXPIRED"} /></td>
                  <td className="px-4 py-3 text-slate-400">{dateFmt(a.lastLoginAt)}</td>
                  <td className="px-4 py-3 text-right"><button onClick={() => setEdit(a)} className="text-brand hover:underline">Edit</button></td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {edit && <AdminModal admin={edit === "new" ? null : edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />}
    </div>
  );
}

function AdminModal({ admin, onClose, onSaved }: { admin: any | null; onClose: () => void; onSaved: () => void }) {
  const { adminFetch } = useAdmin();
  const [f, setF] = useState<any>({ email: admin?.email ?? "", name: admin?.name ?? "", role: admin?.role ?? "CONTENT_ADMIN", password: "", isActive: admin?.isActive ?? true });
  const set = (k: string, v: unknown) => setF((p: any) => ({ ...p, [k]: v }));
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");

  const save = async () => {
    setBusy(true); setErr("");
    let res: Response;
    if (admin) {
      const payload: any = { name: f.name, role: f.role, isActive: f.isActive };
      if (f.password) payload.password = f.password;
      res = await adminFetch(`/admin/admins/${admin.id}`, { method: "PATCH", body: JSON.stringify(payload) });
    } else {
      res = await adminFetch("/admin/admins", { method: "POST", body: JSON.stringify({ email: f.email, name: f.name, role: f.role, password: f.password }) });
    }
    setBusy(false);
    if (!res.ok) { const e = await res.json().catch(() => null); return setErr(e?.error?.message ?? "Save failed"); }
    onSaved();
  };

  return (
    <Modal title={admin ? "Edit Admin" : "New Admin"} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Email"><input className="input" value={f.email} disabled={!!admin} onChange={(e) => set("email", e.target.value)} /></Field>
        <Field label="Name"><input className="input" value={f.name} onChange={(e) => set("name", e.target.value)} /></Field>
        <Field label="Role">
          <select className="input" value={f.role} onChange={(e) => set("role", e.target.value)}>
            {ROLES.map((r) => <option key={r}>{r}</option>)}
          </select>
        </Field>
        <Field label={admin ? "New password (leave blank to keep)" : "Password (min 8)"}>
          <input className="input" type="password" value={f.password} onChange={(e) => set("password", e.target.value)} />
        </Field>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={save} disabled={busy} className="btn-primary">{busy ? "Saving…" : "Save"}</button>
        </div>
      </div>
    </Modal>
  );
}
