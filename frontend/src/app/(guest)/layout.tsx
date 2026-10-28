/** Layout for guests: no account chrome, just the shared place. */
export default function GuestLayout({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto flex min-h-dvh w-full max-w-[1800px] flex-col px-3 pb-10 sm:px-4 lg:px-5">{children}</div>;
}
