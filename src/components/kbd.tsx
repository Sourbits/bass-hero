import type { ReactNode } from "react";

/**
 * A key on the keyboard, as a hint on a button. Only shown with a mouse or
 * trackpad, since a touch screen has no keyboard.
 */
export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd
      aria-hidden
      className="ms-2 pointer-fine:inline-block hidden rounded border border-current/30 px-1.5 font-normal font-sans text-[0.7rem] leading-4 opacity-70"
    >
      {children}
    </kbd>
  );
}
