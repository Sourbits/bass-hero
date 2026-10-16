import type { AudioFrame, AudioFrameListener } from "./audio-source";

/** The listener bookkeeping every audio source shares. */
export function createFrameEmitter() {
  const listeners = new Set<AudioFrameListener>();

  return {
    emit: (frame: AudioFrame) => {
      for (const listener of listeners) {
        listener(frame);
      }
    },
    subscribe: (listener: AudioFrameListener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
