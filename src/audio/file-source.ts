import type { AudioSource } from "./audio-source";
import { createSampleSource, type SampleSourceOptions } from "./sample-source";
import { decodeWav } from "./wav";

/**
 * Replays a recorded WAV file through the same interface as the microphone,
 * as fast as the listeners can take it. See createSampleSource.
 */
export function createFileSource(
  wavBytes: ArrayBuffer,
  options?: SampleSourceOptions
): AudioSource {
  return createSampleSource(decodeWav(wavBytes), options);
}
