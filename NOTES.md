# Bass Hero notes

## Decisions

Choices I made while you were away, so you can change any of them.

### Setup (milestone 1)

- **Branch.** All work is on `bass-hero-setup`, branched from `main`. `main`
  holds the scaffold and the first setup commit.
- **Scripts.** `bun run dev`, `bun run build`, `bun run lint` (Ultracite
  check), `bun run fix` (Ultracite autofix) and `bun test`.
- **Linter.** Ultracite with Biome, using its core, React and Next presets.
- **shadcn/ui.** Initialized with the defaults. Init adds a sample Button,
  which I removed during setup.
- **Tests.** Bun's built-in test runner, with `@types/bun` for types. Tests sit
  next to the code they test as `*.test.ts`.

### Audio input seam

Everything that analyzes audio depends only on the `AudioSource` interface in
`src/audio/audio-source.ts`. Five sources implement it:

| Source | Where it runs | What it's for |
| --- | --- | --- |
| `createMicrophoneSource` | Browser | The real bass, through a mic or audio interface |
| `createOscillatorSource` | Browser | A silent live test tone, to check the page without a bass |
| `createFileSource` | Anywhere | A recorded WAV file, for tests |
| `createToneSource` | Anywhere | A generated tone, for tests |
| `createSampleSource` | Anywhere | Any in-memory clip; the file and tone sources use it |

- **Frames.** Sources deliver mono frames of 1024 samples (about 21 ms at
  48 kHz), each with its sample rate and a timestamp counted in samples since
  start. Detectors that need a longer window keep their own history.
- **Live capture.** The mic and the test tone both feed one AudioWorklet that
  copies raw 128-sample blocks to the main thread. Grouping blocks into frames
  happens on the main thread, in code that is unit tested.
- **Test sources skip real time.** The file and tone sources hand over every
  frame as soon as `start()` is called, so tests are fast and give the same
  result every time.
- **Only WAV files.** The file source decodes uncompressed WAV itself, so it
  works in Bun, which has no Web Audio API. MP3 and other compressed formats
  aren't supported.
- **Raw mic signal.** The mic is opened with echo cancellation, noise
  suppression and auto gain turned off, because voice processing filters out
  low notes and smears note attacks.
- **Mono.** Stereo WAV files are averaged to mono. The mic uses only its first
  channel.

## What you need to install

Nothing. Bun 1.4.2, Node 24.21 and git 2.39 were already on this machine, and
everything else installs through `bun install`. Homebrew isn't installed, but
nothing here needs it.
