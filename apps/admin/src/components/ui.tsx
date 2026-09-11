"use client";
import type { ReactNode } from "react";

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    PUBLISHED: "bg-green-100 text-green-700",
    DRAFT: "bg-slate-100 text-slate-600",
    PROCESSING: "bg-amber-100 text-amber-700",
    SCHEDULED: "bg-blue-100 text-blue-700",
    UNPUBLISHED: "bg-slate-200 text-slate-600",
    ARCHIVED: "bg-slate-200 text-slate-500",
    ACTIVE: "bg-green-100 text-green-700",
    EXPIRED: "bg-slate-100 text-slate-500",
    CANCELLED: "bg-red-100 text-red-600",
    PENDING: "bg-amber-100 text-amber-700",
    FAILED: "bg-red-100 text-red-600",
    SUCCESS: "bg-green-100 text-green-700",
    CREATED: "bg-slate-100 text-slate-600",
    PREMIUM: "bg-brand/15 text-brand-dark",
    FREE: "bg-slate-100 text-slate-600",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${map[status] ?? "bg-slate-100 text-slate-600"}`}>
      {status}
    </span>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 rounded-full transition ${checked ? "bg-brand" : "bg-slate-300"}`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${checked ? "left-4" : "left-0.5"}`}
        />
      </button>
      {label && <span>{label}</span>}
    </label>
  );
}

export function Modal({
  title,
  children,
  onClose,
  wide,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className={`card mt-8 w-full ${wide ? "max-w-3xl" : "max-w-lg"} p-6`}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// Select which client platforms a title/plan is available on.
export function PlatformPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const opts: { key: string; label: string }[] = [
    { key: "WEB", label: "🌐 Web" },
    { key: "ANDROID", label: "📱 App" },
  ];
  const toggle = (p: string) =>
    onChange(value.includes(p) ? value.filter((x) => x !== p) : [...value, p]);
  return (
    <div className="flex gap-2">
      {opts.map((o) => {
        const on = value.includes(o.key);
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => toggle(o.key)}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
              on ? "bg-brand text-white" : "bg-slate-100 text-slate-500"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <span className="label">{label}</span>
      {children}
    </div>
  );
}

export function EmptyRow({ colSpan, text }: { colSpan: number; text: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-10 text-center text-sm text-slate-400">
        {text}
      </td>
    </tr>
  );
}

export function rupees(paise: number) {
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
}
export function dateFmt(d?: string | null) {
  return d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
}
