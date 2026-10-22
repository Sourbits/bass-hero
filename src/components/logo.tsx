import { useId } from "react";

/** A guitar pick with a lightning bolt: the Bass Hero mark. */
export function LogoMark({ className = "size-7" }: { className?: string }) {
  const gradient = useId();
  return (
    <svg aria-hidden className={className} viewBox="0 0 32 32">
      <defs>
        <linearGradient id={gradient} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="var(--gold)" />
          <stop offset="1" stopColor="var(--neon)" />
        </linearGradient>
      </defs>
      <path
        d="M16 30.5C10.5 27 2.5 17.5 2.5 9.5 2.5 4.5 8.5 1.5 16 1.5s13.5 3 13.5 8c0 8-8 17.5-13.5 21Z"
        fill={`url(#${gradient})`}
      />
      <path
        d="M18.2 5.5 10.8 17.3h4.8l-1.9 9.2 7.8-12.6h-4.8l1.5-8.4Z"
        fill="var(--stage)"
      />
    </svg>
  );
}

/** The mark and the name, for the top of every page. */
export function Logo() {
  return (
    <span className="flex items-center gap-2">
      <LogoMark />
      <span className="font-extrabold font-heading text-lg tracking-tight">
        Bass <span className="text-stage-gradient">Hero</span>
      </span>
    </span>
  );
}
