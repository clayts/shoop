"use strict";

// ============================================================================
// Sound: note/scale math, the game's chime definitions, and a tiny WebAudio
// player that owns the AudioContext and mute state.
// ============================================================================

const ROOT_MIDI_NOTE = 65; // F4
const SCALE_SEMITONES = [0, 2, 4, 7, 9]; // Tizita major / western major pentatonic
// const SCALE_SEMITONES = [0, 1, 5, 6, 9]; // Anchihoye scale: 1, m2, 4, b5, M6
// const SCALE_SEMITONES = [0, 1, 5, 7, 8]; // Ambassel minor scale: 1, m2, 4, 5, m6

// A single scale-degree note, ready to drop into a notes[] array. Degree 0 is
// the root (ROOT_MIDI_NOTE); negative or >= scale length wraps into a
// neighbouring octave.
function note(degree, duration, extra = {}) {
  const length = SCALE_SEMITONES.length;
  const octave = Math.floor(degree / length);
  const semitone = SCALE_SEMITONES[((degree % length) + length) % length] + octave * 12;

  const frequency = 440 * Math.pow(2, (ROOT_MIDI_NOTE + semitone - 69) / 12);

  return { frequency, duration, ...extra };
}

// Fixed chimes, keyed by the event that triggers them.
export const SOUNDS = {
  connected: { notes: [note(0, 0.1), note(4, 0.15)], waveform: "sine", gain: 0.2 },
  disconnected: { notes: [note(4, 0.1), note(0, 0.15)], waveform: "sine", gain: 0.2 },
  error: { notes: [note(-4, 0.15), note(-5, 0.2)], waveform: "sawtooth", gain: 0.2 },
  restart: { notes: [note(2, 0.1), note(4, 0.1), note(2, 0.15)], waveform: "triangle", gain: 0.2 },
  win: { notes: [2, 3, 4, 5].map((degree) => note(degree, 0.15)), waveform: "sine", gain: 0.25 },
  lose: { notes: [2, 1, 0, -1].map((degree) => note(degree, 0.2)), waveform: "sine", gain: 0.25 },
};

// A single note based on how far right the column is: the leftmost column
// plays the root, and each column further right climbs one scale degree.
export function moveSound(column, duration) {
  return { notes: [note(column, duration)], waveform: "triangle", gain: 0.25 };
}

// Owns the AudioContext (created lazily, on first unmute) and mute state, and
// plays {notes, waveform, gain} sounds like the ones above.
export class SoundPlayer {
  muted = true;
  #context = null;

  // Must be called from a user gesture (e.g. a click) the first time, since
  // browsers block audio until then.
  toggleMute() {
    this.#context ??= new (window.AudioContext || window.webkitAudioContext)();
    this.#context.resume();
    this.muted = !this.muted;
    return this.muted;
  }

  play({ notes, waveform, gain }) {
    if (this.muted || !this.#context) return;

    const oscillator = this.#context.createOscillator();
    const gainNode = this.#context.createGain();
    oscillator.type = waveform;
    gainNode.gain.value = gain;
    oscillator.connect(gainNode).connect(this.#context.destination);

    let time = this.#context.currentTime;

    notes.forEach(({ frequency, duration = 0.3 }) => {
      oscillator.frequency.setValueAtTime(frequency, time);
      time += duration;
    });

    oscillator.start();
    oscillator.stop(time);
  }
}
