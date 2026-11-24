// HTML HUD bar above the canvas: level label, level title and a status meter (gate
// progress in levels, boss health and Max's shield in the boss fight).
// Plain text via textContent, sized in rem so the site's text-size setting applies.

export interface Hud {
  setLevel(label: string, title: string): void;
  setGates(opened: number, total: number): void;
  /** Free status text on the right, e.g. "PHISH.BOT 3/4 · SHIELD 2/3", with a spoken label. */
  setMeter(text: string, label: string): void;
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

  const setMeter = (text: string, label: string) => {
    gates.textContent = text;
    gates.setAttribute('aria-label', label);
  };

  return {
    setMeter,
    setLevel(l, t) {
      label.textContent = l;
      title.textContent = t;
    },
    setGates(opened, total) {
      const boxes = '■'.repeat(opened) + '□'.repeat(Math.max(0, total - opened));
      setMeter(`GATES [${boxes}] ${opened}/${total}`, `Gates opened: ${opened} of ${total}`);
    },
  };
}
