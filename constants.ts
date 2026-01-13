import { Instrument, ScaleType } from './types';

export const MIN_NOTE_DURATION = 0.05;

// Base URL per i suoni (FluidR3_GM)
const MIDI_JS_BASE = "https://raw.githubusercontent.com/gleitz/midi-js-soundfonts/gh-pages/FluidR3_GM/";

export const INSTRUMENTS: Instrument[] = [
  // PIANOS
  { id: 'acoustic_grand_piano', name: 'CONCERT GRAND', category: 'PIANO' },
  { id: 'electric_piano_1', name: 'VINTAGE RHODES', category: 'PIANO' },
  { id: 'church_organ', name: 'CHURCH ORGAN', category: 'PIANO' },
  { id: 'harpsichord', name: 'HARPSICHORD', category: 'PIANO' },
  
  // STRINGS
  { id: 'violin', name: 'SOLO VIOLIN', category: 'STRINGS' },
  { id: 'cello', name: 'SOLO CELLO', category: 'STRINGS' },
  { id: 'string_ensemble_1', name: 'STRING ENSEMBLE', category: 'STRINGS' },
  { id: 'pizzicato_strings', name: 'PIZZICATO STRINGS', category: 'STRINGS' },
  
  // BRASS
  { id: 'trumpet', name: 'JAZZ TRUMPET', category: 'BRASS' },
  { id: 'trombone', name: 'TROMBONE SOLO', category: 'BRASS' },
  { id: 'brass_section', name: 'HORN SECTION', category: 'BRASS' },
  
  // WOODWINDS
  { id: 'alto_sax', name: 'ALTO SAX', category: 'WOODWIND' },
  { id: 'flute', name: 'CONCERT FLUTE', category: 'WOODWIND' },
  { id: 'clarinet', name: 'CLARINET', category: 'WOODWIND' },
  { id: 'harmonica', name: 'HARMONICA', category: 'WOODWIND' },
  { id: 'oboe', name: 'OBOE SOLO', category: 'WOODWIND' },
  
  // GUITARS
  { id: 'acoustic_guitar_nylon', name: 'NYLON GUITAR', category: 'GUITAR' },
  { id: 'acoustic_guitar_steel', name: 'ACOUSTIC STEEL', category: 'GUITAR' },
  { id: 'electric_guitar_clean', name: 'CLEAN ELECTRIC', category: 'GUITAR' },
  { id: 'electric_guitar_muted', name: 'MUTED ELECTRIC', category: 'GUITAR' },
  { id: 'electric_guitar_jazz', name: 'JAZZ HOLLOW BODY', category: 'GUITAR' },
  { id: 'distortion_guitar', name: 'HEAVY DISTORTION', category: 'GUITAR' },
  { id: 'banjo', name: 'BANJO', category: 'GUITAR' },
  
  // BASS
  { id: 'electric_bass_finger', name: 'ELECTRIC BASS', category: 'BASS' },
  { id: 'slap_bass_1', name: 'FUNK SLAP BASS', category: 'BASS' },
  
  // PERCUSSION & OTHERS
  { id: 'marimba', name: 'MARIMBA', category: 'PERCUSSION' },
  { id: 'steel_drums', name: 'STEEL DRUMS', category: 'PERCUSSION' },
  { id: 'tubular_bells', name: 'TUBULAR BELLS', category: 'PERCUSSION' },
  { id: 'music_box', name: 'MUSIC BOX', category: 'PERCUSSION' },
  { id: 'tinkle_bell', name: 'CRYSTAL BELLS', category: 'SYNTH' },
  { id: 'synth_lead_1_square', name: 'SQUARE LEAD', category: 'SYNTH' },
  { id: 'synth_lead_2_sawtooth', name: 'SAWTOOTH LEAD', category: 'SYNTH' }
];

export const SCALES: Record<ScaleType, number[]> = {
  MAJOR: [0, 2, 4, 5, 7, 9, 11],
  MINOR: [0, 2, 3, 5, 7, 8, 10],
  PENTATONIC: [0, 2, 4, 7, 9],
  BLUES: [0, 3, 5, 6, 7, 10],
  CHROMATIC: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
};

// Mappa automatica dei file MP3
export const SAMPLE_MAPS: Record<string, { urls: Record<string, string>, baseUrl: string }> = {};

INSTRUMENTS.forEach(inst => {
  SAMPLE_MAPS[inst.id] = {
    baseUrl: `${MIDI_JS_BASE}${inst.id}-mp3/`,
    urls: {
      'A0': 'A0.mp3', 'C1': 'C1.mp3', 'D#1': 'Ds1.mp3', 'F#1': 'Fs1.mp3',
      'A1': 'A1.mp3', 'C2': 'C2.mp3', 'D#2': 'Ds2.mp3', 'F#2': 'Fs2.mp3',
      'A2': 'A2.mp3', 'C3': 'C3.mp3', 'D#3': 'Ds3.mp3', 'F#3': 'Fs3.mp3',
      'A3': 'A3.mp3', 'C4': 'C4.mp3', 'D#4': 'Ds4.mp3', 'F#4': 'Fs4.mp3',
      'A4': 'A4.mp3', 'C5': 'C5.mp3', 'D#5': 'Ds5.mp3', 'F#5': 'Fs5.mp3',
      'A5': 'A5.mp3', 'C6': 'C6.mp3', 'D#6': 'Ds6.mp3', 'F#6': 'Fs6.mp3',
      'A6': 'A6.mp3', 'C7': 'C7.mp3'
    }
  };
});
