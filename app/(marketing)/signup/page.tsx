import { Suspense } from "react";
import { OnboardingWizard } from "@/components/signup/OnboardingWizard";
import { Spinner } from "@/components/ui/Spinner";

export default function SignupPage() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-7xl flex-col items-center justify-center px-4 py-16 sm:px-6 lg:px-8">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Create your account
        </h1>
        <p className="mt-3 text-white/55">
          Start trading in seconds. No paperwork, no delays.
        </p>
      </div>
      {/* The form reads `?next=` with useSearchParams. This route is statically
          prerendered, and on a prerendered route that hook forces client-side
          rendering up to the nearest Suspense boundary - Next wants one declared
          rather than inferred, so the heading above still ships in the initial
          HTML. */}
      <Suspense
        fallback={
          <div className="flex min-h-[24rem] w-full max-w-md items-center justify-center">
            <Spinner className="h-7 w-7 text-white/40" />
          </div>
        }
      >
        <OnboardingWizard />
      </Suspense>
    </div>
  );
}
