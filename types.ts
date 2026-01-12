
export enum WorkstationMode {
  IDLE = 'IDLE',
  MIDI = 'MIDI',
  VOICE = 'VOICE',
  RECORD = 'RECORD'
}

export type ScaleType = 'MAJOR' | 'MINOR' | 'PENTATONIC' | 'BLUES' | 'CHROMATIC';

export interface Instrument {
  id: string;
  name: string;
  category: 'PIANO' | 'SYNTH' | 'STRINGS' | 'BASS' | 'BRASS' | 'WOODWIND' | 'GUITAR' | 'PERCUSSION' | 'ETHNIC' | 'PAD';
}

export interface RecordedNote {
  note: string;
  time: number;
  duration: number;
}

export interface StudioSession {
  id: string;
  timestamp: number;
  midiNotes: RecordedNote[];
  audioUrl: string;
  instrumentId: string;
  bpm: number;
  scale: ScaleType;
}
