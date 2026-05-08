"use client";

import { useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";

export function LoginForm() {
  const params = useSearchParams();
  const error = params.get("error");
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setProblem(null);
    try {
      const res = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      setSubmitted(true);
    } catch (err) {
      setProblem((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (submitted) {
    return (
      <div className="text-center">
        <p className="font-display text-xl">Check your inbox.</p>
        <p className="mt-2 text-ink-faded">
          We sent a sign-in link to <em>{email}</em>. It expires in 15 minutes.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error === "expired" && (
        <p className="badge mb-2 block">That link has expired. Request another below.</p>
      )}
      <div>
        <label className="label" htmlFor="email">
          Email address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input"
          placeholder="reader@example.com"
        />
      </div>
      {problem && <p className="text-sm text-accent">{problem}</p>}
      <button type="submit" disabled={busy} className="btn-solid w-full">
        {busy ? "Sending…" : "Send the link"}
      </button>
      <p className="text-xs text-ink-faded text-center">
        No password. We send a one-tap link that expires in 15 minutes.
      </p>
    </form>
  );
}
