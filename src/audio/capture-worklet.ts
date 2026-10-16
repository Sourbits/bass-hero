export const CAPTURE_PROCESSOR_NAME = "bass-hero-capture";

/** What the processor posts for every 128-sample block. */
export interface CapturedBlock {
  samples: Float32Array;
  /** AudioContext time of the block's first sample, in seconds. */
  time: number;
}

/**
 * Runs on the audio thread. It only copies each 128-sample block from the
 * first input channel to the main thread, stamped with the audio clock's time,
 * and framing happens in code that can be tested. It writes nothing to its
 * output, so it plays silence.
 */
const PROCESSOR_SOURCE = `
class CaptureProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0]?.[0];
    if (channel) {
      const samples = channel.slice();
      this.port.postMessage({ samples, time: currentTime }, [samples.buffer]);
    }
    return true;
  }
}
registerProcessor("${CAPTURE_PROCESSOR_NAME}", CaptureProcessor);
`;

const loads = new WeakMap<BaseAudioContext, Promise<void>>();

/**
 * Loads the processor from a blob URL, so there's no separate file to serve.
 * Loads once per context, because registering the processor twice throws.
 */
export function loadCaptureWorklet(context: BaseAudioContext) {
  let load = loads.get(context);
  if (!load) {
    const url = URL.createObjectURL(
      new Blob([PROCESSOR_SOURCE], { type: "text/javascript" })
    );
    load = context.audioWorklet.addModule(url).finally(() => {
      URL.revokeObjectURL(url);
    });
    load.catch(() => loads.delete(context));
    loads.set(context, load);
  }
  return load;
}
