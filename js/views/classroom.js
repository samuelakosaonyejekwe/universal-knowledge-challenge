// Classroom: school-managed accounts without a server.
// A teacher creates a class pack (a file) holding the students' player names and picture codes. Each student opens
// the pack on their own device, picks their name and enters their code; the account is managed by the teacher's PIN.
// Students send a progress file back whenever asked, and the teacher's device builds the class overview.
import { h, clear, toast, uid, slowHash, hashStr, rngFrom, shuffle, pct } from '../core/util.js';
import { t } from '../core/i18n.js';
import { profile, device, saveDevice, createProfile, worldProgress, worldId, audit } from '../core/store.js';
import { makeGuardian, bandFor, ageFrom, BANDS } from '../core/safety.js';
import { nameMenu } from '../core/names.js';
import { randomAvatar, avatarEl } from '../core/avatar.js';
import { world } from '../data/worlds.js';
import { mastery, DIMENSIONS } from '../engine/report.js';
import { go, sectionTitle } from './ui.js';
import { applySettings } from '../app.js';

const PICS = ['🐶', '🐱', '🦊', '🐼', '🐸', '🦁', '🐵', '🐧', '🦄', '🐢', '🦋', '🐙', '🍎', '🍌', '⚽', '🚀'];
const SALT = 'ukc-class-1';
const sign = (o) => hashStr(SALT + JSON.stringify(o)).toString(36);
const download = (name, obj) => { const a = h('a', { href: URL.createObjectURL(new Blob([JSON.stringify(obj)], { type: 'application/json' })), download: name }); a.click(); };
const readFiles = async (files) => (await Promise.all([...files].map((f) => f.text()))).map((x) => { try { return JSON.parse(x); } catch { return null; } }).filter(Boolean);

// ---------- teacher and student (signed in) ----------
export function classroomView(main) {
  const p = profile;
  device.classes ||= {};
  main.append(h('div', { class: 'hero' }, h('h1', null, '🏫 ', t('Classroom')), h('p', { class: 'muted' }, t('School-managed players, class progress and class codes — all without an online account.'))));

  // A student in a class: send progress to the teacher.
  if (p.school) {
    main.append(h('div', { class: 'card mt' }, sectionTitle('🎒', t('My class') + ': ' + p.school.className),
      h('p', { class: 'small' }, t('Teacher') + ': ', h('b', null, p.guardian?.name || '')),
      h('button', { class: 'btn', onClick: () => { download(`${p.name.replace(/\s+/g, '-')}-progress.json`, progressReport()); toast(t('Saved. Give this file to your teacher.')); } }, '📤 ', t('Save my progress for my teacher')),
      h('p', { class: 'tiny muted mt' }, t('The file holds your player name, levels, mastery scores and learning time. Nothing else.'))));
  }

  if (p.band !== 'adult') { if (!p.school) main.append(h('div', { class: 'card mt' }, t('Classes are created by a teacher using an adult player. Students join from the welcome screen with "Join my class".'))); return; }

  // Create a class.
  const f = { name: h('input', { class: 'input', placeholder: t('For example: Year 5 Blue') }), teacher: h('input', { class: 'input', autocomplete: 'name' }), n: h('input', { class: 'input', type: 'number', min: 1, max: 40, value: 10 }), year: h('input', { class: 'input', type: 'number', min: 1990, max: new Date().getFullYear(), value: new Date().getFullYear() - 10 }), pin: h('input', { class: 'input', type: 'password', inputmode: 'numeric', maxlength: 8, autocomplete: 'new-password' }) };
  const out = h('div', { class: 'mt' });
  main.append(h('div', { class: 'card mt' }, sectionTitle('➕', t('Create a class')),
    h('div', { class: 'grid c2' }, h('label', { class: 'field' }, h('span', null, t('Class name')), f.name), h('label', { class: 'field' }, h('span', null, t('Teacher\'s name')), f.teacher),
      h('label', { class: 'field' }, h('span', null, t('Number of students')), f.n), h('label', { class: 'field' }, h('span', null, t('Year most students were born')), f.year),
      h('label', { class: 'field' }, h('span', null, t('Teacher PIN (4–8 digits) — unlocks the grown-up settings on every student\'s device')), f.pin)),
    h('button', { class: 'btn', onClick: async () => {
      if (f.name.value.trim().length < 2 || f.teacher.value.trim().length < 3 || !/^\d{4,8}$/.test(f.pin.value)) return toast(t('Please fill in the class name, your name and a 4–8 digit PIN.'));
      const id = 'c' + uid();
      const guardian = await makeGuardian({ name: f.teacher.value.trim(), relation: 'Teacher or school', birthYear: 1980, pin: f.pin.value });
      const n = Math.max(1, Math.min(40, +f.n.value || 1));
      const rng = rngFrom(id);
      const names = nameMenu(id, 40).slice(0, n);
      const roster = [], students = [];
      for (const name of names) {
        const code = shuffle(PICS, rng).slice(0, 4).join('');
        roster.push({ name, code });
        students.push({ name, check: await slowHash(code, id + name), avatar: randomAvatar(rng) });
      }
      const pack = { app: 'ukc-class', v: 1, id, className: f.name.value.trim(), birth: { y: +f.year.value, m: 9, d: 1 }, guardian, students };
      pack.sig = sign({ id, students: students.map((s) => s.check) });
      device.classes[id] = { name: pack.className, created: Date.now(), roster, reports: {} };
      saveDevice(); audit('class-created', { id, n });
      download(`${pack.className.replace(/\s+/g, '-')}-class-pack.json`, pack);
      drawClasses(); toast(t('Class pack saved. Share that file with your students\' devices.'));
    } }, '🏫 ', t('Create the class pack')),
    h('p', { class: 'tiny muted mt' }, t('Each student gets a player name from the game\'s list and a four-picture code. Real names are never entered; keep your own list of who has which player name.'))), out);

  function drawClasses() {
    clear(out);
    for (const [id, c] of Object.entries(device.classes)) {
      const table = h('div');
      const drawTable = () => {
        const rows = c.roster.map((s) => ({ s, r: c.reports[s.name] }));
        clear(table).append(h('div', { style: { overflowX: 'auto' } }, h('table', { class: 'tbl' }, h('tr', null, h('th', null, t('Player')), h('th', null, t('Code')), h('th', null, t('Worlds')), h('th', null, t('Stages')), h('th', null, t('Mastery')), h('th', null, t('Minutes')), h('th', null, t('To practise')), h('th', null, t('Updated'))),
          rows.map(({ s, r }) => h('tr', null, h('td', null, h('b', null, s.name)), h('td', null, s.code), h('td', null, r ? r.worlds.map((w) => `${world(worldId(w.w)).em}L${w.level}`).join(' ') : '–'), h('td', null, r ? r.stages : '–'), h('td', null, r && r.overall != null ? pct(r.overall, 1) + '%' : '–'), h('td', null, r ? Math.round(r.ms / 60000) : '–'), h('td', null, r?.weak ? t(DIMENSIONS.find((d) => d[0] === r.weak)[1]) : '–'), h('td', { class: 'tiny' }, r ? new Date(r.at).toLocaleDateString() : t('no report yet')))))));
      };
      drawTable();
      out.append(h('div', { class: 'card mt' }, sectionTitle('👥', c.name), table,
        h('div', { class: 'row mt' },
          h('label', { class: 'btn' }, '📥 ', t('Add students\' progress files'), h('input', { type: 'file', accept: '.json,application/json', multiple: true, hidden: true, onChange: async (e) => {
            let added = 0;
            for (const r of await readFiles(e.target.files)) { const { sig, ...rest } = r; if (r.app === 'ukc-progress' && r.cls === id && sign(rest) === sig) { c.reports[r.name] = r; added++; } }
            saveDevice(); drawTable(); toast(t('{n} progress files added.', { n: added }));
          } })),
          h('button', { class: 'btn ghost', onClick: () => print() }, '🖨️ ', t('Print the list of names and codes')))));
    }
  }
  drawClasses();
}

export function progressReport() {
  const p = profile;
  const m = mastery(p.stats.kinds, p.stats.retention);
  const scored = Object.entries(m.parts).filter(([, v]) => v != null).sort((a, b) => a[1] - b[1]);
  const worlds = Object.entries(p.worlds).filter(([, w]) => w.level > 0).map(([k, w]) => ({ w: k, level: w.level, done: Math.round(worldProgress(k) * 60), credits: w.credits, mastered: w.completed.length }));
  const rep = { app: 'ukc-progress', v: 1, cls: p.school?.id || '', name: p.name, at: Date.now(), worlds, stages: worlds.reduce((a, w) => a + w.done, 0), overall: m.overall, parts: m.parts, weak: scored[0]?.[0] || null, ms: p.stats.ms, answered: m.evidence };
  rep.sig = sign(rep);
  return rep;
}

// ---------- student joins a class (before signing in) ----------
export function joinClass(main) {
  const box = h('div', { class: 'card', style: { maxWidth: '640px', margin: '0 auto' } });
  main.append(box);
  const start = () => clear(box).append(sectionTitle('🏫', t('Join my class')), h('p', null, t('Open the class pack file your teacher gave you.')),
    h('label', { class: 'btn' }, '📂 ', t('Open the class pack'), h('input', { type: 'file', accept: '.json,application/json', hidden: true, onChange: async (e) => {
      const [pack] = await readFiles(e.target.files);
      if (pack?.app !== 'ukc-class' || sign({ id: pack.id, students: pack.students.map((s) => s.check) }) !== pack.sig) return toast(t('That file is not a class pack.'));
      pickName(pack);
    } })), h('button', { class: 'btn ghost', style: { marginInlineStart: '.5rem' }, onClick: () => go('welcome') }, t('Back')));
  const pickName = (pack) => clear(box).append(sectionTitle('🏷️', pack.className), h('p', null, t('Tap your player name.')),
    h('div', { class: 'grid c3' }, pack.students.map((s) => h('button', { class: 'card flat row', style: { cursor: 'pointer', textAlign: 'start' }, onClick: () => enterCode(pack, s) }, avatarEl(s.avatar, { band: bandFor(ageFrom(pack.birth)), role: 'student', size: 'sm' }), h('b', null, s.name)))));
  const enterCode = (pack, s) => {
    const chosen = [];
    const show = h('div', { class: 'big center', style: { minHeight: '2rem', letterSpacing: '.3rem' } });
    const tryIt = async () => {
      const code = chosen.join('');
      if ((await slowHash(code, pack.id + s.name)) !== s.check) { chosen.length = 0; show.textContent = ''; return toast(t('That is not your code. Try again.')); }
      const band = bandFor(ageFrom(pack.birth));
      await createProfile({ name: s.name, avatar: s.avatar, birth: pack.birth, band, guardian: { ...pack.guardian }, consent: { at: Date.now(), by: pack.guardian.name, terms: 'school-v1' }, lang: device.lang || 'en', secretKind: 'picture' }, code);
      profile.school = { id: pack.id, className: pack.className };
      const { save } = await import('../core/store.js'); save(true);
      audit('class-joined', { cls: pack.id });
      applySettings(); go('rules');
    };
    clear(box).append(sectionTitle('🔑', t('Hello, {name}!', { name: s.name })), h('p', null, t('Tap your four secret pictures in order.')), show,
      h('div', { class: 'row center' }, PICS.map((e) => h('button', { class: 'chip big', onClick: () => { if (chosen.length < 4) { chosen.push(e); show.textContent = chosen.join(''); if (chosen.length === 4) tryIt(); } } }, e))),
      h('div', { class: 'row center mt' }, h('button', { class: 'btn ghost sm', onClick: () => { chosen.length = 0; show.textContent = ''; } }, '↺ ', t('Start again')), h('button', { class: 'btn ghost sm', onClick: () => pickName(pack) }, t('Back'))),
      h('p', { class: 'tiny muted mt' }, t('{type} account, managed by your teacher.', { type: t(BANDS[bandFor(ageFrom(pack.birth))].account) })));
  };
  start();
}
