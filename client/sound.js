"use strict";

// ============================================================================
// Sound: the note/scale maths, the game's chimes, and a small WebAudio player
// that owns the AudioContext and the mute state.
// ============================================================================

const ROOT_MIDI_NOTE = 65; // F4
const A4_MIDI_NOTE = 69;
const A4_FREQUENCY = 440;
const SEMITONES_PER_OCTAVE = 12;

const SCALE_SEMITONES = [0, 2, 4, 7, 9]; // Tizita major / western major pentatonic
// const SCALE_SEMITONES = [0, 1, 5, 6, 9]; // Anchihoye scale: 1, m2, 4, b5, M6
// const SCALE_SEMITONES = [0, 1, 5, 7, 8]; // Ambassel minor scale: 1, m2, 4, 5, m6

const DEFAULT_NOTE_DURATION = 0.3;
const RAMP_SECONDS = 0.005; // fade in and out, so notes don't click on and off

// A single scale-degree note, ready to drop into a notes[] array. Degree 0 is
// the root (ROOT_MIDI_NOTE); negative degrees, or degrees past the end of the
// scale, wrap into a neighbouring octave.
function note(degree, duration, extra = {}) {
  const length = SCALE_SEMITONES.length;
  const octave = Math.floor(degree / length);
  const semitone = SCALE_SEMITONES[((degree % length) + length) % length] + octave * SEMITONES_PER_OCTAVE;
  const frequency = A4_FREQUENCY * 2 ** ((ROOT_MIDI_NOTE + semitone - A4_MIDI_NOTE) / SEMITONES_PER_OCTAVE);

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

// A two-note chord placing the move in space: how far right the column is sets
// the root (leftmost plays the root, each column right of it climbs a scale
// degree), and how many discs are already stacked there sets how much further
// the second note climbs above it.
export function moveSound(column, duration, discsInColumn) {
  return {
    notes: [[note(column, duration), note(column + discsInColumn, duration)]],
    waveform: "triangle",
    gain: 0.25,
  };
}

// Owns the AudioContext (created lazily, on first unmute) and the mute state,
// and plays {notes, waveform, gain} sounds like the ones above.
export class SoundPlayer {
  muted = true;
  #context = null;

  // Must be called from a user gesture (a click, say) the first time, since
  // browsers block audio until then.
  toggleMute() {
    this.#context ??= new (window.AudioContext || window.webkitAudioContext)();
    this.#context.resume();
    this.muted = !this.muted;
    return this.muted;
  }

  /**
   * Each entry in `notes` is either a single {frequency, duration} note or an
   * array of them — a chord, played simultaneously. Entries themselves run one
   * after another along a single timeline, a chord lasting as long as its
   * longest note.
   */
  play({ notes, waveform, gain }) {
    if (this.muted || !this.#context) return;

    let time = this.#context.currentTime;

    for (const step of notes) {
      const chord = Array.isArray(step) ? step : [step];
      const stepDuration = Math.max(...chord.map(({ duration = DEFAULT_NOTE_DURATION }) => duration));

      // One oscillator per note, so the notes of a chord can each hold their own
      // frequency.
      for (const { frequency, duration = DEFAULT_NOTE_DURATION } of chord) {
        this.#playNote({ frequency, waveform, gain, startAt: time, duration });
      }

      time += stepDuration;
    }
  }

  #playNote({ frequency, waveform, gain, startAt, duration }) {
    const oscillator = this.#context.createOscillator();
    const envelope = this.#context.createGain();

    oscillator.type = waveform;
    oscillator.frequency.setValueAtTime(frequency, startAt);
    oscillator.connect(envelope).connect(this.#context.destination);

    // Starting and stopping a waveform at full volume mid-cycle is an audible
    // click, so ease the gain in and out around the note. Short notes get a
    // proportionally shorter ramp rather than one longer than the note itself.
    const ramp = Math.min(RAMP_SECONDS, duration / 2);
    envelope.gain.setValueAtTime(0, startAt);
    envelope.gain.linearRampToValueAtTime(gain, startAt + ramp);
    envelope.gain.setValueAtTime(gain, startAt + duration - ramp);
    envelope.gain.linearRampToValueAtTime(0, startAt + duration);

    oscillator.start(startAt);
    oscillator.stop(startAt + duration);
  }
}
