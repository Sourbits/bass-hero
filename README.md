# Bass Hero

A rhythm game you play with a real bass. Notes come down a Guitar Hero-style highway, and you play them on your bass into the microphone. The game listens in the browser, checks that you played the right note at the right time, and scores you. Along the way it teaches you where every note is on the neck, and what each one sounds like.

Everything runs in the browser with the Web Audio API: no plugins, no special hardware. A laptop's built-in mic works, and an audio interface works better.

## What's in it

- **Game**
  - **Levels**: four tiers (Easy, Medium, Hard, Demon) of 10 levels each. Each level adds notes, speeds up and moves around the neck more. You earn up to three stars per level.
  - **Weak spots**: drills the notes you miss most.
  - **Ear training**: the game plays a note, and you find it on your bass, with "higher" or "lower" hints. It has 10 levels of its own, from the open strings to the whole neck.
- **Practice**: free play with any set of notes, at any tempo.
- **Learn**: every note to the 12th fret. Tap one to hear it, or switch on a heat map of how well you know each note.
- **Tuner**: tells you which string you're playing and which way to turn the peg.
- **Calibrate**: measures your setup's delay, with a metronome to pluck along to, so your timing is judged fairly.
- **Combos and scoring**: Perfect and Good timing windows, a multiplier up to ×4, and fret buzz counted as a miss.
- **Achievements**: 39 of them, from your first note to every star.
- **Accounts and friends** (optional): save your progress to an account, add friends by username, and compare stats and achievements. Guests can play without signing up.
- **Settings**: left-handed mode, which mirrors the fretboard and highway, plus keyboard shortcuts.

## Running it

You need [Bun](https://bun.sh) 1.4 or later and [Node.js](https://nodejs.org) 24. Node 24 matters because accounts are stored with its built-in SQLite.

```bash
bun install
cp .env.example .env.local
```

Open `.env.local` and set `BETTER_AUTH_SECRET` to a random value, for example the output of:

```bash
openssl rand -base64 32
```

Then start it:

```bash
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) and allow the microphone when asked.

Browsers only allow the microphone on `localhost` or over HTTPS. To play on a phone or another computer, the site needs to be hosted with HTTPS.

### Other commands

| Command | What it does |
| --- | --- |
| `bun test` | Runs the tests: detection, timing, scoring, achievements and more |
| `bun run lint` | Checks the code with [Ultracite](https://www.ultracite.ai) (Biome) |
| `bun run fix` | Fixes what the linter can |
| `bun run build` | Builds the production site |

### Handy for testing

- Add `?demo` to the game, Practice or Calibrate page to watch a simulated bass play by itself. It needs no microphone.
- Add `?tone=E1` (or a frequency, such as `?tone=41.2`) to the tuner page to feed it a test tone.
- Add `?debug=on` to any page to start the **debug log**: every pluck the game hears, with its note, pitch, buzz and timing, saved to `data/debug-logs/` while the dev server runs. `?debug=off` stops it.

## How it works

- **Audio input** sits behind an `AudioSource` interface. The same detectors run on the live mic, on a recorded file or on generated tones, which is how the tests work.
- **The clock**: plucks and the highway share the AudioContext's clock, so timing doesn't drift with screen frame rates.
- **Onset detection** (`src/onset`) finds the moment each string is plucked, from jumps in loudness. It's tuned for slow low notes, and for a note that swells after its pluck.
- **Pitch detection** (`src/pitch`) uses the McLeod Pitch Method, via [pitchy](https://github.com/ianprime0509/pitchy). A pluck is named once two readings agree. The tuner also recognizes a string's overtone, which small mics often hear instead of a low E.
- **Buzz** is measured as the share of high-frequency energy just after the pluck.
- **Judging** (`src/timing`) pairs each pluck with the nearest charted note. It rates the pluck Perfect, Good or Miss, and says why a miss happened: early, late, wrong note, buzz or not played.
- **Accounts** use [Better Auth](https://www.better-auth.com), with progress saved as one JSON document per player and merged between devices, keeping the best of both.

Everything you might want to tune is in `src/config`: timing windows, difficulty curves, ear training levels, achievement goals and keyboard shortcuts.

## Built with

[Next.js](https://nextjs.org) 16, React 19, TypeScript, Tailwind CSS 4, [shadcn/ui](https://ui.shadcn.com), Bun and Biome.

## Limits

- Accounts are stored in a SQLite file (`data/bass-hero.db`). Hosting needs a server with a disk that persists. On serverless hosting such as Vercel, it needs a hosted database, such as Postgres, instead.
- No email check or password reset yet.
- Detection has been tested on real basses only with a MacBook's built-in mic in Safari so far. Other mics, interfaces and browsers may need the settings in `src/config/timing.ts` adjusted.
