"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Mail } from "lucide-react";
import { Tabs } from "@/components/ui/Tabs";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { SuccessState } from "@/components/signup/SuccessState";
import { useWallet } from "@/contexts/WalletContext";

const TABS = [
  { value: "wallet", label: "Web3 Wallet" },
  { value: "email", label: "Email" },
];

const REDIRECT_DELAY_MS = 1600;
const EMAIL_SUBMIT_DELAY_MS = 1400;

export function SignupForm() {
  const router = useRouter();
  const [tab, setTab] = useState("wallet");
  const [agreed, setAgreed] = useState(false);
  const [email, setEmail] = useState("");
  const [emailSubmitting, setEmailSubmitting] = useState(false);
  const [emailDone, setEmailDone] = useState(false);
  const { status, openModal } = useWallet();

  const walletDone = tab === "wallet" && status === "connected";
  const done = walletDone || emailDone;

  useEffect(() => {
    if (!done) return undefined;
    const timeout = setTimeout(() => {
      router.push("/terminal");
    }, REDIRECT_DELAY_MS);
    return () => clearTimeout(timeout);
  }, [done, router]);

  if (done) {
    return <SuccessState />;
  }

  const handleEmailSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!agreed || !email) return;
    setEmailSubmitting(true);
    setTimeout(() => {
      setEmailSubmitting(false);
      setEmailDone(true);
    }, EMAIL_SUBMIT_DELAY_MS);
  };

  return (
    <div className="mx-auto w-full max-w-md">
      <Tabs items={TABS} value={tab} onChange={setTab} className="mb-6 w-full" />

      {tab === "wallet" ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-white/55">
            Connect a Web3 wallet to create your account instantly — no email or
            password required.
          </p>
          <Button
            variant="primary"
            size="lg"
            disabled={!agreed || status === "connecting"}
            onClick={openModal}
            className="w-full"
          >
            {status === "connecting" ? <Spinner className="h-5 w-5" /> : "Connect Wallet"}
          </Button>
        </div>
      ) : (
        <form onSubmit={handleEmailSubmit} className="flex flex-col gap-4">
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
          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={!agreed || !email || emailSubmitting}
            className="w-full"
          >
            {emailSubmitting ? <Spinner className="h-5 w-5" /> : "Create Account"}
          </Button>
        </form>
      )}

      <label className="mt-6 flex items-start gap-3 text-sm text-white/55">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(event) => setAgreed(event.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 rounded border-white/20 bg-white/5 text-violet-600 focus:ring-violet-500"
        />
        <span>
          I agree to the{" "}
          <a href="#" className="text-violet-300 hover:underline">
            Terms of Service
          </a>{" "}
          and acknowledge the risks of high-leverage trading.
        </span>
      </label>
    </div>
  );
}
