import { AdminShell } from "./_components/admin-shell";
import type { ReactNode } from "react";

export default function ProtectedLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return <AdminShell>{children}</AdminShell>;
}
