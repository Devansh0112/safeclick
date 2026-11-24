// The game shell: everything outside the canvas that scenes need. Saved progress,
// settings, sound (Task 7) and the HTML reading screens. Stored in game.registry as 'shell'.
import { loadProgress, saveProgress, type GameProgress, type KV } from './logic/progress';
import type { GamePayload, ScamFileData } from './types';
import { collectionView } from './logic/unlocks';
import { showLevelClear, type LevelClearChoice, type LevelClearInfo } from './ui/level-clear';
import { showCaught, showNote, type OverlayHost } from './ui/overlays';
import { showScamFiles, showStash } from './ui/scam-files';

export type SfxName = 'jump' | 'gate' | 'caught' | 'hit' | 'damage' | 'clear' | 'click';

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
  openMap(): void;
  /** The overlay layer and game stage, for in-game HTML such as the gate panel. */
  readonly host: OverlayHost;
}

export interface ShellOptions {
  /** Until the district map exists (Task 7), the caller decides what "Map" does. */
  onOpenMap?: () => void;
}

export function createShell(root: HTMLElement, payload: GamePayload, kv: KV, opts: ShellOptions = {}): Shell {
  const overlay = root.querySelector<HTMLElement>('[data-game-overlay]') ?? root;
  const stage = root.querySelector<HTMLElement>('[data-game-stage]') ?? root;
  let progress = loadProgress(kv);
  const systemReduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const reducedMotion = () => progress.settings.reducedMotion ?? systemReduced.matches;
  const host: OverlayHost = { overlay, stage, reducedMotion };
  const live = root.querySelector<HTMLElement>('[data-game-live]');
  const openCollection = () => showScamFiles(host, payload.scamFiles, collectionView(payload.scamFiles, progress.scamFiles));
  let announceTimer: ReturnType<typeof setTimeout> | undefined;

  return {
    payload,
    host,
    progress: () => progress,
    update(fn) {
      progress = fn(progress);
      saveProgress(kv, progress);
    },
    reducedMotion,
    sfx() {
      /* sound arrives in Task 7 */
    },
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
    openMap: () => opts.onOpenMap?.(),
  };
}
