// HTML HUD bar above the canvas: level label, level title and gate progress.
// Plain text via textContent, sized in rem so the site's text-size setting applies.

export interface Hud {
  setLevel(label: string, title: string): void;
  setGates(opened: number, total: number): void;
}

export function mountHud(el: HTMLElement): Hud {
  el.replaceChildren();
  const level = document.createElement('p');
  level.className = 'hud-level';
  const label = document.createElement('span');
  label.className = 'hud-label';
  const title = document.createElement('span');
  title.className = 'hud-title';
  level.append(label, title);
  const gates = document.createElement('p');
  gates.className = 'hud-gates';
  el.append(level, gates);
  el.hidden = false;

  return {
    setLevel(l, t) {
      label.textContent = l;
      title.textContent = t;
    },
    setGates(opened, total) {
      const boxes = '■'.repeat(opened) + '□'.repeat(Math.max(0, total - opened));
      gates.textContent = `GATES [${boxes}] ${opened}/${total}`;
      gates.setAttribute('aria-label', `Gates opened: ${opened} of ${total}`);
    },
  };
}
