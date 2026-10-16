/** Builds WAV files in memory so tests don't need binary fixtures. */

export type WavEncoding = "float32" | "pcm8" | "pcm16" | "pcm24";

export interface EncodeWavOptions {
  /** One array per channel, all the same length. */
  channels: Float32Array[];
  encoding?: WavEncoding;
  /** Extra chunks written between fmt and data, such as LIST metadata. */
  extraChunks?: { bytes: Uint8Array; id: string }[];
  sampleRate: number;
}

const BYTES_PER_SAMPLE: Record<WavEncoding, number> = {
  float32: 4,
  pcm8: 1,
  pcm16: 2,
  pcm24: 3,
};

type SampleWriter = (view: DataView, offset: number, value: number) => void;

const SAMPLE_WRITERS: Record<WavEncoding, SampleWriter> = {
  float32: (view, offset, value) => view.setFloat32(offset, value, true),
  pcm8: (view, offset, value) =>
    view.setUint8(offset, Math.round(value * 127) + 128),
  pcm16: (view, offset, value) =>
    view.setInt16(offset, Math.round(value * 32_767), true),
  pcm24: (view, offset, value) => {
    const scaled = Math.round(value * 8_388_607);
    const unsigned = scaled < 0 ? scaled + 16_777_216 : scaled;
    view.setUint16(offset, unsigned % 65_536, true);
    view.setUint8(offset + 2, Math.floor(unsigned / 65_536));
  },
};

function writeTag(view: DataView, offset: number, tag: string) {
  for (let index = 0; index < 4; index += 1) {
    view.setUint8(offset + index, tag.charCodeAt(index));
  }
}

export function encodeWav({
  channels,
  encoding = "pcm16",
  extraChunks = [],
  sampleRate,
}: EncodeWavOptions): ArrayBuffer {
  const bytesPerSample = BYTES_PER_SAMPLE[encoding];
  const frameCount = channels[0]?.length ?? 0;
  const blockSize = bytesPerSample * channels.length;
  const dataSize = frameCount * blockSize;
  const extraSize = extraChunks.reduce(
    (total, chunk) => total + 8 + chunk.bytes.length + (chunk.bytes.length % 2),
    0
  );

  const buffer = new ArrayBuffer(12 + 24 + extraSize + 8 + dataSize);
  const view = new DataView(buffer);

  writeTag(view, 0, "RIFF");
  view.setUint32(4, buffer.byteLength - 8, true);
  writeTag(view, 8, "WAVE");

  writeTag(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, encoding === "float32" ? 3 : 1, true);
  view.setUint16(22, channels.length, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockSize, true);
  view.setUint16(32, blockSize, true);
  view.setUint16(34, bytesPerSample * 8, true);

  let offset = 36;
  for (const chunk of extraChunks) {
    writeTag(view, offset, chunk.id);
    view.setUint32(offset + 4, chunk.bytes.length, true);
    new Uint8Array(buffer, offset + 8, chunk.bytes.length).set(chunk.bytes);
    offset += 8 + chunk.bytes.length + (chunk.bytes.length % 2);
  }

  writeTag(view, offset, "data");
  view.setUint32(offset + 4, dataSize, true);
  offset += 8;

  const write = SAMPLE_WRITERS[encoding];
  for (let frame = 0; frame < frameCount; frame += 1) {
    for (const channel of channels) {
      write(view, offset, channel[frame] ?? 0);
      offset += bytesPerSample;
    }
  }

  return buffer;
}
