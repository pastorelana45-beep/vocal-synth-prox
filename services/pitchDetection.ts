export function detectPitch(buffer: Float32Array, sampleRate: number): number | null {
  const SIZE = buffer.length;
  
  // 1. RIMOZIONE OFFSET DC (Centra l'onda per evitare errori nei bassi come Seven Nation Army)
  let mean = 0;
  for (let i = 0; i < SIZE; i++) mean += buffer[i];
  mean /= SIZE;
  for (let i = 0; i < SIZE; i++) buffer[i] -= mean;

  // 2. CALCOLO VOLUME (RMS)
  let rms = 0;
  for (let i = 0; i < SIZE; i++) rms += buffer[i] * buffer[i];
  const rmsValue = Math.sqrt(rms / SIZE);
  if (rmsValue < 0.01) return null; // Troppo silenzio

  // 3. NORMALIZZAZIONE (Rende forti anche i suoni deboli)
  let maxAmp = 0;
  for (let i = 0; i < SIZE; i++) {
    if (Math.abs(buffer[i]) > maxAmp) maxAmp = Math.abs(buffer[i]);
  }
  const normalizedBuffer = new Float32Array(SIZE);
  for (let i = 0; i < SIZE; i++) normalizedBuffer[i] = buffer[i] / maxAmp;

  // 4. AUTOCORRELAZIONE (Con Center Clipping per pulire le armoniche di Halo)
  const correlations = new Float32Array(SIZE);
  for (let offset = 0; offset < SIZE; offset++) {
    for (let i = 0; i < SIZE - offset; i++) {
      // Center Clipping applicato al volo: ignora vibrazioni minuscole
      const val1 = Math.abs(normalizedBuffer[i]) < 0.2 ? 0 : normalizedBuffer[i];
      const val2 = Math.abs(normalizedBuffer[i + offset]) < 0.2 ? 0 : normalizedBuffer[i + offset];
      correlations[offset] += val1 * val2;
    }
  }

  // 5. TROVA IL PICCO (Cerca il primo picco significativo dopo lo zero)
  let d = 0;
  while (correlations[d] > correlations[d + 1]) d++;
  
  let maxval = -1, maxpos = -1;
  for (let i = d; i < SIZE; i++) {
    if (correlations[i] > maxval) {
      maxval = correlations[i];
      maxpos = i;
    }
  }

  // Controllo qualità: se il picco è troppo debole rispetto al segnale, è rumore
  if (maxpos === -1 || (maxval / correlations[0]) < 0.3) return null;

  // 6. INTERPOLAZIONE PARABOLICA (Precisione millimetrica per Halo)
  let T0 = maxpos;
  if (maxpos > 0 && maxpos < SIZE - 1) {
    const x1 = correlations[maxpos - 1], x2 = correlations[maxpos], x3 = correlations[maxpos + 1];
    const a = (x1 + x3 - 2 * x2) / 2;
    const b = (x3 - x1) / 2;
    if (a !== 0) T0 = T0 - b / (2 * a);
  }

  return sampleRate / T0;
}
