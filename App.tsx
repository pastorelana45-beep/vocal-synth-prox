import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import * as Tone from 'tone';
import { 
  Music, Settings, Mic, Play, Square, Volume2, Trash2, 
  Activity, Disc, History, AudioWaveform, ChevronRight, 
  XCircle, Mic2, Zap, Hash, ListMusic, Ghost, User, Bot, 
  Stars, MoveUp, MoveDown, Loader2, Timer, Sparkles, 
  Sliders, Download, Layers, Combine, VolumeX, Volume1, 
  ArrowRightToLine, AlertCircle, FileAudio, FileJson, Share2,
  ChevronDown, ExternalLink, FastForward, Wand2, MessageSquareText, 
  Wind, Waves, Maximize2, Box, Guitar, Drum, Piano, Check, 
  Disc2, Cpu, Flame, PartyPopper, Repeat
} from 'lucide-react';

// --- TYPES & INTERFACES ---
export enum WorkstationMode {
  IDLE = 'IDLE',
  MIDI = 'MIDI',
  RECORD = 'RECORD',
  PLAYBACK = 'PLAYBACK'
}

export type ScaleType = 'MAJOR' | 'MINOR' | 'PENTATONIC' | 'BLUES' | 'DORIAN';

export interface RecordedNote {
  note: string;
  time: number;
  duration: number;
}

export interface StudioSession {
  id: string;
  timestamp: number;
  midiNotes: RecordedNote[];
  audioUrl?: string;
  instrumentId: string;
  bpm: number;
  scale: ScaleType;
}

export interface Instrument {
  id: string;
  name: string;
  type: 'synth' | 'sampler';
  category: 'lead' | 'pad' | 'bass';
}

// --- CONSTANTS ---
const INSTRUMENTS: Instrument[] = [
  { id: 'LD-01', name: 'NEON LEAD', type: 'sampler', category: 'lead' },
  { id: 'BS-05', name: 'SUB GROUND', type: 'synth', category: 'bass' },
  { id: 'PD-09', name: 'ETHER VOID', type: 'sampler', category: 'pad' },
  { id: 'GT-02', name: 'DIST GUITAR', type: 'sampler', category: 'lead' }
];

const SCALES: Record<ScaleType, number[]> = {
  MAJOR: [0, 2, 4, 5, 7, 9, 11],
  MINOR: [0, 2, 3, 5, 7, 8, 10],
  PENTATONIC: [0, 2, 4, 7, 9],
  BLUES: [0, 3, 5, 6, 7, 10],
  DORIAN: [0, 2, 3, 5, 7, 9, 10]
};

const App: React.FC = () => {
  // --- CORE ENGINE STATE ---
  const [selectedInstrument, setSelectedInstrument] = useState<Instrument>(INSTRUMENTS[0]);
  const [mode, setMode] = useState<WorkstationMode>(WorkstationMode.IDLE);
  const [isStarted, setIsStarted] = useState(false);
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [currentMidiNote, setCurrentMidiNote] = useState<number | null>(null);
  const [currentChordName, setCurrentChordName] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlayingBack, setIsPlayingBack] = useState<string | null>(null);
  const [activeLoopId, setActiveLoopId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<StudioSession[]>([]);
  const [rmsVolume, setRmsVolume] = useState(0);
  const [sensitivity, setSensitivity] = useState(0.015); 
  const [micBoost, setMicBoost] = useState(3.0); 
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState<'BROWSER' | 'VAULT' | 'ENGINE'>('BROWSER');
  const [isInstrumentLoading, setIsInstrumentLoading] = useState(false);
  const [bendMode, setBendMode] = useState(true);
  const [isRendering, setIsRendering] = useState<string | null>(null);

  // --- SYNTH ENGINE PARAMETERS ---
  const [glide, setGlide] = useState(0.05);
  const [vibratoDepth, setVibratoDepth] = useState(0.0);
  const [unisonThickness, setUnisonThickness] = useState(0.0);
  const [distortionAmount, setDistortionAmount] = useState(0.0);
  const [delayWet, setDelayWet] = useState(0.15);
  const [reverbWet, setReverbWet] = useState(0.2);
  const [attack, setAttack] = useState(0.1);
  const [release, setRelease] = useState(0.8);
  const [bitCrush, setBitCrush] = useState(0);

  // --- MIXER & HARMONY ---
  const [leadVol, setLeadVol] = useState(0.8);
  const [chordVol, setChordVol] = useState(0.4);
  const [isHarmonizerActive, setIsHarmonizerActive] = useState(true);
  const [bpm, setBpm] = useState(120);
  const [currentScale, setCurrentScale] = useState<ScaleType>('MAJOR');
  // --- AUDIO REFS (Hardware & Nodes) ---
  const leadSamplerRef = useRef<Tone.Sampler | Tone.PolySynth | null>(null);
  const chordSamplerRef = useRef<Tone.Sampler | Tone.PolySynth | null>(null);
  const leadGainRef = useRef<Tone.Gain | null>(null);
  const chordGainRef = useRef<Tone.Gain | null>(null);
  const distortionRef = useRef<Tone.Distortion | null>(null);
  const bitCrusherRef = useRef<Tone.BitCrusher | null>(null);
  const chorusRef = useRef<Tone.Chorus | null>(null);
  const reverbRef = useRef<Tone.Reverb | null>(null);
  const delayRef = useRef<Tone.FeedbackDelay | null>(null);
  const analyserRef = useRef<Tone.Analyser | null>(null);
  const recorderRef = useRef<Tone.Recorder | null>(null);
  const playerRef = useRef<Tone.Player | null>(null);
  const loopPartRef = useRef<Tone.Part | null>(null);
  
  // Riferimento allo stato "veloce" per il loop audio (evita lag di re-render)
  const stateRef = useRef({ 
    mode, isRecording, sensitivity, micBoost, scale: currentScale, 
    bendMode, isHarmonizerActive, glide, attack, release, 
    distortionAmount, isPlayingBack: false, lastMidi: null as number | null
  });

  const recordingNotesRef = useRef<RecordedNote[]>([]);
  const recordingStartTimeRef = useRef<number>(0);
  const activeNoteStartRef = useRef<{ note: string, time: number } | null>(null);

  // --- ENGINE SYNC (Effect) ---
  // Sincronizza i cambiamenti della UI con i parametri dei nodi audio
  useEffect(() => {
    stateRef.current = { 
      ...stateRef.current, mode, isRecording, sensitivity, micBoost, 
      scale: currentScale, bendMode, isHarmonizerActive, glide, 
      attack, release, distortionAmount, isPlayingBack: !!isPlayingBack 
    };

    if (distortionRef.current) distortionRef.current.distortion = distortionAmount;
    if (bitCrusherRef.current) bitCrusherRef.current.wet.value = bitCrush;
    if (chorusRef.current) chorusRef.current.wet.value = unisonThickness;
    if (reverbRef.current) reverbRef.current.wet.value = reverbWet;
    if (delayRef.current) delayRef.current.wet.value = delayWet;
    
    [leadSamplerRef.current, chordSamplerRef.current].forEach(s => {
      if (!s) return;
      if (s instanceof Tone.Sampler) {
        s.attack = attack;
        s.release = release;
      }
      // Gestione portamento (glide) se supportato dallo strumento
      if ('portamento' in s) (s as any).portamento = glide;
    });
  }, [mode, isRecording, sensitivity, micBoost, currentScale, bendMode, isHarmonizerActive, glide, attack, release, distortionAmount, bitCrush, unisonThickness, reverbWet, delayWet, isPlayingBack]);

  // --- HELPER FUNCTIONS ---
  const stopAllPlayback = useCallback(() => {
    if (loopPartRef.current) {
      loopPartRef.current.stop();
      loopPartRef.current.dispose();
      loopPartRef.current = null;
    }
    Tone.Transport.stop();
    [leadSamplerRef, chordSamplerRef].forEach(ref => ref.current?.releaseAll());
    setIsPlayingBack(null);
    setActiveLoopId(null);
    setCurrentMidiNote(null);
    setCurrentChordName(null);
    stateRef.current.lastMidi = null;
  }, []);

  const getChordNotes = (midi: number, scaleType: ScaleType) => {
    // Calcola l'armonizzazione basata sulla scala selezionata
    const scaleIntervals = SCALES[scaleType] || SCALES.MAJOR;
    // Logica semplificata: crea una triade basata sulla nota MIDI corrente
    return { 
      notes: [midi, midi + 4, midi + 7], 
      name: `${midiToNoteName(midi)} Major` 
    };
  };

  const applyPreset = (type: string) => {
    stopAllPlayback();
    switch(type) {
      case 'ROCK':
        setGlide(0.02); setDistortionAmount(0.7); setUnisonThickness(0.3);
        setAttack(0.01); setRelease(1.8); setReverbWet(0.25); setDelayWet(0.1);
        setBitCrush(0); break;
      case 'DANCE':
        setGlide(0.0); setDistortionAmount(0.1); setUnisonThickness(0.8);
        setAttack(0.01); setRelease(0.3); setReverbWet(0.2); setDelayWet(0.3);
        setBitCrush(0.2); break;
      case 'SYNTHWAVE':
        setGlide(0.15); setDistortionAmount(0.05); setUnisonThickness(0.6);
        setAttack(0.2); setRelease(1.5); setReverbWet(0.5); setDelayWet(0.4);
        setBitCrush(0); break;
    }
  };
  // --- INITIALIZATION: THE AUDIO CORE ---
  const initAudioCore = async () => {
    if (Tone.context.state !== 'running') await Tone.start();
    
    // Configurazione Catena FX Master (Limiter + Spazialità)
    const masterLimiter = new Tone.Limiter(-1).toDestination();
    const reverb = new Tone.Reverb({ decay: 3.5, wet: reverbWet }).connect(masterLimiter);
    const delay = new Tone.FeedbackDelay("8n", 0.35).connect(reverb);
    const bitCrusher = new Tone.BitCrusher(4).connect(delay);
    const distortion = new Tone.Distortion(0).connect(bitCrusher);
    const chorus = new Tone.Chorus(4, 2.5, 0.5).connect(distortion).start();
    
    // Salvataggio riferimenti per manipolazione real-time
    reverbRef.current = reverb; 
    delayRef.current = delay;
    distortionRef.current = distortion; 
    bitCrusherRef.current = bitCrusher;
    chorusRef.current = chorus;

    // Gain Nodes separati per Lead e Accordi (Mixer interno)
    leadGainRef.current = new Tone.Gain(leadVol).connect(chorus);
    chordGainRef.current = new Tone.Gain(chordVol).connect(chorus);
    
    // Accesso Hardware Microfono
    const mic = new Tone.UserMedia();
    try {
      await mic.open();
      // Analizzatore per Pitch Detection e Visualizer
      const analyser = new Tone.Analyser('waveform', 1024);
      mic.connect(analyser);
      analyserRef.current = analyser;
      
      // Registratore per catturare le performance vocali
      recorderRef.current = new Tone.Recorder();
      mic.connect(recorderRef.current);
      
      // Caricamento strumento iniziale
      await applyInstrumentSettings(selectedInstrument.id);
      
      // Avvio del loop di monitoraggio (Pitch & Volume)
      startDetectionLoop();
    } catch (err) {
      console.error("Mic access denied or hardware error:", err);
      alert("Errore: Microfono non trovato o accesso negato.");
    }
  };

  // --- INSTRUMENT LOADER ---
  const applyInstrumentSettings = async (id: string) => {
    setIsInstrumentLoading(true);
    const config = SAMPLE_MAPS[id] || SAMPLE_MAPS['LD-01'];
    
    // Pulizia memorie precedenti
    if (leadSamplerRef.current) {
      leadSamplerRef.current.dispose();
      chordSamplerRef.current?.dispose();
    }
    
    return new Promise<void>((resolve) => {
      const s1 = new Tone.Sampler({
        urls: config.urls,
        baseUrl: config.baseUrl,
        onload: () => {
          setIsInstrumentLoading(false);
          resolve();
        }
      }).connect(leadGainRef.current!);
      
      const s2 = new Tone.Sampler({
        urls: config.urls,
        baseUrl: config.baseUrl
      }).connect(chordGainRef.current!);

      leadSamplerRef.current = s1;
      chordSamplerRef.current = s2;
    });
  };

  // --- THE PITCH DETECTION ENGINE ---
  const startDetectionLoop = () => {
    const loop = () => {
      if (!analyserRef.current || stateRef.current.isPlayingBack) {
        requestAnimationFrame(loop);
        return;
      }
      
      const buffer = analyserRef.current.getValue() as Float32Array;
      
      // Calcolo RMS (Volume Level)
      let sum = 0;
      for(let i=0; i<buffer.length; i++) {
        const s = buffer[i] * stateRef.current.micBoost;
        sum += s * s;
      }
      const rms = Math.sqrt(sum/buffer.length);
      setRmsVolume(rms);

      // Gate di attivazione basato sulla sensibilità impostata
      if (rms > stateRef.current.sensitivity && stateRef.current.mode === WorkstationMode.MIDI) {
        processActiveSignal(buffer);
      } else if (stateRef.current.lastMidi !== null) {
        handleSignalLoss();
      }
      
      requestAnimationFrame(loop);
    };
    loop();
  };
  // --- SIGNAL PROCESSING: VOCAL TO MIDI ---
  const processActiveSignal = (buffer: Float32Array) => {
    // Rilevamento della frequenza fondamentale (Pitch)
    const freq = detectPitch(buffer, Tone.context.sampleRate);
    
    if (freq) {
      // Conversione frequenza -> Numero MIDI (es. 440Hz -> 69)
      const midiFloat = frequencyToMidiFloat(freq);
      const midi = Math.round(midiFloat);
      
      // Esegui la nota solo se è cambiata rispetto al frame precedente
      if (midi !== stateRef.current.lastMidi) {
        const noteName = midiToNoteName(midi);
        
        // Trigger strumento Lead
        leadSamplerRef.current?.triggerAttack(noteName);
        
        // Gestione Armonizzatore (Accordi)
        if (stateRef.current.isHarmonizerActive) {
          const chord = getChordNotes(midi, stateRef.current.scale);
          chord.notes.forEach(m => {
            chordSamplerRef.current?.triggerAttack(midiToNoteName(m));
          });
          setCurrentChordName(chord.name);
        }

        // Se stiamo registrando, iniziamo a tracciare la nuova nota
        if (stateRef.current.isRecording) {
          // Se c'era una nota precedente non chiusa, la salviamo ora
          closeActiveNoteRecording();
          activeNoteStartRef.current = { 
            note: noteName, 
            time: Tone.now() - recordingStartTimeRef.current 
          };
        }

        stateRef.current.lastMidi = midi;
        setCurrentMidiNote(midi);
      }
    }
  };

  // --- SIGNAL LOSS: NOTE OFF LOGIC ---
  const handleSignalLoss = () => {
    // Rilascia tutte le note attive quando il volume scende sotto il gate
    leadSamplerRef.current?.releaseAll();
    chordSamplerRef.current?.releaseAll();
    
    if (stateRef.current.isRecording) {
      closeActiveNoteRecording();
    }
    
    stateRef.current.lastMidi = null;
    setCurrentMidiNote(null);
    setCurrentChordName(null);
  };

  // --- RECORDING HELPERS ---
  const closeActiveNoteRecording = () => {
    if (activeNoteStartRef.current) {
      const currentTime = Tone.now() - recordingStartTimeRef.current;
      const duration = currentTime - activeNoteStartRef.current.time;
      
      // Filtriamo le note troppo brevi (ghost notes/rumore)
      if (duration > 0.05) {
        recordingNotesRef.current.push({
          ...activeNoteStartRef.current,
          duration: duration
        });
      }
      activeNoteStartRef.current = null;
    }
  };

  // --- TRANSPORT CONTROLS ---
  const toggleLoop = (session: StudioSession) => {
    if (activeLoopId === session.id) {
      stopAllPlayback();
      return;
    }
    
    stopAllPlayback();
    setActiveLoopId(session.id);
    setIsPlayingBack(session.id + "_loop");

    // Calcola la durata totale del loop basandosi sull'ultima nota
    const lastNote = session.midiNotes[session.midiNotes.length - 1];
    const loopDuration = lastNote ? lastNote.time + lastNote.duration : 4;
    
    // Crea una sequenza Tone.Part per il playback fedele del MIDI
    loopPartRef.current = new Tone.Part((time, noteData) => {
      leadSamplerRef.current?.triggerAttackRelease(
        noteData.note, 
        noteData.duration, 
        time
      );
      
      // Riproduci anche l'armonia se era attiva nella sessione
      const chord = getChordNotes(Tone.Frequency(noteData.note).toMidi(), session.scale);
      chord.notes.forEach(m => {
        chordSamplerRef.current?.triggerAttackRelease(
          midiToNoteName(m), 
          noteData.duration, 
          time
        );
      });
    }, session.midiNotes).start(0);

    loopPartRef.current.loop = true;
    loopPartRef.current.loopEnd = loopDuration;
    
    Tone.Transport.bpm.value = session.bpm;
    Tone.Transport.start();
  };
  // --- MASTERING & EXPORT: FROM MIDI TO WAV ---
  const renderWav = async (session: StudioSession) => {
    setIsRendering(session.id);
    
    // Calcolo durata con buffer di coda per il riverbero
    const lastNote = session.midiNotes[session.midiNotes.length - 1];
    const duration = lastNote ? lastNote.time + lastNote.duration + 2 : 5;
    
    // Creazione del contesto Offline per un rendering ad alta fedeltà
    const offlineContext = new Tone.OfflineContext(2, duration, 44100);
    
    // Ricostruzione della catena FX nel dominio offline
    const offlineLimiter = new Tone.Limiter(-1).toDestination();
    const offlineReverb = new Tone.Reverb(3).connect(offlineLimiter);
    const offlineDist = new Tone.Distortion(distortionAmount).connect(offlineReverb);
    
    const offlineSampler = new Tone.Sampler({
      urls: SAMPLE_MAPS[session.instrumentId]?.urls || SAMPLE_MAPS['LD-01'].urls,
      baseUrl: SAMPLE_MAPS[session.instrumentId]?.baseUrl || SAMPLE_MAPS['LD-01'].baseUrl,
      onload: () => {
        session.midiNotes.forEach(n => {
          offlineSampler.triggerAttackRelease(n.note, n.duration, n.time);
        });
      }
    }).connect(offlineDist);

    try {
      const renderedBuffer = await offlineContext.render();
      const wavBlob = await bufferToWavBlob(renderedBuffer);
      const url = URL.createObjectURL(wavBlob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `Master_${session.id}_${selectedInstrument.name}.wav`;
      link.click();
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setIsRendering(null);
    }
  };

  const bufferToWavBlob = (buffer: AudioBuffer): Promise<Blob> => {
    return new Promise((resolve) => {
      const worker = new Worker(URL.createObjectURL(new Blob([`
        self.onmessage = function(e) {
          const buffer = e.data;
          const numChannels = buffer.numberOfChannels;
          const sampleRate = buffer.sampleRate;
          const format = 1; // PCM
          const bitDepth = 16;
          
          const bytesPerSample = bitDepth / 8;
          const blockAlign = numChannels * bytesPerSample;
          
          const dataLen = buffer.length * blockAlign;
          const bufferSize = 44 + dataLen;
          const arrayBuffer = new ArrayBuffer(bufferSize);
          const view = new DataView(arrayBuffer);
          
          const writeString = (offset, string) => {
            for (let i = 0; i < string.length; i++) {
              view.setUint8(offset + i, string.charCodeAt(i));
            }
          };

          writeString(0, 'RIFF');
          view.setUint32(4, 36 + dataLen, true);
          writeString(8, 'WAVE');
          writeString(12, 'fmt ');
          view.setUint32(16, 16, true);
          view.setUint16(20, format, true);
          view.setUint16(22, numChannels, true);
          view.setUint32(24, sampleRate, true);
          view.setUint32(28, sampleRate * blockAlign, true);
          view.setUint16(32, blockAlign, true);
          view.setUint16(34, bitDepth, true);
          writeString(36, 'data');
          view.setUint32(40, dataLen, true);

          let offset = 44;
          for (let i = 0; i < buffer.length; i++) {
            for (let channel = 0; channel < numChannels; channel++) {
              const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
              view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
              offset += 2;
            }
          }
          self.postMessage(new Blob([arrayBuffer], { type: 'audio/wav' }));
        }
      `], { type: 'application/javascript' })));
      
      worker.onmessage = (e) => resolve(e.data);
      worker.postMessage({
        length: buffer.length,
        numberOfChannels: buffer.numberOfChannels,
        sampleRate: buffer.sampleRate,
        channelData: Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i))
      });
    });
  };

  // --- RENDER UI: LAYOUT START ---
  return (
    <div className="fixed inset-0 bg-black text-white flex flex-col font-sans select-none overflow-hidden">
      {/* Dynamic Header */}
      <header className="p-5 flex justify-between items-center border-b border-white/10 bg-zinc-950/80 backdrop-blur-md z-50">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-purple-600 rounded-2xl flex items-center justify-center shadow-xl shadow-purple-900/40">
            <Combine size={24} />
          </div>
          <div>
            <h1 className="text-[11px] font-black uppercase tracking-tighter leading-none">
              VocalSynth <span className="text-purple-500">Master</span>
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <div className={`w-1.5 h-1.5 rounded-full ${isStarted ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-700'}`} />
              <span className="text-[7px] text-zinc-500 font-bold uppercase tracking-[0.2em]">
                {isStarted ? 'Engine Online' : 'Core Standby'}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-zinc-900 px-4 py-2 rounded-2xl border border-white/5 flex items-center gap-3">
            <Timer size={14} className="text-purple-500" />
            <input 
              type="number" 
              value={bpm} 
              onChange={e => setBpm(Number(e.target.value))} 
              className="bg-transparent w-8 text-[11px] font-black outline-none text-purple-400" 
            />
          </div>
          <button 
            onClick={() => setShowSettings(!showSettings)} 
            className="p-2.5 bg-zinc-900 rounded-2xl border border-white/10 hover:bg-zinc-800 transition-colors"
          >
            <Settings size={20} className="text-zinc-400" />
          </button>
        </div>
      </header>

      {!isStarted ? (
        // --- LANDING VIEW ---
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-[radial-gradient(circle_at_50%_50%,_#1e1b4b_0%,_#000_100%)]">
          <div className="relative mb-16">
            <div className="absolute -inset-8 bg-purple-600/20 rounded-full blur-3xl animate-pulse" />
            <div className="w-32 h-32 bg-purple-600 rounded-[2.5rem] flex items-center justify-center relative shadow-2xl">
              <Mic size={54} className="text-white" />
            </div>
          </div>
          <h2 className="text-5xl font-black uppercase italic tracking-tighter mb-6 leading-[0.9]">
            Transform your <br/><span className="text-purple-600">Voice</span>
          </h2>
          <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.3em] mb-12 max-w-[200px]">
            Pro-grade real-time vocal to midi workstation
          </p>
          <button 
            onClick={() => { setIsStarted(true); initAudioCore(); }} 
            className="w-full max-w-xs bg-white text-black py-7 rounded-[2rem] font-black text-xl shadow-[0_20px_40px_rgba(255,255,255,0.1)] active:scale-95 transition-all"
          >
            INITIALIZE STUDIO
          </button>
        </div>
      ) : (
        // --- MAIN WORKSTATION ---
        <main className="flex-1 flex flex-col overflow-hidden">
          
          {/* Dashboard Area: Real-time Feedback */}
          <div className="px-6 py-8 flex flex-col items-center justify-center border-b border-white/5 relative bg-zinc-950">
             <div className="flex justify-between w-full max-w-sm mb-6">
                <div className="flex flex-col items-center">
                   <span className="text-[7px] font-black text-zinc-600 uppercase tracking-widest mb-2">Detection</span>
                   <div className="text-4xl font-black text-white font-mono tracking-tighter">
                       {currentMidiNote ? midiToNoteName(currentMidiNote) : '--'}
                   </div>
                </div>
                <div className="h-10 w-px bg-white/5 self-center" />
                <div className="flex flex-col items-center">
                   <span className="text-[7px] font-black text-zinc-600 uppercase tracking-widest mb-2">Harmony</span>
                   <div className="text-2xl font-black text-purple-500 uppercase italic">
                       {currentChordName ? currentChordName.split(' ')[1] : 'NONE'}
                   </div>
                </div>
             </div>
             
             {/* Waveform Visualizer: Animated bars based on RMS */}
             <div className="w-full h-12 flex items-center justify-center gap-1">
                {Array.from({length: 40}).map((_, i) => (
                    <div 
                      key={i} 
                      className="w-1.5 bg-purple-600 rounded-full transition-all duration-75" 
                      style={{ 
                        height: `${Math.max(10, rmsVolume * 600 * (0.4 + Math.random() * 0.6))}%`, 
                        opacity: 0.1 + (rmsVolume * 2) 
                      }} 
                    />
                ))}
             </div>
          </div>

          {/* Tab Navigation */}
          <div className="p-4 flex gap-2 shrink-0 bg-black">
             {(['BROWSER', 'ENGINE', 'VAULT'] as const).map((tab) => (
                <button 
                  key={tab} 
                  onClick={() => setActiveTab(tab)} 
                  className={`flex-1 py-4 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all border ${
                    activeTab === tab 
                    ? 'bg-white text-black border-white shadow-lg' 
                    : 'bg-zinc-900 text-zinc-600 border-white/5'
                  }`}
                >
                    {tab}
                </button>
             ))}
          </div>
          {/* Content Area: Dynamic rendering based on Active Tab */}
          <div className="flex-1 overflow-y-auto px-5 pb-44 no-scrollbar">
            
            {activeTab === 'BROWSER' && (
              <div className="space-y-3 pt-2">
                <h3 className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.4em] mb-4 ml-2">Available Textures</h3>
                {INSTRUMENTS.map(inst => (
                   <button 
                     key={inst.id} 
                     onClick={() => { setSelectedInstrument(inst); applyInstrumentSettings(inst.id); }} 
                     className={`w-full p-6 flex justify-between items-center rounded-3xl border transition-all ${
                       selectedInstrument.id === inst.id 
                       ? 'bg-purple-600/10 border-purple-500/50' 
                       : 'bg-zinc-900/40 border-white/5 text-zinc-500'
                     }`}
                   >
                      <div className="flex items-center gap-5">
                        <div className={`w-3 h-3 rounded-full ${
                          selectedInstrument.id === inst.id 
                          ? 'bg-purple-500 shadow-[0_0_10px_#a855f7]' 
                          : 'bg-zinc-800'
                        }`} />
                        <div className="text-left">
                          <span className={`block font-black uppercase tracking-wide text-[12px] ${
                            selectedInstrument.id === inst.id ? 'text-white' : 'text-zinc-600'
                          }`}>{inst.name}</span>
                          <span className="text-[7px] font-bold opacity-50">{inst.category} // {inst.type}</span>
                        </div>
                      </div>
                      {isInstrumentLoading && selectedInstrument.id === inst.id ? (
                        <Loader2 size={18} className="animate-spin text-purple-500" />
                      ) : (
                        <ChevronRight size={18} className={selectedInstrument.id === inst.id ? 'text-purple-500' : 'text-zinc-800'} />
                      )}
                   </button>
                ))}
              </div>
            )}

            {activeTab === 'ENGINE' && (
              <div className="space-y-10 pt-4">
                {/* Preset Quick-Selector */}
                <div className="grid grid-cols-3 gap-3">
                   {['ROCK', 'DANCE', 'SYNTHWAVE'].map(preset => (
                      <button 
                        key={preset} 
                        onClick={() => applyPreset(preset)} 
                        className="p-5 bg-zinc-900 rounded-[2rem] border border-white/5 flex flex-col items-center gap-3 active:scale-95 transition-all"
                      >
                         {preset === 'ROCK' ? <Flame className="text-orange-500" /> : preset === 'DANCE' ? <Zap className="text-pink-500" /> : <Stars className="text-indigo-500" />}
                         <span className="font-black text-[7px] uppercase tracking-widest text-zinc-400">{preset}</span>
                      </button>
                   ))}
                </div>

                {/* Synth Parameter Matrix */}
                <div className="space-y-8 bg-zinc-950 p-8 rounded-[2.5rem] border border-white/5 shadow-2xl">
                    <div className="space-y-5">
                        <div className="flex justify-between uppercase font-black text-[8px] text-zinc-500 tracking-widest">
                          <span>Overdrive</span>
                          <span className="text-orange-500">{(distortionAmount*100).toFixed(0)}%</span>
                        </div>
                        <input 
                          type="range" min="0" max="1" step="0.01" 
                          value={distortionAmount} 
                          onChange={e => setDistortionAmount(parseFloat(e.target.value))} 
                          className="w-full h-2 accent-orange-500 bg-zinc-900 rounded-full appearance-none" 
                        />
                    </div>

                    <div className="space-y-5">
                        <div className="flex justify-between uppercase font-black text-[8px] text-zinc-500 tracking-widest">
                          <span>Release Time</span>
                          <span className="text-purple-400">{release}s</span>
                        </div>
                        <input 
                          type="range" min="0.1" max="4" step="0.1" 
                          value={release} 
                          onChange={e => setRelease(parseFloat(e.target.value))} 
                          className="w-full h-2 accent-purple-500 bg-zinc-900 rounded-full appearance-none" 
                        />
                    </div>

                    <div className="space-y-5">
                        <div className="flex justify-between uppercase font-black text-[8px] text-zinc-500 tracking-widest">
                          <span>Chorus / Unison</span>
                          <span className="text-blue-400">{(unisonThickness*100).toFixed(0)}%</span>
                        </div>
                        <input 
                          type="range" min="0" max="1" step="0.05" 
                          value={unisonThickness} 
                          onChange={e => setUnisonThickness(parseFloat(e.target.value))} 
                          className="w-full h-2 accent-blue-500 bg-zinc-900 rounded-full appearance-none" 
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4 pt-4">
                        <div className="p-4 bg-zinc-900 rounded-2xl border border-white/5">
                            <span className="block text-[7px] font-black text-zinc-600 uppercase mb-3">Spatial Delay</span>
                            <input 
                              type="range" min="0" max="0.8" step="0.01" 
                              value={delayWet} 
                              onChange={e => setDelayWet(parseFloat(e.target.value))} 
                              className="w-full h-1 accent-white bg-zinc-800 rounded-full appearance-none" 
                            />
                        </div>
                        <div className="p-4 bg-zinc-900 rounded-2xl border border-white/5">
                            <span className="block text-[7px] font-black text-zinc-600 uppercase mb-3">Room Reverb</span>
                            <input 
                              type="range" min="0" max="0.8" step="0.01" 
                              value={reverbWet} 
                              onChange={e => setReverbWet(parseFloat(e.target.value))} 
                              className="w-full h-1 accent-white bg-zinc-800 rounded-full appearance-none" 
                            />
                        </div>
                    </div>
                </div>
              </div>
            )}

            {activeTab === 'VAULT' && (
              <div className="space-y-4 pt-2 pb-20">
                {sessions.length === 0 ? (
                    <div className="py-24 text-center">
                        <div className="w-20 h-20 bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-6 opacity-20">
                            <History size={32} />
                        </div>
                        <span className="text-[9px] font-black uppercase tracking-[0.4em] text-zinc-700">Storage Empty</span>
                    </div>
                ) : (
                  sessions.map(s => (
                    <div key={s.id} className="p-6 bg-zinc-900/60 rounded-[2.5rem] border border-white/5 space-y-6">
                      <div className="flex justify-between items-center">
                          <div className="flex items-center gap-4">
                              <div className="w-10 h-10 bg-purple-600/10 rounded-xl flex items-center justify-center border border-purple-500/20">
                                  <FileAudio size={18} className="text-purple-500" />
                              </div>
                              <div className="flex flex-col">
                                  <span className="font-black uppercase text-[11px] text-white tracking-tight">Record_{s.id}</span>
                                  <span className="text-[7px] text-zinc-500 font-bold uppercase tracking-widest">
                                    {new Date(s.timestamp).toLocaleTimeString()} // {s.midiNotes.length} notes
                                  </span>
                              </div>
                          </div>
                          <button 
                            onClick={() => setSessions(prev => prev.filter(x => x.id !== s.id))} 
                            className="p-2 text-zinc-700 hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={18}/>
                          </button>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                          <button 
                            onClick={() => toggleLoop(s)} 
                            className={`py-5 rounded-2xl flex items-center justify-center gap-3 font-black text-[10px] uppercase tracking-tighter transition-all border ${
                              activeLoopId === s.id 
                              ? 'bg-purple-600 border-purple-400 text-white shadow-lg shadow-purple-900/40' 
                              : 'bg-zinc-950 border-white/5 text-zinc-400'
                            }`}
                          >
                              {activeLoopId === s.id ? <Square size={14} fill="white"/> : <Repeat size={14}/>}
                              {activeLoopId === s.id ? 'Stop Loop' : 'Midi Loop'}
                          </button>
                          <button 
                            onClick={() => renderWav(s)} 
                            disabled={isRendering !== null}
                            className="py-5 bg-zinc-950 border border-white/5 rounded-2xl flex items-center justify-center gap-3 font-black text-[10px] uppercase text-emerald-500 active:bg-emerald-500 active:text-white transition-all disabled:opacity-30"
                          >
                              {isRendering === s.id ? <Loader2 size={14} className="animate-spin" /> : <Download size={14}/>}
                              Master Wav
                          </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </main>
      )}
      {/* Persistent Dock Controls: Record / Signal / Mode */}
      {isStarted && (
        <div className="fixed bottom-10 left-6 right-6 z-[100]">
            <div className="bg-zinc-950/80 backdrop-blur-3xl border border-white/10 p-4 rounded-[3rem] flex items-center justify-between shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)]">
                {/* RECORD BUTTON */}
                <button 
                  onClick={() => {
                    if(isRecording) {
                        recorderRef.current?.stop().then(blob => {
                            const newSession: StudioSession = { 
                                id: Math.random().toString(36).substr(2, 5).toUpperCase(), 
                                timestamp: Date.now(), 
                                midiNotes: [...recordingNotesRef.current], 
                                audioUrl: URL.createObjectURL(blob), 
                                instrumentId: selectedInstrument.id, 
                                bpm, 
                                scale: currentScale 
                            };
                            setSessions(prev => [newSession, ...prev]);
                            setIsRecording(false);
                            setMode(WorkstationMode.IDLE);
                        });
                    } else {
                        stopAllPlayback();
                        recordingNotesRef.current = [];
                        recordingStartTimeRef.current = Tone.now();
                        recorderRef.current?.start();
                        setIsRecording(true);
                        setMode(WorkstationMode.RECORD);
                        setActiveTab('VAULT');
                    }
                }} 
                className={`w-16 h-16 rounded-[2rem] flex items-center justify-center transition-all ${
                  isRecording ? 'bg-red-600 shadow-2xl shadow-red-900/50 animate-pulse' : 'bg-zinc-900 shadow-inner'
                }`}>
                    {isRecording ? <Square size={24} fill="white"/> : <Disc size={32} className="text-white"/>}
                </button>

                {/* SIGNAL MONITOR */}
                <div className="flex-1 px-8">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.2em]">Input Level</span>
                        <div className="flex gap-1">
                          <div className={`w-1 h-1 rounded-full ${rmsVolume > 0.05 ? 'bg-purple-500' : 'bg-zinc-800'}`} />
                          <div className={`w-1 h-1 rounded-full ${rmsVolume > 0.15 ? 'bg-purple-500' : 'bg-zinc-800'}`} />
                          <div className={`w-1 h-1 rounded-full ${rmsVolume > 0.3 ? 'bg-purple-500' : 'bg-zinc-800'}`} />
                        </div>
                    </div>
                    <div className="h-2 bg-zinc-900 rounded-full overflow-hidden p-0.5">
                        <div 
                          className="h-full bg-gradient-to-r from-purple-600 via-blue-500 to-cyan-400 rounded-full transition-all duration-75" 
                          style={{ width: `${Math.min(100, rmsVolume * 400)}%` }} 
                        />
                    </div>
                </div>

                {/* MODE SWITCHER & STOP */}
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setMode(mode === WorkstationMode.MIDI ? WorkstationMode.IDLE : WorkstationMode.MIDI)} 
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                      mode === WorkstationMode.MIDI ? 'bg-purple-600 text-white' : 'bg-zinc-900 text-zinc-600'
                    }`}
                  >
                      <Activity size={20}/>
                  </button>
                  <button onClick={stopAllPlayback} className="w-12 h-12 bg-zinc-900 rounded-2xl flex items-center justify-center text-zinc-600 hover:text-white">
                      <Square size={18} fill="currentColor"/>
                  </button>
                </div>
            </div>
        </div>
      )}

      {/* CUSTOM CSS INJECTIONS */}
      <style>{`
        @keyframes pulse-soft { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }
        input[type=range]::-webkit-slider-thumb { 
          -webkit-appearance: none; height: 20px; width: 20px; 
          border-radius: 50%; background: #fff; 
          border: 4px solid #8b5cf6; 
          box-shadow: 0 4px 12px rgba(0,0,0,0.4); cursor: pointer; 
        }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }
        .bg-blur { backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); }
      `}</style>
    </div>
  );
};

export default App;
