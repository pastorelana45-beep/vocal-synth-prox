
import { Instrument, ScaleType } from './types';

export const MIN_NOTE_DURATION = 0.05;

export const INSTRUMENTS: Instrument[] = [
  // PIANOS
  { id: 'concert-grand', name: 'CONCERT GRAND', category: 'PIANO' },
  { id: 'vintage-rhodes', name: 'VINTAGE RHODES', category: 'PIANO' },
  { id: 'church-organ', name: 'CHURCH ORGAN', category: 'PIANO' },
  { id: 'harpsichord', name: 'HARPSICHORD', category: 'PIANO' },
  
  // STRINGS
  { id: 'solo-violin', name: 'SOLO VIOLIN', category: 'STRINGS' },
  { id: 'solo-cello', name: 'SOLO CELLO', category: 'STRINGS' },
  { id: 'string-ensemble', name: 'STRING ENSEMBLE', category: 'STRINGS' },
  { id: 'pizzicato-strings', name: 'PIZZICATO STRINGS', category: 'STRINGS' },
  
  // BRASS
  { id: 'jazz-trumpet', name: 'JAZZ TRUMPET', category: 'BRASS' },
  { id: 'horn-section', name: 'HORN SECTION', category: 'BRASS' },
  { id: 'trombone-solo', name: 'TROMBONE SOLO', category: 'BRASS' },
  
  // WOODWINDS
  { id: 'alto-sax', name: 'ALTO SAX', category: 'WOODWIND' },
  { id: 'concert-flute', name: 'CONCERT FLUTE', category: 'WOODWIND' },
  { id: 'clarinet', name: 'CLARINET', category: 'WOODWIND' },
  { id: 'harmonica', name: 'HARMONICA', category: 'WOODWIND' },
  { id: 'oboe-solo', name: 'OBOE SOLO', category: 'WOODWIND' },
  
  // GUITARS
  { id: 'nylon-guitar', name: 'NYLON GUITAR', category: 'GUITAR' },
  { id: 'acoustic-steel', name: 'ACOUSTIC STEEL', category: 'GUITAR' },
  { id: '12-string-acoustic', name: '12-STRING ACOUSTIC', category: 'GUITAR' },
  { id: 'clean-electric', name: 'CLEAN ELECTRIC', category: 'GUITAR' },
  { id: 'muted-electric', name: 'MUTED ELECTRIC', category: 'GUITAR' },
  { id: 'jazz-hollow-body', name: 'JAZZ HOLLOW BODY', category: 'GUITAR' },
  { id: 'crunch-lead', name: 'CRUNCH LEAD', category: 'GUITAR' },
  { id: 'heavy-distortion', name: 'HEAVY DISTORTION', category: 'GUITAR' },
  { id: 'ukulele-breeze', name: 'UKULELE BREEZE', category: 'GUITAR' },
  
  // BASS
  { id: 'electric-bass', name: 'ELECTRIC BASS', category: 'BASS' },
  { id: 'funk-slap-bass', name: 'FUNK SLAP BASS', category: 'BASS' },
  
  // ETHNIC
  { id: 'banjo-solo', name: 'BANJO SOLO', category: 'ETHNIC' },
  
  // SYNTH & PADS
  { id: 'lamour-lead-90s', name: "L'AMOUR LEAD (90S)", category: 'SYNTH' },
  { id: 'sawtooth-lead', name: 'SAWTOOTH LEAD', category: 'SYNTH' },
  { id: 'atmospheric-pad', name: 'ATMOSPHERIC PAD', category: 'PAD' },
  { id: 'dream-strings', name: 'DREAM STRINGS', category: 'PAD' },
  { id: 'crystal-bells', name: 'CRYSTAL BELLS', category: 'SYNTH' },
  { id: 'choir-aahs', name: 'CHOIR AAHS', category: 'PAD' },
  
  // PERCUSSION
  { id: 'studio-drum-kit', name: 'STUDIO DRUM KIT', category: 'PERCUSSION' },
  { id: 'amour-909-kit', name: 'AMOUR 909 KIT', category: 'PERCUSSION' },
  { id: 'steel-drums', name: 'STEEL DRUMS', category: 'PERCUSSION' },
  { id: 'marimba', name: 'MARIMBA', category: 'PERCUSSION' },
  { id: 'tubular-bells', name: 'TUBULAR BELLS', category: 'PERCUSSION' },
  { id: 'music-box', name: 'MUSIC BOX', category: 'ETHNIC' }
];

export const SCALES: Record<ScaleType, number[]> = {
  MAJOR: [0, 2, 4, 5, 7, 9, 11],
  MINOR: [0, 2, 3, 5, 7, 8, 10],
  PENTATONIC: [0, 2, 4, 7, 9],
  BLUES: [0, 3, 5, 6, 7, 10],
  CHROMATIC: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
};

export const SAMPLE_MAPS: Record<string, { urls: Record<string, string>, baseUrl: string }> = {
  'concert-grand': {
    urls: { 'A0': 'A0.mp3', 'C1': 'C1.mp3', 'D#1': 'Ds1.mp3', 'F#1': 'Fs1.mp3', 'A1': 'A1.mp3', 'C2': 'C2.mp3', 'D#2': 'Ds2.mp3', 'F#2': 'Fs2.mp3', 'A2': 'A2.mp3', 'C3': 'C3.mp3', 'D#3': 'Ds3.mp3', 'F#3': 'Fs3.mp3', 'A3': 'A3.mp3', 'C4': 'C4.mp3', 'D#4': 'Ds4.mp3', 'F#4': 'Fs4.mp3', 'A4': 'A4.mp3', 'C5': 'C5.mp3', 'D#5': 'Ds5.mp3', 'F#5': 'Fs5.mp3', 'A5': 'A5.mp3', 'C6': 'C6.mp3', 'D#6': 'Ds6.mp3', 'F#6': 'Fs6.mp3', 'A6': 'A6.mp3', 'C7': 'C7.mp3', 'D#7': 'Ds7.mp3', 'F#7': 'Fs7.mp3', 'A7': 'A7.mp3' },
    baseUrl: 'https://tonejs.github.io/audio/salamander/'
  },
  'vintage-rhodes': {
    urls: { 'C2': 'C2.mp3', 'E2': 'E2.mp3', 'G2': 'G2.mp3', 'C3': 'C3.mp3' },
    baseUrl: 'https://tonejs.github.io/audio/casio/'
  }
};
