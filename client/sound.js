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

// A chord based on how far right the column is (leftmost column plays the
// root, each column further right climbs one scale degree) and how many
// discs are already stacked in that column: the second note climbs further
// by that many scale degrees, and both notes play simultaneously.
export function moveSound(column, duration, discsInColumn) {
  return {
    notes: [[note(column, duration), note(column + discsInColumn, duration)]],
    waveform: "triangle",
    gain: 0.25,
  };
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

  // Each entry in `notes` is either a single {frequency, duration} note, or
  // an array of them (a chord) to be played simultaneously. Sequential
  // entries still advance along one timeline, one after another; each note
  // gets its own oscillator so simultaneous notes can each hold their own
  // frequency.
  play({ notes, waveform, gain }) {
    if (this.muted || !this.#context) return;

    let time = this.#context.currentTime;

    notes.forEach((step) => {
      const chordNotes = Array.isArray(step) ? step : [step];
      const stepDuration = Math.max(...chordNotes.map(({ duration = 0.3 }) => duration));

      chordNotes.forEach(({ frequency, duration = 0.3 }) => {
        const oscillator = this.#context.createOscillator();
        const gainNode = this.#context.createGain();
        oscillator.type = waveform;
        gainNode.gain.value = gain;
        oscillator.connect(gainNode).connect(this.#context.destination);
        oscillator.frequency.setValueAtTime(frequency, time);
        oscillator.start(time);
        oscillator.stop(time + duration);
      });

      time += stepDuration;
    });
  }
}
