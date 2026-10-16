# Bass Hero notes

## Timing system plan

Written before coding, on the `timing-system` branch (branched from
`bass-hero-setup`, which has the tuner).

### Parts and seams

Each part is its own folder, testable without the others:

| Part | Folder | Input → output |
| --- | --- | --- |
| Audio sources | `src/audio` | Mic, test tone or clip → timestamped frames |
| Onset detection | `src/onset` | Frames → pluck times |
| Pitch detection | `src/pitch` | Frames → note readings (already built) |
| Played notes | `src/onset/played-notes.ts` | Pluck times + note readings → "this note was plucked at this time" |
| Timing judgment | `src/timing` | Played notes + expected notes → Perfect / Good / Miss |
| Game logic | `src/game` | Chart, tempo, circle positions, score |
| Game screen | `src/app/play`, `src/components/game` | Draws it; no timing logic of its own |

### One clock

The game clock is the **AudioContext clock**, in milliseconds.

- Each 128-sample audio block reports its own `currentTime` from the audio
  thread, so every sample has an exact time on that clock. A pluck time comes
  from the sample where the pluck starts.
- The screen reads the same clock every animation frame, using
  `getOutputTimestamp()` to get a smooth "now" between audio blocks. Circle
  positions and judgment both use it.
- Why not `performance.now()`: the audio clock is the one that's
  sample-accurate. Any later audio (a metronome, backing tracks) has to be
  scheduled on it anyway, and the two clocks slowly drift apart.
- Tests don't need a browser: a clip's clock starts at 0 and counts samples.

### Milestone 1: onset detection

- Work in short blocks (~0.7 ms). Track the peak level over the last ~17 ms
  (longer than half a cycle of low B, so the level doesn't ripple) and compare
  it with the 17 ms before that. A jump of at least 1.5× above a noise floor
  is a pluck.
- Then pin the exact time. Wait 15 ms to see how loud the new note gets, and
  scan back for the first sample that rises above the old level by 10% of the
  jump. That sample's time is the onset.
- Pair each onset with the existing pitch detector. Use the first confident
  reading whose window starts just after the onset, so the previous note
  doesn't leak in. The note keeps the onset's time, not the time its pitch was
  recognized.
- Test with generated plucks (low E included), at different phases, attack
  lengths, noise and re-plucks, and record the error.

### Milestone 2: timing judgment

- `src/config/timing.ts` holds the Perfect (±50 ms) and Good (±120 ms)
  windows, plus the other tuning values.
- Hit time = onset − calibration offset. A right note within ±50 ms is
  Perfect, within ±120 ms is Good, and within ±200 ms is a Miss marked early
  or late. A wrong note within ±120 ms is a Miss. A note nobody played is a
  Miss once its window has closed.
- Calibration: the same sliding-circle view as the game, at a steady beat.
  You pluck on each beat, and the suggested offset is the median of
  (pluck − beat).

### Milestone 3: test game screen

- `/play`: circles slide right to left into a target outline. Each position
  is computed from the clock, so a circle's center is on the outline exactly
  at its target time. Tempo setting, feedback near the target, running score
  and an end summary.
- `?demo` mode feeds the game a silent synthesized bass that plays the chart
  with known timing mistakes. That lets me check the whole loop in the browser
  without a mic.

## Timing system decisions

### The clock

- **Game clock = AudioContext time, in ms.** Each 128-sample block from the
  capture worklet carries the audio thread's `currentTime`, so every sample,
  and so every pluck, has an exact time on it (`src/audio/capture-worklet.ts`).
- **"Now" for drawing.** `createAudioClock` (`src/audio/audio-clock.ts`) uses
  `getOutputTimestamp()`: the audio time currently reaching the speakers,
  advanced smoothly with `performance.now()` between audio updates, and never
  going backwards.
- **One AudioContext.** Live sources accept a shared `context`, so the mic,
  the clock and any synthesized audio are all on one timeline.
- **Units.** Audio frames and pitch readings keep seconds, the Web Audio
  convention. Everything in the timing layer (onsets, targets, judgments,
  offsets) is in ms, and those field names end in `Ms`.
- **What calibration absorbs.** A pluck reaches the audio thread after the
  mic and input buffer delay, and "now" lags the audio thread by the output
  delay. If you play exactly when a circle reaches the outline, the detected
  pluck lands roughly the input delay plus the output delay late. The
  calibration offset measures that whole delay for your setup and removes it.

### Onset detection (milestone 1)

`src/onset/onset-detector.ts`. It needs no pitch, so low notes aren't slower
to detect than high ones.

1. **Detect.** It tracks the peak level in 35 ms windows, one full cycle of a
   5-string's low B. A pluck is a window at least 1.5× louder than the window
   before, and louder than −45 dBFS. Or, for quick re-plucks: the note goes
   quiet (below a tenth of its level) for 12 ms, then comes back to at least
   a quarter of that level.
2. **Pin the time.** 15 ms later, once the new note's peak is known, it finds
   the first sample that rises 10% of the way from the old level to the new
   peak. If there's a quiet gap of at least 5 ms just before the rise (the
   player muted the string), it measures from the silence instead. That
   sample's time is the onset.

**Pairing with the note** (`src/onset/played-notes.ts`). Each onset gets the
first confident pitch reading whose window starts at least 10 ms after the
pluck, so the previous note and the attack noise are left out. The note keeps
the onset's time. Pitch takes about 100 ms to name the note, so feedback
appears about 0.1 s after the pluck, but the timing isn't affected. If the
next pluck comes before the note can be named, or nothing is named within
400 ms, the pluck is reported with no note, and judgment ignores it.

**Accuracy achieved.** Generated plucks of B0, E1 (low E, 41.2 Hz), A1, D2,
G2, C3 and G3, each at five starting phases, at 44.1 and 48 kHz, with
background noise at about −55 dBFS. Error = detected − true pluck time. No
plucks were missed and no extra onsets were found in any of these.

| Case | Pure tone: avg / worst | Bass-like tone: avg / worst | Low E worst |
| --- | --- | --- | --- |
| Pluck onto silence or after a mute, instant attack | +0.1 / 0.6 ms | +0.2 / 2.4 ms | 1.8 ms |
| Same, 2 ms attack | +0.4 / 1.2 ms | +0.9 / 3.4 ms | 2.6 ms |
| Same, slow 5 ms attack | +0.7 / 2.8 ms | +1.6 / 5.9 ms | 3.2 ms |
| Quick re-plucks every 150 ms after a 15 ms mute | +0.3 / 0.8 ms | +0.8 / 2.6 ms | 2.6 ms |
| Re-pluck while the old note still rings, no mute | +1.3 / 7.5 ms | +3.0 / 19.4 ms | 14.6 ms |

"Bass-like" means the second harmonic is louder than the fundamental. Errors
are almost always late, never more than 0.1 ms early. The tests in
`src/onset/onset-detector.test.ts` enforce these bounds: 3.5 ms for plucks
onto silence or after a mute, 6 ms for a 5 ms attack, and 20 ms for the
no-mute re-pluck.

**Known weak spot: re-plucking a note that's still ringing, with no mute.**
The detector only sees the new pluck once it's louder than the old note.
With low notes, that can take most of a cycle (up to ~19 ms). A note that's
*quieter* than one still ringing on another string, without a mute, isn't
detected at all. Real plucks have a sharp attack and usually a brief mute
from the finger or pick, so this may matter less on a real bass; it's on the
test list.

### Timing judgment (milestone 2)

- **Config.** All timing and scoring values are in `src/config/timing.ts`:
  Perfect ±50 ms, Good ±120 ms, a ±200 ms Miss window, a 300 ms wait for late
  plucks to be named, the octave option, points per rating and the
  calibration beat.
- **The judge** (`src/timing/judge.ts`) works in game-clock ms. Hit time =
  pluck time − calibration offset, and offset = hit − target, so negative
  means early.
  - A right note within ±50 ms is Perfect, and within ±120 ms is Good. The
    edges count.
  - A right note within ±200 ms but outside Good is a Miss marked early or
    late, with its ms. Without this window, a pluck at +150 ms would just be
    ignored, and you'd see "Not played" with no hint you were close.
  - A wrong note within ±120 ms is a Miss ("Wrong note: F1") and uses up that
    note. Playing the right one afterwards doesn't count.
  - A note nobody played becomes a Miss 200 + 300 ms after its target (plus
    the calibration offset). The 300 ms covers the ~100 ms it takes to name a
    late pluck.
  - Plucks with no clear pitch, plucks nowhere near a note, and second plucks
    of an already-judged note are ignored, not penalized. That way noise, or
    the detector seeing one pluck as two, doesn't cost points.
  - When two windows overlap, a pluck goes to the nearest note of that pitch.
- **Octaves are strict by default.** Playing E2 for E1 is a wrong note. If a
  laptop mic makes low E read as E2, set `ignoreOctave: true` in the config.
- **Calibration offset.** The offset is subtracted from every hit. It's saved
  per browser in localStorage (`src/timing/latency-setting.ts`), because it
  depends on the device, mic and speakers. The default is 0.
- **Calibration math** (`src/timing/calibration.ts`). Each beat is matched
  with its nearest pluck, within 40% of a beat. The suggested offset is the
  median of (pluck − beat), so a few flubbed beats don't skew it. The spread
  is the median distance from that offset. It needs at least 8 matched beats.
- **Calibration screen.** It reuses the game's sliding-circle view, so it's
  built and committed with the game screen in milestone 3.
- **Calibrate against visuals, not clicks.** The game is visual, so
  calibration measures what matters: circle on screen → your pluck → mic →
  detection. An audible click would also be picked up by the mic and detected
  as a pluck when there are no headphones.

### Test game screen (milestone 3)

- **Pages.** `/play` is the game and `/calibrate` is calibration. The home page
  links to both, plus the tuner.
- **Chart** (`src/game/charts.ts`): "Warm-up", 16 notes, one per beat. It
  starts with each open string twice (E1 E1 A1 A1 D2 D2 G2 G2), then goes up
  the neck through the 3rd frets (G1 A1 C2 D2 F2 G2 A2) and ends on E1.
- **Tempo.** A slider from 40 to 140 BPM, default 70, saved per browser. It
  can only be changed between runs. A run starts 3 s after you press Start,
  so the first circle has time to slide in.
- **Circles** move right to left and take 2 s to cross from the right edge to
  the outline, which sits 18% in from the left. Every animation frame, each
  circle is placed from the game clock with `circleX()` in
  `src/game/layout.ts`. At its target time its center is exactly on the
  outline (unit-tested). They're HTML elements moved with transforms rather
  than a canvas, which keeps them easy to style and to measure in tests.
- **Colors by string.** The usual string for each note: E red, A amber, D
  green, G blue. A hit circle pops and disappears; a missed one fades and
  slides on past the outline.
- **Feedback** shows above the outline: "Perfect", "Good" or "Miss", plus
  "Late +80 ms", "Early −35 ms", "On time", "Wrong note: F1" or "Not played".
  It appears when the note has been named, about 0.1 s after the pluck. The
  timing it shows comes from the pluck itself.
- **Score.** Perfect 100, Good 50, Miss 0 (in the config). There's a running
  count of each rating. The end summary gives the counts, the score, and the
  average timing of Perfect and Good hits, signed so it shows early vs late.
  If that average is more than 30 ms off, it suggests calibrating.
- **Demo mode.** `/play?demo` and `/calibrate?demo` replace the mic with a
  silent synthesized bass, scheduled on the same AudioContext clock. On
  `/play` it plays the chart with scripted mistakes: on time, ±25–40 ms,
  Good early and late, a wrong note, a skipped note and a Miss at +160 ms. On
  `/calibrate` it plays every beat 40 ms late. Demo runs ignore the saved
  offset.
- **Shared audio session** (`src/components/game/audio-session.ts`). It
  opens one AudioContext on Start, for the mic (or demo bass) and the clock,
  and closes it when the run ends.

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
