import { type AudioSource, DEFAULT_FRAME_SIZE } from "./audio-source";
import { CAPTURE_PROCESSOR_NAME, loadCaptureWorklet } from "./capture-worklet";
import { createFrameAssembler } from "./frame-assembler";
import { createFrameEmitter } from "./frame-emitter";

/** Something live to listen to, such as a microphone or an oscillator. */
export interface LiveInput {
  node: AudioNode;
  /** Lets go of what the input holds, such as microphone tracks. */
  release: () => void;
}

export type OpenLiveInput = (context: AudioContext) => Promise<LiveInput>;

export interface WebAudioSourceOptions {
  frameSize?: number;
}

interface Session {
  capture: AudioWorkletNode;
  context: AudioContext;
  input: LiveInput;
}

/**
 * Captures a live Web Audio input in real time. Browser only. The microphone
 * and the in-browser test tone both go through this, so they share one
 * capture path.
 *
 * Call start() from a user gesture such as a click, because browsers keep
 * audio suspended until the user interacts with the page.
 */
export function createWebAudioSource(
  openInput: OpenLiveInput,
  { frameSize = DEFAULT_FRAME_SIZE }: WebAudioSourceOptions = {}
): AudioSource {
  const emitter = createFrameEmitter();
  let session: Promise<Session> | null = null;

  const open = async (): Promise<Session> => {
    // Created before anything is awaited, while the user gesture still counts.
    const context = new AudioContext({ latencyHint: "interactive" });
    let input: LiveInput | undefined;

    try {
      input = await openInput(context);
      await loadCaptureWorklet(context);

      const capture = new AudioWorkletNode(context, CAPTURE_PROCESSOR_NAME);
      const assembler = createFrameAssembler({
        frameSize,
        onFrame: emitter.emit,
        sampleRate: context.sampleRate,
      });
      capture.port.onmessage = (event: MessageEvent<Float32Array>) => {
        assembler.push(event.data);
      };

      input.node.connect(capture);
      // The processor outputs silence, but browsers only run nodes that lead
      // to the speakers.
      capture.connect(context.destination);
      await context.resume();

      return { capture, context, input };
    } catch (error) {
      input?.release();
      await context.close();
      throw error;
    }
  };

  const close = async ({ capture, context, input }: Session) => {
    capture.port.onmessage = null;
    capture.disconnect();
    input.node.disconnect();
    input.release();
    await context.close();
  };

  return {
    onFrame: emitter.subscribe,
    start: async () => {
      if (!session) {
        const opening = open();
        session = opening;
        opening.catch(() => {
          if (session === opening) {
            session = null;
          }
        });
      }
      await session;
    },
    stop: async () => {
      const pending = session;
      session = null;
      if (!pending) {
        return;
      }
      // If start() is still in progress, wait for it, then shut it down.
      const opened = await pending.catch(() => null);
      if (opened) {
        await close(opened);
      }
    },
  };
}
