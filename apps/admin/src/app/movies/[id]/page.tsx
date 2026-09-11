"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAdmin } from "@/lib/adminAuth";
import { Field, Toggle, PlatformPicker } from "@/components/ui";
import { VideoPanel } from "@/components/VideoPanel";

interface Genre { id: string; name: string; slug: string }
interface Language { id: string; name: string; code: string }
interface CastRow { name: string; character?: string | null; role: string; order: number }

const STATUSES = ["DRAFT", "PUBLISHED", "SCHEDULED", "UNPUBLISHED", "ARCHIVED"];

export default function MovieEditor() {
  const { adminFetch, can } = useAdmin();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const isNew = params.id === "new";
  const readOnly = !can("content.manage");

  const [genres, setGenres] = useState<Genre[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [loaded, setLoaded] = useState(isNew);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const [form, setForm] = useState<any>({
    title: "", slug: "", description: "", poster: "", backdrop: "", trailerUrl: "",
    year: "", durationSec: "", ageRating: "", rating: "", access: "FREE", status: "DRAFT",
    isFeatured: false, isTrending: false, isTop10: false, publishAt: "",
    platforms: ["WEB", "ANDROID"] as string[],
    languageId: "", genreIds: [] as string[], streamUrl: "",
    seoTitle: "", seoDescription: "", cast: [] as CastRow[],
  });
  const set = (k: string, v: unknown) => setForm((f: any) => ({ ...f, [k]: v }));

  useEffect(() => {
    adminFetch("/admin/content/genres").then((r) => r.json()).then((d) => setGenres(d.items));
    adminFetch("/admin/content/languages").then((r) => r.json()).then((d) => setLanguages(d.items));
  }, [adminFetch]);

  useEffect(() => {
    if (isNew) return;
    adminFetch(`/admin/content/movies/${params.id}`)
      .then((r) => r.json())
      .then((m) => {
        setForm({
          title: m.title, slug: m.slug, description: m.description ?? "",
          poster: m.poster ?? "", backdrop: m.backdrop ?? "", trailerUrl: m.trailerUrl ?? "",
          year: m.year ?? "", durationSec: m.durationSec ?? "", ageRating: m.ageRating ?? "",
          rating: m.rating ?? "", access: m.access, status: m.status,
          isFeatured: m.isFeatured, isTrending: m.isTrending, isTop10: m.isTop10,
          platforms: m.platforms ?? ["WEB", "ANDROID"],
          publishAt: m.publishAt ? m.publishAt.slice(0, 16) : "",
          languageId: m.languageId ?? "", genreIds: m.genres.map((g: Genre) => g.id),
          streamUrl: m.videoAsset?.streamUrl ?? "",
          seoTitle: m.seoTitle ?? "", seoDescription: m.seoDescription ?? "",
          cast: m.cast.map((c: any) => ({ name: c.name, character: c.character, role: c.role, order: c.order })),
        });
        setLoaded(true);
      });
  }, [isNew, params.id, adminFetch]);

  const slugAuto = useMemo(
    () => form.title.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    [form.title],
  );

  const save = async () => {
    setSaving(true);
    setMsg("");
    const payload: any = {
      ...form,
      slug: form.slug || slugAuto,
      year: form.year ? Number(form.year) : null,
      durationSec: form.durationSec ? Number(form.durationSec) : null,
      rating: form.rating ? Number(form.rating) : null,
      publishAt: form.publishAt ? new Date(form.publishAt).toISOString() : null,
      languageId: form.languageId || null,
      streamUrl: form.streamUrl || null,
    };
    const res = isNew
      ? await adminFetch("/admin/content/movies", { method: "POST", body: JSON.stringify(payload) })
      : await adminFetch(`/admin/content/movies/${params.id}`, { method: "PATCH", body: JSON.stringify(payload) });
    setSaving(false);
    if (!res.ok) {
      const e = await res.json().catch(() => null);
      return setMsg(e?.error?.message ?? "Save failed");
    }
    const m = await res.json();
    if (isNew) router.replace(`/movies/${m.id}`);
    else setMsg("Saved ✓");
  };

  const remove = async () => {
    if (!confirm("Delete this movie permanently?")) return;
    const res = await adminFetch(`/admin/content/movies/${params.id}`, { method: "DELETE" });
    if (res.ok) router.replace("/movies");
  };

  if (!loaded) return <div className="text-slate-400">Loading…</div>;

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black">{isNew ? "New Movie" : form.title || "Edit Movie"}</h1>
        <button onClick={() => router.push("/movies")} className="btn-ghost">← Back</button>
      </div>

      <div className="card space-y-4 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Title">
            <input className="input" value={form.title} onChange={(e) => set("title", e.target.value)} disabled={readOnly} />
          </Field>
          <Field label="Slug (URL)">
            <input className="input" value={form.slug} placeholder={slugAuto} onChange={(e) => set("slug", e.target.value)} disabled={readOnly} />
          </Field>
        </div>
        <Field label="Description">
          <textarea className="input h-24" value={form.description} onChange={(e) => set("description", e.target.value)} disabled={readOnly} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Poster URL"><input className="input" value={form.poster} onChange={(e) => set("poster", e.target.value)} disabled={readOnly} /></Field>
          <Field label="Backdrop URL"><input className="input" value={form.backdrop} onChange={(e) => set("backdrop", e.target.value)} disabled={readOnly} /></Field>
        </div>
        <Field label="Stream URL (HLS .m3u8)">
          <input className="input" value={form.streamUrl} onChange={(e) => set("streamUrl", e.target.value)} disabled={readOnly}
            placeholder="https://…/master.m3u8 — dev stub for the transcoder" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="Year"><input className="input" value={form.year} onChange={(e) => set("year", e.target.value)} disabled={readOnly} /></Field>
          <Field label="Duration (sec)"><input className="input" value={form.durationSec} onChange={(e) => set("durationSec", e.target.value)} disabled={readOnly} /></Field>
          <Field label="Age rating"><input className="input" value={form.ageRating} onChange={(e) => set("ageRating", e.target.value)} disabled={readOnly} /></Field>
          <Field label="Rating (0-10)"><input className="input" value={form.rating} onChange={(e) => set("rating", e.target.value)} disabled={readOnly} /></Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Access">
            <select className="input" value={form.access} onChange={(e) => set("access", e.target.value)} disabled={readOnly}>
              <option value="FREE">FREE</option>
              <option value="PREMIUM">PREMIUM</option>
            </select>
          </Field>
          <Field label="Status">
            <select className="input" value={form.status} onChange={(e) => set("status", e.target.value)} disabled={readOnly}>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Language">
            <select className="input" value={form.languageId} onChange={(e) => set("languageId", e.target.value)} disabled={readOnly}>
              <option value="">—</option>
              {languages.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </Field>
        </div>
        {form.status === "SCHEDULED" && (
          <Field label="Publish at (scheduled)">
            <input type="datetime-local" className="input" value={form.publishAt} onChange={(e) => set("publishAt", e.target.value)} disabled={readOnly} />
          </Field>
        )}

        <div>
          <span className="label">Genres</span>
          <div className="flex flex-wrap gap-2">
            {genres.map((g) => {
              const on = form.genreIds.includes(g.id);
              return (
                <button key={g.id} type="button" disabled={readOnly}
                  onClick={() => set("genreIds", on ? form.genreIds.filter((x: string) => x !== g.id) : [...form.genreIds, g.id])}
                  className={`rounded-full px-3 py-1 text-sm ${on ? "bg-brand text-white" : "bg-slate-100 text-slate-600"}`}>
                  {g.name}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap gap-6 border-t border-slate-100 pt-4">
          <Toggle checked={form.isFeatured} onChange={(v) => set("isFeatured", v)} label="Featured" />
          <Toggle checked={form.isTrending} onChange={(v) => set("isTrending", v)} label="Trending" />
          <Toggle checked={form.isTop10} onChange={(v) => set("isTop10", v)} label="Top 10" />
        </div>

        <div className="border-t border-slate-100 pt-4">
          <span className="label">Available on (platforms)</span>
          <PlatformPicker value={form.platforms} onChange={(v) => set("platforms", v)} />
          <p className="mt-1 text-xs text-slate-400">Only the selected platforms will show and play this title.</p>
        </div>

        <div className="grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2">
          <Field label="SEO Title"><input className="input" value={form.seoTitle} onChange={(e) => set("seoTitle", e.target.value)} disabled={readOnly} /></Field>
          <Field label="SEO Description"><input className="input" value={form.seoDescription} onChange={(e) => set("seoDescription", e.target.value)} disabled={readOnly} /></Field>
        </div>

        {!readOnly && (
          <div className="flex items-center gap-3 border-t border-slate-100 pt-4">
            <button onClick={save} disabled={saving} className="btn-primary">{saving ? "Saving…" : isNew ? "Create Movie" : "Save Changes"}</button>
            {!isNew && <button onClick={remove} className="btn text-red-600 hover:bg-red-50">Delete</button>}
            {msg && <span className="text-sm text-slate-500">{msg}</span>}
          </div>
        )}
      </div>

      {!isNew && <VideoPanel kind="movie" id={params.id} />}
    </div>
  );
}
