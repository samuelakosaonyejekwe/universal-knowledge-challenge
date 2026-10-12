import { h, button } from '../core/labkit.js';

// [greeting, [1..5], please, thank you, how much]  and optional romanisation in R
const P = {
  en: { v: 'en-GB', g: 'Hello', n: ['one', 'two', 'three', 'four', 'five'], pl: 'Please', th: 'Thank you', hm: 'How much is it?' },
  es: { v: 'es-ES', g: 'Hola', n: ['uno', 'dos', 'tres', 'cuatro', 'cinco'], pl: 'Por favor', th: 'Gracias', hm: '¿Cuánto cuesta?' },
  fr: { v: 'fr-FR', g: 'Bonjour', n: ['un', 'deux', 'trois', 'quatre', 'cinq'], pl: "S'il vous plaît", th: 'Merci', hm: "C'est combien ?" },
  ar: { v: 'ar-SA', g: 'مرحبا', n: ['واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة'], pl: 'من فضلك', th: 'شكرا', hm: 'بكم هذا؟',
    r: { g: 'marhaban', n: ['wāḥid', 'ithnān', 'thalātha', 'arbaʿa', 'khamsa'], pl: 'min faḍlak', th: 'shukran', hm: 'bikam hādhā?' } },
  ru: { v: 'ru-RU', g: 'Здравствуйте', n: ['один', 'два', 'три', 'четыре', 'пять'], pl: 'Пожалуйста', th: 'Спасибо', hm: 'Сколько стоит?',
    r: { g: 'Zdravstvuyte', n: ['odin', 'dva', 'tri', 'chetyre', 'pyat’'], pl: 'Pozhaluysta', th: 'Spasibo', hm: 'Skol’ko stoit?' } },
  he: { v: 'he-IL', g: 'שלום', n: ['אחת', 'שתיים', 'שלוש', 'ארבע', 'חמש'], pl: 'בבקשה', th: 'תודה', hm: 'כמה זה עולה?',
    r: { g: 'shalom', n: ['achat', 'shtayim', 'shalosh', 'arba', 'chamesh'], pl: 'bevakasha', th: 'toda', hm: 'kama ze ole?' } },
  it: { v: 'it-IT', g: 'Buongiorno', n: ['uno', 'due', 'tre', 'quattro', 'cinque'], pl: 'Per favore', th: 'Grazie', hm: 'Quanto costa?' },
  el: { v: 'el-GR', g: 'Γεια σας', n: ['ένα', 'δύο', 'τρία', 'τέσσερα', 'πέντε'], pl: 'Παρακαλώ', th: 'Ευχαριστώ', hm: 'Πόσο κάνει;',
    r: { g: 'Ya sas', n: ['éna', 'dío', 'tría', 'tésera', 'pénte'], pl: 'Parakaló', th: 'Efharistó', hm: 'Póso káni?' } },
  tr: { v: 'tr-TR', g: 'Merhaba', n: ['bir', 'iki', 'üç', 'dört', 'beş'], pl: 'Lütfen', th: 'Teşekkür ederim', hm: 'Bu ne kadar?' },
  pt: { v: 'pt-PT', g: 'Olá', n: ['um', 'dois', 'três', 'quatro', 'cinco'], pl: 'Por favor', th: 'Obrigado / Obrigada', hm: 'Quanto custa?' },
  zh: { v: 'zh-CN', g: '你好', n: ['一', '二', '三', '四', '五'], pl: '请', th: '谢谢', hm: '多少钱？',
    r: { g: 'nǐ hǎo', n: ['yī', 'èr', 'sān', 'sì', 'wǔ'], pl: 'qǐng', th: 'xièxie', hm: 'duōshao qián?' } },
  ja: { v: 'ja-JP', g: 'こんにちは', n: ['一', '二', '三', '四', '五'], pl: 'お願いします', th: 'ありがとう', hm: 'いくらですか？',
    r: { g: 'konnichiwa', n: ['ichi', 'ni', 'san', 'yon', 'go'], pl: 'onegai shimasu', th: 'arigatō', hm: 'ikura desu ka?' } },
};
export const PHRASES = P;

export default {
  id: 'w10-market-day',
  world: 10,
  levels: [5, 6],
  kind: 'tour',
  icon: '🧺',
  title: 'Market Day',
  goal: 'Buy fruit at the market by saying the right phrase at each step.',
  limits: 'Only a few polite, common phrases (hello, numbers 1 to 5, please, thank you, how much) in a standard form; real speech has many more ways to say them, formal and informal. Voice playback depends on your device.',
  mount(root, api) {
    const t = api.t;
    const L = P[api.lang] ? api.lang : 'es';
    const D = P[L], R = D.r || null;
    const fruit = [['🍎', 'apples'], ['🍌', 'bananas'], ['🍊', 'oranges'], ['🍐', 'pears']][Math.floor(api.rng() * 4)];
    const qty = 2 + Math.floor(api.rng() * 4);
    const rtl = L === 'ar' || L === 'he';
    const say = (txt) => { try { window.speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(txt); u.lang = D.v; window.speechSynthesis.speak(u); } catch { /* no voice */ } };
    const label = (key, i) => { const w = key === 'n' ? D.n[i] : D[key]; const r = R ? (key === 'n' ? R.n[i] : R[key]) : null; return r ? `${w}  (${r})` : w; };
    const wrongNums = () => { const o = [0, 1, 2, 3, 4].filter((k) => k !== qty - 1); return o.sort(() => api.rng() - 0.5).slice(0, 2); };
    const steps = [
      { q: t('You reach the stall. How do you greet the seller?'), opts: [['g'], ['th'], ['pl']], right: 'g', reply: () => D.g },
      { q: `${t('You want')} ${qty} ${fruit[1]} ${fruit[0]}. ${t('How do you ask the price?')}`, opts: [['hm'], ['g'], ['th']], right: 'hm', reply: () => label('n', qty - 1) },
      { q: `${t('The seller says the price is')} “${label('n', qty - 1)}”. ${t('Which number is that?')}`, num: true, reply: () => '' },
      { q: t('You are ready to ask for your fruit politely. Which word do you add?'), opts: [['pl'], ['hm'], ['g']], right: 'pl', reply: () => '' },
      { q: t('The seller hands you the bag. What do you say?'), opts: [['th'], ['hm'], ['pl']], right: 'th', reply: () => '' },
    ];
    let si = 0, correct = 0, tried = false, chosen = null, finished = false;
    const body = h('div', { class: 'lab', dir: rtl ? 'rtl' : 'ltr' });
    const bubble = h('div', { class: 'note' });
    const out = h('div', { class: 'note', 'aria-live': 'polite' });

    function render() {
      if (si >= steps.length) {
        const score = correct / steps.length;
        body.replaceChildren(h('div', { class: 'card', style: { textAlign: 'center', fontSize: '1.2rem' } }, `🧺 ${fruit[0]} ×${qty}`, h('br'), `${correct} / ${steps.length} ${t('right first time')}`),
          h('div', { class: 'small' }, t('Your phrasebook:')),
          h('ul', { class: 'small' }, ...['g', 'pl', 'th', 'hm'].map((k) => h('li', null, `${label(k)}`)), h('li', null, D.n.map((w, i) => `${i + 1} ${w}`).join(' · '))),
          button(t('Play again'), () => { si = 0; correct = 0; finished = false; render(); }));
        if (!finished) { finished = true; api.say(t('Using polite words like please and thank you makes shopping friendlier in any language.')); api.complete(score, `Market role-play: ${correct}/${steps.length} first-try.`); }
        return;
      }
      const s = steps[si]; tried = false;
      let opts;
      if (s.num) { const idx = [qty - 1, ...wrongNums()].sort(() => api.rng() - 0.5); opts = idx.map((k) => [`${k + 1}`, String(k + 1), k === qty - 1]); }
      else opts = s.opts.map(([k]) => [k, label(k), k === s.right]).sort(() => api.rng() - 0.5);
      body.replaceChildren(
        h('div', { class: 'small muted' }, `${si + 1} / ${steps.length} · ${t('Pick before you hear it.')}`),
        h('div', { class: 'lab-goal' }, `🧑‍🌾 ${s.q}`),
        ...opts.map(([k, text, ok]) => h('button', { class: 'btn ghost block', type: 'button', style: { fontSize: '1.15rem', justifyContent: 'flex-start' }, onClick: () => answer(ok, text) }, text)),
        bubble, out);
      bubble.textContent = ''; out.textContent = ''; out.className = 'note';
    }
    function answer(ok, text) {
      const s = steps[si];
      if (ok) {
        if (!tried) correct++;
        out.className = 'note ok'; out.textContent = `${t('Yes!')} “${text}”`; say(text.split('(')[0]);
        if (s.reply() ) bubble.textContent = `🧑‍🌾 ${s.reply()}`;
        body.append(button(t('Next'), () => { si++; render(); }));
        body.querySelectorAll('button.btn.ghost').forEach((b) => { b.disabled = true; });
      } else { tried = true; out.className = 'note warn'; out.textContent = t('Not this one. Think about when you would say it, then try again.'); }
    }
    root.append(body); render();
    api.say(t('Tap the phrase you think fits. If you are unsure, tap it to hear it and learn!'));
    return () => { try { window.speechSynthesis.cancel(); } catch { /* none */ } };
  },
};
