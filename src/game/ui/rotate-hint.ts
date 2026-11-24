// "Turn your phone sideways" hint for touch screens held upright (spec §7).
// Dismissible; the game still plays letterboxed. Not stored: it is only a suggestion.

export function mountRotateHint(overlay: HTMLElement): () => void {
  const hint = document.createElement('div');
  hint.className = 'rotate-hint';
  hint.setAttribute('role', 'note');
  const text = document.createElement('span');
  text.textContent = 'Turn your phone sideways for the best view';
  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = 'OK';
  close.setAttribute('aria-label', 'Dismiss the hint to turn your phone sideways');
  hint.append(text, close);
  overlay.append(hint);

  const coarsePortrait = window.matchMedia('(pointer: coarse) and (orientation: portrait)');
  let dismissed = false;
  const sync = () => { hint.hidden = dismissed || !coarsePortrait.matches; };
  const dismiss = () => { dismissed = true; sync(); };
  close.addEventListener('click', dismiss);
  coarsePortrait.addEventListener('change', sync);
  sync();

  return () => {
    coarsePortrait.removeEventListener('change', sync);
    close.removeEventListener('click', dismiss);
    hint.remove();
  };
}
