import { h, slider, readout, button, canvas, predict, fmt } from '../core/labkit.js';

export default {
  id: 'w12-market-equilibrium',
  world: 12,
  levels: [3, 4],
  kind: 'lab',
  icon: '⚖️',
  title: 'Market Balance',
  goal: 'Set the price where buyers want exactly as much as sellers offer, then handle a surprise.',
  limits: 'Straight-line demand and supply for one product in a perfectly competitive market with no taxes, no stock-keeping and instant price changes. Real curves bend and shift for many reasons.',
  mount(root, api) {
    const t = api.t;
    const ri = (a, b) => a + Math.floor(api.rng() * (b - a + 1));
    let A, bD, cS, dS, round = 1, shiftDir, done = false, predOk = true, dirGuess = null;
    const goods = [['🍓', 'strawberries'], ['🍦', 'ice creams'], ['🥖', 'loaves'], ['🧃', 'juices']];
    const good = goods[ri(0, goods.length - 1)];
    // Qd = A - bD*P ; Qs = -cS + dS*P   (quantity in hundreds per day, price in coins)
    bD = ri(5, 10); dS = ri(5, 10); const Pstar0 = ri(4, 8); cS = ri(5, 15);
    A = Math.round(cS + (bD + dS) * Pstar0); // gives P* = (A + cS)/(bD+dS) near Pstar0
    const eqP = () => (A + cS) / (bD + dS);
    const eqQ = () => A - bD * eqP();
    const Pmax = () => Math.ceil((A / bD) * 1.0);

    const c = canvas(280, { light: true });
    const price = slider({ label: t('Price per item (coins)'), min: 0, max: 16, step: 0.25, value: 1, onInput: () => update() });
    const rD = readout(t('buyers want'), '0'), rS = readout(t('sellers offer'), '0'), rG = readout(t('gap'), '–');
    const out = h('div', { class: 'note', 'aria-live': 'polite' });
    const roundEl = h('div', { class: 'lab-goal' });
    const pbox = h('div'), dirBox = h('div');
    const Qd = (p) => Math.max(0, A - bD * p), Qs = (p) => Math.max(0, -cS + dS * p);

    function update() {
      const p = price.value, qd = Qd(p), qs = Qs(p);
      rD.set(fmt(qd, 3)); rS.set(fmt(qs, 3));
      const gap = qd - qs;
      rG.set(Math.abs(gap) < 0.5 ? t('balanced') : gap > 0 ? `${t('shortage')} ${fmt(gap, 3)}` : `${t('surplus')} ${fmt(-gap, 3)}`);
      draw(p);
      if (Math.abs(p - eqP()) <= 0.3 && !(round === 2 && dirGuess === null) ) reached();
    }
    function reached() {
      if (round === 1) {
        out.className = 'note ok'; out.textContent = t('Balanced! Now something changes in the market. Predict what happens to the price.');
        api.say(t('At the equilibrium price, no one is left empty-handed and no stock is left unsold.'));
        round = 2; shiftDir = api.rng() < 0.5 ? -1 : 1;
        const shift = Math.round(A * 0.25) * shiftDir;
        pending = shift; showShock();
      } else if (!done && shocked) {
        done = true; out.className = 'note ok'; out.textContent = t('Found the new balance price.');
        api.say(shiftDir > 0 ? t('More demand at every price makes the old price too low: buyers compete and the price rises until supply catches up.') : t('Less demand at every price leaves stock unsold at the old price, so the price must fall to clear the market.'));
        api.complete(predOk && dirGuess === shiftDir ? 1 : 0.8, `Equilibrium moved to ${fmt(eqP())} coins.`);
      }
    }
    let pending = 0, shocked = false;
    function showShock() {
      shocked = false; dirGuess = null;
      roundEl.textContent = shiftDir > 0 ? `${good[0]} ${t('News: a festival means more people want to buy.')}` : `${good[0]} ${t('News: a rival shop opens, so fewer people want to buy here.')}`;
      dirBox.replaceChildren(h('span', { class: 'lab-goal' }, t('The balance price will…')), ...[[1, t('go up')], [-1, t('go down')]].map(([v, txt]) => button(txt, () => { dirGuess = v; A += pending; shocked = true; predOk = v === shiftDir; dirBox.textContent = `${t('You predicted')}: ${txt}. ${t('Now move the price to the new balance.')}`; update(); }, 'btn gold')));
      update();
    }
    function draw(p) {
      const { ctx, w } = c, H = 280, X = Math.max(A, 30), Y = 16;
      const px = (q) => 30 + (q / X) * (w - 40), py = (v) => H - 24 - (v / Y) * (H - 40);
      ctx.clearRect(0, 0, w, H);
      ctx.strokeStyle = '#4b5578'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(30, 8); ctx.lineTo(30, H - 24); ctx.lineTo(w - 6, H - 24); ctx.stroke();
      ctx.fillStyle = '#4b5578'; ctx.font = '11px system-ui'; ctx.fillText(t('price'), 2, 12); ctx.fillText(t('quantity'), w - 52, H - 8);
      const line = (fn, col) => { ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.beginPath(); let first = true; for (let v = 0; v <= Y; v += 0.25) { const q = fn(v); if (q > X * 1.05) continue; const x = px(q), y = py(v); first ? ctx.moveTo(x, y) : ctx.lineTo(x, y); first = false; } ctx.stroke(); };
      line(Qd, '#5b6cff'); line(Qs, '#f5a000');
      ctx.fillStyle = '#5b6cff'; ctx.fillText(t('demand'), px(Qd(1.5)) + 4, py(1.5)); ctx.fillStyle = '#d98200'; ctx.fillText(t('supply'), px(Qs(Y - 1)) - 40, py(Y - 1));
      ctx.strokeStyle = '#d9485f'; ctx.setLineDash([5, 4]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(30, py(p)); ctx.lineTo(w - 6, py(p)); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#5b6cff'; ctx.beginPath(); ctx.arc(px(Qd(p)), py(p), 6, 0, 7); ctx.fill();
      ctx.fillStyle = '#f5a000'; ctx.beginPath(); ctx.arc(px(Qs(p)), py(p), 6, 0, 7); ctx.fill();
    }
    pbox.append(predict({ question: t('Predict: the balance price (coins)'), unit: t('coins'), truth: () => eqP(), tolerance: 0.1, onResult: () => {} }));
    c.onResize = () => draw(price.value);
    c.el.setAttribute('aria-label', t('Supply and demand graph'));
    roundEl.textContent = `${good[0]} ${t('A stall sells')} ${t(good[1])}. ${t('Find the price that balances buyers and sellers.')}`;
    root.append(h('div', { class: 'lab' }, roundEl, pbox, c.el, price.el, h('div', { class: 'lab-row' }, rD.el, rS.el, rG.el), dirBox, out,
      h('div', { class: 'small muted' }, t('Blue dot: how much buyers want at this price. Orange dot: how much sellers offer. They meet at the balance.'))));
    update();
    api.say(t('Move the price. If buyers want more than sellers offer there is a shortage; if sellers offer more, a surplus.'));
    void eqQ; void Pmax; void button;
    return () => {};
  },
};
