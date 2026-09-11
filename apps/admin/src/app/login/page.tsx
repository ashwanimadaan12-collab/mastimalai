"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAdmin } from "@/lib/adminAuth";

export default function AdminLogin() {
  const { login } = useAdmin();
  const router = useRouter();
  const [email, setEmail] = useState("admin@mastimalai.com");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    const r = await login(email, password);
    setBusy(false);
    if (r.ok) router.replace("/");
    else setErr(r.error ?? "Login failed");
  };

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <form onSubmit={submit} className="card w-full max-w-sm p-8">
        <h1 className="text-2xl font-black">
          Masti Malai <span className="text-brand">Admin</span>
        </h1>
        <p className="mt-1 text-sm text-slate-500">Sign in to manage the platform.</p>
        <div className="mt-6 space-y-3">
          <div>
            <span className="label">Email</span>
            <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
          </div>
          <div>
            <span className="label">Password</span>
            <input className="input" value={password} onChange={(e) => setPassword(e.target.value)} type="password" />
          </div>
          <button className="btn-primary w-full" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
          {err && <p className="text-sm text-red-600">{err}</p>}
        </div>
        <p className="mt-4 rounded-lg bg-slate-50 p-2 text-xs text-slate-400">
          Dev seed: admin@mastimalai.com / Masti@12345
        </p>
      </form>
    </div>
  );
}
