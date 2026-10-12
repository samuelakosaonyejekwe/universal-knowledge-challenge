// Live duel: two players on two devices answer the same questions at the same time and watch each other's score.
// The devices connect directly to each other (WebRTC). There is no game server and no chat: the two players swap
// two short-lived connection codes by any means they already use (showing the screen, a message from a parent, a
// classroom board), and during play only answers and preset friendly phrases travel between the devices.
import { h, clear, toast } from '../core/util.js';
import { t } from '../core/i18n.js';
import { profile, worldId, recordAnswer, logEvent, save } from '../core/store.js';
import { needsGuardian } from '../core/safety.js';
import { world } from '../data/worlds.js';
import { runSet, timeFor } from '../engine/quiz.js';
import { sfx } from '../core/audio.js';
import { avatarEl } from '../core/avatar.js';
import { sectionTitle, guardianGate, loading } from './ui.js';
import { seededSet, worldPicker } from './arena.js';

const PHRASES = ['Good game!', 'Well played!', 'That was close!', 'Great thinking!', 'Good luck!', 'Thank you for playing!'];
const ICE = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }];

// Connection descriptions are long; squeeze them into a code that is practical to copy.
async function pack(obj) {
  const raw = new TextEncoder().encode(JSON.stringify(obj));
  let bytes = raw, z = 0;
  if (typeof CompressionStream !== 'undefined') { bytes = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer()); z = 1; }
  let s = ''; for (const b of bytes) s += String.fromCharCode(b);
  return z + btoa(s).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}
async function unpack(code) {
  try {
    const c = code.trim(), z = c[0] === '1';
    const bytes = Uint8Array.from(atob(c.slice(1).replace(/-/g, '+').replace(/_/g, '/')), (ch) => ch.charCodeAt(0));
    const raw = z ? new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer()) : bytes;
    return JSON.parse(new TextDecoder().decode(raw));
  } catch { return null; }
}
const gathered = (pc) => new Promise((res) => { if (pc.iceGatheringState === 'complete') return res(); const done = () => { if (pc.iceGatheringState === 'complete') res(); }; pc.addEventListener('icegatheringstatechange', done); setTimeout(res, 3500); });

export function liveDuel(body) {
  const out = h('div', { class: 'mt' });
  let pc = null;
  const stop = () => { try { pc?.close(); } catch { /* closed */ } pc = null; };
  const codeBox = (label, code) => {
    const ta = h('textarea', { class: 'input', rows: 3, readonly: true, 'aria-label': label }, code);
    return h('div', { class: 'card' }, h('b', null, label), ta, h('div', { class: 'row mt' }, h('button', { class: 'btn ghost sm', onClick: async () => { try { await navigator.clipboard.writeText(code); toast(t('Copied')); } catch { ta.select(); } } }, '📋 ', t('Copy')), navigator.share ? h('button', { class: 'btn ghost sm', onClick: () => navigator.share({ text: code }).catch(() => {}) }, '📤 ', t('Share')) : null));
  };

  function begin() {
    if (typeof RTCPeerConnection === 'undefined') { clear(out).append(h('div', { class: 'note' }, t('This browser cannot make live connections. Use a friend challenge code instead.'))); return; }
    const join = h('input', { class: 'input', placeholder: t('Paste the invitation code'), autocomplete: 'off' });
    clear(out).append(h('h3', null, t('Start a live duel')), worldPicker(host), h('h3', { class: 'mt' }, t('Join a live duel')), h('div', { class: 'row' }, h('div', { class: 'grow' }, join), h('button', { class: 'btn', onClick: () => guest(join.value) }, t('Join'))));
  }

  async function host(wkey, level) {
    clear(out).append(loading());
    stop(); pc = new RTCPeerConnection({ iceServers: ICE });
    const ch = pc.createDataChannel('duel');
    const c = { w: wkey, l: level, s: Math.random().toString(36).slice(2, 8), n: 8 };
    await pc.setLocalDescription(await pc.createOffer());
    await gathered(pc);
    const invite = await pack({ k: 'offer', sdp: pc.localDescription.sdp, c, who: profile.name });
    const reply = h('input', { class: 'input', placeholder: t('Paste your friend\'s reply code'), autocomplete: 'off' });
    clear(out).append(h('ol', null, h('li', null, t('Send this invitation code to your friend.')), h('li', null, t('Your friend sends a reply code back. Paste it below.'))), codeBox(t('Invitation code'), invite),
      h('div', { class: 'row mt' }, h('div', { class: 'grow' }, reply), h('button', { class: 'btn', onClick: async () => { const a = await unpack(reply.value); if (a?.k !== 'answer') return toast(t('That code does not look right.')); try { await pc.setRemoteDescription({ type: 'answer', sdp: a.sdp }); toast(t('Connecting…')); } catch { toast(t('That code does not look right.')); } } }, t('Connect'))));
    ch.onopen = () => play(ch, c, true);
  }

  async function guest(code) {
    const o = await unpack(code);
    if (o?.k !== 'offer') return toast(t('That code does not look right.'));
    const mine = profile.worlds[o.c.w]?.level || 0;
    clear(out).append(loading());
    stop(); pc = new RTCPeerConnection({ iceServers: ICE });
    pc.ondatachannel = (e) => { e.channel.onopen = () => play(e.channel, o.c, false, o.who); if (e.channel.readyState === 'open') play(e.channel, o.c, false, o.who); };
    await pc.setRemoteDescription({ type: 'offer', sdp: o.sdp });
    await pc.setLocalDescription(await pc.createAnswer());
    await gathered(pc);
    clear(out).append(o.c.l > mine + 1 ? h('div', { class: 'note warn mb' }, t('This duel is for Level {n}, above your current level in that world. Fair matches pair players of similar level — you can still play it as a friendly.', { n: o.c.l })) : null,
      h('p', null, t('{name} invited you. Send this reply code back, then wait — the duel starts by itself.', { name: o.who })), codeBox(t('Reply code'), await pack({ k: 'answer', sdp: pc.localDescription.sdp, who: profile.name })));
  }

  let started = false;
  async function play(ch, c, isHost, otherName = '') {
    if (started) return; started = true;
    const w = world(worldId(c.w));
    let them = 0, me = 0, theirDone = null, myDone = false, other = otherName;
    const mineEl = h('div', { class: 'score' }, '0'), theirEl = h('div', { class: 'score' }, '0'), theirName = h('div', null, other || '…'), said = h('div', { class: 'center small', 'aria-live': 'polite' });
    const stage = h('div');
    const arena = h('div', { class: 'arena' }, h('div', { class: 'versus' }, h('div', { class: 'side' }, avatarEl(profile.avatar, { band: profile.band, role: 'student' }), h('div', null, profile.name), mineEl), h('div', { class: 'vs' }, 'VS'), h('div', { class: 'side' }, avatarEl({ seed: 'peer' + c.s }, { band: profile.band, role: 'peer' }), theirName, theirEl)), said, stage);
    clear(out).append(h('div', { class: 'tiny muted mb' }, `${w.em} ${t(w.short)} · ${t('Level {n}', { n: c.l })}`), arena);
    const send = (m) => { try { ch.send(JSON.stringify(m)); } catch { /* peer left */ } };
    const finish = () => {
      if (!myDone || theirDone == null) return;
      const won = me > them, tie = me === them;
      sfx(won ? 'win' : tie ? 'ok' : 'lose');
      if (won) arena.classList.add('lit');
      logEvent('live-duel', { w: c.w, level: c.l, won, you: me, them });
      profile.social.results.push({ k: 'live', sc: me, n: c.n, tm: profile.settings.untimed ? 0 : 1, at: Date.now(), mine: true }); save();
      clear(stage).append(h('div', { class: 'card center' }, h('h2', null, tie ? t('A tie — well matched!') : won ? '🏅 ' + t('You win, {a} to {b}!', { a: me, b: them }) : t('{name} wins, {b} to {a}. Good game!', { name: other, a: me, b: them })),
        h('div', { class: 'row center' }, PHRASES.map((ph, i) => h('button', { class: 'chip', onClick: () => { send({ t: 'say', i }); toast(t(ph)); } }, t(ph))))));
    };
    ch.onmessage = (e) => {
      let m; try { m = JSON.parse(e.data); } catch { return; }
      if (m.t === 'hi') { other = String(m.who || '').slice(0, 24); theirName.textContent = other; }
      if (m.t === 'ans' && m.ok) { them += 5; theirEl.textContent = them; }
      if (m.t === 'done') { theirDone = true; them = Math.max(0, Math.min(c.n * 5, +m.score || 0)); theirEl.textContent = them; finish(); }
      if (m.t === 'say' && PHRASES[m.i]) said.textContent = `💬 ${other}: ${t(PHRASES[m.i])}`;
    };
    ch.onclose = () => { if (theirDone == null) { theirDone = true; said.textContent = t('Your friend left the duel.'); finish(); } };
    send({ t: 'hi', who: profile.name });
    const items = await seededSet(c.w, c.l, c.s, c.n).catch(() => []);
    if (!items.length) { clear(stage).append(h('div', { class: 'card' }, t('This lesson pack is not on your device yet'))); return; }
    await runSet(stage, items, (it) => ({ feedback: false, timed: profile.settings.untimed ? 0 : timeFor(it), onAnswer: (q, r) => { if (r.correct) { me += 5; mineEl.textContent = me; } send({ t: 'ans', ok: r.correct }); recordAnswer(c.w, q, r.correct, { ms: r.ms }); } }));
    myDone = true; send({ t: 'done', score: me });
    if (theirDone == null) clear(stage).append(h('div', { class: 'card center' }, h('p', null, t('Finished! Waiting for your friend…'))));
    finish();
    isHost;
  }

  body.append(h('div', { class: 'card' }, sectionTitle('⚡', t('Live duel')), h('p', { class: 'small muted' }, t('Play a friend in real time on two devices. Your devices connect directly to each other — no chat, no accounts, player names only. You both get the same questions.')), out));
  // A direct connection lets the two devices see each other's network address, so younger players need a grown-up's OK.
  if (needsGuardian(profile.band)) clear(out).append(h('button', { class: 'btn', onClick: () => guardianGate(begin, t('A live duel connects this device directly to a friend\'s device.')) }, '🔒 ', t('Ask a grown-up to start')));
  else begin();
  return stop;
}
