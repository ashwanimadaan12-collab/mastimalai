"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { AuthTokens, MovieSummary } from "@masti/types";
import { API_BASE, PLATFORM_HEADERS } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function LoginPage() {
  const { setTokens, refresh } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState<"mobile" | "otp">("mobile");
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [posters, setPosters] = useState<string[]>([]);

  // Real posters for the cinematic background + moving strip.
  useEffect(() => {
    fetch(`${API_BASE}/movies?limit=12`, { headers: PLATFORM_HEADERS })
      .then((r) => r.json())
      .then((d) => {
        const imgs = (d.items as MovieSummary[])
          .map((m) => m.poster)
          .filter((x): x is string => !!x);
        setPosters(imgs);
      })
      .catch(() => {});
  }, []);

  const backdrops = posters.slice(0, 9);
  const jsonHeaders = { "content-type": "application/json", ...PLATFORM_HEADERS };

  // Continue: existing active customer -> OTP step; new/lapsed -> subscription page.
  const onContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    const res = await fetch(`${API_BASE}/auth/continue`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ mobile }),
    });
    setBusy(false);
    if (!res.ok) {
      const e2 = await res.json().catch(() => null);
      return setErr(e2?.error?.message ?? "Kuch galat ho gaya, dubara try karein.");
    }
    const data = (await res.json()) as { next: "otp" | "subscribe"; otp?: string };
    if (data.next === "otp") {
      if (data.otp) {
        setDevOtp(data.otp);
        setOtp(data.otp);
      }
      setStep("otp");
    } else {
      // New / no active subscription — go pick a plan (no OTP).
      router.push(`/subscription?m=${encodeURIComponent(mobile)}`);
    }
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    const res = await fetch(`${API_BASE}/auth/verify-otp`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ mobile, otp }),
    });
    setBusy(false);
    if (!res.ok) {
      const e2 = await res.json().catch(() => null);
      return setErr(e2?.error?.message ?? "Invalid OTP");
    }
    const data = (await res.json()) as AuthTokens;
    setTokens(data.accessToken, data.refreshToken);
    await refresh();
    router.push("/"); // active customer -> home
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-base">
      {/* Cinematic poster-collage background */}
      <div className="pointer-events-none absolute inset-0 grid grid-cols-3 gap-1 opacity-30">
        {backdrops.map((src, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            src={src}
            alt=""
            className="slow-zoom h-full w-full object-cover"
            style={{ animationDelay: `${i * 1.5}s` }}
          />
        ))}
      </div>
      <div className="absolute inset-0 bg-gradient-to-b from-base/70 via-base/85 to-base" />

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4">
        <div className="mb-6 text-center">
          <div className="brand-gradient text-4xl font-black">Masti Malai</div>
          <p className="mt-1 text-sm text-muted">Entertainment Ka Full Tadka</p>
        </div>

        <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-surface/80 p-6 shadow-2xl backdrop-blur">
          {step === "mobile" ? (
            <form onSubmit={onContinue} className="space-y-3">
              <h1 className="text-lg font-bold">Login / Sign up</h1>
              <p className="text-sm text-muted">Apna mobile number daaliye.</p>
              <div className="flex items-center rounded-md bg-card ring-1 ring-white/10 focus-within:ring-accent/50">
                <span className="px-3 text-muted">+91</span>
                <input
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  placeholder="10-digit mobile number"
                  inputMode="numeric"
                  className="w-full rounded-md bg-transparent py-2.5 pr-4 outline-none"
                />
              </div>
              <button
                disabled={busy || mobile.length < 10}
                className="w-full rounded-md bg-accent py-2.5 font-bold text-black transition hover:bg-accent-2 disabled:opacity-50"
              >
                {busy ? "Please wait…" : "Continue"}
              </button>
            </form>
          ) : (
            <form onSubmit={verify} className="space-y-3">
              <h1 className="text-lg font-bold">Verify OTP</h1>
              <p className="text-sm text-muted">OTP bheja gaya +91 {mobile} par.</p>
              {devOtp && (
                <p className="rounded-md bg-accent/10 px-3 py-2 text-xs text-accent-2">
                  Dev mode: OTP is <b>{devOtp}</b> (auto-filled)
                </p>
              )}
              <input
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="6-digit OTP"
                inputMode="numeric"
                maxLength={6}
                className="w-full rounded-md bg-card px-4 py-2.5 tracking-[0.5em] outline-none ring-1 ring-white/10 focus:ring-accent/50"
              />
              <button
                disabled={busy || otp.length !== 6}
                className="w-full rounded-md bg-accent py-2.5 font-bold text-black transition hover:bg-accent-2 disabled:opacity-50"
              >
                {busy ? "Verifying…" : "Verify & Login"}
              </button>
              <button
                type="button"
                onClick={() => { setStep("mobile"); setErr(""); setDevOtp(null); setOtp(""); }}
                className="w-full text-sm text-muted hover:text-white"
              >
                ‹ Change number
              </button>
            </form>
          )}
          {err && <p className="mt-3 text-sm text-red-400">{err}</p>}
        </div>

        {posters.length > 0 && (
          <div className="relative mt-10 w-full max-w-4xl overflow-hidden">
            <div className="marquee-track gap-3">
              {[...posters, ...posters].map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={src}
                  alt=""
                  className="h-40 w-28 shrink-0 rounded-lg object-cover ring-1 ring-white/10"
                />
              ))}
            </div>
            <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-base to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-base to-transparent" />
          </div>
        )}
      </div>
    </div>
  );
}
