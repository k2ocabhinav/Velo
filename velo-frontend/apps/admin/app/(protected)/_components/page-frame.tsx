import type { ReactNode } from "react";

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
    <section className="page-frame">
      <header className="page-header">
        <div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        {children}
      </header>
    </section>
  );
}
