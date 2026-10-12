// Welcome, registration with age assurance and guardian consent, sign-in, game rules,
// the "how do you learn best" check, and the optional "about you" questions.
import { h, clear, toast, rngFrom, shuffle, uid } from '../core/util.js';
import { t, LANGS, lang } from '../core/i18n.js';
import { device, profile, createProfile, signIn, save, syncMeta, importProfile } from '../core/store.js';
import { screenAge, needsGuardian, makeGuardian, BANDS } from '../core/safety.js';
import { avatarEl, SKINS, HAIR_COLORS, OUTFITS, HAIR_STYLES, CAST_THEMES, randomAvatar, TYPICAL_HAIR } from '../core/avatar.js';
import { nameMenu } from '../core/names.js';
import { speak, canSpeakLang } from '../core/speech.js';
import { sfx } from '../core/audio.js';
import { WORLDS, CONTEXTS, STAGE_REWARD, AWARD } from '../data/worlds.js';
import { go, sectionTitle } from './ui.js';
import { changeLanguage, installApp, isInstalled, applySettings } from '../app.js';

const langPicker = () => h('div', { class: 'row center', role: 'group', 'aria-label': 'Language' }, LANGS.map((l) =>
  h('button', { class: 'chip' + (l.code === lang ? ' on' : ''), lang: l.code, onClick: () => changeLanguage(l.code) }, l.flag, ' ', l.name)));

// "Male / Female / Rather not say": shapes how the character is drawn, and nothing else in the game.
function lookChoice(av, redraw) {
  const pick = (v) => { av.g = v; if (!TYPICAL_HAIR[v].includes(av.hair)) av.hair = TYPICAL_HAIR[v][0]; redraw(); };
  return h('div', { class: 'field mt' }, h('span', null, t('My character is')),
    h('div', { class: 'row', role: 'radiogroup' }, [['m', '👦', 'Male'], ['f', '👧', 'Female'], ['n', '🙂', 'Rather not say']].map(([v, e, label]) => h('button', { class: 'chip', role: 'radio', 'aria-checked': String((av.g || 'n') === v), 'aria-pressed': String((av.g || 'n') === v), onClick: () => pick(v) }, e, ' ', t(label)))),
    h('span', { class: 'tiny muted' }, t('This only changes how your character is drawn. Every hair style and colour stays open to everyone, and lessons are the same for all.')));
}

// A short row of hair styles that suit the chosen look; "More styles" opens the rest.
let moreHair = false;
function hairPicker(av, band, cast, redraw) {
  const typical = TYPICAL_HAIR[av.g || 'n'];
  const list = moreHair || !typical.includes(av.hair) ? Array.from({ length: HAIR_STYLES }, (_, i) => i) : typical;
  return h('div', { class: 'field' }, h('span', null, t('Hair style')), h('div', { class: 'row' },
    list.map((i) => h('button', { class: 'chip', style: { padding: '3px', borderRadius: '50%' }, 'aria-label': `${t('Hair style')} ${i + 1}`, 'aria-pressed': String(av.hair === i), onClick: () => { av.hair = i; redraw(); } }, avatarEl({ ...av, hair: i }, { band, role: 'student', cast }))),
    list.length < HAIR_STYLES ? h('button', { class: 'chip', onClick: () => { moreHair = true; redraw(); } }, '➕ ', t('More styles')) : null));
}

// ---------- welcome ----------
export function welcome(main) {
  const profiles = Object.entries(device.profiles);
  main.append(
    h('div', { class: 'hero center' },
      h('div', { class: 'scene', 'aria-hidden': 'true' }, ['🪐', '⚗️', '🚀', '🌍', '🎵', '♟️', '🧬', '📚'].map((e, i) => h('span', { style: { left: (6 + i * 12) + '%', top: (i % 2 ? 58 : 8) + '%', animationDelay: i * 0.7 + 's' } }, e))),
      h('img', { src: 'icons/icon.svg', alt: '', width: 88, height: 88 }),
      h('h1', null, t('The Universal Knowledge Challenge')),
      h('p', { class: 'muted' }, t('20 worlds of knowledge. Learn with your teacher, explore the labs, then challenge the masters.'))),
    h('div', { class: 'card mt' }, h('h3', { class: 'center' }, '🌐 ', t('Choose your language')), langPicker()),
    h('div', { class: 'card mt col' },
      profiles.length ? h('h3', null, t('Who is playing?')) : null,
      profiles.length ? h('div', { class: 'grid c3' }, profiles.map(([id, p]) => h('button', { class: 'card flat row', style: { cursor: 'pointer', textAlign: 'start' }, onClick: () => go('signin/' + id) }, avatarEl(p.avatar, { band: p.band, role: 'student' }), h('b', null, p.name)))) : null,
      h('button', { class: 'btn block', onClick: () => go('join') }, '✨ ', t('Create a new player')),
      h('button', { class: 'btn ghost block', onClick: () => go('joinclass') }, '🏫 ', t('Join my class')),
      !isInstalled() ? h('button', { class: 'btn ghost block', onClick: installApp }, '📲 ', t('Install on this device')) : null,
      h('label', { class: 'btn ghost block' }, '📂 ', t('Bring a saved player from another device'), h('input', { type: 'file', accept: '.json,application/json', hidden: true, onChange: async (e) => { try { const id = importProfile(await e.target.files[0].text()); toast(t('Player added.')); go('signin/' + id); } catch { toast(t('That file is not a saved player.')); } } }))),
    h('div', { class: 'grid c3 mt' },
      [['🎓', 'Learning comes first', 'Understand ideas, not just answers.'], ['🏆', 'Mastery, never money', 'Nothing to buy. You advance by showing what you know.'], ['🔁', 'Mistakes help you grow', 'Every miss comes with an explanation and another try.'], ['🤝', 'Fair for everyone', 'The game adapts to what you show you can do — nothing else.'], ['🛡️', 'Safe by design', 'No open chat, no strangers, no adverts.'], ['✈️', 'Works offline', 'Install it and keep learning without the internet.']]
        .map(([e, a, b]) => h('div', { class: 'card flat' }, h('div', { class: 'big' }, e, ' ', h('b', null, t(a))), h('div', { class: 'small muted' }, t(b))))));
}

// ---------- sign in ----------
const EMOJI_KEYS = ['🐶', '🐱', '🦊', '🐼', '🐸', '🦁', '🐵', '🐧', '🦄', '🐢', '🦋', '🐙', '🍎', '🍌', '⚽', '🚀'];
function secretInput(kind, onChange) {
  if (kind !== 'picture') {
    const input = h('input', { class: 'input', type: 'password', autocomplete: 'off', minlength: 4, 'aria-label': t('Secret word') });
    input.addEventListener('input', () => onChange(input.value));
    return input;
  }
  const chosen = [];
  const show = h('div', { class: 'big center', style: { minHeight: '2rem', letterSpacing: '.3rem' }, 'aria-live': 'polite' });
  const grid = h('div', { class: 'row center' }, EMOJI_KEYS.map((e) => h('button', { class: 'chip big', type: 'button', onClick: () => { if (chosen.length < 4) { chosen.push(e); show.textContent = chosen.join(''); onChange(chosen.join('')); sfx('tap'); } } }, e)));
  return h('div', { class: 'col' }, show, grid, h('button', { class: 'btn ghost sm', type: 'button', onClick: () => { chosen.length = 0; show.textContent = ''; onChange(''); } }, '↺ ', t('Start again')));
}

export function signin(main, [id]) {
  const meta = device.profiles[id];
  if (!meta) return go('welcome');
  let secret = '';
  const msg = h('div', { class: 'small', 'aria-live': 'polite' });
  const submit = async () => { if (await signIn(id, secret)) { applySettings(); await changeLanguage(profile.lang); go('home'); } else { msg.textContent = t('That is not right. Try again.'); sfx('no'); } };
  main.append(h('div', { class: 'card center col', style: { maxWidth: '460px', margin: '0 auto' } },
    h('div', { style: { margin: '0 auto' } }, avatarEl(meta.avatar, { band: meta.band, role: 'student', size: 'lg' })), h('h2', null, t('Welcome back, {name}!', { name: meta.name })),
    h('p', { class: 'muted' }, meta.kind === 'picture' ? t('Tap your four secret pictures in order.') : t('Type your secret word.')),
    secretInput(meta.kind, (v) => { secret = v; if (meta.kind === 'picture' && v.length >= 8) submit(); }), msg,
    h('button', { class: 'btn', onClick: submit }, t('Sign in')), h('button', { class: 'btn ghost', onClick: () => go('welcome') }, t('Someone else'))));
}

// ---------- registration ----------
export function join(main) {
  const data = { lang, avatar: randomAvatar(), cast: 0, interests: [], school: '' };
  const seed = uid();
  let step = 0, secret = '', secret2 = '';
  const box = h('div', { class: 'card', style: { maxWidth: '640px', margin: '0 auto' } });
  main.append(box);
  const next = () => { step++; draw(); scrollTo(0, 0); };

  function draw() {
    clear(box);
    const steps = ['age', 'guardian', 'name', 'look', 'finish'];
    box.append(h('div', { class: 'steps' }, steps.map((_, i) => h('i', { class: i < step ? 'done' : i === step ? 'now' : '' }))));
    ({ 0: ageStep, 1: guardianStep, 2: nameStep, 3: lookStep, 4: finishStep })[step]();
  }

  // Neutral age screen: no hint about which answer changes what.
  function ageStep() {
    const now = new Date().getFullYear();
    const d = h('select', { class: 'input', 'aria-label': t('Day') }, h('option', { value: '' }, t('Day')), Array.from({ length: 31 }, (_, i) => h('option', { value: i + 1 }, i + 1)));
    const m = h('select', { class: 'input', 'aria-label': t('Month') }, h('option', { value: '' }, t('Month')), Array.from({ length: 12 }, (_, i) => h('option', { value: i + 1 }, new Date(2000, i, 1).toLocaleString(lang, { month: 'long' }))));
    const y = h('select', { class: 'input', 'aria-label': t('Year') }, h('option', { value: '' }, t('Year')), Array.from({ length: 101 }, (_, i) => h('option', { value: now - i }, now - i)));
    box.append(sectionTitle('🎂', t('When were you born?')), h('p', { class: 'muted' }, t('We ask so the game looks and feels right for you. Your date of birth is kept only on this device.')),
      h('div', { class: 'row' }, h('div', { class: 'grow' }, d), h('div', { class: 'grow' }, m), h('div', { class: 'grow' }, y)),
      h('button', { class: 'btn mt', onClick: () => {
        if (!d.value || !m.value || !y.value) return toast(t('Please choose the day, month and year.'));
        const date = new Date(+y.value, +m.value - 1, +d.value);
        if (date.getMonth() !== +m.value - 1 || date > new Date()) return toast(t('That date does not exist. Please check it.'));
        const res = screenAge({ y: +y.value, m: +m.value, d: +d.value });
        Object.assign(data, { birth: res.birth, band: res.band });
        if (!needsGuardian(res.band)) step++; // skip the guardian step for 16+
        next();
      } }, t('Continue'), ' →'));
  }

  // Under-16s: a parent or guardian signs in on the child's behalf, consents, and sets a PIN.
  function guardianStep() {
    const a = 12 + Math.floor(Math.random() * 30), b = 7 + Math.floor(Math.random() * 9);
    const f = { name: h('input', { class: 'input', autocomplete: 'name' }), rel: h('select', { class: 'input' }, ['Parent', 'Guardian', 'Grandparent', 'Teacher or school', 'Other carer'].map((r) => h('option', { value: r }, t(r)))), year: h('input', { class: 'input', type: 'number', inputmode: 'numeric', min: 1920, max: new Date().getFullYear() }), check: h('input', { class: 'input', inputmode: 'numeric' }), sign: h('input', { class: 'input', autocomplete: 'off' }), pin: h('input', { class: 'input', type: 'password', inputmode: 'numeric', maxlength: 8, autocomplete: 'new-password' }), pin2: h('input', { class: 'input', type: 'password', inputmode: 'numeric', maxlength: 8, autocomplete: 'new-password' }) };
    const boxes = [
      'I am this child\'s parent or legal guardian (or their school), and I am 18 or older.',
      'I agree to this child using the game. Learning records stay on this device and are used only to adapt lessons and show progress.',
      'I understand that I can review progress, set time limits, switch off the microphone, live content and challenge codes, correct the age, and delete all data at any time with my PIN.',
    ].map((txt) => { const c = h('input', { type: 'checkbox' }); return [c, h('label', { class: 'row nowrap', style: { alignItems: 'flex-start' } }, c, h('span', { class: 'small' }, t(txt)))]; });
    const forums = h('input', { type: 'checkbox' });
    const msg = h('div', { class: 'note bad', hidden: true });
    box.append(sectionTitle('👪', t('A grown-up is needed here')),
      h('p', null, t('Please hand the device to your parent or guardian. They create this player for you.')),
      h('div', { class: 'note small mb' }, t('For the parent or guardian: this is a guardian-managed account. There is no open chat, no public profile and no contact with strangers anywhere in the game, whatever age is entered.')),
      h('label', { class: 'field' }, h('span', null, t('Your full name')), f.name), h('label', { class: 'field' }, h('span', null, t('Your relationship to the child')), f.rel),
      h('label', { class: 'field' }, h('span', null, t('Your year of birth')), f.year),
      h('label', { class: 'field' }, h('span', null, t('Adult check: what is {a} × {b}?', { a, b })), f.check),
      boxes.map((x) => x[1]),
      data.band === 'teen' ? h('label', { class: 'row nowrap mt', style: { alignItems: 'flex-start' } }, forums, h('span', { class: 'small' }, t('Optional: also allow titles of community questions from moderated Q&A sites in the Live Hub.'))) : null,
      h('label', { class: 'field mt' }, h('span', null, t('Sign by typing your full name again')), f.sign),
      h('div', { class: 'row' }, h('label', { class: 'field grow' }, h('span', null, t('Choose a guardian PIN (4–8 digits)')), f.pin), h('label', { class: 'field grow' }, h('span', null, t('Repeat the PIN')), f.pin2)),
      msg,
      h('button', { class: 'btn', onClick: async () => {
        const fail = (s) => { msg.hidden = false; msg.textContent = t(s); };
        if (f.name.value.trim().length < 3) return fail('Please enter your full name.');
        if (new Date().getFullYear() - +f.year.value < 18 || !+f.year.value) return fail('A guardian must be an adult.');
        if (+f.check.value !== a * b) return fail('The adult check answer is not right.');
        if (!boxes.every((x) => x[0].checked)) return fail('Please tick all three boxes to give consent.');
        if (f.sign.value.trim().toLowerCase() !== f.name.value.trim().toLowerCase()) return fail('The signature must match your name.');
        if (!/^\d{4,8}$/.test(f.pin.value) || f.pin.value !== f.pin2.value) return fail('The PINs must match and be 4–8 digits.');
        data.guardian = await makeGuardian({ name: f.name.value.trim(), relation: f.rel.value, birthYear: +f.year.value, pin: f.pin.value });
        data.guardian.forums = forums.checked;
        data.consent = { at: Date.now(), by: data.guardian.name, terms: 'v1' };
        next();
      } }, t('Give consent and continue'), ' →'),
      h('p', { class: 'tiny muted mt' }, t('Honest note: this check runs on the device and cannot prove identity. Schools and organisations that need stronger assurance should use managed devices or their own verified sign-on.')));
  }

  function nameStep() {
    let salt = 0;
    const list = h('div', { class: 'row center' });
    const fill = () => clear(list).append(...nameMenu(seed + salt).map((n) => h('button', { class: 'chip' + (data.name === n ? ' on' : ''), onClick: () => { data.name = n; fill(); } }, n)));
    fill();
    box.append(sectionTitle('🏷️', t('Pick your player name')), h('p', { class: 'muted' }, t('Players use fun names, never real ones, so your identity stays private.')), list,
      h('div', { class: 'row center mt' }, h('button', { class: 'btn ghost', onClick: () => { salt++; fill(); } }, '🎲 ', t('Show me others')), h('button', { class: 'btn', onClick: () => (data.name ? next() : toast(t('Tap a name first.'))) }, t('Continue'), ' →')));
  }

  function lookStep() {
    const prev = h('div', { class: 'row center' });
    const drawPrev = () => clear(prev).append(avatarEl(data.avatar, { band: data.band, role: 'student', size: 'xl', cast: data.cast }));
    const swatches = (key, cols) => h('div', { class: 'row' }, cols.map((c, i) => h('button', { class: 'chip', 'aria-label': `${key} ${i + 1}`, 'aria-pressed': String(data.avatar[key] === i), style: { background: c, width: '40px', height: '40px', padding: 0 }, onClick: () => { data.avatar[key] = i; draw(); } })));
    drawPrev();
    box.append(sectionTitle('🧑‍🎨', t('Create your character')), prev, lookChoice(data.avatar, draw),
      h('div', { class: 'field' }, h('span', null, t('Skin')), swatches('skin', SKINS)),
      hairPicker(data.avatar, data.band, data.cast, draw),
      h('div', { class: 'field' }, h('span', null, t('Hair colour')), swatches('hairColor', HAIR_COLORS)),
      h('div', { class: 'field' }, h('span', null, t('Uniform colour')), swatches('outfit', OUTFITS)),
      h('div', { class: 'field' }, h('span', null, t('Style of your teachers and masters')), h('div', { class: 'row' }, CAST_THEMES.map((c, i) => h('button', { class: 'chip', 'aria-pressed': String(data.cast === i), onClick: () => { data.cast = i; draw(); } }, c.em, ' ', t(c.name))))),
      h('div', { class: 'row' }, h('button', { class: 'btn ghost', onClick: () => { data.avatar = randomAvatar(Math.random, data.avatar.g || 'n'); draw(); } }, '🎲 ', t('Surprise me')), h('button', { class: 'btn', onClick: next }, t('Continue'), ' →')));
  }

  function finishStep() {
    const young = data.band === 'tiny' || data.band === 'kid';
    const kind = young ? 'picture' : 'text';
    const schools = ['Not at school yet', 'Early primary', 'Upper primary', 'Lower secondary', 'Upper secondary', 'College or university', 'Finished studying'];
    const sel = h('select', { class: 'input' }, schools.map((s) => h('option', { value: s }, t(s))));
    const interests = h('div', { class: 'row' }, WORLDS.map((w) => h('button', { class: 'chip', 'aria-pressed': 'false', onClick: (e) => { const on = !data.interests.includes(w.id); data.interests = on ? [...data.interests, w.id] : data.interests.filter((x) => x !== w.id); e.currentTarget.setAttribute('aria-pressed', String(on)); } }, w.em, ' ', t(w.short))));
    const msg = h('div', { class: 'note bad', hidden: true });
    box.append(sectionTitle('🚀', t('Almost ready, {name}!', { name: data.name })),
      h('label', { class: 'field' }, h('span', null, t('Where are you in your schooling?')), sel),
      h('div', { class: 'field' }, h('span', null, t('What are you curious about? (pick any)')), interests),
      h('div', { class: 'field' }, h('span', null, young ? t('Choose four secret pictures to open your game') : t('Choose a secret word (at least 4 characters)')), secretInput(kind, (v) => { secret = v; })),
      young ? null : h('label', { class: 'field' }, h('span', null, t('Type it again')), (() => { const i = h('input', { class: 'input', type: 'password', autocomplete: 'off' }); i.addEventListener('input', () => { secret2 = i.value; }); return i; })()),
      data.band === 'young' ? h('div', { class: 'note small mb' }, t('Your learning records stay on this device. They are used only to adapt lessons and show your progress. You can export or delete them at any time in Settings.')) : null,
      msg,
      h('button', { class: 'btn', onClick: async () => {
        const fail = (s) => { msg.hidden = false; msg.textContent = t(s); };
        if (young ? [...secret].length < 4 : secret.length < 4) return fail('Your secret needs at least four pictures or characters.');
        if (!young && secret !== secret2) return fail('The two secret words are different.');
        data.school = sel.value; data.secretKind = kind;
        await createProfile(data, secret);
        applySettings(); sfx('win');
        go('rules');
      } }, '✨ ', t('Create my player')));
  }
  draw();
}

// ---------- rules of the game and fair-play pledge ----------
export function rules(main) {
  const cards = [
    ['👩‍🏫', 'Your teacher', 'Every level has a teacher who explains, demonstrates, gives hints and helps again whenever something is unclear.'],
    ['🧪', 'Learn by doing', 'Each stage goes: Discover → Understand → Remember → Recall → Experiment → Apply → Explain. You can revisit any finished lesson whenever you like.'],
    ['⚔️', 'The Master Duel', 'When you are ready, challenge the master. You both get the same questions. Each correct answer is 5 points; wrong answers cost nothing. Win with at least 50 points and more than the master. No hints in a duel.'],
    ['⚖️', 'Ties', 'If you tie, sudden death begins: nuanced reasoning questions keep coming until one of you misses a question the other gets right.'],
    ['🩺', 'College of Doctors', 'After beating the master, three doctors each ask one searching question before the next stage opens.'],
    ['🧑‍🤝‍🧑', 'Teach it', 'To finish a level you teach a complete beginner until they truly understand, then take a reasoning test.'],
    ['🔁', 'If you do not win', 'You are never out. Your teacher explains every mistake and you try again with new questions. A level you cannot pass must be repeated; after three failed finals you step back one level to rebuild.'],
    ['🏅', 'Credits', `Lesson ${AWARD.lesson} · experiment ${AWARD.experiment} · hard problem ${AWARD.hard} · investigation ${AWARD.investigation} · duel ${AWARD.duel} · perfect score +${AWARD.perfect} · team mission ${AWARD.coop} · stage ladder ${STAGE_REWARD.slice(0, 9).join(', ')} · championship ${AWARD.championship}. Credits are fictional, cannot be bought, sold or exchanged, and never unlock lessons — mastery does.`],
    ['⏳', 'Your pace', 'Choose timed or untimed play. Leaderboards keep the two apart, so taking your time is never punished.'],
    ['🛡️', 'Stay well', 'The game reminds you to take breaks. It is best mixed with play, friends, family, sleep and the outdoors.'],
  ];
  const agree = h('input', { type: 'checkbox', id: 'pledge' });
  main.append(h('div', { class: 'hero' }, h('h1', null, '📜 ', t('How the game works')), h('p', { class: 'muted' }, t('Read these with your teacher. They are the same for every player, everywhere.'))),
    h('div', { class: 'grid c2 mt' }, cards.map(([e, a, b]) => h('div', { class: 'card flat' }, h('div', { class: 'bold' }, e, ' ', t(a)), h('div', { class: 'small' }, t(b))))),
    h('div', { class: 'card mt tint' }, sectionTitle('🤝', t('The fair-play pledge')),
      h('ul', null, ['I play as myself and never pretend to be someone else.', 'I do my own thinking: no cheating and no changing results.', 'I treat every player with respect: no bullying, insults or unkindness.', 'I win and lose graciously.'].map((x) => h('li', null, t(x)))),
      h('label', { class: 'row', for: 'pledge' }, agree, h('b', null, t('I promise to play fair.'))),
      h('button', { class: 'btn mt', onClick: () => { if (!agree.checked) return toast(t('Tick the box to make your promise.')); profile.pledged = true; save(true); go(profile.learn ? 'home' : 'learntest'); } }, t('Continue'), ' →')));
}

// ---------- how do you learn best? ----------
// Four tiny made-up lessons, each taught a different way, each followed by two recall questions. Made-up facts
// mean nobody has a head start. The result only decides what the game offers first; every mode stays available.
export function learnTest(main) {
  const rng = rngFrom(profile.id + 'learn');
  const scores = { read: 0, listen: 0, see: 0, do: 0 };
  const prefs = {};
  const host = h('div', { class: 'card', style: { maxWidth: '640px', margin: '0 auto' } });
  main.append(h('div', { class: 'hero mb' }, h('h1', null, '🧭 ', t('How do you learn best?')), h('p', { class: 'muted' }, t('Four mini-lessons, two questions each. There are no wrong ways to learn — this just helps your teacher know where to start.'))), host);
  const ask2 = (mode, qs, done) => {
    let i = 0;
    const showQ = () => {
      const [q, opts, a] = qs[i];
      clear(host).append(h('div', { class: 'q-text' }, t(q)), h('div', { class: 'opts' }, shuffle(opts.map((o, k) => [o, k]), rng).map(([o, k]) => h('button', { class: 'opt', onClick: () => { if (k === a) { scores[mode]++; sfx('ok'); } else sfx('no'); i++; i < qs.length ? showQ() : done(); } }, t(o)))));
    };
    showQ();
  };
  const lessons = [
    () => { // reading
      clear(host).append(sectionTitle('📖', t('Read this')), h('p', { class: 'big' }, t('The Lumo bird lives on high cliffs. It eats red berries. It sleeps standing on one leg.')), h('button', { class: 'btn', onClick: () => ask2('read', [['Where does the Lumo bird live?', ['On high cliffs', 'In a river', 'Under the ground'], 0], ['What does the Lumo bird eat?', ['Red berries', 'Blue fish', 'Green leaves'], 0]], nextLesson) }, t('I have read it'), ' →'));
    },
    () => { // listening
      const text = t('The Tavi fish glows green at night. It always swims in groups of seven.');
      const heard = canSpeakLang(lang);
      const go2 = h('button', { class: 'btn', onClick: () => ask2('listen', [['What colour does the Tavi fish glow?', ['Green', 'Red', 'Yellow'], 0], ['How many Tavi fish swim together?', ['Seven', 'Two', 'Twelve'], 0]], nextLesson) }, t('I have listened'), ' →');
      clear(host).append(sectionTitle('🎧', t('Listen to this')), heard ? h('button', { class: 'btn ghost', onClick: () => speak(text) }, '🔊 ', t('Play')) : h('p', { class: 'big' }, text), heard ? h('p', { class: 'small muted' }, t('Tap play. You can listen twice.')) : null, go2);
      if (heard) speak(text);
    },
    () => { // seeing
      const svg = '<svg viewBox="0 0 220 150" width="100%" style="max-width:320px"><rect width="220" height="150" rx="14" fill="#e8f6ff"/><rect x="100" y="80" width="18" height="60" fill="#8a5a2b"/><g fill="#2f9e44"><rect x="60" y="30" width="34" height="34" rx="3"/><rect x="96" y="14" width="34" height="34" rx="3"/><rect x="132" y="34" width="34" height="34" rx="3"/><rect x="84" y="52" width="50" height="34" rx="3"/></g><g fill="#8a5cf6"><circle cx="78" cy="70" r="8"/><circle cx="112" cy="40" r="8"/><circle cx="150" cy="74" r="8"/></g><text x="110" y="146" text-anchor="middle" font-size="11" fill="#1c2340" font-weight="700">Kobi</text></svg>';
      clear(host).append(sectionTitle('🖼️', t('Look at this picture of a Kobi tree')), h('div', { class: 'center', html: svg }), h('button', { class: 'btn', onClick: () => ask2('see', [['How many fruits were on the Kobi tree?', ['Three', 'Five', 'One'], 0], ['What shape were its leaves?', ['Square', 'Round', 'Star-shaped'], 0]], nextLesson) }, t('I have looked'), ' →'));
    },
    () => { // doing
      const lamp = h('div', { class: 'huge center', style: { transition: 'filter .2s' } }, '💡');
      const range = h('input', { type: 'range', min: -1, max: 1, step: 1, value: 0, style: { width: '100%' }, 'aria-label': t('Lever') });
      let tried = new Set();
      const btn = h('button', { class: 'btn', disabled: true, onClick: () => ask2('do', [['Which way did you push the lever to make the lamp blue?', ['Left', 'Right', 'It was never blue'], 0], ['What colour was the lamp with the lever pushed right?', ['Yellow', 'Blue', 'Green'], 0]], nextLesson) }, t('I have tried it'), ' →');
      range.addEventListener('input', () => { const v = +range.value; tried.add(v); lamp.style.filter = v < 0 ? 'hue-rotate(180deg) saturate(3)' : v > 0 ? 'saturate(3)' : 'grayscale(1)'; lamp.style.background = v < 0 ? '#bcd7ff' : v > 0 ? '#fff3b0' : 'transparent'; lamp.style.borderRadius = '20px'; if (tried.has(-1) && tried.has(1)) btn.disabled = false; });
      lamp.style.filter = 'grayscale(1)';
      clear(host).append(sectionTitle('🕹️', t('Try the Pim machine')), h('p', null, t('Push the lever both ways and watch the lamp.')), lamp, range, btn);
    },
  ];
  const order = shuffle([0, 1, 2, 3], rng);
  let li = 0;
  const nextLesson = () => (li < 4 ? lessons[order[li++]]() : askPrefs());
  const PREFS = [
    ['pace', 'When something is new, I like to…', [['slow', 'take my time and be sure'], ['fast', 'move quickly and fix mistakes later']]],
    ['social', 'I learn best…', [['solo', 'on my own'], ['team', 'with others'], ['mix', 'a bit of both']]],
    ['drive', 'What makes you try hardest?', [['compete', 'beating a rival'], ['coop', 'helping a team'], ['curious', 'finding out how things work']]],
    ['first', 'First, I usually want to…', [['why', 'know why it works'], ['how', 'see how to do it'], ['try', 'just try it']]],
  ];
  let pi = 0;
  function askPrefs() {
    if (pi >= PREFS.length) return finish();
    const [key, q, opts] = PREFS[pi];
    clear(host).append(h('div', { class: 'q-text' }, t(q)), h('div', { class: 'opts' }, opts.map(([v, label]) => h('button', { class: 'opt', onClick: () => { prefs[key] = v; pi++; askPrefs(); } }, t(label)))));
  }
  function finish() {
    const labels = { read: ['📖', 'Reading'], listen: ['🎧', 'Listening'], see: ['🖼️', 'Pictures and demonstrations'], do: ['🕹️', 'Hands-on trying'] };
    // Ties are broken by what the player says they want to do first.
    const nudge = { try: 'do', how: 'see', why: 'read' }[prefs.first];
    const orderModes = Object.keys(scores).sort((a, b) => scores[b] - scores[a] || (b === nudge) - (a === nudge));
    profile.learn = { scores, order: orderModes, prefs, at: Date.now() };
    if (orderModes[0] === 'listen') profile.settings.voice = true;
    save(true);
    clear(host).append(sectionTitle('🌟', t('Your learning compass')),
      h('p', null, t('Today these worked best for you, in this order:')),
      h('ol', null, orderModes.map((m) => h('li', { class: 'big' }, labels[m][0], ' ', t(labels[m][1]), ' ', h('span', { class: 'small muted' }, `${scores[m]}/2`)))),
      h('div', { class: 'note small' }, t('Everyone learns through all of these, and the best mix changes with the subject. Your teacher will start with what suits you and still use every way — and the game keeps adapting to how you actually do.')),
      h('button', { class: 'btn mt', onClick: () => go('about') }, t('Continue'), ' →'));
  }
  nextLesson();
}

// ---------- about you (optional) ----------
// The game adapts to demonstrated learning, never to race, ethnicity, gender or nationality — and never asks for them.
// These optional answers only choose which everyday examples and supports appear first.
export function aboutYou(main) {
  const x = profile.experience || { contexts: [], regions: [], langs: [], access: '', goals: [], needs: [] };
  const multi = (key, opts) => h('div', { class: 'row' }, opts.map(([v, em, label]) => h('button', { class: 'chip', 'aria-pressed': String(x[key].includes(v)), onClick: (e) => { x[key] = x[key].includes(v) ? x[key].filter((k) => k !== v) : [...x[key], v]; e.currentTarget.setAttribute('aria-pressed', String(x[key].includes(v))); } }, em, ' ', t(label))));
  const single = (key, opts) => { const row = h('div', { class: 'row' }); const draw = () => clear(row).append(...opts.map(([v, label]) => h('button', { class: 'chip', 'aria-pressed': String(x[key] === v), onClick: () => { x[key] = v; draw(); } }, t(label)))); draw(); return row; };
  const done = (skip) => {
    if (!skip) {
      profile.experience = { ...x, at: Date.now() };
      const s = profile.settings;
      if (x.needs.includes('big')) s.size = 'l';
      if (x.needs.includes('contrast')) s.contrast = 'high';
      if (x.needs.includes('time')) s.untimed = true;
      if (x.needs.includes('aloud')) s.voice = true;
      if (x.needs.includes('calm')) s.motion = 'off';
      if (x.needs.includes('spacing')) s.spacing = 'wide';
      applySettings();
    } else profile.experience ||= { contexts: [], regions: [], langs: [], access: '', goals: [], needs: [], skipped: true, at: Date.now() };
    save(true); syncMeta(); go('home');
  };
  main.append(h('div', { class: 'hero' }, h('h1', null, '🧩 ', t('Make the game yours')), h('p', { class: 'muted' }, t('Optional. Your answers choose which everyday examples your teacher uses first. They never change how hard the game is or how you are marked — only what you show you can do does that.'))),
    h('div', { class: 'card mt' },
      h('div', { class: 'field' }, h('span', null, t('Which of these do you know well from your own life?')), multi('contexts', CONTEXTS)),
      h('div', { class: 'field' }, h('span', null, t('I would enjoy examples and stories from…')), multi('regions', [['africa', '🌍', 'Africa'], ['asia', '🌏', 'Asia'], ['europe', '🏰', 'Europe'], ['namerica', '🗽', 'North America'], ['samerica', '🏞️', 'South America'], ['oceania', '🏝️', 'Australia and Oceania'], ['all', '🌐', 'Everywhere']])),
      h('div', { class: 'field' }, h('span', null, t('Languages I use at home or school')), multi('langs', LANGS.map((l) => [l.code, l.flag, l.name]).concat([['other', '💬', 'Another language']]))),
      h('div', { class: 'field' }, h('span', null, t('My internet connection is…')), single('access', [['always', 'almost always on'], ['some', 'on some of the time'], ['rare', 'rarely available']])),
      h('div', { class: 'field' }, h('span', null, t('I am here to…')), multi('goals', [['fun', '🎉', 'have fun'], ['school', '🏫', 'do better at school'], ['curious', '🔎', 'explore what interests me'], ['future', '🧭', 'prepare for a future job'], ['catchup', '🪜', 'catch up on things I missed']])),
      h('div', { class: 'field' }, h('span', null, t('These would help me')), multi('needs', [['big', '🔠', 'Bigger text'], ['aloud', '🔊', 'Things read aloud'], ['time', '⏳', 'No time limits'], ['contrast', '🌗', 'Stronger contrast'], ['calm', '🍃', 'Less movement on screen'], ['spacing', '↔️', 'More space between letters']])),
      h('div', { class: 'row' }, h('button', { class: 'btn', onClick: () => done(false) }, t('Save and continue'), ' →'), h('button', { class: 'btn ghost', onClick: () => done(true) }, t('Skip for now'))),
      h('p', { class: 'tiny muted mt' }, t('The game never asks about race, ethnicity, religion or family income, and never guesses them. Neither background nor identity decides anyone\'s ability to learn.'))));
}

// ---------- change my character (any time after sign-up) ----------
export function editLook(main) {
  const p = profile;
  const draft = { avatar: { ...p.avatar }, cast: p.cast || 0 };
  for (const k of ['skin', 'hair', 'hairColor', 'outfit']) if (draft.avatar[k] == null) draft.avatar[k] = 0;
  const box = h('div', { class: 'card', style: { maxWidth: '640px', margin: '0 auto' } });
  main.append(h('div', { class: 'hero mb' }, h('h1', null, '🧑‍🎨 ', t('Change my character')), h('p', { class: 'muted' }, t('Try as many looks as you like. Nothing changes until you press Save.'))), box);
  const draw = () => {
    const swatches = (key, cols) => h('div', { class: 'row' }, cols.map((c, i) => h('button', { class: 'chip', 'aria-label': `${key} ${i + 1}`, 'aria-pressed': String(draft.avatar[key] === i), style: { background: c, width: '40px', height: '40px', padding: 0 }, onClick: () => { draft.avatar[key] = i; draw(); } })));
    clear(box).append(
      h('div', { class: 'row center' }, avatarEl(draft.avatar, { band: p.band, role: 'student', size: 'xl', cast: draft.cast, emblem: Object.values(p.worlds).some((w) => w.completed.length) })),
      lookChoice(draft.avatar, draw),
      h('div', { class: 'field' }, h('span', null, t('Skin')), swatches('skin', SKINS)),
      hairPicker(draft.avatar, p.band, draft.cast, draw),
      h('div', { class: 'field' }, h('span', null, t('Hair colour')), swatches('hairColor', HAIR_COLORS)),
      h('div', { class: 'field' }, h('span', null, t('Uniform colour')), swatches('outfit', OUTFITS)),
      h('div', { class: 'field' }, h('span', null, t('Style of your teachers and masters')), h('div', { class: 'row' }, CAST_THEMES.map((c, i) => h('button', { class: 'chip', 'aria-pressed': String(draft.cast === i), onClick: () => { draft.cast = i; draw(); } }, c.em, ' ', t(c.name))))),
      h('div', { class: 'row' },
        h('button', { class: 'btn ghost', onClick: () => { draft.avatar = randomAvatar(Math.random, draft.avatar.g || 'n'); draw(); } }, '🎲 ', t('Surprise me')),
        h('button', { class: 'btn', onClick: () => { p.avatar = { ...draft.avatar }; p.cast = draft.cast; save(true); syncMeta(); sfx('ok'); toast('✨ ' + t('Your new look is saved.')); go('dashboard'); } }, '💾 ', t('Save')),
        h('button', { class: 'btn ghost', onClick: () => history.length > 1 ? go('dashboard') : go('home') }, t('Cancel'))));
  };
  draw();
}
