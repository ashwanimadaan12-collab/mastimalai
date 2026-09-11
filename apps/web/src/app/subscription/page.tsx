"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { SubscriptionPlan, AuthTokens } from "@masti/types";
import { API_BASE, PLATFORM_HEADERS, rupees } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function SubscriptionPage() {
  const { loggedIn, me, authFetch, refresh, logout, setTokens } = useAuth();
  const router = useRouter();
  const [plans, setPlans] = useState<SubscriptionPlan[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [mobile, setMobile] = useState("");

  useEffect(() => {
    fetch(`${API_BASE}/plans`, { headers: PLATFORM_HEADERS })
      .then((r) => r.json())
      .then((d) => setPlans(d.items))
      .catch(() => setPlans([]));
    // Mobile comes from the login "Continue" step (?m=...).
    try {
      const m = new URLSearchParams(window.location.search).get("m");
      if (m) setMobile(m.replace(/\D/g, "").slice(0, 10));
    } catch {
      /* ignore */
    }
  }, []);

  const jsonHeaders = { "content-type": "application/json", ...PLATFORM_HEADERS };

  const subscribe = async (plan: SubscriptionPlan) => {
    setMsg("");

    // --- New customer (not logged in): guest checkout, NO OTP ---
    if (!loggedIn) {
      if (mobile.length < 10) {
        return setMsg("Pehle apna mobile number daaliye.");
      }
      setBusy(plan.id);
      const orderRes = await fetch(`${API_BASE}/payments/guest/create-order`, {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ mobile, planId: plan.id }),
      });
      if (!orderRes.ok) {
        setBusy(null);
        const e = await orderRes.json().catch(() => null);
        return setMsg(e?.error?.message ?? "Could not start checkout.");
      }
      const order = (await orderRes.json()) as { orderId: string };
      const verifyRes = await fetch(`${API_BASE}/payments/guest/verify`, {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ orderId: order.orderId, sandboxApprove: true }),
      });
      setBusy(null);
      if (!verifyRes.ok) return setMsg("Payment verification failed.");
      // The guest verify logs the customer in and returns tokens.
      const data = (await verifyRes.json()) as AuthTokens;
      setTokens(data.accessToken, data.refreshToken);
      await refresh();
      router.push("/");
      return;
    }

    // --- Logged-in user (renewing): authed flow ---
    setBusy(plan.id);
    const orderRes = await authFetch("/payments/create-order", {
      method: "POST",
      body: JSON.stringify({ planId: plan.id }),
    });
    if (!orderRes.ok) {
      setBusy(null);
      return setMsg("Could not create order.");
    }
    const order = (await orderRes.json()) as { orderId: string };
    const verifyRes = await authFetch("/payments/verify", {
      method: "POST",
      body: JSON.stringify({ orderId: order.orderId, sandboxApprove: true }),
    });
    setBusy(null);
    if (!verifyRes.ok) return setMsg("Payment verification failed.");
    setMsg("Masti Premium activated! 🎉");
    await refresh();
    router.push("/");
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-8">
      <div className="mb-6 flex items-center justify-between">
        <span className="brand-gradient text-xl font-black">Masti Malai</span>
        <div className="flex items-center gap-3 text-sm text-muted">
          {loggedIn ? (
            <>
              {me && <span>{me.mobile}</span>}
              <button
                onClick={() => { logout(); router.replace("/subscription"); }}
                className="rounded-md px-3 py-1.5 hover:text-white"
              >
                Log out
              </button>
            </>
          ) : (
            <button
              onClick={() => router.push("/login")}
              className="rounded-md px-3 py-1.5 hover:text-white"
            >
              ‹ Change number
            </button>
          )}
        </div>
      </div>

      <h1 className="text-center text-3xl font-black">
        Get <span className="brand-gradient">Masti Premium</span>
      </h1>
      <p className="mt-2 text-center text-muted">
        Entertainment ka full tadka — sabhi movies aur series unlock karein.
      </p>

      {/* New customer: just a mobile number — no OTP. */}
      {!loggedIn && (
        <div className="mx-auto mt-6 max-w-md">
          <label className="mb-1 block text-center text-sm text-muted">
            Apna mobile number daaliye, plan chuniye — bas!
          </label>
          <div className="flex items-center rounded-md bg-surface ring-1 ring-white/10 focus-within:ring-accent/50">
            <span className="px-3 text-muted">+91</span>
            <input
              value={mobile}
              onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
              placeholder="10-digit mobile number"
              inputMode="numeric"
              className="w-full rounded-md bg-transparent py-2.5 pr-4 outline-none"
            />
          </div>
        </div>
      )}

      {me?.subscription.isActive && (
        <p className="mx-auto mt-4 max-w-md rounded-md bg-accent/10 px-4 py-2 text-center text-sm text-accent-2">
          You're on {me.subscription.planName} · active till{" "}
          {me.subscription.expiresAt
            ? new Date(me.subscription.expiresAt).toLocaleDateString("en-IN")
            : "—"}
        </p>
      )}

      <div className="mt-8 grid gap-5 sm:grid-cols-3">
        {(plans ?? Array.from({ length: 3 }).map(() => null)).map((p, i) =>
          p ? (
            <div
              key={p.id}
              className={`relative rounded-2xl p-6 ring-1 ${
                p.isRecommended
                  ? "bg-gradient-to-b from-accent/15 to-surface ring-accent/60"
                  : "bg-surface ring-white/10"
              }`}
            >
              {p.isRecommended && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-accent px-3 py-0.5 text-xs font-bold text-black">
                  MOST POPULAR
                </span>
              )}
              <h3 className="text-lg font-bold">{p.name}</h3>
              <div className="mt-2 flex items-end gap-2">
                <span className="text-3xl font-black">{rupees(p.priceInPaise)}</span>
                {p.compareAtPriceInPaise &&
                  p.compareAtPriceInPaise > p.priceInPaise && (
                    <span className="mb-1 text-sm text-muted line-through">
                      {rupees(p.compareAtPriceInPaise)}
                    </span>
                  )}
              </div>
              <p className="mt-1 text-xs text-muted">
                {p.durationDays} day{p.durationDays > 1 ? "s" : ""} · {p.description}
              </p>
              <ul className="mt-4 space-y-1.5 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <span className="text-accent">✓</span> {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => subscribe(p)}
                disabled={busy === p.id}
                className="mt-5 w-full rounded-md bg-accent py-2.5 font-bold text-black hover:bg-accent-2 disabled:opacity-50"
              >
                {busy === p.id ? "Processing…" : "Get Premium"}
              </button>
            </div>
          ) : (
            <div key={i} className="h-80 animate-pulse rounded-2xl bg-surface" />
          ),
        )}
      </div>

      {msg && <p className="mt-6 text-center text-accent-2">{msg}</p>}
      <p className="mt-8 text-center text-xs text-muted">
        Local sandbox: no real payment is processed. Production uses Razorpay — the gateway
        captures the phone and verifies the payment (that replaces OTP for new customers).
      </p>
    </div>
  );
}
