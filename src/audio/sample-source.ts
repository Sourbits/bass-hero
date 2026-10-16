import {
  type AudioClip,
  type AudioSource,
  DEFAULT_FRAME_SIZE,
} from "./audio-source";
import { createFrameAssembler } from "./frame-assembler";
import { createFrameEmitter } from "./frame-emitter";

export interface SampleSourceOptions {
  frameSize?: number;
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
  { frameSize = DEFAULT_FRAME_SIZE }: SampleSourceOptions = {}
): AudioSource {
  const emitter = createFrameEmitter();
  let playing = false;

  const play = () => {
    const assembler = createFrameAssembler({
      frameSize,
      onFrame: emitter.emit,
      sampleRate: clip.sampleRate,
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
