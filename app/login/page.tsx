"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        router.replace("/");
      } else {
        setError("Incorrect password.");
        setPassword("");
      }
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950">
      <div className="w-full max-w-sm px-6">
        <div className="mb-8 flex flex-col items-center gap-3">
          <Image
            src="/logo.png"
            alt="Command Centre logo"
            width={64}
            height={64}
            priority
            className="rounded-xl"
          />
          <h1 className="text-lg font-semibold tracking-tight text-zinc-100">
            Tom&apos;s Command Centre
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            autoComplete="current-password"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-zinc-500 focus:ring-0"
          />
          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading || !password}
            className="rounded-lg bg-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-100 transition-colors hover:bg-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Checking…" : "Enter"}
          </button>
        </form>
      </div>
    </div>
  );
}
