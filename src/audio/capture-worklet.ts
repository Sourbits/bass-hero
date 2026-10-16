export const CAPTURE_PROCESSOR_NAME = "bass-hero-capture";

/**
 * Runs on the audio thread. It only copies each 128-sample block from the
 * first input channel to the main thread, where framing happens in code that
 * can be tested. It writes nothing to its output, so it plays silence.
 */
const PROCESSOR_SOURCE = `
class CaptureProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0]?.[0];
    if (channel) {
      const block = channel.slice();
      this.port.postMessage(block, [block.buffer]);
    }
    return true;
  }
}
registerProcessor("${CAPTURE_PROCESSOR_NAME}", CaptureProcessor);
`;

/** Loads the processor from a blob URL, so there's no separate file to serve. */
export async function loadCaptureWorklet(context: BaseAudioContext) {
  const url = URL.createObjectURL(
    new Blob([PROCESSOR_SOURCE], { type: "text/javascript" })
  );
  try {
    await context.audioWorklet.addModule(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}
