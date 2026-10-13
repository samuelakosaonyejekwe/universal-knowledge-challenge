// Everything drawn over the 3D picture: mission list, counters, the action prompt, spoken dialogue with
// subtitles, the side panel for questions and simulations, and the pause menu.
import { h, clear } from '../core/util.js';
import { t, tr } from '../core/i18n.js';
import { speak, stopSpeaking } from '../core/speech.js';

export function createHud(root, { onExit, onPause }) {
  const goals = h('ol', { class: 'g3d-goals' });
  const count = h('div', { class: 'g3d-count' });
  const prompt = h('button', { class: 'g3d-prompt', type: 'button', hidden: true });
  const say = h('div', { class: 'g3d-say', hidden: true, role: 'dialog', 'aria-live': 'polite' });
  const panel = h('aside', { class: 'g3d-panel', hidden: true });
  const banner = h('div', { class: 'g3d-banner', hidden: true, 'aria-live': 'assertive' });
  const fade = h('div', { class: 'g3d-fade' });
  const menu = h('div', { class: 'g3d-menu', hidden: true, role: 'dialog' });
  const tip = h('div', { class: 'g3d-tip', hidden: true });
  const wayArrow = h('i', null, '➤'), wayText = h('span'), way = h('div', { class: 'g3d-way', hidden: true, 'aria-hidden': 'true' }, wayArrow, wayText);
  const mapC = h('canvas', { class: 'g3d-map', width: 132, height: 132, role: 'img', 'aria-label': t('Map') }), mapG = mapC.getContext('2d');
  // a strip that always says how to play
  const keys = h('div', { class: 'g3d-strip' }, h('span', null, h('kbd', null, 'W A S D'), ' ', t('Move')), h('span', null, h('kbd', null, 'Space'), ' ', t('Jump')), h('span', null, h('kbd', null, 'Shift'), ' ', t('Run')), h('span', null, h('kbd', null, 'E'), ' ', t('Use, talk, collect')), h('span', null, '🖱️ ', t('Click or tap a thing to go to it.')));
  const top = h('div', { class: 'g3d-top' },
    h('button', { class: 'g3d-btn', type: 'button', 'aria-label': t('Pause'), title: t('Pause'), onClick: () => onPause() }, '⏸'),
    h('div', { class: 'g3d-mission' }, goals), count);
  // the view pad: turn, tilt, zoom, reset, and "look around" (pan the camera anywhere, then come back)
  const held = new Set();
  const vb = (name, label, title, cls = '') => { const b = h('button', { class: 'g3d-vb ' + cls, type: 'button', title, 'aria-label': title }, label); const on = (e) => { e.preventDefault(); b.setPointerCapture?.(e.pointerId); held.add(name); hud.onView?.(name, true); }, off = () => held.delete(name); b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('pointerleave', off); b.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { held.add(name); hud.onView?.(name, true); setTimeout(off, 180); } }); return b; };
  const lookBtn = vb('free', '🔭', t('Look around'), 'wide');
  const view = h('div', { class: 'g3d-view', role: 'group', 'aria-label': t('View') }, vb('up', '▲', t('Tilt up'), 'u'), vb('left', '◀', t('Turn left'), 'l'), vb('reset', '⟲', t('Reset the view'), 'c'), vb('right', '▶', t('Turn right'), 'r'), vb('down', '▼', t('Tilt down'), 'd'), vb('in', '＋', t('Zoom in'), 'zi'), vb('out', '－', t('Zoom out'), 'zo'), lookBtn);
  root.append(fade, top, mapC, keys, view, way, tip, prompt, say, panel, banner, menu);
  let act = null, panelClose = null;
  prompt.addEventListener('click', () => act?.());

  const hud = {
    root, panelEl: panel,
    get busy() { return !say.hidden || !panel.hidden || !menu.hidden; },
    get panelOpen() { return !panel.hidden; }, get talking() { return !say.hidden; }, get menuOpen() { return !menu.hidden; },
    // list: [{ text, done, now }]
    goals(list) { clear(goals).append(...list.map((g) => h('li', { class: g.done ? 'done' : g.now ? 'now' : '' }, h('span', null, g.done ? '✔' : g.now ? '➤' : '○'), ' ', g.text, g.now && hud.onShow ? h('button', { class: 'g3d-show', type: 'button', onClick: () => hud.onShow() }, '👁 ', t('Show me')) : null))); },
    onShow: null, onView: null, held,
    // shows that the camera is roaming free (the button then brings it back to the character)
    looking(on) { lookBtn.classList.toggle('on', on); lookBtn.textContent = on ? '🧍' : '🔭'; lookBtn.title = on ? t('Back to my character') : t('Look around'); },
    viewShown(v) { view.hidden = !v; },
    // The pointer to the next thing to do: { x, y (screen), angle (when it is off screen), text } or null.
    way(o) { const hide = !o || hud.busy; way.hidden = hide; mapC.hidden = keys.hidden = hud.busy; if (hide) return; way.style.transform = `translate(${Math.round(o.x)}px, ${Math.round(o.y)}px) translate(-50%, -50%)`; wayText.textContent = o.text; wayArrow.style.transform = `rotate(${o.angle == null ? 90 : (o.angle * 180) / Math.PI}deg)`; way.classList.toggle('edge', o.angle != null); },
    map(draw) { if (!mapC.hidden) draw(mapG, mapC.width); },
    count(text) { count.textContent = text; },
    // The one thing the player can do right now. key: the keyboard hint.
    prompt(text, fn) { act = fn || null; if (!text || hud.busy) { prompt.hidden = true; return; } if (prompt.dataset.text !== text) { prompt.dataset.text = text; clear(prompt).append(h('kbd', null, 'E'), ' ', text); } prompt.hidden = false; },
    act() { if (!prompt.hidden && act) { act(); return true; } return false; },
    tip(text, seconds = 6) { tip.textContent = text; tip.hidden = false; clearTimeout(hud._tip); hud._tip = setTimeout(() => { tip.hidden = true; }, seconds * 1000); },
    banner(text, seconds = 2.6) { banner.textContent = text; banner.hidden = false; clearTimeout(hud._ban); hud._ban = setTimeout(() => { banner.hidden = true; }, seconds * 1000); },
    flash() { fade.classList.add('on'); setTimeout(() => fade.classList.remove('on'), 350); },
    // Spoken lines with subtitles. lines: English strings (translated on the way). who: { name }.
    // onLine(i, speaking) lets the game animate the speaker. Resolves when the last line is dismissed.
    dialogue(who, lines, { onLine, local = false } = {}) {
      return new Promise((resolve) => {
        let i = 0; prompt.hidden = true;
        const text = h('p'), next = h('button', { class: 'btn sm', type: 'button' }, t('Next'), ' ▶');
        const show = async () => {
          const line = local ? lines[i] : await tr(lines[i]).catch(() => lines[i]);
          text.textContent = line; onLine?.(i, true); speak(line);
          next.firstChild.textContent = i === lines.length - 1 ? t('OK') : t('Next');
          setTimeout(() => onLine?.(i, false), Math.min(6000, 600 + line.length * 55));
        };
        const step = () => { stopSpeaking(); if (++i >= lines.length) { say.hidden = true; hud.advance = null; resolve(); } else show(); };
        next.addEventListener('click', step); hud.advance = step;
        clear(say).append(h('b', null, who.name), text, next); say.hidden = false; show(); next.focus({ preventScroll: true });
      });
    },
    // A side panel holding a question, a tablet or a simulation's controls.
    panel(title, body, { onClose, closable = true, wide = false } = {}) {
      panelClose = onClose || null; prompt.hidden = true;
      panel.classList.toggle('wide', wide);
      clear(panel).append(h('div', { class: 'row between' }, h('h2', null, title), closable ? h('button', { class: 'g3d-btn', type: 'button', 'aria-label': t('Close'), onClick: () => hud.closePanel() }, '✕') : null), body);
      panel.hidden = false; panel.scrollTop = 0;
    },
    closePanel(silent) { if (panel.hidden) return; panel.hidden = true; clear(panel); const f = panelClose; panelClose = null; f?.(silent); },
    // settings: { quality, calm, stats() }, handlers: { setQuality, setCalm, resume }
    menu(state, on) {
      const pick = (label, value, options, fn) => h('label', { class: 'g3d-opt' }, h('span', null, label), h('select', { class: 'input', onChange: (e) => fn(e.target.value) }, options.map(([v, text]) => h('option', { value: v, selected: v === value }, text))));
      clear(menu).append(h('div', { class: 'card' },
        h('h2', null, '⏸ ', t('Paused')),
        h('div', { class: 'g3d-keys small' },
          h('div', null, h('kbd', null, 'W A S D'), ' ', t('Move')), h('div', null, h('kbd', null, 'Shift'), ' ', t('Run')), h('div', null, h('kbd', null, 'Space'), ' ', t('Jump')),
          h('div', null, h('kbd', null, 'E'), ' ', t('Use, talk, collect')), h('div', null, '🖱️ ', t('Drag to look around, wheel to zoom')), h('div', null, '🎮 ', t('A game controller also works')),
          h('div', null, '📱 ', t('On a touch screen: left stick to move, drag the picture to look'))),
        pick(t('Picture quality'), state.quality, [['auto', t('Automatic')], ['low', t('Low (fastest)')], ['medium', t('Medium')], ['high', t('High')], ['ultra', t('Ultra (sharpest, for strong graphics cards)')]], on.setQuality),
        pick(t('Movement on screen'), state.calm ? 'off' : 'on', [['on', t('On')], ['off', t('Reduced')]], (v) => on.setCalm(v === 'off')),
        h('p', { class: 'tiny muted' }, state.stats),
        h('div', { class: 'row' }, h('button', { class: 'btn', type: 'button', onClick: on.resume }, '▶ ', t('Keep playing')), h('button', { class: 'btn ghost', type: 'button', onClick: onExit }, t('Leave this world')))));
      menu.hidden = false; menu.querySelector('.btn').focus({ preventScroll: true });
    },
    closeMenu() { menu.hidden = true; clear(menu); },
    dispose() { stopSpeaking(); clearTimeout(hud._tip); clearTimeout(hud._ban); root.replaceChildren(); },
  };
  return hud;
}
