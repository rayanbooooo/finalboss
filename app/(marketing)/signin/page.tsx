import { SignInForm } from "@/components/signup/SignInForm";

export default function SignInPage() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-7xl flex-col items-center justify-center px-4 py-16 sm:px-6 lg:px-8">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Welcome back
        </h1>
        <p className="mt-3 text-white/55">Sign in to pick up where you left off.</p>
      </div>
      <SignInForm />
    </div>
  );
}
