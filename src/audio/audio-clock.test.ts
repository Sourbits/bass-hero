import { describe, expect, test } from "bun:test";
import { type ClockSource, createAudioClock } from "./audio-clock";

const FRAME_MS = 1000 / 60;

/**
 * A fake audio clock that runs 5 s ahead of the page's clock, and reports
 * its timestamps with up to ±3 ms of jitter, as real browsers do.
 */
function jitteryAudio(jitterMs = 3) {
  let pageNow = 0;
  let audioAhead = 5000;
  let seed = 7;
  const jitter = () => {
    seed = (seed * 16_807) % 2_147_483_647;
    return ((seed / 2_147_483_647) * 2 - 1) * jitterMs;
  };
  const source: ClockSource = {
    currentTime: 0,
    getOutputTimestamp: () => {
      const performanceTime = pageNow + jitter();
      return {
        contextTime: (performanceTime + audioAhead) / 1000,
        performanceTime: pageNow,
      };
    },
  };
  return {
    advance: (ms: number) => {
      pageNow += ms;
      return pageNow;
    },
    setAhead: (ms: number) => {
      audioAhead = ms;
    },
    source,
  };
}

describe("createAudioClock", () => {
  test("moves by exactly one frame per frame, despite jittery audio timestamps", () => {
    const audio = jitteryAudio();
    const clock = createAudioClock(audio.source);
    // Let it settle on the offset first.
    for (let frame = 0; frame < 120; frame += 1) {
      clock.now(audio.advance(FRAME_MS));
    }

    let previous = clock.now(audio.advance(FRAME_MS));
    let worst = 0;
    for (let frame = 0; frame < 600; frame += 1) {
      const current = clock.now(audio.advance(FRAME_MS));
      worst = Math.max(worst, Math.abs(current - previous - FRAME_MS));
      previous = current;
    }

    // Raw timestamps would wobble by up to 6 ms between frames.
    expect(worst).toBeLessThan(0.5);
  });

  test("stays locked to the audio clock", () => {
    const audio = jitteryAudio();
    const clock = createAudioClock(audio.source);
    let at = 0;
    for (let frame = 0; frame < 300; frame += 1) {
      at = audio.advance(FRAME_MS);
      clock.now(at);
    }

    expect(clock.now(at)).toBeCloseTo(at + 5000, -0.5);
  });

  test("follows a real jump in the audio clock straight away", () => {
    const audio = jitteryAudio(0);
    const clock = createAudioClock(audio.source);
    clock.now(audio.advance(FRAME_MS));

    audio.setAhead(5200);
    const at = audio.advance(FRAME_MS);

    expect(clock.now(at)).toBeCloseTo(at + 5200, 6);
  });

  test("never goes backwards", () => {
    const audio = jitteryAudio(0);
    const clock = createAudioClock(audio.source);
    const later = clock.now(audio.advance(100));

    expect(clock.now(50)).toBe(later);
  });

  test("falls back to currentTime when there's no output timestamp", () => {
    const clock = createAudioClock({
      currentTime: 12,
      getOutputTimestamp: () => ({}),
    });

    const now = clock.now(performance.now());

    expect(now).toBeGreaterThan(11_900);
    expect(now).toBeLessThan(12_100);
  });
});
