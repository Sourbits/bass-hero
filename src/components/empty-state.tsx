import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** What a section shows before there's anything in it, and what to do. */
export function EmptyState({
  action,
  children,
  icon: Icon,
  title,
}: {
  action?: ReactNode;
  children: ReactNode;
  icon: LucideIcon;
  title: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed px-4 py-8 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-secondary text-gold">
        <Icon aria-hidden className="size-5" />
      </span>
      <p className="font-bold font-heading text-lg">{title}</p>
      <p className="max-w-sm text-muted-foreground text-sm">{children}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
