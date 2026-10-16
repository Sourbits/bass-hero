import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4">
      <h1 className="font-semibold text-3xl">Bass Hero</h1>
      <nav className="flex w-full max-w-xs flex-col gap-3">
        <Link className={buttonVariants({ size: "lg" })} href="/play">
          Play the warm-up
        </Link>
        <Link
          className={buttonVariants({ size: "lg", variant: "outline" })}
          href="/calibrate"
        >
          Calibrate latency
        </Link>
        <Link
          className={buttonVariants({ size: "lg", variant: "outline" })}
          href="/tuner"
        >
          Tuner
        </Link>
      </nav>
    </main>
  );
}
