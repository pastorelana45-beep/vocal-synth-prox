
export function detectPitch(buffer: Float32Array, sampleRate: number): number | null {
  const SIZE = buffer.length;
  let rms = 0;
  for (let i = 0; i < SIZE; i++) rms += buffer[i] * buffer[i];
  if (Math.sqrt(rms / SIZE) < 0.01) return null;

  let r1 = 0, r2 = SIZE - 1, threshold = 0.1;
  for (let i = 0; i < SIZE / 2; i++) {
    if (Math.abs(buffer[i]) < threshold) { r1 = i; break; }
  }
  for (let i = 1; i < SIZE / 2; i++) {
    if (Math.abs(buffer[SIZE - i]) < threshold) { r2 = SIZE - i; break; }
  }

  const buf = buffer.slice(r1, r2);
  const N = buf.length;
  const correlations = new Float32Array(N);

  for (let offset = 0; offset < N; offset++) {
    for (let i = 0; i < N - offset; i++) {
      correlations[offset] += buf[i] * buf[i + offset];
    }
  }

  let d = 0;
  while (correlations[d] > correlations[d + 1]) d++;
  let maxval = -1, maxpos = -1;
  for (let i = d; i < N; i++) {
    if (correlations[i] > maxval) {
      maxval = correlations[i];
      maxpos = i;
    }
  }

  let T0 = maxpos;
  if (T0 === -1) return null;

  const x1 = correlations[T0 - 1], x2 = correlations[T0], x3 = correlations[T0 + 1];
  const a = (x1 + x3 - 2 * x2) / 2;
  const b = (x3 - x1) / 2;
  if (a !== 0) T0 = T0 - b / (2 * a);

  return sampleRate / T0;
}

export function frequencyToMidiFloat(freq: number): number {
  return 12 * (Math.log(freq / 440) / Math.log(2)) + 69;
}

export function frequencyToMidi(freq: number): number {
  return Math.round(frequencyToMidiFloat(freq));
}

export function midiToNoteName(midi: number): string {
  const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  return notes[midi % 12] + (Math.floor(midi / 12) - 1);
}
