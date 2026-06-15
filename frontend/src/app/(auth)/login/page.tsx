"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { useAuth } from "@/src/hooks/useAuth";
import { Spinner } from "@/src/components/ui/Spinner";

export default function LoginPage() {
  const { user, loading, signIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace("/");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: "var(--background)" }}>
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div
      className="flex h-screen items-center justify-center px-4"
      style={{ background: "var(--background)" }}
    >
      {/* Ambient glow */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(99,102,241,0.15) 0%, transparent 60%)",
        }}
      />

      <div
        className="relative flex w-full max-w-sm flex-col items-center gap-8 rounded-3xl p-10 text-center"
        style={{
          background: "rgba(255,255,255,0.03)",
          backdropFilter: "blur(16px)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 32px 64px rgba(0,0,0,0.4)",
        }}
      >
        {/* Logo */}
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-linear-to-br from-indigo-500 to-violet-600 shadow-2xl shadow-indigo-900/50 ring-1 ring-white/10">
            <Sparkles className="h-6 w-6 text-white" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-100">Xenon AI</h1>
            <p className="mt-1 text-sm text-zinc-500">Your intelligent assistant</p>
          </div>
        </div>

        {/* Divider */}
        <div className="w-full" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }} />

        {/* Sign-in */}
        <div className="flex w-full flex-col items-center gap-4">
          <p className="text-sm text-zinc-500">Sign in to continue</p>
          <button
            onClick={signIn}
            className="flex w-full items-center justify-center gap-3 rounded-xl px-5 py-3 text-sm font-medium text-zinc-200 transition-all hover:bg-white/8 active:scale-95"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continue with Google
          </button>
        </div>

        <p className="text-xs text-zinc-700">
          By continuing you agree to our terms of service
        </p>
      </div>
    </div>
  );
}
