# Bass Hero notes

## Latest: friends

On the `friends` branch (from `settings-and-shortcuts`).

- **Usernames:**
  - 3 to 20 letters, numbers, `_` or `.`, unique ignoring case, and shown
    the way you typed them ("BassBuddy").
  - New accounts pick one when signing up; it replaces the old Name field.
  - Existing accounts are asked for one on the Account and Friends pages.
  - You can change yours on the Account page, and sign in with your
    username or your email.
- **The Friends tab:**
  - Add a friend by username. They get a request, and once they accept,
    you can both see each other's stats.
  - If they had already asked you, adding them accepts instead.
  - A number on the tab shows requests waiting for you.
  - Requests can be declined or cancelled, and friends removed, from their
    profile.
- **What friends see:**
  - A card per friend: stars (out of 120), achievements (out of 39), their
    furthest level, and notes played.
  - Tap one for their profile: levels cleared, notes known (green on the
    heat map, out of 52), days in a row, best ear streak, when they last
    played, and every achievement with the date they got it.
  - Your own card ("you") sits at the top to compare.
  - Never sent to friends: your email, your heat map note by note, your
    settings.
- **Choices I made:**
  - Requests need accepting, so nobody can see your stats without your OK.
  - Friends see a summary, not your raw saved data.
  - A friend's numbers are as of their last save, and only what's saved to
    their account counts.
  - The waiting-requests number is checked when you change pages or come
    back to the tab, not live.
- **How it's built:**
  - Better Auth's username plugin. It added `username` and
    `displayUsername` columns, with a unique index, to the accounts table
    on its own the first time the server started.
  - A `friendship` table: one row per pair, "pending" until accepted.
  - The `/api/friends` route: GET lists, POST sends or accepts, DELETE
    declines, cancels or removes.
  - The summary is worked out in `src/game/player-summary.ts`.
- **Test players** (logins in `data/dev-test-account.json`):
  - **BassBuddy**, with made-up progress: 38 stars, up to Medium 4.
  - **LowEnd.C**, with no progress.
  - The old "testing" account is now **TestPlayer**.
  - Your account ("yours") has no username yet, so it'll ask you to pick
    one.
- **Checked in the browser,** as TestPlayer against BassBuddy and
  LowEnd.C:
  - Picking a username: a taken one ("bassbuddy") was refused, then
    "TestPlayer" saved and showed in the nav at once.
  - BassBuddy's request showed a "1" on the tab, and accepting it showed
    their card with the right numbers.
  - Their profile listed their stats and achievements.
  - A request to "lowend.c" was sent and then cancelled.
  - Removing BassBuddy went back to the list, with no friends left.
  - The API's messages: unknown username, yourself, already asked, and
    signed out.
- **Limits:**
  - Like accounts, friends only work on this computer until the site is
    hosted online.
  - Finding someone takes their exact username: there's no search or
    suggestions.
  - There's no blocking. Removing someone ends the friendship, but they can
    ask again.
- **Dev server fix:** the reload loop came back once, so the dev
  compiler's disk cache is now off (`turbopackFileSystemCacheForDev:
  false` in `next.config.ts`). If pages ever reload in a loop again,
  restarting the server is enough.
- **Nothing new to install.**

## Earlier: settings, left-handed mode, keyboard shortcuts

On the `settings-and-shortcuts` branch (from `achievements`). Committed.

- **Settings page:** the gear icon at the top right. It has:
  - **Left-handed mode.**
  - **The Levels options:** buzz checking, guide tone, always show the
    fretboard map. They're still under the level picker too.
  - **This device's latency offset,** with a link to Calibrate.
  - **A list of every keyboard shortcut.**
- **Left-handed mode mirrors everything:**
  - The fretboard: the nut and open strings are on the right, and the frets
    count up to the left. That covers Learn, the heat map, Practice's
    custom set, the level map and ear training.
  - The highway: lanes go G, D, A, E from left to right.
  - The tuner: the string row and the string picker are mirrored too.
  - Page text that says "left" or "right" switches with it.
  - It saves to your account like everything else, so it follows you.
- **Keyboard shortcuts:**
  - **Space** starts a run, or plays again. **Esc** stops one. This works
    in Levels, Weak spots, Ear training, Practice and Calibrate.
  - **Levels:** ← and → pick the level before or after. **Enter** plays the
    next level from the results.
  - **Practice:** ← and → make the tempo slower or faster.
  - **Ear training:** **R** plays the note again.
  - **Tuner:** **Space** starts or stops listening. **E, A, D, G** pick a
    string, and **0** goes back to detecting it.
  - Buttons show their key as a small hint, on computers only, since phones
    and tablets have no keyboard.
  - Shortcuts stay out of the way while you type in a box. Space and Enter
    on a focused button press it, as usual.
  - Starting a run takes focus off the button you clicked, so Space mid-run
    can't press Stop by accident.
- **Choices I made:**
  - The arrows change the level within a tier and don't cross tiers.
  - Space does nothing mid-run, rather than pausing: there's no pause yet.
  - Keys are in `src/config/shortcuts.ts`, with the list the Settings page
    shows.
- **Checked in the browser (demo mode), in left-handed mode:**
  - The fretboard mirrored, with "G string" labels on the right.
  - The highway lanes read G, D, A, E, and notes landed in the right lanes.
  - Keys: ← → changed the level, Space started a run, Esc stopped it, and
    Enter after a full run started the next level.
  - Space mid-run, after starting with a mouse click, didn't stop the run.
  - The tuner's strings mirrored, and G and 0 picked strings.
  - Practice's arrows changed the tempo.
- **If the dev site keeps reloading or shows old pages:** Next's dev
  cache got corrupted. It happened once here, while editing with the server
  running. Fix: stop the server (Ctrl-C), delete the `.next` folder, and run
  `bun run dev` again. `.next` is rebuilt automatically, and your progress
  and accounts aren't in it.
- **Nothing new to install.**

## Earlier: achievements

On the `achievements` branch (from `combos-and-training`). Committed.

- **39 achievements:** the 28 you approved, plus 11 early ones, so a new
  player unlocks a few in their first sessions.
- **The 11 new early ones** (in the "Getting started" group):
  - **Spot On**: land your first Perfect.
  - **First Clear**: clear your first level (1 star or more).
  - **Open Strings**: hit all four open strings, E, A, D and G.
  - **Shining Star**: get 3 stars on any level.
  - **Free Play**: finish a Practice run.
  - **Self Aware**: finish a Weak spots run.
  - **First Listen**: find an ear training note on the first try.
  - **Halfway There**: clear Easy 5.
  - **Century**: play 100 notes.
  - **Explorer**: play Levels, Practice, Weak spots and Ear training.
  - **Safe Keeping**: sign in, so your progress is saved to an account.
- **Where they show:**
  - A new **Achievements** tab lists all 39 in six groups, with unlock
    dates and progress bars for goals that build up ("12 / 30 stars").
  - A pop-up in the corner announces each unlock, on any page. Four or more
    at once show as one pop-up.
- **Saved** in the browser and, when signed in, to the account. Merging
  keeps everything unlocked on either device, with the earliest date.
- **Already earned counts.** Achievements that come from saved progress
  (stars, clears, the heat map) unlock on the first page load. Existing
  players aren't starting from zero.
- **Demo runs don't count**, same as for the heat map.
- **Choices I made where the list left room:**
  - **Clean Hands** needs 2 stars or more, with buzz checking on and no
    buzzing note. Otherwise it came free with almost any first clear.
  - **Metronome** uses your average offset, early and late cancelling out,
    as on the results screen: within ±5 ms over 30+ hits.
  - **"Solid green"** on the heat map means mastery 0.85 or more: the line
    under which a note counts as a weak spot.
  - **Marathon and Century** count every note in finished runs and ear
    training rounds, hit or not.
  - **Night Owl** means finishing between midnight and 4 am.
  - **Day streaks** need a run or round finished on each day. On the page,
    a streak shows as broken once a whole day passes without playing.
- **Goals are all in `src/config/achievements.ts`**, to tune. The list is
  `src/game/achievement-list.ts`.
- **Checked in the browser:**
  - Made-up guest progress unlocked First Clear, Open Strings, Shining Star
    and Halfway There on load, in one pop-up.
  - Saving a calibration unlocked Dialed In.
  - Signing in unlocked Safe Keeping, and the account then held all 6.
- **Not verified with a real bass:** unlocks from real runs, ear training
  and the tuner. The mic is blocked in my browser and demo runs don't
  count, so 19 unit tests cover those rules instead.
- **Nothing new to install.**

## Earlier: accounts and saved progress

On the `combos-and-training` branch, with the combos work below. Committed.

- **Accounts.** A "Sign in" button at the right of the tabs opens the new
  Account page: sign in, or create an account with a name, email and
  password (8+ characters). Signed in, the button shows your name, and the
  page shows whether everything is saved, with Save now and Sign out.
- **What's saved:** level stars and bests, the level you're on in each tier
  and the level options, the heat map stats, and Practice's note set and
  tempo. **Not saved:** the latency calibration, on purpose: it belongs to a
  device's mic and speakers, so each device keeps its own.
- **Guests still play as before**, saved in the browser only.
- **How saving works** (`src/components/account/account-provider.tsx`):
  - On sign-in, the account and this browser's progress are merged, keeping
    the best of both: for each level the best stars, score and hit rate.
    Settings and "current level" come from whichever copy changed last.
    So guest progress isn't lost when you sign in.
  - Then each change is saved 1.5 s after it happens (a finished run, a
    changed setting).
  - The server merges every save into what it has instead of overwriting,
    so two devices can't wipe each other's bests. If the account had
    something newer, the open screen updates on its own.
  - Sign out saves anything pending first, then clears this browser's copy
    so the next person starts fresh. It's still in the account. If that
    last save fails (say, the server is down), it stays signed in and offers
    "Sign out anyway".
- **How it's built:**
  - [Better Auth](https://www.better-auth.com) 1.7 for accounts: password
    hashing, session cookies and rate limiting, rather than writing my own.
    It's the maintained successor to the libraries Next.js recommends.
  - The database is a SQLite file at `data/bass-hero.db`, through Node 24's
    built-in `node:sqlite`, so nothing native needs compiling or
    installing. Its tables are made on the first request. `data/` is never
    committed. To start over, stop the server and delete `data/`.
  - Saved progress is one JSON document per player, checked on the way in
    (`src/game/saved-data.ts`) and capped at 256 KB.
  - Routes: `/api/auth/*` (Better Auth) and `/api/player-data` (GET your
    progress, PUT to save and merge it).
  - The session is read in the browser and in those routes only, so every
    page stays static and fast.
- **Setup:** I made `.env.local` with a fresh random secret, so it works as
  is. On another machine, copy `.env.example` to `.env.local` and fill it in.
- **Test account:** I made one to test with. Its details are in
  `data/dev-test-account.json`, which is never committed.
- **Checked in the browser:**
  - Sign-up with existing guest progress: the account got all of it.
  - Sign-out cleared this browser's copy, and the account then refused
    requests (401).
  - Signing back in on the empty browser brought back the stars, the
    current level and the tempo.
  - A best saved from a "second device" showed up on the open Game screen
    after the next auto-save.
  - Changing a level option reached the server within 2 s.
  - A wrong password shows "Invalid email or password".
- **Also:** opening `/` now redirects through `next.config.ts` instead of a
  page. The old way printed an error on every dev reload under Cache
  Components.
- **Limits, for later:**
  - **It only runs on this computer for now.** An account only follows you
    to another device once the site is hosted somewhere.
    - Hosting needs a server with a disk that persists, for the SQLite file.
    - Or, on serverless hosting such as Vercel, a hosted database such as
      Postgres instead. Better Auth supports that, and `player-data.ts` is
      small.
    - Set `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL` there.
  - **No email check or password reset yet.** Both need an email-sending
    service. Until then, a forgotten password can't be recovered.
  - **Heat map merging keeps, for each note, the copy with more plays.** If
    you play offline on two devices, the smaller history for that note is
    dropped rather than combined.
- **Nothing new to install.**

## Earlier: combos, longer levels, heat map, Weak spots, ear training

On the `combos-and-training` branch (from `main-game`).

- **Combos.** Every 10 hits in a row (Perfect or Good) raise the multiplier
  by one, up to ×4; a Miss resets it. Points are multiplied by the combo at
  the time of each hit. The highway's corner shows "×3 · 24 in a row", and at
  ×4 the strike line glows amber ("on fire"). Results show the longest
  streak and "Full combo!". Combos follow the order notes were judged in, so
  a note called unplayed late still breaks the streak. Settings: `COMBO` in
  `src/config/timing.ts`.
- **Longer levels.** Notes per run, level 1 → 10: Easy 12 → 32, Medium
  40 → 64, Hard 72 → 112, Demon 128 → 256. Hard 10 and Demon 10 now each run
  about a minute.
- **Fretboard heat map** (`src/game/note-stats.ts`).
  - Every real run (Levels, Practice, Weak spots, ear training) records
    each note's result. Demo runs don't count.
  - Each note gets a mastery score from 0 to 1 that weighs recent results
    most: each result moves it 30% of the way to hit or miss.
  - Colors run red → amber → green; dashed means not played yet.
  - It's shown in Weak spots, and on the Learn page with a checkbox.
- **Game modes.** The Game tab now has three:
  - **Levels**, as before.
  - **Weak spots**: drills the 8 notes you know least (below 85% mastery),
    filling in with notes from your current level you haven't played yet.
    32 notes at 70 BPM, names shown.
  - **Ear training**: the game plays a note, then listens while you find it.
    "↑ Higher / ↓ Lower than F1" after a miss, the string after the second
    miss, and the answer (played again) after the third. 100 / 50 / 25
    points by try, with a multiplier for first-try answers in a row. Notes
    come from the level you pick. To work without headphones, it ignores
    anything played until 1.1 s after its own note, by which time the note
    has faded. Settings: `src/config/ear-training.ts`.
- **Checked in the browser (demo mode):**
  - A Medium 1 run's combo reached ×2 at 12 in a row, with a longest streak
    of 13, as scripted.
  - The heat map and Weak spots list matched made-up stats.
  - An ear training round went exactly as scripted, 7 of 10 on the first
    try.
- **Not yet verified:** that the mic doesn't hear the game's own ear-training
  note through speakers. The demo can't test this. If an answer registers
  before you play, raise `listenAfterMs`.

### Achievements

Proposed here, then built: see "Latest: achievements" at the top.

## Earlier: string tuner, Game tab, difficulty curve, buzz, smoother scrolling

On the `main-game` branch (from `note-highway`).

### Tabs

Every page now has a tab bar: **Game** (new, the main game), **Practice**
(the old Play page: free play with note sets and a tempo slider), **Learn**,
**Tuner** and **Calibrate**. The home page goes straight to Game.

### Tuner: tune up or down, string by string

- **Which string.** "Auto" picks the open string nearest the pitch you play.
  Buttons E, A, D and G pick a string by hand, for one tuned more than about
  2½ semitones off, which Auto could take for its neighbor.
- **What it says.** It shows "↑ Tune up · Tighten the string" or "↓ Tune
  down · Loosen the string", with the cents, measured against the string's
  open note (E1, A1, D2, G2), not the nearest note. Within ±5 cents it says
  "✓ In tune".
- **All four strings.** A status row keeps the last reading for each string,
  so you can see them all at once.
- **Buzz meter.** It shows how buzzy the note sounds, with a line marking
  where the game starts counting a miss. Use it to tune the threshold (see
  Buzz).
- Code: `src/pitch/string-tuning.ts`, tested.

### Game: the difficulty curve

All the tuning values are in `src/config/difficulty.ts`. Each value is given
for level 1 and level 10 of its tier; the levels in between are spread evenly.

| Tier | Notes (introduced a few per level) | Spacing | Tempo | Notes per run | Help |
| --- | --- | --- | --- | --- | --- |
| Easy | Open E and A at level 1 (2 notes), then open D and G, then G1, C2, E2, A2, F1, B1 (10 by level 10) | Every 2 beats → every beat | 50 → 70 BPM | 10 → 16 | Fret numbers, fretboard map |
| Medium | Easy's 10, plus the rest of the natural notes to fret 5 (16) | Every beat | 70 → 95 BPM | 16 → 20 | Fretboard map |
| Hard | Medium's 16, plus sharps to fret 5, then every note on frets 6–7 (32) | Every beat | 95 → 120 BPM | 20 → 28 | None: play from memory |
| Demon | Every note to the 12th fret (52), from level 1 | Two notes per beat | 100 → 150 BPM | 32 → 48 | None, and tighter timing: Perfect ±35 ms, Good ±80 ms |

- **Easy 1 is very easy:** two open strings, a note every 2.4 seconds.
- **Pace never drops** from Easy 1 to Demon 10, measured in notes per minute
  (25 → 300). It's tested, along with the rule that each tier starts with
  every note the one before ended with.
- **Notes come in a few at a time.** Each level adds one or two notes to the
  ones before, and the Game page lists what's new ("New in this level: G1 (E
  string, fret 3)…").
- **Movement grows within each tier.** Distance on the neck = frets moved,
  plus 2 for each string crossed. Each tier sets the closest and furthest a
  note may move from the last, as shares of its widest possible move. Easy
  allows repeats throughout; Demon forces jumps of at least 30–50% of the
  neck. Notes played less often are more likely, so a run covers the level's
  notes.
- **The fastest notes** (Demon 10, 200 ms apart) stay above the ~150 ms that
  naming a note needs.
- **Progress** is saved per browser: best hit rate, best score and stars per
  level, with stars at 60%, 80% and 95% of notes hit. All levels are open.
- **Learning the sound.** Missed notes are listed after a run with where they
  are and "Hear it". The optional guide tone plays each note as it lands (use
  headphones).

### Smoother scrolling (the micro lags)

- **Measured.** Frames arrived steadily, with none dropped and no long tasks,
  but the game clock moved unevenly: 15.3 to 17.7 ms per 16.7 ms frame, up to
  6.8 ms off. Notes near the strike line move about 0.5 px per ms, so they
  jumped unevenly by 1–3 px: the micro lags. This was on our side.
- **Fix** (`src/audio/audio-clock.ts`). The clock keeps a smoothed offset
  between the audio clock and the page's clock, and each frame is drawn at
  its own timestamp plus that offset. Measured again: the clock now moves by
  exactly each frame's interval (within 0.005 ms). It still follows the audio
  clock, which is what pluck times use, so timing judgments don't change.
- **Also:** the highway no longer looks up the page's font every frame, and
  the fretboards and note sets aren't rebuilt each time a note is judged.
- **If it still stutters,** it's likely your machine: power-saving mode, many
  tabs, or Bluetooth audio. Say so and I'll look further. The next step would
  be moving the audio analysis off the page's main thread.

### Fast runs: quick re-plucks are now caught

At Demon speed the demo missed several plucks: a note played right after
another, at the same loudness, with only a short mute. The mute rule now
needs 8 ms below 5% of the note's level, instead of 12 ms below 10%. Tested
on generated runs: quick re-plucks missed went from 306 of 336 to none, with
no new false onsets. A new test plays 12 notes 200 ms apart with 8 ms mutes,
for every note from B0 to G3. The Demon 1 demo now scores exactly as
scripted.

Also, timing is now judged in whole milliseconds, the same as shown, so
"Late +80 ms" is never a Miss when Good reaches ±80 ms.

### Buzz: a buzzing note counts as a Miss

- **How it's measured** (`src/onset/buzz.ts`). The share of the note's energy
  that's high-frequency rattle, in dB, in a window 25–105 ms after the pluck
  (skipping the pluck's own bright click). "High" starts at 12× the note, or
  1.5 kHz if that's higher, so the note's own harmonics don't count. A string
  slapping a fret clicks every cycle, which shows up there.
- **The threshold** is −22 dB, in `src/config/timing.ts` as
  `buzzThresholdDb`. On generated notes:
  - clean notes measure −46 to −37 dB for low notes, and up to about −27 dB
    for bright high ones;
  - strong buzz measures −21 to −13 dB.
  - Low notes need more buzz to cross, because they click fewer times a
    second.
- **Needs tuning on a real bass.** The threshold is a guess until it's been
  set against your bass, amp and mic. Play clean and deliberately buzzy notes
  on the tuner and watch the buzz meter. If clean notes come close to the line,
  lower `buzzThresholdDb` toward −15; if buzz slips under it, raise it toward
  −28.
- **Rules.** A buzzing right note is "Miss · Buzzing: fret it cleanly". If
  it's also too early or late, that's what's shown instead. The game has an
  option to switch buzz checking off.

### What to test with your bass

1. **Tuner.** Tune each string from well flat and well sharp. Check the arrow
   and "Tune up/down" match, and Auto picks the right string. Then play a few
   clean notes and a few buzzy ones (press lightly just behind the fret) and
   note the buzz meter values.
2. **Game.** Is Easy 1 easy enough, and is the climb through Easy and
   Medium smooth? Try a Demon level to check it's hard but fair.
3. **Smoothness.** Do notes still stutter? If they do, tell me your browser
   and whether your computer is plugged in.
4. **Buzz rule.** Does a clean note ever come up "Buzzing"? Does a really
   buzzy one get through? Tell me the meter readings and I'll set the
   threshold.

## Earlier: Guitar Hero highway, note sets, learning

On the `note-highway` branch (from `timing-system`).

- **Highway.** Notes come toward you down a perspective highway, one lane per
  string (E, A, D, G from left to right, thickest to thinnest), and hit a
  ring per lane at the bottom. Each note's position comes from
  `projectNote()` in `src/game/layout.ts`. At its target time a note is
  exactly on the strike line at full size (unit-tested). Notes speed up as
  they come closer, as in real perspective. They take 2.5 s from the far end
  to the strike line. Drawn on a canvas (`src/components/game/draw-highway.ts`)
  with upright, high-contrast labels. Feedback appears under the rings, so it
  never covers incoming notes.
- **Note sets** (`src/game/note-sets.ts`). Pick which notes appear: the
  warm-up song, open strings, natural notes on the E and A strings or on the
  D and G strings, first-position naturals, first position with sharps, or
  Custom, where you tap notes on a fretboard. Every set except the song
  generates a new 16-note run each time; the same note never comes three
  times in a row. The choice is saved per browser.
- **Legend.** Under the game, a fretboard shows where the set's notes are,
  colored like their lanes. Tap a note to hear it; in Custom, tapping picks
  notes instead. `/notes` ("Learn the notes") shows the whole neck to the
  12th fret: naturals are solid, sharps are outlined, and tapping plays the
  note. It also has a short guide to note names, sharps and octaves.
- **Calibration** uses the same highway, with full-width bars, since any
  string will do.
- **Robustness fix.** Notes are only called "Not played" once the audio
  after them has been analyzed, not just when the clock passes. In a busy or
  background tab, plucks can reach the page late. Going by the clock alone,
  a demo run in a hidden browser pane once scored 13 misses.
- **Open question.** I read "pick what notes can be shown" as which notes
  appear in a run. If you meant what's written on each note (note name, fret
  number, or nothing, as a quiz), that's a small addition.

## Summary: timing system

Everything from this run is on the `timing-system` branch, branched from
`bass-hero-setup`, with one commit per milestone. Nothing is pushed. Build,
lint and all 152 tests pass. No new dependencies, so there's nothing to
install.

### What I built

- **Milestone 1, onset detection** (`src/onset/`). It finds the exact sample
  where each pluck starts, without waiting for pitch. Each pluck is then
  paired with the existing pitch detector to name the note, and the note
  keeps the pluck's time. All times are on one game clock.
- **Milestone 2, timing judgment** (`src/timing/`, `src/config/timing.ts`).
  Perfect is ±50 ms, Good ±120 ms, otherwise Miss, with early/late and ms.
  Wrong notes and unplayed notes are Misses. A calibration offset is
  subtracted from every hit, and the calibration math suggests one from
  plucks played along to a beat.
- **Milestone 3, test game screen.** `/play` slides 16 note circles into a
  target outline at an adjustable tempo, with feedback such as "Good · Late
  +80 ms", a running score and an end summary. `/calibrate` is the
  calibration screen. `?demo` on either page swaps the mic for a silent
  synthesized bass, so the whole loop can be checked without an instrument.

### Decisions

Details are under "Timing system decisions".

- **The clock.** The game clock is the AudioContext clock, in ms. Audio
  blocks carry the audio thread's own time, so pluck times are
  sample-accurate. The screen reads the same clock (via
  `getOutputTimestamp()`) every frame. `performance.now()` would drift from
  the audio clock, and any future music has to be scheduled on the audio
  clock anyway.
- **Calibration is visual.** You pluck as circles reach the outline, the same
  as in the game, with no click track. That measures the delay that matters
  in the game, and the mic can't mistake a click for a pluck. It's the median
  of 16 beats, saved per browser.
- **A ±200 ms Miss window.** A right note just outside Good shows "Miss ·
  Late +150 ms" instead of being ignored. Plucks with no clear pitch, or
  nowhere near a note, are ignored rather than penalized.
- **Octaves are strict.** E2 for E1 is a wrong note. There's an
  `ignoreOctave` switch in the config in case a laptop mic hears low E an
  octave up.
- **Tuning values.** All of them are in `src/config/timing.ts`: windows,
  grace time, points and the calibration beat.
- **Calibration screen in milestone 3.** It reuses the game's sliding-circle
  view, so it was built and committed with the game screen rather than with
  milestone 2's judgment code.

### Onset accuracy achieved

Generated plucks from B0 up to G3, including low E (41.2 Hz), at five
starting phases, at 44.1 and 48 kHz, with background noise. Nothing was
missed and nothing extra was detected. Errors are almost always slightly late
and never more than 0.1 ms early.

| Case | Worst error | Low E worst |
| --- | --- | --- |
| Pluck onto silence, or after muting the old note (attack ≤ 2 ms) | 3.4 ms | 2.6 ms |
| Quick re-plucks every 150 ms, each after a 15 ms mute | 2.6 ms | 2.6 ms |
| Slow 5 ms attack | 5.9 ms | 3.2 ms |
| Re-plucking a note that's still ringing, with no mute | 19.4 ms | 14.6 ms |

The full table is under "Onset detection". In the browser, a demo run of all
16 notes came out exactly as scripted ("On time", "Late +25 ms", "Early
−30 ms", …). Demo calibration of a player who's 40 ms late suggested 41 ms.

**Circles hit the outline on time.** This is unit-tested: at a note's target
time, `circleX()` puts its center exactly on the outline. In the browser I
also measured the drawn circles against the clock, and every upcoming circle
was where it should be to within 0.001 ms.

### What doesn't work yet, or isn't verified

- **Not tried with a real mic.** The built-in browser I tested with blocks
  microphone access. The demo modes cover everything after the mic, through
  the same capture path.
- **Re-plucking a ringing note without muting it** can be timed up to ~19 ms
  late on low notes. A note *quieter* than one still ringing on another
  string, without a mute, isn't detected at all.
- **Two plucks closer than 60 ms** count as one.
- **Feedback comes ~0.1 s after the pluck**, because that's how long naming a
  low note takes. Timing isn't affected.
- **Only Chromium tested**, not Safari or Firefox. There's no input device
  picker, no audio or music in the game, and no dark mode.

### What to test with your real bass

Use Chrome on this computer. An audio interface is best, if you have one. Make
it the default input, or pick it in Chrome's site settings for localhost.

```bash
bun run dev
```

1. **Check the input first.** Open http://localhost:3000/tuner, press Start
   and allow the mic. Play each open string. You should see E1, A1, D2 and G2,
   and the input level should jump when you pluck.
2. **Calibrate.** Open http://localhost:3000/calibrate and press Start. After
   the grey 4-3-2-1 count-in, pluck any open string each time a purple
   circle reaches the outline, 16 times. Pluck crisply and mute between
   plucks. Each pluck shows how late it was heard. At the end, press "Use N
   ms" to save the suggested offset.
   - If the spread is over about 30 ms, try again.
   - Run it twice. The two suggestions should be within ~10 ms of each other.
   - Expect roughly 20–80 ms with wired gear. Bluetooth headphones or
     speakers can add 150 ms or more; avoid them.
3. **Play.** Open http://localhost:3000/play, leave the tempo at 70 BPM and
   press Start. Play each note as its circle reaches the outline.
   - When you feel right on time, the feedback should mostly be Perfect,
     within about ±20 ms. If it's consistently early or late, recalibrate or
     adjust the offset on `/calibrate`.
   - Play one note wrong on purpose (it should say "Wrong note") and skip one
     (it should say "Not played").
4. **Things I couldn't test:**
   - The repeated notes (E1 E1, A1 A1…), played both with and without
     muting between them. A missed second pluck or late timing there is the
     known weak spot.
   - Low E through a laptop mic. If it keeps saying "Wrong note: E2", set
     `ignoreOctave: true` in `src/config/timing.ts`.
   - Slow tempos (40–50 BPM) and faster ones (100–140 BPM).
   - Soft playing: whether quiet plucks still register. The onset floor is
     −45 dBFS; see `floorDb` in `src/onset/onset-detector.ts`.
5. **If timing seems off,** a short WAV recording of you playing along is the
   best thing to bring back. Generated plucks can't show how a real attack
   looks to the detector.

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

## Earlier run: setup and tuner

This section and the ones below it are from the run that built the tuner, on
the `bass-hero-setup` branch.

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

## Setup and tuner decisions

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
