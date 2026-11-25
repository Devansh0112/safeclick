// Settings screen (spec §7): sound, reduced motion (follow device / on / off) and a confirmed
// reset of Neon City progress. Also the mute button that lives in the top-right corner of the
// game and, as a twin, on the map. DOM only via createElement + textContent.
import { button, closeOn, el, openDialog, uid, type OverlayHost } from './overlays';

export interface SoundState {
  muted(): boolean;
  setMuted(m: boolean): void;
  /** Called after every change, whoever made it. Returns an unsubscribe function. */
  onMutedChange(fn: (muted: boolean) => void): () => void;
}

/** "reducedMotion" setting: null follows the device. */
export type MotionSetting = boolean | null;

export interface SettingsOptions extends SoundState {
  reducedMotion(): MotionSetting;
  setReducedMotion(v: MotionSetting): void;
  /** Clears Neon City progress (never the story games'). */
  reset(): void;
  sfx(): void;
}

const MOTION_CHOICES: { value: MotionSetting; label: string; id: string }[] = [
  { value: null, label: 'Follow device', id: 'follow' },
  { value: true, label: 'On', id: 'on' },
  { value: false, label: 'Off', id: 'off' },
];

/**
 * Key rule for the corner buttons: only Enter and Space, which press the button itself, are kept
 * from the game. Arrows and the rest reach the game, so a focused button never blocks movement.
 */
export const keepActivationKeys = (e: KeyboardEvent): void => {
  if (e.key === 'Enter' || e.key === ' ') e.stopPropagation();
};

/**
 * A mute toggle: aria-pressed is true while muted. After a pointer click, focus goes back to
 * `stage` (when given) so the game keys work at once; a keyboard press keeps focus on the button.
 */
export function createMuteButton(sound: SoundState, sfx: () => void = () => undefined, stage?: HTMLElement): HTMLButtonElement {
  const b = el('button', 'mute-btn');
  b.type = 'button';
  const icon = el('span', 'mute-icon');
  icon.setAttribute('aria-hidden', 'true');
  b.append(icon);
  const sync = (muted: boolean) => {
    icon.textContent = muted ? '🔇' : '🔊';
    b.setAttribute('aria-pressed', String(muted));
    b.setAttribute('aria-label', 'Mute sound');
    b.title = muted ? 'Sound is off' : 'Sound is on';
  };
  sync(sound.muted());
  // Stop listening once the button has been shown and then removed (the map's twin).
  let wasShown = false;
  const off = sound.onMutedChange((m) => {
    if (b.isConnected) wasShown = true;
    else if (wasShown) { off(); return; }
    sync(m);
  });
  b.addEventListener('click', (e) => {
    sound.setMuted(!sound.muted());
    sfx();
    // detail is 0 for a keyboard-activated click.
    if (stage && e.detail > 0) stage.focus({ preventScroll: true });
  });
  b.addEventListener('keydown', keepActivationKeys);
  return b;
}

/**
 * The always-visible corner of the game: a MAP button (leave a level or fight; hidden while the
 * map is open) and the mute button. Both keep their keys away from the game.
 */
export function mountCorner(overlay: HTMLElement, stage: HTMLElement, sound: SoundState, sfx: () => void, onMap: () => void): { mapButton: HTMLButtonElement } {
  const corner = el('div', 'game-corner');
  corner.dataset.gameCorner = '';
  const mapButton = button('map-btn', 'MAP', '▦');
  mapButton.setAttribute('aria-label', 'Back to the map');
  mapButton.addEventListener('click', () => {
    sfx();
    onMap();
  });
  mapButton.addEventListener('keydown', keepActivationKeys);
  corner.append(mapButton, createMuteButton(sound, sfx, stage));
  overlay.prepend(corner);
  return { mapButton };
}

export function showSettings(host: OverlayHost, o: SettingsOptions): Promise<void> {
  return new Promise((resolve) => {
    const title = el('h2', 'ov-title settings-title', 'SETTINGS');
    const dialog = openDialog(host, { className: 'ov-settings', title });
    const body = el('div', 'settings-body');
    dialog.card.append(body);

    const showMain = (focus?: 'reset') => {
      const sound = button('ov-btn settings-sound', '');
      sound.type = 'button';
      const syncSound = () => {
        sound.replaceChildren(el('span', 'ov-icon', o.muted() ? '🔇' : '🔊'), document.createTextNode(`Sound: ${o.muted() ? 'Off' : 'On'}`));
        sound.firstElementChild?.setAttribute('aria-hidden', 'true');
        sound.setAttribute('aria-pressed', String(!o.muted()));
      };
      syncSound();
      sound.addEventListener('click', () => {
        o.setMuted(!o.muted());
        syncSound();
        o.sfx();
      });
      // Keep this button right if the corner button changes the sound.
      const off = o.onMutedChange(syncSound);

      const group = el('fieldset', 'settings-group');
      group.append(el('legend', 'settings-legend', 'Reduced motion'));
      group.append(el('p', 'settings-help', 'Less movement and flashing, and a slower boss fight.'));
      const name = uid('motion');
      for (const choice of MOTION_CHOICES) {
        const label = el('label', 'settings-radio');
        const input = el('input');
        input.type = 'radio';
        input.name = name;
        input.value = choice.id;
        input.checked = o.reducedMotion() === choice.value;
        input.addEventListener('change', () => {
          if (!input.checked) return;
          o.setReducedMotion(choice.value);
          o.sfx();
        });
        label.append(input, el('span', '', choice.label));
        group.append(label);
      }

      const reset = button('ov-btn settings-reset', 'Reset game progress', '↺');
      reset.addEventListener('click', () => {
        off();
        showConfirm();
      });
      const done = button('ov-btn ov-btn-primary', 'DONE', '✔');
      done.dataset.autofocus = '';
      const actions = el('div', 'clear-actions');
      actions.append(reset, done);
      body.replaceChildren(sound, group, actions);
      closeOn(dialog, done, undefined, (v) => { off(); o.sfx(); resolve(v); });
      if (focus === 'reset') reset.focus({ preventScroll: true });
    };

    const showConfirm = () => {
      const question = el('p', 'ov-text settings-confirm', 'Reset all Neon City progress? Your story game progress is kept.');
      question.setAttribute('role', 'alert');
      const cancel = button('ov-btn ov-btn-primary', 'Cancel');
      const confirm = button('ov-btn', 'Reset');
      const actions = el('div', 'clear-actions');
      actions.append(cancel, confirm);
      body.replaceChildren(question, actions);
      cancel.focus({ preventScroll: true });
      cancel.addEventListener('click', () => { o.sfx(); showMain('reset'); });
      confirm.addEventListener('click', () => {
        o.reset();
        dialog.close();
        resolve();
      }, { once: true });
    };

    showMain();
  });
}
