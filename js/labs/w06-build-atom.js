import { h, button, canvas } from '../core/labkit.js';

const EL = ['', 'Hydrogen', 'Helium', 'Lithium', 'Beryllium', 'Boron', 'Carbon', 'Nitrogen', 'Oxygen'];
const NEU = [0, 0, 2, 4, 5, 6, 6];
const SYM = ['', 'H', 'He', 'Li', 'Be', 'B', 'C', 'N', 'O'];

export default {
  id: 'w06-build-atom',
  world: 6,
  levels: [1, 2],
  kind: 'lab',
  icon: '⚛️',
  title: 'Build an Atom',
  goal: 'Tap to add red protons, grey neutrons and blue electrons to build the atom you are asked for.',
  limits: 'A simple picture with electrons on rings. Real electrons form clouds, not tiny planets. Only the first eight elements are included.',
  mount(root, api) {
    const t = api.t;
    let p = 0, n = 0, e = 0, done = false;
    let target = 1 + Math.floor(api.rng() * 6); // up to carbon
    const c = canvas(240);
    const ask = h('div', { class: 'lab-goal', style: { fontSize: '1.2rem', textAlign: 'center' } });
    const info = h('div', { class: 'note', 'aria-live': 'polite' });
    const mk = (label, arr, color) => h('div', { class: 'lab-row', style: { justifyContent: 'center' } },
      button('➕ ' + label, () => { arr(1); update(); }, 'btn'), button('➖', () => { arr(-1); update(); }, 'btn ghost'));
    const cl = (v, d) => Math.max(0, Math.min(12, v + d));
    function draw() {
      const { ctx, w } = c, H = 240, cx = w / 2, cy = H / 2;
      ctx.clearRect(0, 0, w, H);
      for (const r of [50, 85, 110]) { ctx.strokeStyle = '#4a5590'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.stroke(); }
      const nuc = [...Array(p).fill('#e74c3c'), ...Array(n).fill('#aab')];
      nuc.sort((a, b) => (a < b ? 1 : -1));
      nuc.forEach((col, i) => {
        const a = i * 2.4, r = 6 * Math.sqrt(i + 0.5) * 1.5;
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(cx + r * Math.cos(a), cy + r * Math.sin(a), 8, 0, 7); ctx.fill();
      });
      const shells = [[2, 50], [8, 85], [2, 110]];
      let k = 0;
      for (const [cap, r] of shells) {
        const cnt = Math.min(cap, e - k); if (cnt <= 0) break;
        for (let i = 0; i < cnt; i++) {
          const a = (i / cnt) * 6.283 + 0.5;
          ctx.fillStyle = '#4aa3ff'; ctx.beginPath(); ctx.arc(cx + r * Math.cos(a), cy + r * Math.sin(a), 7, 0, 7); ctx.fill();
        }
        k += cnt;
      }
    }
    function update() {
      const name = p >= 1 && p <= 8 ? t(EL[p]) : (p ? '?' : '');
      const charge = p - e;
      info.className = 'note';
      info.textContent = `🔴 ${p}   ⚪ ${n}   🔵 ${e}   ` + (name ? `= ${name}` : '') + (charge ? `  (${charge > 0 ? '+' : ''}${charge})` : '');
      const ok = p === target && e === target && n === NEU[target];
      if (ok && !done) {
        done = true; info.className = 'note ok';
        api.say(t(`The number of protons decides which element it is. With the same number of electrons, the atom is balanced.`));
        api.complete(1, t('Built an atom by matching protons and electrons.'));
      }
      draw();
    }
    ask.textContent = '';
    function setTarget() {
      ask.textContent = '🎯 ' + t('Build') + ` ${t(EL[target])} (${SYM[target]}): ` + t('it has') + ` ${target} ` + t('protons') + ', ' + NEU[target] + ' ' + t('neutrons') + ', ' + target + ' ' + t('electrons') + '.';
    }
    c.onResize = draw;
    setTarget();
    root.append(h('div', { class: 'lab' }, ask, c.el, info,
      mk('🔴 ' + t('Proton'), d => { p = cl(p, d); }), mk('⚪ ' + t('Neutron'), d => { n = cl(n, d); }), mk('🔵 ' + t('Electron'), d => { e = cl(e, d); }),
      h('p', { class: 'small muted' }, t('Protons are +, electrons are −, neutrons have no charge.'))));
    update();
    return () => {};
  },
};
