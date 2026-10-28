import { AppShell } from "@/components/layout/AppShell";

/** Layout of everything behind the login: session gate plus app chrome (see `AppShell`). */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
