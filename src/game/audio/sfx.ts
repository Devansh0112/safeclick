// Sound: Web Audio oscillators and a noise buffer only, so there are no audio files, no licensing
// and no CSP impact. The AudioContext is created (or resumed) by unlock(), which the shell calls
// from the player's first pointer or key event; before that nothing makes a sound and no
// AudioContext exists, so the browser never warns about autoplay.
// Music is a very quiet synth arpeggio, at most MUSIC_GAIN. Mute silences everything at once;
// music stops while the tab is hidden and comes back when it is visible (if not muted).

export type SfxName = 'jump' | 'gate' | 'caught' | 'hit' | 'damage' | 'clear' | 'click';

export interface Sfx {
  unlock(): void;
  play(name: SfxName): void;
  setMuted(m: boolean): void;
  startMusic(): void;
  stopMusic(): void;
}

export const MUSIC_GAIN = 0.07;
// At most one arp note and one bass note sound at once (arp notes end before the next starts),
// so the music bus peaks at MUSIC_GAIN * (ARP_VOL + BASS_VOL) = 0.07 * 1.05 = 0.0735 <= 0.08.
const ARP_VOL = 0.6;
const BASS_VOL = 0.45;

// A minor pentatonic arpeggio, one note per step.
const ARP = [220, 261.63, 329.63, 392, 329.63, 261.63, 392, 440, 329.63, 261.63, 196, 261.63];
const STEP_S = 0.24;
const LOOKAHEAD_S = 0.5;

type AudioCtor = typeof AudioContext;

export function createSfx(): Sfx {
  const Ctor: AudioCtor | undefined = typeof window === 'undefined'
    ? undefined
    : window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext;
  let ctx: AudioContext | undefined;
  let master: GainNode | undefined;
  let musicBus: GainNode | undefined;
  let noise: AudioBuffer | undefined;
  let muted = false;
  let musicWanted = false;
  let timer: ReturnType<typeof setInterval> | undefined;
  let nextNote = 0;
  let step = 0;

  const audible = () => !!ctx && !muted && !document.hidden;

  function tone(freq: number, end: number, dur: number, type: OscillatorType, vol: number, delay = 0, bus: AudioNode | undefined = master): void {
    if (!ctx || !bus) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (end !== freq) osc.frequency.exponentialRampToValueAtTime(end, t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(bus);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function burst(dur: number, vol: number, delay = 0): void {
    if (!ctx || !master || !noise) return;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    const gain = ctx.createGain();
    src.buffer = noise;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(gain).connect(master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  function schedule(): void {
    if (!ctx || !musicBus || !audible()) return;
    if (nextNote < ctx.currentTime) nextNote = ctx.currentTime + 0.05;
    while (nextNote < ctx.currentTime + LOOKAHEAD_S) {
      const f = ARP[step % ARP.length];
      const delay = nextNote - ctx.currentTime;
      tone(f, f, STEP_S * 0.9, 'triangle', ARP_VOL, delay, musicBus);
      // A soft bass note at the start of each bar.
      if (step % 4 === 0) tone(f / 2, f / 2, STEP_S * 3.2, 'sine', BASS_VOL, delay, musicBus);
      nextNote += STEP_S;
      step += 1;
    }
  }

  function syncMusic(): void {
    const run = musicWanted && audible() && ctx?.state !== 'closed';
    if (run && !timer) {
      nextNote = 0;
      schedule();
      timer = setInterval(schedule, 120);
    } else if (!run && timer) {
      clearInterval(timer);
      timer = undefined;
    }
  }

  function applyMute(): void {
    if (ctx && master) master.gain.setValueAtTime(muted ? 0 : 1, ctx.currentTime);
    syncMusic();
  }

  function unlock(): void {
    if (!Ctor) return;
    try {
      if (!ctx) {
        ctx = new Ctor();
        master = ctx.createGain();
        master.connect(ctx.destination);
        musicBus = ctx.createGain();
        musicBus.gain.value = MUSIC_GAIN;
        musicBus.connect(master);
        noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.5), ctx.sampleRate);
        const data = noise.getChannelData(0);
        for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
        applyMute();
      }
      if (ctx.state === 'suspended' && !document.hidden) void ctx.resume().catch(() => undefined);
      syncMusic();
    } catch {
      ctx = undefined;
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) void ctx.suspend().catch(() => undefined);
    else if (!muted || musicWanted) void ctx.resume().catch(() => undefined);
    syncMusic();
  });

  return {
    unlock,
    setMuted(m) {
      muted = m;
      applyMute();
    },
    startMusic() {
      musicWanted = true;
      syncMusic();
    },
    stopMusic() {
      musicWanted = false;
      syncMusic();
    },
    play(name) {
      if (!audible() || !ctx) return;
      if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
      switch (name) {
        case 'jump': tone(300, 640, 0.12, 'square', 0.07); break;
        case 'click': tone(880, 880, 0.05, 'sine', 0.1); break;
        case 'gate':
          [523.25, 659.25, 783.99].forEach((f, i) => tone(f, f, 0.14, 'triangle', 0.14, i * 0.09));
          break;
        case 'caught':
          tone(320, 80, 0.4, 'sawtooth', 0.12);
          burst(0.3, 0.1);
          break;
        case 'hit':
          tone(180, 60, 0.22, 'square', 0.12);
          burst(0.15, 0.1);
          break;
        case 'damage':
          tone(700, 1100, 0.1, 'triangle', 0.14);
          tone(1100, 1500, 0.1, 'triangle', 0.1, 0.08);
          break;
        case 'clear':
          [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, f, 0.22, 'triangle', 0.14, i * 0.12));
          break;
      }
    },
  };
}
