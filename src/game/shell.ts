// The game shell: everything outside the canvas that scenes need. Saved progress,
// settings, sound (Task 7) and the HTML reading screens. Stored in game.registry as 'shell'.
import { createSfx, type SfxName } from './audio/sfx';
import { emptyProgress, loadProgress, resetProgress, saveProgress, type GameProgress, type KV } from './logic/progress';
import type { GamePayload, ScamFileData } from './types';
import { collectionView } from './logic/unlocks';
import { showLevelClear, type LevelClearChoice, type LevelClearInfo } from './ui/level-clear';
import { showMap, type MapChoice } from './ui/map';
import { showCaught, showNote, type OverlayHost } from './ui/overlays';
import { showScamFiles, showStash } from './ui/scam-files';
import { createMuteButton, mountCorner, showSettings, type SoundState } from './ui/settings';

export type { SfxName };

export interface Shell {
  payload: GamePayload;
  progress(): GameProgress;
  /** Applies `fn` and saves. */
  update(fn: (p: GameProgress) => GameProgress): void;
  /** The game's own setting when set, else the system preference. */
  reducedMotion(): boolean;
  sfx(name: SfxName): void;
  showCaught(o: { botName: string; redFlag: string; retryLabel: string }): Promise<void>;
  showNote(text: string): Promise<void>;
  showLevelClear(o: LevelClearInfo): Promise<LevelClearChoice>;
  /** PHISH.BOT's stash: the won files one at a time, then the next-district teaser. */
  showStash(files: ScamFileData[], nextDistrictLabel: string): Promise<void>;
  /** The Scam Files collection (collected cards open in full, the rest locked). */
  showScamFiles(): void;
  /** Read `text` out through the game's polite live region. */
  announce(text: string): void;
  /** Stops any running scene and shows the district map; the pick starts a level or the boss. */
  openMap(): void;
  muted(): boolean;
  /** The overlay layer and game stage, for in-game HTML such as the gate panel. */
  readonly host: OverlayHost;
}

export interface ShellOptions {
  /** Stops the level and boss scenes (no scene runs while the map is open). */
  stopScenes?: () => void;
  /** Starts the level or boss the player picked on the map. */
  startScene?: (choice: MapChoice) => void;
}

const WAKE_EVENTS = ['pointerdown', 'keydown', 'touchend', 'click'] as const;

export function createShell(root: HTMLElement, payload: GamePayload, kv: KV, opts: ShellOptions = {}): Shell {
  const overlay = root.querySelector<HTMLElement>('[data-game-overlay]') ?? root;
  const stage = root.querySelector<HTMLElement>('[data-game-stage]') ?? root;
  let progress = loadProgress(kv);
  const systemReduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const reducedMotion = () => progress.settings.reducedMotion ?? systemReduced.matches;
  const host: OverlayHost = { overlay, stage, reducedMotion };
  const live = root.querySelector<HTMLElement>('[data-game-live]');
  const hudEl = root.querySelector<HTMLElement>('[data-game-hud]');
  const touchEl = root.querySelector<HTMLElement>('[data-game-touch]');

  // Sound. The audio context only wakes on the player's first press inside the game.
  const sound = createSfx();
  sound.setMuted(progress.settings.muted);
  const mutedListeners = new Set<(m: boolean) => void>();
  const soundState: SoundState = {
    muted: () => progress.settings.muted,
    setMuted(m) {
      if (m === progress.settings.muted) return;
      save((p) => ({ ...p, settings: { ...p.settings, muted: m } }));
      sound.setMuted(m);
      mutedListeners.forEach((fn) => fn(m));
    },
    onMutedChange(fn) {
      mutedListeners.add(fn);
      return () => mutedListeners.delete(fn);
    },
  };
  const wake = () => {
    sound.unlock();
    sound.startMusic();
    for (const type of WAKE_EVENTS) root.removeEventListener(type, wake, true);
  };
  for (const type of WAKE_EVENTS) root.addEventListener(type, wake, true);

  function save(fn: (p: GameProgress) => GameProgress): void {
    progress = fn(progress);
    saveProgress(kv, progress);
  }
  const click = () => sound.play('click');

  const openCollection = () => showScamFiles(host, payload.scamFiles, collectionView(payload.scamFiles, progress.scamFiles));
  let announceTimer: ReturnType<typeof setTimeout> | undefined;
  let mapOpen = false;

  const openSettings = () => showSettings(host, {
    ...soundState,
    reducedMotion: () => progress.settings.reducedMotion,
    setReducedMotion: (v) => save((p) => ({ ...p, settings: { ...p.settings, reducedMotion: v } })),
    reset() {
      // Only Neon City's data goes; the story games' progress stays. Settings are kept.
      resetProgress(kv);
      const settings = progress.settings;
      progress = { ...emptyProgress(), settings };
      saveProgress(kv, progress);
    },
    sfx: click,
  });

  const openMap = () => {
    if (mapOpen) return;
    mapOpen = true;
    opts.stopScenes?.();
    if (hudEl) hudEl.hidden = true;
    if (touchEl) touchEl.hidden = true;
    void showMap(host, payload, {
      progress: () => progress,
      sfx: click,
      openSettings,
      openScamFiles: openCollection,
      muteButton: () => createMuteButton(soundState, click),
    }).then((choice) => {
      mapOpen = false;
      if (hudEl) hudEl.hidden = false;
      if (touchEl) touchEl.hidden = false;
      opts.startScene?.(choice);
    });
  };

  mountCorner(overlay, soundState, click);

  return {
    payload,
    host,
    progress: () => progress,
    update: save,
    reducedMotion,
    sfx: (name) => sound.play(name),
    muted: soundState.muted,
    showCaught: (o) => showCaught(host, o),
    showNote: (text) => showNote(host, text),
    showLevelClear: (o) => showLevelClear(host, o),
    showStash: (files, nextDistrictLabel) => showStash(host, files, nextDistrictLabel, openCollection),
    showScamFiles: () => void openCollection(),
    announce(text) {
      if (!live) return;
      // Clear first so the same words twice in a row are read again.
      live.textContent = '';
      clearTimeout(announceTimer);
      announceTimer = setTimeout(() => { live.textContent = text; }, 60);
    },
    openMap,
  };
}
