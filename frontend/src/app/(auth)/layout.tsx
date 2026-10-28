import { Logo } from "@/components/layout/Logo";

/** Centered card layout for login and registration. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-4 py-10">
      {/* Confetti glow, purely decorative */}
      <div aria-hidden className="pointer-events-none absolute -top-32 left-1/2 size-[36rem] -translate-x-1/2 rounded-full bg-gradient-to-br from-brand-400/30 to-party-500/25 blur-3xl" />
      <div className="relative w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo className="text-2xl" />
        </div>
        {children}
      </div>
    </div>
  );
}
