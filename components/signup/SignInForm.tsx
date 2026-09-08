"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { isSupabaseConfigured } from "@/lib/supabase";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SignInForm() {
  const router = useRouter();
  const { signInWithEmail, isOnboarded } = useOnboarding();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOnboarded) router.replace("/terminal");
  }, [isOnboarded, router]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await signInWithEmail(email, password);
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.push("/terminal");
  };

  return (
    <form onSubmit={handleSubmit} className="mx-auto flex w-full max-w-md flex-col gap-4">
      {!isSupabaseConfigured && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          Accounts aren&apos;t connected to a backend on this deployment, so
          signing in is unavailable.
        </p>
      )}

      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-white/70">
          Email address
        </label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            className="min-h-11 w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-3 text-sm text-white placeholder:text-white/30 focus:border-violet-500 focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-white/70">
          Password
        </label>
        <input
          id="password"
          type="password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="min-h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white focus:border-violet-500 focus:outline-none"
        />
      </div>

      {error && (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      )}

      <Button
        type="submit"
        variant="primary"
        size="lg"
        disabled={submitting || !EMAIL_PATTERN.test(email) || password.length === 0}
        className="w-full"
      >
        {submitting ? <Spinner className="h-5 w-5" /> : "Sign In"}
      </Button>

      <p className="text-center text-xs text-white/40">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="text-violet-300 hover:underline">
          Create one
        </Link>
      </p>
    </form>
  );
}
