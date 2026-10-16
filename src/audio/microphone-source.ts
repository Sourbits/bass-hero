import type { AudioSource } from "./audio-source";
import {
  createWebAudioSource,
  type WebAudioSourceOptions,
} from "./web-audio-source";

export interface MicrophoneSourceOptions extends WebAudioSourceOptions {
  /** A specific input, such as an audio interface. Defaults to the system mic. */
  deviceId?: string;
}

/**
 * Live input from a microphone or audio interface. Browser only.
 *
 * start() rejects with the browser's own error when access fails, for
 * example a DOMException named NotAllowedError when the user blocks the mic.
 */
export function createMicrophoneSource({
  deviceId,
  ...options
}: MicrophoneSourceOptions = {}): AudioSource {
  return createWebAudioSource(async (context) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new DOMException(
        "Microphone access needs a secure page (https or localhost).",
        "NotSupportedError"
      );
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        // Voice processing filters out low notes and smears note attacks.
        autoGainControl: false,
        channelCount: { ideal: 1 },
        echoCancellation: false,
        noiseSuppression: false,
        ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
      },
    });

    return {
      node: context.createMediaStreamSource(stream),
      release: () => {
        for (const track of stream.getTracks()) {
          track.stop();
        }
      },
    };
  }, options);
}
