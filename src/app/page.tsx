import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4">
      <h1 className="font-semibold text-3xl">Bass Hero</h1>
      <Link className={buttonVariants({ size: "lg" })} href="/tuner">
        Open the tuner
      </Link>
    </main>
  );
}
