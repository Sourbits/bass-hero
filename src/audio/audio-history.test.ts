import { describe, expect, test } from "bun:test";
import { createAudioHistory } from "./audio-history";

const frame = (time: number, values: number[]) => ({
  sampleRate: 10,
  samples: Float32Array.from(values),
  time,
});

describe("createAudioHistory", () => {
  test("looks up a stretch of audio by clock time", () => {
    const history = createAudioHistory(2);
    history.push(frame(100, [0, 1, 2, 3, 4]));
    history.push(frame(100.5, [5, 6, 7, 8, 9]));

    expect([...(history.slice(100.3, 100.7) ?? [])]).toEqual([3, 4, 5, 6]);
  });

  test("returns null for audio that hasn't arrived or was forgotten", () => {
    const history = createAudioHistory(1);
    for (let second = 0; second < 3; second += 1) {
      history.push(frame(second, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]));
    }

    expect(history.slice(2.5, 3.5)).toBeNull();
    expect(history.slice(0.5, 0.8)).toBeNull();
    expect(history.slice(2.2, 2.4)).not.toBeNull();
  });
});
