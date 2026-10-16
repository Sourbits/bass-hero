import {
  type AudioClip,
  type AudioSource,
  DEFAULT_FRAME_SIZE,
} from "./audio-source";
import { createFrameAssembler } from "./frame-assembler";
import { createFrameEmitter } from "./frame-emitter";

export interface SampleSourceOptions {
  frameSize?: number;
  /** Clock time of the clip's first sample, in seconds. Defaults to 0. */
  startTime?: number;
}

/**
 * Plays an in-memory clip through the same interface as the microphone.
 *
 * It doesn't wait for real time: start() hands every frame to the listeners
 * straight away and resolves after the last one, so tests run fast and give
 * the same result every time. Calling stop() from a listener ends playback
 * early, and calling start() again replays from the beginning.
 */
export function createSampleSource(
  clip: AudioClip,
  { frameSize = DEFAULT_FRAME_SIZE, startTime = 0 }: SampleSourceOptions = {}
): AudioSource {
  const emitter = createFrameEmitter();
  let playing = false;

  const play = () => {
    const assembler = createFrameAssembler({
      frameSize,
      onFrame: emitter.emit,
      sampleRate: clip.sampleRate,
      startTime,
    });
    for (
      let offset = 0;
      playing && offset < clip.samples.length;
      offset += frameSize
    ) {
      assembler.push(clip.samples.subarray(offset, offset + frameSize));
    }
    if (playing) {
      assembler.flush();
    }
  };

  return {
    onFrame: emitter.subscribe,
    start: () => {
      if (playing) {
        return Promise.resolve();
      }
      playing = true;
      try {
        play();
        return Promise.resolve();
      } catch (error) {
        return Promise.reject(error);
      } finally {
        playing = false;
      }
    },
    stop: () => {
      playing = false;
      return Promise.resolve();
    },
  };
}
