import { h, button, choice, predict, readout, fmt } from '../core/labkit.js';

export default {
  id: 'w11-punnett-garden',
  world: 11,
  levels: [3, 4],
  kind: 'lab',
  icon: '🧬',
  title: 'Punnett Garden',
  goal: 'Choose parent pea plants so that the right share of their seeds grow short.',
  limits: 'One gene with two alleles and complete dominance (T tall over t short). Real traits often involve many genes, partial dominance and environment. A small batch of seeds will not match the exact ratio.',
  mount(root, api) {
    const t = api.t;
    const geno = ['TT', 'Tt', 'tt'];
    let p1 = 'Tt', p2 = 'Tt', target, done = false, guessed = false, good = true, batch = null;
    target = [0, 25, 50, 100][Math.floor(api.rng() * 4)];

    const gam = (g) => g.split('');
    const cross = () => gam(p1).flatMap((a) => gam(p2).map((b) => [a, b].sort((x, y) => (x < y ? -1 : 1)).join('')));
    const shortPct = () => (cross().filter((g) => g === 'tt').length / 4) * 100;

    const sq = h('div');
    const rS = readout(t('short seeds'), '–'), rT = readout(t('tall seeds'), '–');
    const out = h('div', { class: 'note', 'aria-live': 'polite' });
    const goal = h('div', { class: 'lab-goal' });
    const pbox = h('div');
    const batchEl = h('div', { class: 'small' });
    const c1 = choice(geno.map((g) => [g, g]), p1, (v) => { p1 = v; refresh(); });
    const c2 = choice(geno.map((g) => [g, g]), p2, (v) => { p2 = v; refresh(); });

    function refresh() {
      const cr = cross();
      const cell = (txt, a) => h('div', { style: { padding: '.7rem', textAlign: 'center', fontWeight: '800', fontSize: '1.15rem', background: a ? '#f1f3fc' : (txt === 'tt' ? '#ffe9b3' : '#d4f5e4'), borderRadius: '8px', minWidth: '56px' } }, txt);
      sq.replaceChildren(h('div', { style: { display: 'grid', gridTemplateColumns: 'auto 1fr 1fr', gap: '4px', maxWidth: '280px', margin: '0 auto' } },
        cell('', true), ...gam(p2).map((x) => cell(x, true)),
        cell(gam(p1)[0], true), cell(cr[0]), cell(cr[1]), cell(gam(p1)[1], true), cell(cr[2]), cell(cr[3])));
      sq.setAttribute('aria-label', t('Punnett square'));
      const sp = shortPct();
      rS.set(`${sp}%`); rT.set(`${100 - sp}%`);
      batch = null; batchEl.textContent = '';
      out.className = 'note';
      out.textContent = t('Parents: ') + `${p1} × ${p2}. ` + t('Press “Grow 16 seeds” to test.');
    }
    function grow() {
      const sp = shortPct() / 100; let s = 0;
      for (let i = 0; i < 16; i++) if (api.rng() < sp) s++;
      batch = s;
      batchEl.textContent = `🌱 ${16 - s} ${t('tall')} · 🌿 ${s} ${t('short')}  (${t('expected')} ${fmt(sp * 16)} ${t('short')})`;
      if (Math.abs(shortPct() - target) < 0.01 && !done) {
        done = true; out.className = 'note ok'; out.textContent = t('That cross gives the share you wanted.');
        api.say(t('Each parent passes on one allele at random. A short plant needs two t alleles, so it only appears when both parents give a t.'));
        api.complete(guessed && good ? 1 : 0.8, `${p1} × ${p2} gives ${shortPct()}% short seeds.`);
      } else { out.className = 'note'; out.textContent = t('Not the target share yet. Try different parents.'); }
    }
    goal.textContent = `${t('Mission: make')} ${target}% ${t('short seeds')}`;
    pbox.append(predict({ question: t('Predict: % short seeds for the current parents'), unit: '%', truth: () => shortPct(), tolerance: 0.01, onResult: (e) => { guessed = true; good = e <= 0.01; } }));
    root.append(h('div', { class: 'lab' }, goal,
      h('div', { class: 'small' }, t('Parent 1 (T = tall allele, t = short allele)')), c1.el,
      h('div', { class: 'small' }, t('Parent 2')), c2.el, sq,
      h('div', { class: 'lab-row' }, rT.el, rS.el), pbox,
      h('div', { class: 'lab-row' }, button(t('Grow 16 seeds'), grow, 'btn gold')), batchEl, out));
    refresh();
    api.say(t('Fill in the square: each box is one possible seed. Count the boxes with tt.'));
    void batch;
    return () => {};
  },
};
