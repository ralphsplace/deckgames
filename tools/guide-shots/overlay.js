// Marks drawn over a page for a guide picture: a box and a name tag on a thing, an arrow for a move.
// Targets are CSS selectors, Playwright locators, or a list of them (meaning the box around them all). Everything is placed in page coordinates, so draw marks after the
// page is in its final position.
const INK = '#23262b', GOLD = '#ffd54a';

// a target, or the box around a list of them
async function rectOf(page, target) {
  if (Array.isArray(target)) {
    const rs = await Promise.all(target.map(t => rectOf(page, t)));
    const x = Math.min(...rs.map(r => r.x)), y = Math.min(...rs.map(r => r.y));
    return { x, y, width: Math.max(...rs.map(r => r.x + r.width)) - x, height: Math.max(...rs.map(r => r.y + r.height)) - y };
  }
  const loc = typeof target === 'string' ? page.locator(target).first() : target;
  const b = await loc.boundingBox();
  if (!b) throw new Error(`nothing visible for ${target}`);
  return b;
}

function draw(spec) {
  let layer = document.getElementById('guide-marks');
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'guide-marks';
    layer.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;z-index:2147483647;pointer-events:none';
    layer.innerHTML = `<svg style="position:absolute;left:0;top:0;overflow:visible" width="1" height="1"><defs>
      <marker id="gm-head" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
      <path d="M0 0L10 5L0 10z" fill="${spec.gold}"/></marker></defs></svg>`;
    document.body.appendChild(layer);
  }
  const sx = scrollX, sy = scrollY;
  const add = (html, css) => { const d = document.createElement('div'); d.className = 'gm'; d.style.cssText = css; d.innerHTML = html; layer.appendChild(d); return d; };
  if (spec.kind === 'label') {
    const r = spec.r, x = r.x + sx, y = r.y + sy;
    if (spec.box) add('', `position:absolute;left:${x - 4}px;top:${y - 4}px;width:${r.width + 8}px;height:${r.height + 8}px;
      border:3px solid ${spec.gold};border-radius:10px;box-shadow:0 0 0 2px rgba(0,0,0,.35)`);
    if (!spec.text) return;
    const tag = add(spec.text, `position:absolute;left:0;top:0;padding:5px 11px;border-radius:999px;background:#fff;
      color:${spec.ink};font:600 15px/1.25 Georgia,'Times New Roman',serif;white-space:nowrap;
      box-shadow:0 2px 6px rgba(0,0,0,.45);border:2px solid ${spec.gold}`);
    const w = tag.offsetWidth, h = tag.offsetHeight, gap = 12;
    const at = { top: [x + r.width / 2 - w / 2, y - gap - h - 4], bottom: [x + r.width / 2 - w / 2, y + r.height + gap + 4],
      left: [x - gap - w - 4, y + r.height / 2 - h / 2], right: [x + r.width + gap + 4, y + r.height / 2 - h / 2],
      inside: [x + r.width / 2 - w / 2, y + r.height / 2 - h / 2] }[spec.at];
    const maxX = document.documentElement.clientWidth + sx - w - 4;     // stays on the page
    tag.style.left = Math.max(4, Math.min(maxX, at[0] + (spec.dx || 0))) + 'px';
    tag.style.top = Math.max(4, at[1] + (spec.dy || 0)) + 'px';
  } else {
    const a = spec.a, b = spec.b;
    const p = (r, side) => side === 'top' ? [r.x + sx + r.width / 2, r.y + sy] : side === 'bottom' ? [r.x + sx + r.width / 2, r.y + sy + r.height]
      : side === 'left' ? [r.x + sx, r.y + sy + r.height / 2] : side === 'right' ? [r.x + sx + r.width, r.y + sy + r.height / 2]
      : [r.x + sx + r.width / 2, r.y + sy + r.height / 2];
    const [x1, y1] = p(a, spec.from), [x2, y2] = p(b, spec.to);
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, len = Math.hypot(x2 - x1, y2 - y1) || 1;
    const bend = spec.bend * len;                                     // curve sideways from the straight line
    const cx = mx - (y2 - y1) / len * bend, cy = my + (x2 - x1) / len * bend;
    const svg = layer.querySelector('svg');
    const path = (stroke, width, marker) => {
      const el = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      el.setAttribute('d', `M${x1} ${y1}Q${cx} ${cy} ${x2} ${y2}`);
      el.setAttribute('fill', 'none'); el.setAttribute('stroke', stroke); el.setAttribute('stroke-width', width);
      el.setAttribute('stroke-linecap', 'round');
      if (marker) el.setAttribute('marker-end', 'url(#gm-head)');
      svg.appendChild(el);
    };
    path('rgba(0,0,0,.45)', 9, false);
    path(spec.gold, 5, true);
    const box = add('', `position:absolute;left:${Math.min(x1, x2, cx) - 6}px;top:${Math.min(y1, y2, cy) - 6}px;
      width:${Math.abs(Math.max(x1, x2, cx) - Math.min(x1, x2, cx)) + 12}px;height:${Math.abs(Math.max(y1, y2, cy) - Math.min(y1, y2, cy)) + 12}px`);
    box.dataset.extent = '1';
  }
}

// The tools a shot's setup gets. setClip receives a function that returns the capture rectangle.
export function overlay(page, setClip) {
  return {
    // a gold box around the target and a name tag beside it (text '' for the box alone); at: top | bottom | left | right | inside
    async label(target, text, { at = 'top', box = true, dx = 0, dy = 0 } = {}) {
      await page.evaluate(draw, { kind: 'label', r: await rectOf(page, target), text, at, box, dx, dy, ink: INK, gold: GOLD });
    },
    // a curved arrow from one thing to another; from/to: top | bottom | left | right | center
    async arrow(fromTarget, toTarget, { from = 'center', to = 'center', bend = 0.18 } = {}) {
      await page.evaluate(draw, { kind: 'arrow', a: await rectOf(page, fromTarget), b: await rectOf(page, toTarget), from, to, bend, gold: GOLD });
    },
    // extra CSS for this picture only, e.g. more room around a crowded row so its labels don't cover anything.
    // Call it before drawing marks: marks are placed where things are when they're drawn.
    async style(css) { await page.addStyleTag({ content: css }); },
    // keep things out of the picture without moving anything else (e.g. a game's header in a board-only picture)
    async hide(selector) {
      await page.evaluate(sel => document.querySelectorAll(sel).forEach(e => { e.style.visibility = 'hidden'; }), selector);
    },
    // capture just these things (and every mark drawn), with some room around them
    clip(targets, pad = 16) {
      setClip(async () => {
        const rs = [];
        for (const t of Array.isArray(targets) ? targets : [targets]) rs.push(await rectOf(page, t));
        const marks = await page.evaluate(() => [...document.querySelectorAll('#guide-marks .gm')].map(e => {
          const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height };
        }));
        const all = rs.concat(marks).filter(r => r.width && r.height);
        const sx = await page.evaluate(() => [scrollX, scrollY, document.documentElement.scrollWidth, document.documentElement.scrollHeight]);
        const x = Math.max(0, Math.min(...all.map(r => r.x)) + sx[0] - pad), y = Math.max(0, Math.min(...all.map(r => r.y)) + sx[1] - pad);
        const x2 = Math.min(sx[2], Math.max(...all.map(r => r.x + r.width)) + sx[0] + pad);
        const y2 = Math.min(sx[3], Math.max(...all.map(r => r.y + r.height)) + sx[1] + pad);
        return { x, y, width: x2 - x, height: y2 - y };
      });
    },
  };
}
