import type { ReactNode } from "react";
import { PageHeader } from "@velo/ui";

export function PageFrame({
  title,
  description,
  children
}: Readonly<{
  title: string;
  description: string;
  children?: ReactNode;
}>) {
  return (
    <PageHeader title={title} description={description} actions={children} />
  );
}
