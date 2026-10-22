import type { ReactNode } from "react";

/** The big title at the top of a page, with one short line under it. */
export function PageHeader({
  children,
  title,
}: {
  children?: ReactNode;
  title: string;
}) {
  return (
    <header className="flex flex-col gap-1.5">
      <h1 className="font-extrabold font-heading text-4xl tracking-tight sm:text-5xl">
        {title}
      </h1>
      {children ? (
        <p className="max-w-prose text-muted-foreground">{children}</p>
      ) : null}
    </header>
  );
}
