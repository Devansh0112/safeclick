// The game shell: everything outside the canvas that scenes need. Saved progress,
// settings, sound (Task 7) and the HTML reading screens. Stored in game.registry as 'shell'.
import { loadProgress, saveProgress, type GameProgress, type KV } from './logic/progress';
import type { GamePayload, GrownUpChallenge, ScamFileData } from './types';
import { showLevelClear } from './ui/level-clear';
import { showCaught, showNote, type OverlayHost } from './ui/overlays';

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
  showLevelClear(o: { stars: 1 | 2 | 3; rule: string; challenge: GrownUpChallenge; hasNext: boolean }): Promise<'next' | 'replay' | 'map'>;
  showStash(files: ScamFileData[], nextDistrictLabel: string): Promise<void>;
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
    // The stash reveal arrives in Task 6.
    showStash: () => Promise.resolve(),
    openMap: () => opts.onOpenMap?.(),
  };
}
