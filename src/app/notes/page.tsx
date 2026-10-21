import type { Metadata } from "next";
import { Handed } from "@/components/handed";
import { LearnFretboard } from "@/components/learn-notes";
import { STRING_COLORS } from "@/components/string-colors";
import { STRINGS } from "@/instrument/bass";

export const metadata: Metadata = {
  description: "Where every note is on a bass, up to the 12th fret.",
  title: "Learn the notes | Bass Hero",
};

export default function NotesPage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-4 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="font-semibold text-3xl">Learn the notes</h1>
        <p className="text-muted-foreground">
          Every note on a 4-string bass up to the 12th fret. Tap a note to hear
          it.
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold text-xl">The neck</h2>
        <p className="text-muted-foreground text-sm">
          Drawn like tab: the thinnest string (G) on top, the thickest (E) at
          the bottom, and the nut on the <Handed left="right" right="left" />.
          Natural notes are solid; sharps are outlined.
        </p>
        <LearnFretboard />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold text-xl">The four strings</h2>
        <p>
          From thickest to thinnest, the open strings are{" "}
          {STRINGS.map((string, index) => (
            <span key={string}>
              <strong style={{ color: STRING_COLORS[string] }}>{string}</strong>
              {index < STRINGS.length - 1 ? ", " : ""}
            </span>
          ))}
          . On the game's highway each string has its own lane,{" "}
          <Handed
            left="mirrored for left-handed mode (G, D, A, E from left to right)"
            right="in the same order from left to right"
          />
          , with the same colors as here.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold text-xl">How the notes work</h2>
        <ul className="flex list-disc flex-col gap-2 pl-5">
          <li>
            Each fret raises a note by a half step. Seven notes have plain
            names: A B C D E F G. The rest are sharps, written ♯: A♯ is a half
            step above A.
          </li>
          <li>
            There's no sharp between E and F, or between B and C. That's why
            fret 1 on the E string is F, not E♯.
          </li>
          <li>
            The small number is the octave. The open E string is E1, and the
            same note an octave higher is E2. Middle C on a piano is C4.
          </li>
          <li>
            The 12th fret, with the double dot, is one octave above the open
            string: the same note names start over.
          </li>
          <li>
            The same note can be in more than one place. A1 is the open A string
            and also the 5th fret of the E string.
          </li>
        </ul>
      </section>
    </main>
  );
}
