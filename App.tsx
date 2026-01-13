import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import * as Tone from 'tone';
import { 
  Music, Settings, Mic, Play, Square, Volume2, Trash2, 
  Activity, Disc, History, AudioWaveform,
  ChevronRight, XCircle, Mic2, Zap, Hash, ListMusic, Ghost, User, Bot, Stars,
  MoveUp, MoveDown, Loader2, Timer, Sparkles, Sliders, Download, Layers, Combine,
  VolumeX, Volume1, ArrowRightToLine, AlertCircle, FileAudio, FileJson, Share2,
  ChevronDown, ExternalLink, FastForward, Wand2, MessageSquareText, Wind, Waves,
  Maximize2, Box, Guitar, Drum, Piano, Check, Disc2, Cpu, Flame, PartyPopper
} from 'lucide-react';
import { INSTRUMENTS, SCALES, SAMPLE_MAPS, MIN_NOTE_DURATION } from './constants';
import { Instrument, WorkstationMode, RecordedNote, StudioSession, ScaleType } from './types';
import { detectPitch, frequencyToMidiFloat, midiToNoteName } from './services/pitchDetection';
import { GoogleGenAI } from "@google/genai";

const App: React.FC = () => {
  // --- Core State ---
  const [selectedInstrument, setSelectedInstrument] = useState<Instrument>(INSTRUMENTS[0]);
  const [mode, setMode] = useState<WorkstationMode>(WorkstationMode.IDLE);
  const [isStarted, setIsStarted] = useState(false);
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [setupStep, setSetupStep] = useState<'PERMISSION' | 'LOADING' | 'COMPLETE'>('PERMISSION');
  const [currentMidiNote, setCurrentMidiNote] = useState<number | null>(null);
  const [currentChordName, setCurrentChordName] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlayingBack, setIsPlayingBack] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState<string | null>(null);
  const [sessions, setSessions] = useState<StudioSession[]>([]);
  const [rmsVolume, setRmsVolume] = useState(0);
  const [sensitivity, setSensitivity] = useState(0.015); 
  const [micBoost, setMicBoost] = useState(3.0); 
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState<'BROWSER' | 'VAULT' | 'ENGINE'>('BROWSER');
  const [isInstrumentLoading, setIsInstrumentLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [bendMode, setBendMode] = useState(true);
  const [skipSilences, setSkipSilences] = useState(false);
  
  // --- Synth Engine State ---
  const [glide, setGlide] = useState(0.05);
  const [vibratoDepth, setVibratoDepth] = useState(0.0);
  const [unisonThickness, setUnisonThickness] = useState(0.0);
  const [delayWet, setDelayWet] = useState(0.15);
  const [reverbWet, setReverbWet] = useState(0.2);
  const [attack, setAttack] = useState(0.1);
  const [release, setRelease] = useState(0.5);

  // AI Insights State
  const [aiAnalysis, setAiAnalysis] = useState<{ id: string, text: string, links?: any[] } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<string | null>(null);

  // Mixer State
  const [leadVol, setLeadVol] = useState(0.8);
  const [chordVol, setChordVol] = useState(0.4);
  const [isHarmonizerActive, setIsHarmonizerActive] = useState(true);
  const [bpm, setBpm] = useState(120);
  const [currentScale, setCurrentScale] = useState<ScaleType>('MAJOR');

  // --- Audio Refs ---
  const leadSamplerRef = useRef<Tone.Sampler | Tone.PolySynth | null>(null);
  const chordSamplerRef = useRef<Tone.Sampler | Tone.PolySynth | null>(null);
  const leadGainRef = useRef<Tone.Gain | null>(null);
  const chordGainRef = useRef<Tone.Gain | null>(null);
  const vibratoRef = useRef<Tone.Vibrato | null>(null);
  const chorusRef = useRef<Tone.Chorus | null>(null);
  const mainFxRef = useRef<{ 
    reverb: Tone.Reverb, 
    delay: Tone.FeedbackDelay, 
    filter: Tone.Filter,
    masterLimiter: Tone.Limiter,
    masterCompressor: Tone.Compressor
  } | null>(null);
  const micRef = useRef<Tone.UserMedia | null>(null);
  const analyserRef = useRef<Tone.Analyser | null>(null);
  const recorderRef = useRef<Tone.Recorder | null>(null);
  const playerRef = useRef<Tone.Player | null>(null);
  const voicePassthroughRef = useRef<Tone.Gain | null>(null);
  const audioLoopIntervalRef = useRef<number | null>(null);
  
  const stateRef = useRef({ 
    mode: WorkstationMode.IDLE, 
    isRecording: false, 
    isPlayingBack: false, 
    lastMidi: null as number | null, 
    sensitivity: 0.015, 
    micBoost: 3.0, 
    scale: 'MAJOR' as ScaleType, 
    bendMode: true, 
    isHarmonizerActive: true,
    glide: 0.05,
    attack: 0.1,
    release: 0.5
  });
  const recordingNotesRef = useRef<RecordedNote[]>([]);
  const recordingStartTimeRef = useRef<number>(0);
  const activeNoteStartRef = useRef<{ note: string, time: number } | null>(null);

  // Grouped instruments for Browser
  const groupedInstruments = useMemo(() => {
    return INSTRUMENTS.reduce((acc, inst) => {
      if (!acc[inst.category]) acc[inst.category] = [];
      acc[inst.category].push(inst);
      return acc;
    }, {} as Record<string, Instrument[]>);
  }, []);

  // Sync state to ref
  useEffect(() => {
    stateRef.current = { 
      ...stateRef.current, mode, isRecording, isPlayingBack: !!isPlayingBack, sensitivity, micBoost, scale: currentScale, bendMode, isHarmonizerActive, glide, attack, release
    };
    if (leadGainRef.current && chordGainRef.current) {
      const activeState = (isPlayingBack?.includes('_midi') || mode === WorkstationMode.MIDI) ? 1 : 0;
      leadGainRef.current.gain.rampTo(leadVol * activeState, 0.1);
      chordGainRef.current.gain.rampTo(isHarmonizerActive ? chordVol * activeState : 0, 0.1);
    }
    if (voicePassthroughRef.current) voicePassthroughRef.current.gain.value = (mode === WorkstationMode.VOICE) ? 1 : 0;
    
    [leadSamplerRef.current, chordSamplerRef.current].forEach(s => {
      if (!s) return;
      // @ts-ignore
      if ('portamento' in s) s.portamento = glide;
      if (s instanceof Tone.PolySynth) {
        s.set({ envelope: { attack, release } });
      } else {
        // @ts-ignore
        if ('attack' in s) s.attack = attack;
        // @ts-ignore
        if ('release' in s) s.release = release;
      }
    });

    if (vibratoRef.current) vibratoRef.current.depth.value = vibratoDepth;
    if (chorusRef.current) chorusRef.current.wet.value = unisonThickness;
    if (mainFxRef.current) {
      mainFxRef.current.delay.wet.value = delayWet;
      mainFxRef.current.reverb.wet.value = reverbWet;
    }
  }, [mode, isRecording, isPlayingBack, sensitivity, micBoost, currentScale, bendMode, leadVol, chordVol, isHarmonizerActive, glide, vibratoDepth, unisonThickness, delayWet, reverbWet, attack, release]);

  const processNotes = useCallback((notes: RecordedNote[]) => {
    if (!skipSilences) return notes;
    const sorted = [...notes].sort((a, b) => a.time - b.time);
    let timeOffset = 0;
    let lastNoteEnd = 0;
    const GAP_MAX = 0.3;

    return sorted.map((n, i) => {
      if (i === 0) {
        timeOffset = n.time;
        lastNoteEnd = n.duration;
        return { ...n, time: 0 };
      }
      const realStart = n.time - timeOffset;
      const gap = realStart - lastNoteEnd;
      if (gap > GAP_MAX) {
        timeOffset += (gap - GAP_MAX);
      }
      const finalStart = n.time - timeOffset;
      lastNoteEnd = finalStart + n.duration;
      return { ...n, time: finalStart };
    });
  }, [skipSilences]);

  const getChordNotes = (midi: number, scaleType: ScaleType): { notes: number[], name: string } => {
    const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    const rootName = noteNames[midi % 12];
    if (scaleType === 'CHROMATIC') return { notes: [midi, midi + 4, midi + 7], name: `${rootName} Maj` };
    const scale = SCALES[scaleType];
    const rootInOctave = midi % 12;
    const octave = Math.floor(midi / 12);
    const degree = scale.indexOf(rootInOctave);
    if (degree === -1) return { notes: [midi], name: `${rootName}` };
    const getNoteAtDegree = (offset: number) => {
      const targetDegreeIndex = (degree + offset) % scale.length;
      const octaveShift = Math.floor((degree + offset) / scale.length);
      return (octave + octaveShift) * 12 + scale[targetDegreeIndex];
    };
    const notes = [midi, getNoteAtDegree(2), getNoteAtDegree(4)];
    const thirdInterval = (scale[(degree + 2) % scale.length] - rootInOctave + 12) % 12;
    return { notes, name: `${rootName}${thirdInterval === 3 ? 'min' : 'Maj'}` };
  };

  const snapToScale = (midi: number, scaleType: ScaleType): number => {
    if (scaleType === 'CHROMATIC') return midi;
    const scale = SCALES[scaleType];
    const noteInOctave = midi % 12;
    const octave = Math.floor(midi / 12);
    const closest = scale.reduce((prev, curr) => Math.abs(curr - noteInOctave) < Math.abs(prev - noteInOctave) ? curr : prev);
    return octave * 12 + closest;
  };

  const applyInstrumentSettings = useCallback(async (instrumentId: string): Promise<void> => {
    setIsInstrumentLoading(true);
    setLoadError(null);
    const config = SAMPLE_MAPS[instrumentId];
    const instrument = INSTRUMENTS.find(i => i.id === instrumentId);
    const category = instrument?.category || 'SYNTH';

    [leadSamplerRef, chordSamplerRef].forEach(ref => { if (ref.current) { ref.current.releaseAll(); ref.current.dispose(); } });

    if (config) {
      const createSampler = (gainNode: Tone.Gain) => new Promise<Tone.Sampler>((resolve, reject) => {
        const s = new Tone.Sampler({ 
          urls: config.urls, 
          baseUrl: config.baseUrl, 
          onload: () => { s.attack = stateRef.current.attack; s.release = stateRef.current.release; s.portamento = stateRef.current.glide; resolve(s); },
          onerror: (e) => reject(e)
        }).connect(gainNode);
      });

      try {
        const [lead, chord] = await Promise.all([ createSampler(leadGainRef.current!), createSampler(chordGainRef.current!) ]);
        leadSamplerRef.current = lead; chordSamplerRef.current = chord;
        setIsInstrumentLoading(false);
        return;
      } catch (e) { console.warn("Sampler fallback."); }
    }

    const getSynthSettings = (cat: string) => {
      const base = { envelope: { attack: stateRef.current.attack, decay: 0.2, sustain: 0.8, release: stateRef.current.release }, portamento: stateRef.current.glide };
      switch(cat) {
        case 'BASS': return { ...base, oscillator: { type: 'square' } };
        case 'PAD': return { ...base, oscillator: { type: 'triangle' }, envelope: { ...base.envelope, attack: Math.max(0.5, stateRef.current.attack), release: Math.max(1.0, stateRef.current.release) } };
        case 'STRINGS': return { ...base, oscillator: { type: 'sawtooth' }, envelope: { ...base.envelope, attack: 0.2 } };
        case 'BRASS': return { ...base, oscillator: { type: 'sawtooth' }, envelope: { ...base.envelope, attack: 0.05, sustain: 1.0 } };
        case 'SYNTH': return { ...base, oscillator: { type: 'sawtooth' } };
        default: return { ...base, oscillator: { type: 'triangle' } };
      }
    };

    const synthSettings = getSynthSettings(category);
    leadSamplerRef.current = new Tone.PolySynth(Tone.Synth, synthSettings).connect(leadGainRef.current!);
    chordSamplerRef.current = new Tone.PolySynth(Tone.Synth, synthSettings).connect(chordGainRef.current!);
    setIsInstrumentLoading(false);
  }, []);

  const applyPreset = (type: 'HIPHOP' | 'HOUSE' | 'CLASSIC' | '90S' | 'ROCK' | 'DANCE' | 'E-GUITAR' | 'POP-PIANO' | 'SYNTHWAVE') => {
    switch(type) {
      case 'E-GUITAR':
        setGlide(0.02); setVibratoDepth(0.15); setUnisonThickness(0.7); setDelayWet(0.1); setReverbWet(0.15); setAttack(0.01); setRelease(1.2);
        break;
      case 'POP-PIANO':
        setGlide(0.0); setVibratoDepth(0.0); setUnisonThickness(0.1); setDelayWet(0.05); setReverbWet(0.3); setAttack(0.001); setRelease(0.8);
        break;
      case 'SYNTHWAVE':
        setGlide(0.15); setVibratoDepth(0.3); setUnisonThickness(0.6); setDelayWet(0.3); setReverbWet(0.5); setAttack(0.1); setRelease(1.0);
        break;
      case 'HIPHOP':
        setGlide(0.01); setVibratoDepth(0.0); setUnisonThickness(0.6); setDelayWet(0.05); setReverbWet(0.1); setAttack(0.01); setRelease(0.2);
        break;
      case 'HOUSE':
        setGlide(0.0); setVibratoDepth(0.0); setUnisonThickness(0.3); setDelayWet(0.3); setReverbWet(0.2); setAttack(0.005); setRelease(0.1);
        break;
      case 'CLASSIC':
        setGlide(0.0); setVibratoDepth(0.2); setUnisonThickness(0.1); setDelayWet(0.1); setReverbWet(0.6); setAttack(0.4); setRelease(1.5);
        break;
      case '90S':
        setGlide(0.2); setVibratoDepth(0.5); setUnisonThickness(0.5); setDelayWet(0.2); setReverbWet(0.3); setAttack(0.05); setRelease(0.4);
        break;
      case 'ROCK':
        setGlide(0.02); setVibratoDepth(0.2); setUnisonThickness(0.8); setDelayWet(0.1); setReverbWet(0.2); setAttack(0.01); setRelease(0.8);
        break;
      case 'DANCE':
        setGlide(0.0); setVibratoDepth(0.05); setUnisonThickness(0.5); setDelayWet(0.35); setReverbWet(0.25); setAttack(0.005); setRelease(0.2);
        break;
    }
  };

  const renderMasterWav = async (session: StudioSession) => {
    setIsRendering(session.id);
    try {
      const processed = processNotes(session.midiNotes);
      const duration = Math.max(...processed.map(n => n.time + n.duration), 2) + 2;
      
      const buffer = await Tone.Offline(async (context) => {
        const masterLimiter = new Tone.Limiter(-0.5).toDestination();
        const mainReverb = new Tone.Reverb({ decay: 2.8, wet: reverbWet }).connect(masterLimiter);
        const delay = new Tone.FeedbackDelay("8n", 0.15).connect(mainReverb);
        delay.wet.value = delayWet;
        
        const chorus = new Tone.Chorus(4, 2.5, 0.5).connect(delay).start();
        chorus.wet.value = unisonThickness;
        
        const vibrato = new Tone.Vibrato(5, vibratoDepth).connect(chorus);
        await mainReverb.generate();

        const leadG = new Tone.Gain(leadVol).connect(vibrato);
        const chordG = new Tone.Gain(chordVol).connect(vibrato);

        const config = SAMPLE_MAPS[session.instrumentId];
        let leadS, chordS;

        if (config) {
          const createS = () => new Promise<Tone.Sampler>((res) => {
             const s = new Tone.Sampler({ urls: config.urls, baseUrl: config.baseUrl, onload: () => { s.attack = attack; s.release = release; s.portamento = glide; res(s); } });
          });
          leadS = (await createS() as Tone.Sampler).connect(leadG);
          chordS = (await createS() as Tone.Sampler).connect(chordG);
        } else {
          const category = INSTRUMENTS.find(i => i.id === session.instrumentId)?.category || 'SYNTH';
          const settings = { envelope: { attack, decay: 0.2, sustain: 0.8, release }, portamento: glide, oscillator: { type: category === 'BASS' ? 'square' : 'sawtooth' } };
          leadS = new Tone.PolySynth(Tone.Synth, settings).connect(leadG);
          chordS = new Tone.PolySynth(Tone.Synth, settings).connect(chordG);
        }

        processed.forEach(n => {
          leadS.triggerAttackRelease(n.note, n.duration, n.time);
          if (isHarmonizerActive) {
            const chord = getChordNotes(Tone.Frequency(n.note).toMidi(), session.scale);
            chord.notes.forEach(m => chordS.triggerAttackRelease(midiToNoteName(m), n.duration, n.time));
          }
        });
      }, duration);

      const wav = audioBufferToWav(buffer);
      const blob = new Blob([wav], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `VocalSynth_Master_${session.id}.wav`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) { console.error(e); } finally { setIsRendering(null); }
  };

  const audioBufferToWav = (buffer: AudioBuffer) => {
    let numOfChan = buffer.numberOfChannels,
        length = buffer.length * numOfChan * 2 + 44,
        bufferWav = new ArrayBuffer(length),
        view = new DataView(bufferWav),
        channels = [], i, sample,
        offset = 0,
        pos = 0;

    const setUint16 = (data: number) => { view.setUint16(pos, data, true); pos += 2; };
    const setUint32 = (data: number) => { view.setUint32(pos, data, true); pos += 4; };

    setUint32(0x46464952); setUint32(length - 8); setUint32(0x45564157);
    setUint32(0x20746d66); setUint32(16); setUint16(1); setUint16(numOfChan);
    setUint32(buffer.sampleRate); setUint32(buffer.sampleRate * 2 * numOfChan);
    setUint16(numOfChan * 2); setUint16(16); setUint32(0x61746164);
    setUint32(length - pos - 4);

    for(i=0; i<buffer.numberOfChannels; i++) channels.push(buffer.getChannelData(i));
    while(pos < length) {
        for(i=0; i<numOfChan; i++) {
            sample = Math.max(-1, Math.min(1, channels[i][offset]));
            sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767)|0;
            view.setInt16(pos, sample, true); pos += 2;
        }
        offset++;
    }
    return bufferWav;
  }

  const initAudioCore = async () => {
    if (Tone.context.state !== 'running') await Tone.start();
    if (leadSamplerRef.current) return true;
    try {
      setSetupStep('LOADING');
      const masterLimiter = new Tone.Limiter(-0.5).toDestination();
      const masterCompressor = new Tone.Compressor({ threshold: -18, ratio: 3 }).connect(masterLimiter);
      const mainReverb = new Tone.Reverb({ decay: 2.8, wet: reverbWet }).connect(masterCompressor);
      const delay = new Tone.FeedbackDelay("8n", 0.15).connect(mainReverb);
      const mainFilter = new Tone.Filter(20000, "lowpass").connect(delay);
      const chorus = new Tone.Chorus(4, 2.5, 0.5).connect(mainFilter).start();
      const vibrato = new Tone.Vibrato(5, vibratoDepth).connect(chorus);
      await mainReverb.generate();
      const leadGain = new Tone.Gain(0.8).connect(vibrato);
      const chordGain = new Tone.Gain(0.4).connect(vibrato);
      leadGainRef.current = leadGain; chordGainRef.current = chordGain;
      vibratoRef.current = vibrato; chorusRef.current = chorus;
      const mic = new Tone.UserMedia();
      const analyser = new Tone.Analyser('waveform', 1024); 
      const recorder = new Tone.Recorder();
      const player = new Tone.Player().connect(masterCompressor);
      const voicePassthrough = new Tone.Gain(0).connect(masterCompressor);
      await mic.open(); mic.connect(analyser); mic.connect(recorder); mic.connect(voicePassthrough);
      analyserRef.current = analyser; recorderRef.current = recorder; playerRef.current = player; voicePassthroughRef.current = voicePassthrough;
      mainFxRef.current = { reverb: mainReverb, delay, filter: mainFilter, masterLimiter, masterCompressor };
      await applyInstrumentSettings(selectedInstrument.id);
      if (audioLoopIntervalRef.current) clearInterval(audioLoopIntervalRef.current);
      audioLoopIntervalRef.current = window.setInterval(audioLoop, 30); 
      return true;
    } catch (err) { return false; }
  };

  const audioLoop = () => {
    if (!analyserRef.current || !leadSamplerRef.current || !chordSamplerRef.current) return;
    const buffer = analyserRef.current.getValue() as Float32Array;
    let sum = 0; for (let i = 0; i < buffer.length; i++) { const sample = buffer[i] * stateRef.current.micBoost; sum += sample * sample; }
    const rms = Math.sqrt(sum / buffer.length); setRmsVolume(rms);
    if (stateRef.current.isPlayingBack) return;
    const isMidiActive = stateRef.current.mode === WorkstationMode.MIDI || stateRef.current.mode === WorkstationMode.RECORD;
    if (rms > stateRef.current.sensitivity && isMidiActive) {
      const freq = detectPitch(buffer, Tone.getContext().sampleRate);
      let dMidiFloat = freq ? frequencyToMidiFloat(freq) : null;
      if (dMidiFloat !== null) {
        const dMidi = snapToScale(Math.round(dMidiFloat), stateRef.current.scale);
        if (stateRef.current.bendMode) {
          const bend = (dMidiFloat - Math.round(dMidiFloat)) * 100;
          // @ts-ignore
          if ('set' in leadSamplerRef.current) leadSamplerRef.current.set({ detune: bend }); 
          // @ts-ignore
          if ('set' in chordSamplerRef.current) chordSamplerRef.current.set({ detune: bend });
        }
        if (dMidi !== stateRef.current.lastMidi) {
          const nName = midiToNoteName(dMidi); if (nName.startsWith("undefined")) return;
          if (stateRef.current.mode === WorkstationMode.RECORD && activeNoteStartRef.current) {
            const duration = Tone.now() - recordingStartTimeRef.current - activeNoteStartRef.current.time;
            if (duration >= MIN_NOTE_DURATION) recordingNotesRef.current.push({ ...activeNoteStartRef.current, duration });
          }
          if (stateRef.current.glide === 0) { leadSamplerRef.current.releaseAll(); chordSamplerRef.current.releaseAll(); }
          leadSamplerRef.current.triggerAttack(nName);
          if (stateRef.current.isHarmonizerActive) {
            const chord = getChordNotes(dMidi, stateRef.current.scale); setCurrentChordName(chord.name);
            chord.notes.forEach(m => chordSamplerRef.current?.triggerAttack(midiToNoteName(m)));
          } else setCurrentChordName(null);
          setCurrentMidiNote(dMidi); stateRef.current.lastMidi = dMidi;
          if (stateRef.current.mode === WorkstationMode.RECORD) activeNoteStartRef.current = { note: nName, time: Tone.now() - recordingStartTimeRef.current };
        }
      }
    } else if (stateRef.current.lastMidi !== null) {
      leadSamplerRef.current.releaseAll(); chordSamplerRef.current.releaseAll();
      if (stateRef.current.mode === WorkstationMode.RECORD && activeNoteStartRef.current) {
        const duration = Tone.now() - recordingStartTimeRef.current - activeNoteStartRef.current.time;
        if (duration >= MIN_NOTE_DURATION) recordingNotesRef.current.push({ ...activeNoteStartRef.current, duration });
        activeNoteStartRef.current = null;
      }
      stateRef.current.lastMidi = null; setCurrentMidiNote(null); setCurrentChordName(null);
    }
  };

  const toggleRecording = async () => {
    if (!isRecording) { stopAllPlayback(); recordingNotesRef.current = []; recordingStartTimeRef.current = Tone.now(); recorderRef.current?.start(); setIsRecording(true); setMode(WorkstationMode.RECORD); }
    else { const audioBlob = await recorderRef.current?.stop(); setIsRecording(false); setMode(WorkstationMode.IDLE); if (audioBlob) { setSessions(prev => [{ id: Math.random().toString(36).substr(2, 9), timestamp: Date.now(), midiNotes: [...recordingNotesRef.current], audioUrl: URL.createObjectURL(audioBlob), instrumentId: selectedInstrument.id, bpm, scale: currentScale }, ...prev]); setActiveTab('VAULT'); } }
  };

  const stopAllPlayback = () => { [leadSamplerRef, chordSamplerRef].forEach(ref => ref.current?.releaseAll()); playerRef.current?.stop(); setIsPlayingBack(null); setCurrentMidiNote(null); setCurrentChordName(null); stateRef.current.lastMidi = null; };

  const playSessionMidi = async (session: StudioSession) => {
    if (isPlayingBack) stopAllPlayback();
    setIsPlayingBack(session.id + "_loading");
    try {
      await applyInstrumentSettings(session.instrumentId);
      setIsPlayingBack(session.id + "_midi");
      const processed = processNotes(session.midiNotes);
      const now = Tone.now() + 0.1; let maxD = 0;
      processed.forEach(n => {
        leadSamplerRef.current?.triggerAttackRelease(n.note, n.duration, now + n.time);
        if (isHarmonizerActive) {
          const chord = getChordNotes(Tone.Frequency(n.note).toMidi(), session.scale);
          chord.notes.forEach(m => chordSamplerRef.current?.triggerAttackRelease(midiToNoteName(m), n.duration, now + n.time));
        }
        maxD = Math.max(maxD, n.time + n.duration);
      });
      setTimeout(() => setIsPlayingBack(null), (maxD * 1000) + 1000);
    } catch (e) { setIsPlayingBack(null); }
  };

  const getAiInsights = async (session: StudioSession) => {
    setIsAnalyzing(session.id);
    try {
      const ai = new GoogleGenAI({ apiKey: "TU_API_KEY" }); // Sostituisci con la tua chiave
      const prompt = `Pro produttore: sessione ${session.instrumentId}, bpm ${session.bpm}. Fornisci un breve consiglio creativo basato sulle attuali tendenze musicali.`;
      const response = await ai.models.generateContent({ 
        model: 'gemini-1.5-pro', 
        contents: prompt
      });
      setAiAnalysis({ id: session.id, text: response.text || "Consiglio generato." });
    } catch (err) { setAiAnalysis({ id: session.id, text: "AI indisponibile al momento." }); } finally { setIsAnalyzing(null); }
  };

  const getCategoryIcon = (cat: string) => {
    switch(cat) {
      case 'PIANO': return <Piano size={12} />;
      case 'GUITAR': return <Guitar size={12} />;
      case 'PERCUSSION': return <Drum size={12} />;
      case 'BRASS': return <Wind size={12} />;
      case 'WOODWIND': return <Wind size={12} />;
      case 'STRINGS': return <Music size={12} />;
      case 'BASS': return <Zap size={12} />;
      default: return <Box size={12} />;
    }
  };

  return (
    <div className="fixed inset-0 bg-black text-white flex flex-col overflow-hidden font-sans select-none text-[10px]">
      <header className="px-3 py-2 flex justify-between items-center bg-zinc-950/95 border-b border-white/5 z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center shadow-lg"><Combine size={16} className="text-white" /></div>
          <div className="flex flex-col"><h1 className="text-[10px] font-black uppercase tracking-tighter leading-none">VocalSynth<span className="text-purple-500">Pro</span></h1><p className="text-[6px] font-bold text-zinc-500 uppercase tracking-widest mt-0.5">Commercial Engine v12.0</p></div>
        </div>
        {isStarted && <div className="flex items-center gap-2"><div className="flex bg-zinc-900 rounded-full px-2.5 py-1 items-center gap-1.5 border border-white/10"><Timer size={10} className="text-zinc-600" /><input type="number" value={bpm} onChange={(e) => setBpm(Number(e.target.value))} className="bg-transparent w-6 text-[9px] font-black outline-none text-center" /></div><button onClick={() => setShowSettings(!showSettings)} className="p-1.5 bg-zinc-900 rounded-full border border-white/10 hover:bg-zinc-800 transition-colors"><Settings size={14} /></button></div>}
      </header>

      {isStarted && (
        <div className="w-full h-16 bg-zinc-950 relative border-b border-white/5 flex items-center justify-center overflow-hidden">
          <div className="flex items-center gap-1.5 opacity-40">{Array.from({ length: 60 }).map((_, i) => (<div key={i} className={`w-1 rounded-full bg-gradient-to-t transition-all duration-75 ${i % 2 === 0 ? 'from-purple-600 via-white to-cyan-400' : 'from-blue-600 via-white to-purple-400'}`} style={{ height: `${Math.max(2, (rmsVolume * 400 * (0.5 + Math.random()))) }px`, transform: `translateY(${(Math.sin(i * 0.2) * 5)}px)` }} />))}</div>
          <div className="absolute inset-0 flex items-center justify-around px-3 pointer-events-none z-10">
             <div className="flex flex-col items-center">
               <span className="text-[7px] font-black text-zinc-600 uppercase tracking-[0.3em]">Pitch</span>
               <div className="text-xl font-black text-white font-mono drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">{currentMidiNote ? midiToNoteName(currentMidiNote) : '--'}</div>
             </div>
             <div className="flex flex-col items-center">
               <span className="text-[7px] font-black text-zinc-600 uppercase tracking-[0.3em]">Harmonics</span>
               <div className="text-xl font-black text-purple-400 font-mono tracking-tighter drop-shadow-[0_0_10px_rgba(168,85,247,0.3)]">{currentChordName || 'OFF'}</div>
             </div>
          </div>
        </div>
      )}

      {isStarted && (
        <main className="flex-1 flex flex-col px-4 overflow-hidden bg-zinc-950">
          <section className="bg-zinc-900/30 mt-4 p-4 rounded-2xl border border-white/5">
             <div className="grid grid-cols-3 gap-2 shrink-0">
               <button onClick={() => setMode(mode === WorkstationMode.MIDI ? WorkstationMode.IDLE : WorkstationMode.MIDI)} className={`py-3 rounded-2xl flex flex-col items-center gap-1 border-2 transition-all ${mode === WorkstationMode.MIDI ? 'bg-purple-600 border-purple-400 shadow-[0_0_20px_rgba(147,51,234,0.3)]' : 'bg-zinc-900 border-transparent text-zinc-600'}`}><Activity size={18} /><span className="text-[7px] font-black uppercase tracking-widest">Midi</span></button>
               <button onClick={() => setMode(mode === WorkstationMode.VOICE ? WorkstationMode.IDLE : WorkstationMode.VOICE)} className={`py-3 rounded-2xl flex flex-col items-center gap-1 border-2 transition-all ${mode === WorkstationMode.VOICE ? 'bg-blue-600 border-blue-400 shadow-[0_0_20px_rgba(37,99,235,0.3)]' : 'bg-zinc-900 border-transparent text-zinc-600'}`}><Mic2 size={18} /><span className="text-[7px] font-black uppercase tracking-widest">Vox</span></button>
               <button onClick={toggleRecording} className={`py-3 rounded-2xl flex flex-col items-center gap-1 border-2 transition-all ${isRecording ? 'bg-red-600 border-red-400 animate-pulse' : 'bg-zinc-900 border-transparent text-zinc-600'}`}>{isRecording ? <Square size={18} fill="white" /> : <Disc size={18} />}<span className="text-[7px] font-black uppercase tracking-widest">Rec</span></button>
             </div>
          </section>

          <div className="mt-4 flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {(Object.keys(SCALES) as ScaleType[]).map(s => (
              <button key={s} onClick={() => setCurrentScale(s)} className={`flex-none px-4 py-2 rounded-xl text-[8px] font-black transition-all border ${currentScale === s ? 'bg-white text-black border-white scale-105' : 'bg-zinc-900 text-zinc-600 border-transparent hover:bg-zinc-800'}`}>{s}</button>
            ))}
          </div>

          <div className="flex gap-2 my-4 bg-zinc-900/60 p-1.5 rounded-2xl border border-white/5">
             <button onClick={() => setActiveTab('BROWSER')} className={`flex-1 py-2 rounded-xl text-[8px] font-black uppercase flex items-center justify-center gap-2 transition-all ${activeTab === 'BROWSER' ? 'bg-zinc-800 text-white' : 'text-zinc-600'}`}><ListMusic size={14} /> Library</button>
             <button onClick={() => setActiveTab('ENGINE')} className={`flex-1 py-2 rounded-xl text-[8px] font-black uppercase flex items-center justify-center gap-2 transition-all ${activeTab === 'ENGINE' ? 'bg-purple-600 text-white' : 'text-zinc-600'}`}><Cpu size={14} /> Engine</button>
             <button onClick={() => setActiveTab('VAULT')} className={`flex-1 py-2 rounded-xl text-[8px] font-black uppercase flex items-center justify-center gap-2 transition-all ${activeTab === 'VAULT' ? 'bg-zinc-800 text-white' : 'text-zinc-600'}`}><History size={14} /> Vault</button>
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar rounded-2xl bg-zinc-900/10 border border-white/5 mb-32 relative">
            {activeTab === 'BROWSER' && (
              <div className="flex flex-col">
                {(Object.entries(groupedInstruments) as [string, Instrument[]][]).map(([cat, insts]) => (
                  <div key={cat} className="flex flex-col">
                    <div className="bg-zinc-900/50 px-4 py-2 border-y border-white/5 flex items-center gap-2">
                       <span className="text-zinc-500">{getCategoryIcon(cat)}</span>
                       <span className="text-[8px] font-black text-zinc-500 uppercase tracking-[0.2em]">{cat}</span>
                    </div>
                    <div className="flex flex-col divide-y divide-white/5">
                      {insts.map(inst => (
                        <button key={inst.id} onClick={() => { setSelectedInstrument(inst); applyInstrumentSettings(inst.id); }} className={`flex items-center justify-between px-6 py-4 transition-all hover:bg-white/5 ${selectedInstrument.id === inst.id ? 'bg-purple-600/10' : ''}`}>
                          <span className={`text-[10px] font-bold uppercase tracking-wide ${selectedInstrument.id === inst.id ? 'text-purple-400' : 'text-zinc-400'}`}>{inst.name}</span>
                          <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${selectedInstrument.id === inst.id ? 'border-purple-500 bg-purple-500' : 'border-zinc-700 bg-transparent'}`}>{selectedInstrument.id === inst.id && <Check size={12} className="text-white" />}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'ENGINE' && (
              <div className="p-4 space-y-8 pb-10">
                <div className="space-y-4">
                   <h4 className="text-[8px] font-black text-zinc-500 uppercase tracking-[0.4em]">Sonic Profiles (Presets)</h4>
                   <div className="grid grid-cols-3 gap-2">
                      <button onClick={() => applyPreset('E-GUITAR')} className="flex flex-col items-center gap-2 p-3 bg-zinc-900 rounded-xl border border-white/5 hover:border-orange-500 transition-all"><Guitar size={16} className="text-orange-400" /><span className="text-[6px] font-black uppercase text-white">E-Guitar</span></button>
                      <button onClick={() => applyPreset('POP-PIANO')} className="flex flex-col items-center gap-2 p-3 bg-zinc-900 rounded-xl border border-white/5 hover:border-cyan-400 transition-all"><Piano size={16} className="text-cyan-400" /><span className="text-[6px] font-black uppercase text-white">Pop Piano</span></button>
                      <button onClick={() => applyPreset('SYNTHWAVE')} className="flex flex-col items-center gap-2 p-3 bg-zinc-900 rounded-xl border border-white/5 hover:border-indigo-500 transition-all"><Stars size={16} className="text-indigo-500" /><span className="text-[6px] font-black uppercase text-white">Synthwave</span></button>
                      
                      <button onClick={() => applyPreset('HIPHOP')} className="flex flex-col items-center gap-2 p-3 bg-zinc-900 rounded-xl border border-white/5 hover:border-purple-500 transition-all"><Disc2 size={16} className="text-purple-400" /><span className="text-[6px] font-black uppercase text-white">Hip Hop</span></button>
                      <button onClick={() => applyPreset('HOUSE')} className="flex flex-col items-center gap-2 p-3 bg-zinc-900 rounded-xl border border-white/5 hover:border-blue-500 transition-all"><Zap size={16} className="text-blue-400" /><span className="text-[6px] font-black uppercase text-white">House</span></button>
                      <button onClick={() => applyPreset('CLASSIC')} className="flex flex-col items-center gap-2 p-3 bg-zinc-900 rounded-xl border border-white/5 hover:border-emerald-500 transition-all"><Waves size={16} className="text-emerald-400" /><span className="text-[6px] font-black uppercase text-white">Classic</span></button>
                      <button onClick={() => applyPreset('90S')} className="flex flex-col items-center gap-2 p-3 bg-zinc-900 rounded-xl border border-white/5 hover:border-red-500 transition-all"><Sparkles size={16} className="text-red-400" /><span className="text-[6px] font-black uppercase text-white">90s Lead</span></button>
                      <button onClick={() => applyPreset('ROCK')} className="flex flex-col items-center gap-2 p-3 bg-zinc-900 rounded-xl border border-white/5 hover:border-orange-500 transition-all"><Flame size={16} className="text-orange-400" /><span className="text-[6px] font-black uppercase text-white">Rock</span></button>
                      <button onClick={() => applyPreset('DANCE')} className="flex flex-col items-center gap-2 p-3 bg-zinc-900 rounded-xl border border-white/5 hover:border-pink-500 transition-all"><PartyPopper size={16} className="text-pink-400" /><span className="text-[6px] font-black uppercase text-white">Dance</span></button>
                   </div>
                </div>

                <div className="space-y-6 pt-4 border-t border-white/5">
                   <h4 className="text-[8px] font-black text-zinc-500 uppercase tracking-[0.4em]">Voice & Modulation</h4>
                   <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div className="flex justify-between items-center"><span className="text-[7px] font-black uppercase text-zinc-500">Glide</span><span className="text-[7px] text-white">{glide.toFixed(2)}s</span></div>
                        <input type="range" min="0" max="0.5" step="0.01" value={glide} onChange={e => setGlide(parseFloat(e.target.value))} className="w-full h-1 bg-zinc-800 accent-purple-500 appearance-none rounded-full" />
                      </div>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center"><span className="text-[7px] font-black uppercase text-zinc-500">Vibrato</span><span className="text-[7px] text-white">{(vibratoDepth * 100).toFixed(0)}%</span></div>
                        <input type="range" min="0" max="1" step="0.01" value={vibratoDepth} onChange={e => setVibratoDepth(parseFloat(e.target.value))} className="w-full h-1 bg-zinc-800 accent-blue-500 appearance-none rounded-full" />
                      </div>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center"><span className="text-[7px] font-black uppercase text-zinc-500">Thickness</span><span className="text-[7px] text-white">{(unisonThickness * 100).toFixed(0)}%</span></div>
                        <input type="range" min="0" max="1" step="0.01" value={unisonThickness} onChange={e => setUnisonThickness(parseFloat(e.target.value))} className="w-full h-1 bg-zinc-800 accent-emerald-500 appearance-none rounded-full" />
                      </div>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center"><span className="text-[7px] font-black uppercase text-zinc-500">Master Level</span><span className="text-[7px] text-white">{(leadVol * 100).toFixed(0)}%</span></div>
                        <input type="range" min="0" max="1" step="0.01" value={leadVol} onChange={e => setLeadVol(parseFloat(e.target.value))} className="w-full h-1 bg-zinc-800 accent-white appearance-none rounded-full" />
                      </div>
                   </div>
                </div>
                
                <div className="pt-6 border-t border-white/5">
                   <h4 className="text-[8px] font-black text-zinc-500 uppercase tracking-[0.4em] mb-6">Spatial Effects</h4>
                   <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div className="flex justify-between items-center"><span className="text-[7px] font-black uppercase text-zinc-500">Delay</span><span>{(delayWet * 100).toFixed(0)}%</span></div>
                        <input type="range" min="0" max="0.8" step="0.01" value={delayWet} onChange={e => setDelayWet(parseFloat(e.target.value))} className="w-full h-1 bg-zinc-800 accent-purple-400 appearance-none rounded-full" />
                      </div>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center"><span className="text-[7px] font-black uppercase text-zinc-500">Reverb</span><span>{(reverbWet * 100).toFixed(0)}%</span></div>
                        <input type="range" min="0" max="0.8" step="0.01" value={reverbWet} onChange={e => setReverbWet(parseFloat(e.target.value))} className="w-full h-1 bg-zinc-800 accent-blue-400 appearance-none rounded-full" />
                      </div>
                   </div>
                </div>

                <div className="pt-6 border-t border-white/5">
                   <h4 className="text-[8px] font-black text-zinc-500 uppercase tracking-[0.4em] mb-6">Envelope (ADSR)</h4>
                   <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div className="flex justify-between items-center"><span className="text-[7px] font-black uppercase text-zinc-500">Attack</span><span>{attack.toFixed(2)}s</span></div>
                        <input type="range" min="0.001" max="2" step="0.01" value={attack} onChange={e => setAttack(parseFloat(e.target.value))} className="w-full h-1 bg-zinc-800 accent-emerald-500 appearance-none rounded-full" />
                      </div>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center"><span className="text-[7px] font-black uppercase text-zinc-500">Release</span><span>{release.toFixed(2)}s</span></div>
                        <input type="range" min="0.001" max="4" step="0.01" value={release} onChange={e => setRelease(parseFloat(e.target.value))} className="w-full h-1 bg-zinc-800 accent-red-500 appearance-none rounded-full" />
                      </div>
                   </div>
                </div>
              </div>
            )}

            {activeTab === 'VAULT' && (
              <div className="p-4 space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-white/5">
                   <span className="text-[7px] font-black text-zinc-500 uppercase tracking-widest">Saved Recordings</span>
                   <button onClick={() => setSkipSilences(!skipSilences)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[7px] font-black uppercase transition-all ${skipSilences ? 'bg-emerald-600 border-emerald-400 text-white' : 'bg-zinc-900 border-zinc-800 text-zinc-600'}`}>
                     <FastForward size={12} /> Skip Silences
                   </button>
                </div>
                {sessions.length === 0 && <div className="py-20 text-center text-zinc-700 font-black uppercase text-[8px] tracking-[0.5em]">No Sessions Recorded</div>}
                {sessions.map(s => (
                  <div key={s.id} className="p-4 bg-zinc-950 rounded-2xl border border-white/10 flex flex-col gap-4 shadow-xl relative overflow-hidden">
                    {isRendering === s.id && (
                       <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
                          <Loader2 className="animate-spin text-purple-400 mb-2" size={24} />
                          <span className="text-[8px] font-black uppercase tracking-widest text-purple-400">Mastering WAV...</span>
                       </div>
                    )}
                    
                    <div className="flex justify-between items-center">
                       <div className="flex flex-col">
                         <span className="text-[9px] font-black uppercase text-purple-400">Session {s.id}</span>
                         <span className="text-[6px] text-zinc-600 font-bold uppercase tracking-widest">{new Date(s.timestamp).toLocaleTimeString()}</span>
                       </div>
                       <div className="flex gap-2">
                         <button onClick={() => getAiInsights(s)} className="p-2 bg-zinc-900 rounded-lg text-purple-400 hover:bg-purple-600 hover:text-white transition-all"><Wand2 size={14} /></button>
                         <button onClick={() => renderMasterWav(s)} title="Export Master WAV" className="p-2 bg-zinc-900 rounded-lg text-emerald-400 hover:bg-emerald-600 hover:text-white transition-all"><Download size={14} /></button>
                         <button onClick={() => setSessions(prev => prev.filter(x => x.id !== s.id))} className="p-2 bg-zinc-900 rounded-lg text-zinc-600 hover:text-red-500 transition-all"><Trash2 size={14} /></button>
                       </div>
                    </div>
                    
                    <div className="bg-zinc-900/40 p-2 rounded-xl border border-white/5">
                       <select 
                         value={s.instrumentId} 
                         onChange={(e) => {
                           const newId = e.target.value;
                           setSessions(prev => prev.map(x => x.id === s.id ? { ...x, instrumentId: newId } : x));
                         }}
                         className="w-full bg-zinc-900 text-white text-[9px] font-bold uppercase rounded-lg px-2 py-2 outline-none border border-white/10"
                       >
                         {INSTRUMENTS.map(inst => <option key={inst.id} value={inst.id}>{inst.name}</option>)}
                       </select>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => playSessionMidi(s)} className="py-3 bg-zinc-900 rounded-xl text-[8px] font-black uppercase flex items-center justify-center gap-2 border border-white/5 hover:bg-zinc-800 transition-all"><Play size={10} fill="white" /> MIDI Replay</button>
                      <button onClick={() => { playerRef.current?.load(s.audioUrl).then(() => playerRef.current?.start()); }} className="py-3 bg-zinc-900 rounded-xl text-[8px] font-black uppercase flex items-center justify-center gap-2 border border-white/5 hover:bg-zinc-800 transition-all"><Mic size={10} /> Vocal Take</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      )}

      {/* Dock */}
      {isStarted && (
        <div className="fixed bottom-6 left-4 right-4 z-[60]">
          <div className="bg-zinc-950/95 backdrop-blur-3xl border border-white/10 p-3 rounded-3xl flex items-center justify-between shadow-2xl">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isRecording ? 'bg-red-600 animate-pulse' : mode === WorkstationMode.VOICE ? 'bg-blue-600' : 'bg-zinc-900 text-zinc-600'}`}>
                {isRecording ? <Disc size={20} className="animate-spin" /> : <Mic size={20} />}
              </div>
              <div className="flex flex-col">
                <span className="text-[6px] font-black text-zinc-600 uppercase tracking-widest leading-none">{mode} ACTIVE</span>
                <span className="text-[11px] font-black text-white italic truncate max-w-[100px] mt-1 uppercase tracking-tighter">{currentChordName || (currentMidiNote ? midiToNoteName(currentMidiNote) : 'IDLE')}</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setBendMode(!bendMode)} className={`text-[7px] font-black px-2.5 py-1 rounded-full border transition-all ${bendMode ? 'text-emerald-400 border-emerald-500/30 bg-emerald-400/5' : 'text-zinc-700 border-white/5'}`}>BEND</button>
              <button onClick={stopAllPlayback} className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center text-zinc-600 hover:text-white transition-colors"><Square size={16} fill="currentColor" /></button>
            </div>
          </div>
        </div>
      )}

      {/* Landing */}
      {!isStarted && !isConfiguring && (
        <div className="absolute inset-0 z-[100] bg-black flex flex-col items-center justify-center p-10 text-center">
          <div className="relative group">
            <div className="absolute -inset-4 bg-purple-600 rounded-[2rem] blur opacity-30 group-hover:opacity-60 transition duration-1000"></div>
            <div className="w-24 h-24 bg-purple-600 rounded-[2rem] flex items-center justify-center mb-10 shadow-2xl relative">
              <Combine size={48} className="text-white" />
            </div>
          </div>
          <h2 className="text-6xl font-black mb-4 tracking-tighter uppercase italic leading-[0.8] text-white">Vocal<br/><span className="text-purple-600">Synth</span></h2>
          <p className="text-zinc-700 text-[8px] mt-8 mb-16 uppercase font-black tracking-[0.6em]">Pro Studio Engine Commercial v12.0</p>
          <button onClick={() => { setIsConfiguring(true); initAudioCore().then(() => setIsStarted(true)); }} className="w-full max-w-[240px] bg-white text-black py-6 rounded-full font-black text-xl hover:bg-purple-500 hover:text-white transition-all shadow-[0_0_30px_rgba(255,255,255,0.2)]">INITIALIZE</button>
        </div>
      )}

      {aiAnalysis && (
        <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-md flex items-center justify-center p-6" onClick={() => setAiAnalysis(null)}>
          <div className="w-full max-w-md bg-zinc-950 border border-purple-500/30 rounded-3xl p-8 flex flex-col gap-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3"><div className="w-10 h-10 bg-purple-600 rounded-2xl flex items-center justify-center"><Wand2 size={20} className="text-white" /></div><h4 className="text-xs font-black uppercase tracking-widest text-white">Producer Insights</h4></div>
              <button onClick={() => setAiAnalysis(null)}><XCircle size={20} className="text-zinc-600" /></button>
            </div>
            <div className="bg-zinc-900/50 p-6 rounded-2xl border border-white/5">
              <p className="text-[10px] leading-relaxed text-zinc-300 font-medium whitespace-pre-wrap">"{aiAnalysis.text}"</p>
            </div>
            <button onClick={() => setAiAnalysis(null)} className="w-full bg-white text-black py-4 rounded-xl font-black text-[9px] uppercase tracking-widest shadow-xl">Dismiss</button>
          </div>
        </div>
      )}

      <style>{`
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; height: 16px; width: 16px; border-radius: 50%; background: #fff; cursor: pointer; border: 3px solid #6366f1; box-shadow: 0 0 10px rgba(0,0,0,0.5); }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        select {
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 0.75rem center;
        }
      `}</style>
    </div>
  );
};

export default App;
