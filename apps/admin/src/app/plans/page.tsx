"use client";
import { useEffect, useState } from "react";
import { useAdmin } from "@/lib/adminAuth";
import { Modal, Field, Toggle, StatusBadge, PlatformPicker, rupees } from "@/components/ui";

interface Plan {
  id: string; name: string; priceInPaise: number; compareAtPriceInPaise?: number | null;
  currency: string; durationDays: number; description?: string | null; features: string[];
  isActive: boolean; isRecommended: boolean; displayOrder: number; platforms?: string[];
}

export default function PlansPage() {
  const { adminFetch, can } = useAdmin();
  const manage = can("billing.manage");
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [edit, setEdit] = useState<Plan | "new" | null>(null);

  const load = () => { adminFetch("/admin/billing/plans").then((r) => r.json()).then((d) => setPlans(d.items)).catch(() => setPlans([])); };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const del = async (p: Plan) => {
    if (!confirm(`Delete plan "${p.name}"? (Plans with subscriptions are deactivated instead.)`)) return;
    await adminFetch(`/admin/billing/plans/${p.id}`, { method: "DELETE" });
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black">Subscription Plans</h1>
        {manage && <button onClick={() => setEdit("new")} className="btn-primary">+ New Plan</button>}
      </div>
      {!plans ? <div className="text-slate-400">Loading…</div> : (
        <div className="grid gap-4 sm:grid-cols-3">
          {plans.map((p) => (
            <div key={p.id} className={`card p-5 ${p.isRecommended ? "ring-2 ring-brand" : ""}`}>
              <div className="flex items-center justify-between">
                <h3 className="font-bold">{p.name}</h3>
                <StatusBadge status={p.isActive ? "ACTIVE" : "EXPIRED"} />
              </div>
              <div className="mt-2 text-2xl font-black">{rupees(p.priceInPaise)}</div>
              <div className="text-xs text-slate-400">{p.durationDays} days{p.isRecommended ? " · recommended" : ""}</div>
              <ul className="mt-3 space-y-1 text-sm text-slate-600">
                {p.features.map((f) => <li key={f}>• {f}</li>)}
              </ul>
              {manage && (
                <div className="mt-4 flex gap-3 text-sm">
                  <button onClick={() => setEdit(p)} className="text-brand hover:underline">Edit</button>
                  <button onClick={() => del(p)} className="text-red-500 hover:underline">Delete</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {edit && <PlanModal plan={edit === "new" ? null : edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />}
    </div>
  );
}

function PlanModal({ plan, onClose, onSaved }: { plan: Plan | null; onClose: () => void; onSaved: () => void }) {
  const { adminFetch } = useAdmin();
  const [f, setF] = useState<any>({
    name: plan?.name ?? "", priceRupees: plan ? plan.priceInPaise / 100 : "",
    compareRupees: plan?.compareAtPriceInPaise ? plan.compareAtPriceInPaise / 100 : "",
    durationDays: plan?.durationDays ?? "", description: plan?.description ?? "",
    features: (plan?.features ?? []).join("\n"), isActive: plan?.isActive ?? true,
    isRecommended: plan?.isRecommended ?? false, displayOrder: plan?.displayOrder ?? 0,
    platforms: plan?.platforms ?? ["WEB", "ANDROID"],
  });
  const set = (k: string, v: unknown) => setF((p: any) => ({ ...p, [k]: v }));
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");

  const save = async () => {
    setBusy(true); setErr("");
    const payload = {
      name: f.name, priceInPaise: Math.round(Number(f.priceRupees) * 100),
      compareAtPriceInPaise: f.compareRupees ? Math.round(Number(f.compareRupees) * 100) : null,
      durationDays: Number(f.durationDays), description: f.description || null,
      features: f.features.split("\n").map((x: string) => x.trim()).filter(Boolean),
      isActive: f.isActive, isRecommended: f.isRecommended, displayOrder: Number(f.displayOrder),
      platforms: f.platforms,
    };
    const res = plan
      ? await adminFetch(`/admin/billing/plans/${plan.id}`, { method: "PATCH", body: JSON.stringify(payload) })
      : await adminFetch("/admin/billing/plans", { method: "POST", body: JSON.stringify(payload) });
    setBusy(false);
    if (!res.ok) { const e = await res.json().catch(() => null); return setErr(e?.error?.message ?? "Save failed"); }
    onSaved();
  };

  return (
    <Modal title={plan ? "Edit Plan" : "New Plan"} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Name"><input className="input" value={f.name} onChange={(e) => set("name", e.target.value)} /></Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Price ₹"><input className="input" value={f.priceRupees} onChange={(e) => set("priceRupees", e.target.value)} /></Field>
          <Field label="Compare ₹"><input className="input" value={f.compareRupees} onChange={(e) => set("compareRupees", e.target.value)} /></Field>
          <Field label="Days"><input className="input" value={f.durationDays} onChange={(e) => set("durationDays", e.target.value)} /></Field>
        </div>
        <Field label="Description"><input className="input" value={f.description} onChange={(e) => set("description", e.target.value)} /></Field>
        <Field label="Features (one per line)"><textarea className="input h-24" value={f.features} onChange={(e) => set("features", e.target.value)} /></Field>
        <div>
          <span className="label">Available on (platforms)</span>
          <PlatformPicker value={f.platforms} onChange={(v) => set("platforms", v)} />
        </div>
        <div className="flex gap-6">
          <Toggle checked={f.isActive} onChange={(v) => set("isActive", v)} label="Active" />
          <Toggle checked={f.isRecommended} onChange={(v) => set("isRecommended", v)} label="Recommended" />
          <Field label="Order"><input className="input w-16" value={f.displayOrder} onChange={(e) => set("displayOrder", e.target.value)} /></Field>
        </div>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={save} disabled={busy} className="btn-primary">{busy ? "Saving…" : "Save"}</button>
        </div>
      </div>
    </Modal>
  );
}
