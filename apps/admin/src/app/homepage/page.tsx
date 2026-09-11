"use client";
import { useCallback, useEffect, useState } from "react";
import { useAdmin, API_BASE } from "@/lib/adminAuth";
import { Modal, Field, Toggle, StatusBadge } from "@/components/ui";

interface SectionItem { id: string; movieId?: string | null; seriesId?: string | null; title?: string | null; kind: string }
interface Section {
  id: string; title: string; type: string; displayOrder: number; isActive: boolean;
  items: SectionItem[]; heroItems: any[];
}

export default function HomepageManager() {
  const { adminFetch, can } = useAdmin();
  const manage = can("home.manage");
  const [sections, setSections] = useState<Section[] | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [itemsFor, setItemsFor] = useState<Section | null>(null);

  const load = useCallback(() => {
    adminFetch("/admin/home/sections").then((r) => r.json()).then((d) => setSections(d.items)).catch(() => setSections([]));
  }, [adminFetch]);
  useEffect(load, [load]);

  const move = async (idx: number, dir: -1 | 1) => {
    if (!sections) return;
    const next = [...sections];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    setSections(next);
    await adminFetch("/admin/home/sections/reorder", { method: "POST", body: JSON.stringify({ order: next.map((s) => s.id) }) });
  };
  const toggle = async (s: Section) => {
    await adminFetch(`/admin/home/sections/${s.id}`, { method: "PATCH", body: JSON.stringify({ isActive: !s.isActive }) });
    load();
  };
  const del = async (s: Section) => {
    if (!confirm(`Delete section "${s.title}"?`)) return;
    await adminFetch(`/admin/home/sections/${s.id}`, { method: "DELETE" });
    load();
  };

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black">Homepage Layout</h1>
          <p className="text-sm text-slate-500">Order, toggle and fill the rows shown on the consumer home screen.</p>
        </div>
        {manage && <button onClick={() => setAddOpen(true)} className="btn-primary">+ Add Section</button>}
      </div>

      {!sections ? <div className="text-slate-400">Loading…</div> : (
        <div className="space-y-3">
          {sections.map((s, i) => (
            <div key={s.id} className={`card flex items-center gap-4 p-4 ${!s.isActive ? "opacity-60" : ""}`}>
              {manage && (
                <div className="flex flex-col">
                  <button onClick={() => move(i, -1)} className="text-slate-400 hover:text-brand">▲</button>
                  <button onClick={() => move(i, 1)} className="text-slate-400 hover:text-brand">▼</button>
                </div>
              )}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold">{s.title}</span>
                  <StatusBadge status={s.type} />
                </div>
                <div className="text-xs text-slate-400">
                  {s.type === "HERO" ? `${s.heroItems.length} banner(s)` :
                   s.type === "CONTINUE_WATCHING" ? "Auto-filled per user" :
                   `${s.items.length} item(s)`}
                </div>
              </div>
              {manage && (
                <div className="flex items-center gap-3">
                  {(s.type === "CAROUSEL" || s.type === "TOP10") && (
                    <button onClick={() => setItemsFor(s)} className="text-sm text-brand hover:underline">Edit items</button>
                  )}
                  <Toggle checked={s.isActive} onChange={() => toggle(s)} />
                  <button onClick={() => del(s)} className="text-sm text-red-500 hover:underline">Delete</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {addOpen && <AddSection onClose={() => setAddOpen(false)} onSaved={() => { setAddOpen(false); load(); }} />}
      {itemsFor && <ItemsEditor section={itemsFor} onClose={() => setItemsFor(null)} onSaved={() => { setItemsFor(null); load(); }} />}
    </div>
  );
}

function AddSection({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { adminFetch } = useAdmin();
  const [title, setTitle] = useState("");
  const [type, setType] = useState("CAROUSEL");
  const save = async () => {
    await adminFetch("/admin/home/sections", { method: "POST", body: JSON.stringify({ title, type }) });
    onSaved();
  };
  return (
    <Modal title="Add Section" onClose={onClose}>
      <div className="space-y-3">
        <Field label="Title"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
        <Field label="Type">
          <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
            {["CAROUSEL", "TOP10", "CONTINUE_WATCHING", "HERO"].map((t) => <option key={t}>{t}</option>)}
          </select>
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={save} disabled={!title} className="btn-primary">Add</button>
        </div>
      </div>
    </Modal>
  );
}

function ItemsEditor({ section, onClose, onSaved }: { section: Section; onClose: () => void; onSaved: () => void }) {
  const { adminFetch } = useAdmin();
  const [pool, setPool] = useState<{ id: string; title: string; kind: string }[]>([]);
  const [selected, setSelected] = useState<{ id: string; title: string; kind: string }[]>(
    section.items.map((i) => ({ id: (i.movieId ?? i.seriesId)!, title: i.title ?? "?", kind: i.kind })),
  );

  useEffect(() => {
    // Draw from the public catalog for a simple, searchable pool.
    Promise.all([
      fetch(`${API_BASE}/movies?limit=50`).then((r) => r.json()),
      fetch(`${API_BASE}/series?limit=50`).then((r) => r.json()),
    ]).then(([m, s]) => {
      setPool([
        ...m.items.map((x: any) => ({ id: x.id, title: x.title, kind: "movie" })),
        ...s.items.map((x: any) => ({ id: x.id, title: x.title, kind: "series" })),
      ]);
    });
  }, []);

  const add = (x: { id: string; title: string; kind: string }) => {
    if (selected.find((s) => s.id === x.id)) return;
    setSelected([...selected, x]);
  };
  const removeAt = (id: string) => setSelected(selected.filter((s) => s.id !== id));
  const moveSel = (idx: number, dir: -1 | 1) => {
    const j = idx + dir; if (j < 0 || j >= selected.length) return;
    const n = [...selected]; [n[idx], n[j]] = [n[j], n[idx]]; setSelected(n);
  };
  const save = async () => {
    await adminFetch(`/admin/home/sections/${section.id}/items`, {
      method: "PUT",
      body: JSON.stringify({ items: selected.map((s) => (s.kind === "movie" ? { movieId: s.id } : { seriesId: s.id })) }),
    });
    onSaved();
  };

  return (
    <Modal title={`Items — ${section.title}`} onClose={onClose} wide>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="label">Catalog</div>
          <div className="h-72 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
            {pool.map((x) => (
              <button key={x.id} onClick={() => add(x)} className="flex w-full items-center justify-between rounded px-2 py-1 text-left text-sm hover:bg-slate-50">
                <span>{x.title}</span>
                <span className="text-xs uppercase text-slate-400">{x.kind}</span>
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="label">In this row (ordered)</div>
          <div className="h-72 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
            {selected.length === 0 && <p className="p-2 text-sm text-slate-400">Add titles from the left.</p>}
            {selected.map((x, i) => (
              <div key={x.id} className="flex items-center gap-2 rounded bg-slate-50 px-2 py-1 text-sm">
                <div className="flex flex-col text-slate-400">
                  <button onClick={() => moveSel(i, -1)} className="hover:text-brand">▲</button>
                  <button onClick={() => moveSel(i, 1)} className="hover:text-brand">▼</button>
                </div>
                <span className="flex-1">{x.title}</span>
                <button onClick={() => removeAt(x.id)} className="text-red-500">✕</button>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onClose} className="btn-ghost">Cancel</button>
        <button onClick={save} className="btn-primary">Save {selected.length} items</button>
      </div>
    </Modal>
  );
}
