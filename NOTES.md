# Bass Hero notes

## Summary

### What I built

- **Milestone 1, setup.** Next.js 16 with TypeScript, Bun, shadcn/ui and
  Ultracite (Biome), plus Bun's test runner. Audio input sits behind one
  `AudioSource` interface, with five sources: live mic, a silent in-browser
  test tone, WAV files, generated tones, and in-memory clips.
- **Milestone 2, note detector.** `detectNotes` turns any audio source into
  readings of note, octave and cents, using the McLeod Pitch Method. The
  `/tuner` page shows the note in big type, a cents needle that turns green
  within ±5 cents, the frequency, and an input level meter.
- **Checks.** `bun run build` and `bun run lint` pass. `bun test` runs 72
  tests. They feed generated tones for E1, A1, D2 and G2, plus F1, G♯1, C2,
  F♯2, C3, G3 and a 5-string's B0, at 44.1 and 48 kHz, and every one is
  detected within 1 cent. They also cover detuned notes, bass-like harmonics,
  silence, quiet input, noise and note changes.
- **In the browser.** With the test tone (`/tuner?tone=E1`, `?tone=56`,
  `?tone=F%232`), the page showed E1 in tune, A1 31 cents sharp (the math says
  31.2) and F♯2 in tune, and Stop reset it. There were no console errors.
- **Commits.** Everything is on the `bass-hero-setup` branch, one commit per
  milestone. Nothing is pushed; there is no remote.

### Main decisions

Details are in the Decisions section below.

- Pitch detection uses MPM through the `pitchy` library, behind our own
  `PitchDetector` interface. The comparison is under "Pitch detection
  options".
- The analysis window is about 85 ms (4096 samples at 48 kHz), with a new
  reading every ~21 ms.
- The tuner is at `/tuner`, not on the home page.
- `?tone=` swaps the mic for a silent test tone, so the page can be checked
  without a bass.
- The file source reads only WAV, so tests can run in Bun.

### What you need to install

Nothing. See "What you need to install" at the bottom.

### What doesn't work yet, or isn't verified

- **The real microphone is untested.** The built-in browser I used blocks
  microphone access. In it, the page correctly showed "Microphone access was
  blocked", but I never heard real audio through the mic path. The test tone
  covers everything after the mic: the AudioWorklet, framing, detection and
  display.
- **Only Chromium tested.** I haven't tried Safari or Firefox.
- **No input picker.** The tuner uses the browser's default input. To use an
  audio interface, make it the default input in macOS or in the browser's site
  settings. `createMicrophoneSource` already accepts a `deviceId`, but there's
  no UI for it.
- **Light theme only.** There's no dark mode.
- **No real-time file playback.** The file and tone sources are for tests;
  they don't play at real speed in the browser.
- **Clock alignment.** Reading timestamps count samples since start. They
  aren't yet tied to the audio clock the game will use to schedule notes.

### What to test with your real bass

Run `bun run dev`, open http://localhost:3000/tuner in Chrome, press Start and
allow the microphone.

1. **Open strings.** Play E, A, D and G (and low B on a 5-string). Check the
   name and octave: E1, A1, D2, G2, B0.
2. **Fretted notes.** Try the 5th and 12th frets on each string, and a few
   notes high on the G string.
3. **Low E through the laptop mic.** Laptop mics pick up very little at 41 Hz.
   Watch for low E showing as E2 (one octave up), and compare with an audio
   interface if you have one.
4. **Sustain.** Let a low E ring out. The note should stay put as it fades,
   not jump an octave or flicker before it clears.
5. **Accuracy.** Compare the cents reading with a hardware or phone tuner.
6. **Loudness.** Play softly and loudly while watching the input level meter.
   If soft notes never register, the −50 dB gate is too high for your setup.
7. **Fast playing.** Play quick note changes and a slide, and note how long
   the display takes to follow.
8. **Natural harmonics.** A 12th-fret harmonic should read one octave above
   the open string. That's correct, not a bug.

If something reads wrong, note which string, fret and input you used. A short
WAV recording of the problem is the most useful thing to bring back: it can go
straight into a test with `createFileSource`.

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

### Note detector and tuner (milestone 2)

- **Where it lives.** The tuner is at `/tuner`, and the home page links to it.
  Pitch code is in `src/pitch/`, separate from the audio sources and the UI.
- **Layers.** `detectNotes(source, …)` takes any `AudioSource` and reports a
  reading after every frame. Each reading holds the note (or none), its
  clarity, the input level and a timestamp. The tuner page adds
  `createNoteSmoother` on top, for display only; the game can use the raw
  readings.
- **What counts as a note.** The defaults are a clarity of 0.9 or more, a
  level of −50 dBFS or louder, and a pitch between 28 and 600 Hz. That range
  covers a 5-string's low B up past the 24th fret of a 4-string's G string.
  All of these are options on `detectNotes`.
- **Display smoothing.** The cents value eases toward new readings. A note
  stays on screen for 0.4 s after it fades. A different note must be heard
  twice in a row before the display switches, which hides stray readings from
  a pluck's attack.
- **Note names.** Sharps only (C♯, not D♭), in scientific pitch notation, so a
  bass's open strings are E1, A1, D2 and G2. Tuning is A4 = 440 Hz, and
  `referenceA4` changes it.
- **Test tone mode.** `/tuner?tone=E1` or `/tuner?tone=41.2` swaps the mic for
  a silent in-browser tone with bass-like harmonics. It runs through the same
  capture path as the mic, so it checks the whole page without a bass. I used
  it to check the page in the browser.
- **Fonts.** shadcn's init expected the layout's sans font variable to be
  named `--font-sans`, but the layout still used `--font-geist-sans`, so pages
  fell back to a serif font. I renamed the variable in the layout.
- **Octave errors.** The tests include bass-like tones whose second harmonic
  is louder than the fundamental. I also tried tones with the fundamental cut
  to 0. MPM still found the right octave, because the third harmonic pins down
  the true period.

## Pitch detection options

Bass is a hard case: the open low E is 41.2 Hz, so one cycle lasts 24 ms. Its
second harmonic is often louder than the fundamental, which tricks some
methods into reporting the note an octave too high.

| Method | Low notes | Octave errors | Cost | Verdict |
| --- | --- | --- | --- | --- |
| FFT peak picking | Poor. At 48 kHz with 4096 samples, each bin is 11.7 Hz wide, about four semitones at low E | Often picks the loudest harmonic | Cheap | No |
| Harmonic product spectrum | Same coarse resolution as the FFT | Better than plain FFT | Cheap | No |
| Plain autocorrelation | Good | Picks wrong peaks without extra rules | Medium | No |
| Cepstrum | Needs long windows | Fine on harmonic-rich tones, weak on near-sine tones | Medium | No |
| YIN | Good, with fine cents accuracy | Rare | Heavy if computed directly: about 2.5 million operations per reading at 48 kHz, unless it's downsampled or rewritten with FFTs | Strong option |
| McLeod Pitch Method (MPM) | Good, with fine cents accuracy | Rare | Light, because it's computed with FFTs | **Picked** |
| Neural models (CREPE, SPICE, Basic Pitch) | Very robust | Rare | Megabytes of model, GPU or WASM, more latency | Overkill for one bass note at a time |

**Picked: MPM, using the [pitchy](https://github.com/ianprime0509/pitchy)
library.**

- It is as accurate as YIN for single notes and was designed for real-time
  instrument tuning.
- It's cheap at the full sample rate: one 4096-sample reading costs a pair of
  FFTs, so it can run on every 21 ms frame without a worker.
- Each reading comes with a "clarity" score from 0 to 1, which separates a
  played note from silence or noise.
- pitchy is small (one dependency, fft.js), typed, MIT licensed and stable.
  Its last release is from January 2024, which is fine for a finished
  algorithm.
- It sits behind our own `PitchDetector` interface, so switching to YIN or
  something else later only touches one file.

**Window size.** The detector analyzes the most recent ~85 ms of audio: 4096
samples at 44.1 or 48 kHz, or the next power of two above 80 ms at other
rates. That holds about 3.5 cycles of low E and 2.6 cycles of a 5-string's low
B (30.9 Hz). A new reading comes with every 1024-sample frame, so the display
updates about 47 times a second.

## What you need to install

Nothing. Bun 1.4.2, Node 24.21 and git 2.39 were already on this machine, and
everything else installs through `bun install`. Homebrew isn't installed, but
nothing here needs it.
