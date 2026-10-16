import { describe, expect, test } from "bun:test";
import { encodeWav, type WavEncoding } from "./test-helpers";
import { decodeWav } from "./wav";

const SAMPLES = Float32Array.from([0, 0.5, -0.5, 0.25, -1]);

/** How far each encoding can round a sample. */
const PRECISION: Record<WavEncoding, number> = {
  float32: 6,
  pcm8: 1,
  pcm16: 4,
  pcm24: 6,
};

function expectSamplesClose(
  actual: Float32Array,
  expected: Float32Array,
  digits: number
) {
  expect(actual.length).toBe(expected.length);
  for (const [index, value] of expected.entries()) {
    expect(actual[index]).toBeCloseTo(value, digits);
  }
}

describe("decodeWav", () => {
  for (const encoding of ["pcm8", "pcm16", "pcm24", "float32"] as const) {
    test(`decodes ${encoding}`, () => {
      const audio = decodeWav(
        encodeWav({ channels: [SAMPLES], encoding, sampleRate: 44_100 })
      );

      expect(audio.sampleRate).toBe(44_100);
      expectSamplesClose(audio.samples, SAMPLES, PRECISION[encoding]);
    });
  }

  test("averages stereo down to mono", () => {
    const left = Float32Array.from([0.5, 0.5, -0.5]);
    const right = Float32Array.from([0.5, 0, -0.5]);

    const audio = decodeWav(
      encodeWav({ channels: [left, right], sampleRate: 48_000 })
    );

    expectSamplesClose(audio.samples, Float32Array.from([0.5, 0.25, -0.5]), 4);
  });

  test("skips chunks it doesn't know, including odd-length ones", () => {
    const bytes = encodeWav({
      channels: [SAMPLES],
      extraChunks: [{ bytes: new Uint8Array([1, 2, 3]), id: "LIST" }],
      sampleRate: 48_000,
    });

    expectSamplesClose(decodeWav(bytes).samples, SAMPLES, 4);
  });

  test("reads to the end when the data size was never filled in", () => {
    const bytes = encodeWav({ channels: [SAMPLES], sampleRate: 48_000 });
    const view = new DataView(bytes);
    view.setUint32(
      bytes.byteLength - SAMPLES.length * 2 - 4,
      0xff_ff_ff_ff,
      true
    );

    expectSamplesClose(decodeWav(bytes).samples, SAMPLES, 4);
  });

  test("rejects files that aren't WAV", () => {
    expect(() =>
      decodeWav(new TextEncoder().encode("not audio").buffer)
    ).toThrow("Not a WAV file");
  });

  test("rejects compressed formats", () => {
    const bytes = encodeWav({ channels: [SAMPLES], sampleRate: 48_000 });
    new DataView(bytes).setUint16(20, 2, true);

    expect(() => decodeWav(bytes)).toThrow("Unsupported WAV format code 2");
  });

  test("rejects files without audio data", () => {
    const bytes = encodeWav({ channels: [SAMPLES], sampleRate: 48_000 });

    expect(() => decodeWav(bytes.slice(0, 36))).toThrow(
      "WAV file has no data chunk"
    );
  });
});
