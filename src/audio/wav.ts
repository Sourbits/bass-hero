import type { AudioClip } from "./audio-source";

interface WavFormat {
  bitsPerSample: number;
  channels: number;
  encoding: "float" | "pcm";
  sampleRate: number;
}

interface ChunkLocation {
  offset: number;
  size: number;
}

type SampleReader = (view: DataView, offset: number) => number;

const CHUNK_HEADER_SIZE = 8;
const MIN_FMT_SIZE = 16;
const FORMAT_PCM = 1;
const FORMAT_FLOAT = 3;
const FORMAT_EXTENSIBLE = 0xff_fe;
/** Where WAVE_FORMAT_EXTENSIBLE keeps the real format code, inside fmt. */
const EXTENSIBLE_SUBFORMAT_OFFSET = 24;

const SAMPLE_READERS: Record<string, SampleReader> = {
  float32: (view, offset) => view.getFloat32(offset, true),
  float64: (view, offset) => view.getFloat64(offset, true),
  pcm8: (view, offset) => (view.getUint8(offset) - 128) / 128,
  pcm16: (view, offset) => view.getInt16(offset, true) / 32_768,
  pcm24: (view, offset) => {
    const low = view.getUint16(offset, true);
    const high = view.getInt8(offset + 2);
    return (high * 65_536 + low) / 8_388_608;
  },
  pcm32: (view, offset) => view.getInt32(offset, true) / 2_147_483_648,
};

function readTag(view: DataView, offset: number) {
  return String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3)
  );
}

function parseFormat(view: DataView, { offset, size }: ChunkLocation) {
  if (size < MIN_FMT_SIZE) {
    throw new Error("WAV fmt chunk is too short");
  }

  let code = view.getUint16(offset, true);
  if (code === FORMAT_EXTENSIBLE && size >= EXTENSIBLE_SUBFORMAT_OFFSET + 2) {
    code = view.getUint16(offset + EXTENSIBLE_SUBFORMAT_OFFSET, true);
  }
  if (code !== FORMAT_PCM && code !== FORMAT_FLOAT) {
    throw new Error(`Unsupported WAV format code ${code}`);
  }

  const format: WavFormat = {
    bitsPerSample: view.getUint16(offset + 14, true),
    channels: view.getUint16(offset + 2, true),
    encoding: code === FORMAT_FLOAT ? "float" : "pcm",
    sampleRate: view.getUint32(offset + 4, true),
  };
  if (format.channels === 0 || format.sampleRate === 0) {
    throw new Error("WAV file has no channels or no sample rate");
  }
  return format;
}

function findChunks(view: DataView) {
  const chunks = new Map<string, ChunkLocation>();
  let offset = 12;

  while (offset + CHUNK_HEADER_SIZE <= view.byteLength) {
    const id = readTag(view, offset);
    const bodyOffset = offset + CHUNK_HEADER_SIZE;
    // Streamed files can leave the size unset, so never read past the end.
    const size = Math.min(
      view.getUint32(offset + 4, true),
      view.byteLength - bodyOffset
    );
    if (!chunks.has(id)) {
      chunks.set(id, { offset: bodyOffset, size });
    }
    // Chunks are padded to an even length.
    offset = bodyOffset + size + (size % 2);
  }

  return chunks;
}

/** Averages every channel into one, so stereo recordings come out mono. */
function downmix(view: DataView, format: WavFormat, data: ChunkLocation) {
  const read = SAMPLE_READERS[`${format.encoding}${format.bitsPerSample}`];
  if (!read) {
    throw new Error(
      `Unsupported WAV sample format: ${format.bitsPerSample}-bit ${format.encoding}`
    );
  }

  const bytesPerSample = format.bitsPerSample / 8;
  const blockSize = bytesPerSample * format.channels;
  const samples = new Float32Array(Math.floor(data.size / blockSize));

  for (let index = 0; index < samples.length; index += 1) {
    const blockOffset = data.offset + index * blockSize;
    let sum = 0;
    for (let channel = 0; channel < format.channels; channel += 1) {
      sum += read(view, blockOffset + channel * bytesPerSample);
    }
    samples[index] = sum / format.channels;
  }

  return samples;
}

/**
 * Decodes an uncompressed WAV file: 8, 16, 24 or 32-bit integer PCM, or 32 or
 * 64-bit float. Runs anywhere, including Bun tests that have no Web Audio API.
 */
export function decodeWav(bytes: ArrayBuffer): AudioClip {
  const view = new DataView(bytes);
  if (
    view.byteLength < 12 ||
    readTag(view, 0) !== "RIFF" ||
    readTag(view, 8) !== "WAVE"
  ) {
    throw new Error("Not a WAV file");
  }

  const chunks = findChunks(view);
  const fmt = chunks.get("fmt ");
  const data = chunks.get("data");
  if (!fmt) {
    throw new Error("WAV file has no fmt chunk");
  }
  if (!data) {
    throw new Error("WAV file has no data chunk");
  }

  const format = parseFormat(view, fmt);
  return {
    sampleRate: format.sampleRate,
    samples: downmix(view, format, data),
  };
}
