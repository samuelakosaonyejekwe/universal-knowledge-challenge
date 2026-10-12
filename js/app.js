// App shell: routing, top bar with back/forward, bottom navigation, install, offline status, wellbeing breaks.
import { h, clear, $, modal, toast, pick } from './core/util.js';
import { t, setLang, LANGS } from './core/i18n.js';
import { device, profile, resume, saveDevice, addTime, onChange, worldId } from './core/store.js';
import { breakDue, tookBreak, dailyLimitReached, BREAK_IDEAS, checkGuardianPin } from './core/safety.js';
import { unlockAudio, startMusic, stopMusic, sfx } from './core/audio.js';
import { stopSpeaking } from './core/speech.js';
import { avatarEl } from './core/avatar.js';
import { backgroundRefresh } from './core/live.js';
import { world } from './data/worlds.js';

const routes = {
  welcome: () => import('./views/onboarding.js').then((m) => m.welcome),
  join: () => import('./views/onboarding.js').then((m) => m.join),
  signin: () => import('./views/onboarding.js').then((m) => m.signin),
  learntest: () => import('./views/onboarding.js').then((m) => m.learnTest),
  about: () => import('./views/onboarding.js').then((m) => m.aboutYou),
  rules: () => import('./views/onboarding.js').then((m) => m.rules),
  home: () => import('./views/home.js').then((m) => m.home),
  world: () => import('./views/world.js').then((m) => m.worldView),
  stage: () => import('./views/stage.js').then((m) => m.stageView),
  finale: () => import('./views/finale.js').then((m) => m.finaleView),
  placement: () => import('./views/finale.js').then((m) => m.placementView),
  memory: () => import('./views/memory.js').then((m) => m.memoryView),
  arena: () => import('./views/arena.js').then((m) => m.arenaView),
  dashboard: () => import('./views/dashboard.js').then((m) => m.dashboardView),
  settings: () => import('./views/settings.js').then((m) => m.settingsView),
  lab: () => import('./views/world.js').then((m) => m.labView),
};
const OPEN = new Set(['welcome', 'join', 'signin']); // reachable without a profile

const main = $('#main'), top = $('#top'), nav = $('#nav');
let cleanup = null, currentWorld = null;

// ---------- back / forward ----------
let idx = history.state?.i ?? 0, maxIdx = +(sessionStorage.getItem('ukc.max') || idx);
if (history.state?.i == null) history.replaceState({ i: idx }, '');
addEventListener('popstate', (e) => { idx = e.state?.i ?? 0; });
function pushed() { idx++; maxIdx = idx; sessionStorage.setItem('ukc.max', String(maxIdx)); history.replaceState({ i: idx }, ''); }

function drawTop() {
  clear(top);
  const back = h('button', { class: 'navbtn dir', title: t('Back'), 'aria-label': t('Back'), disabled: idx <= 0, onClick: () => history.back() }, '◀');
  const fwd = h('button', { class: 'navbtn dir', title: t('Forward'), 'aria-label': t('Forward'), disabled: idx >= maxIdx, onClick: () => history.forward() }, '▶');
  const w = currentWorld ? world(worldId(currentWorld)) : null;
  const brand = h('button', { class: 'brand', onClick: () => { location.hash = profile ? '#/home' : '#/welcome'; } },
    h('img', { class: 'logo', src: 'icons/icon.svg', alt: '' }), h('span', null, w ? `${w.em} ${t(w.short)}` : t('Universal Knowledge Challenge')));
  top.append(back, fwd, brand);
  const dark = themeNow() === 'dark';
  top.append(h('button', { class: 'pill', title: dark ? t('Light mode') : t('Dark mode'), 'aria-label': dark ? t('Light mode') : t('Dark mode'), onClick: () => setTheme(dark ? 'light' : 'dark') }, dark ? '☀️' : '🌙'));
  if (profile) {
    if (w && profile.worlds[currentWorld]) top.append(h('span', { class: 'pill gold', title: t(w.credit) }, w.creditEm, ' ', String(profile.worlds[currentWorld].credits)));
    const music = h('button', { class: 'pill', title: t('Music'), 'aria-label': t('Music'), 'aria-pressed': String(profile.settings.music), onClick: () => { profile.settings.music = !profile.settings.music; if (profile.settings.music && currentWorld) startMusic(worldId(currentWorld)); else stopMusic(); drawTop(); } }, profile.settings.music ? '🎵' : '🔇');
    const ava = avatarEl(profile.avatar, { band: profile.band, role: 'student', size: 'sm', emblem: Object.values(profile.worlds).some((x) => x.completed.length) });
    ava.setAttribute('role', 'button'); ava.tabIndex = 0; ava.title = profile.name; ava.style.cursor = 'pointer';
    ava.addEventListener('click', () => { location.hash = '#/dashboard'; });
    top.append(music, ava);
  }
}
function drawNav(route) {
  clear(nav);
  nav.hidden = !profile || !profile.learn;
  if (nav.hidden) return;
  for (const [r, ic, label] of [['home', '🌍', 'Worlds'], ['memory', '🧠', 'Memory'], ['arena', '⚔️', 'Arena'], ['dashboard', '📊', 'Progress'], ['settings', '⚙️', 'Settings']]) {
    nav.append(h('a', { href: '#/' + r, 'aria-current': route === r ? 'page' : null }, h('span', { class: 'ic' }, ic), t(label)));
  }
}

// ---------- routing ----------
let lastHash = null;
async function route() {
  const hash = location.hash.replace(/^#\/?/, '');
  if (lastHash !== null && history.state?.i == null) pushed();
  lastHash = hash;
  let [name, ...params] = hash.split('/').map(decodeURIComponent);
  if (!name) name = profile ? 'home' : 'welcome';
  if (!profile && !OPEN.has(name)) { location.replace('#/welcome'); return; }
  if (profile && !OPEN.has(name)) {
    // Everyone finishes the short first steps before the worlds open.
    const need = !profile.pledged ? 'rules' : !profile.learn ? 'learntest' : null;
    if (need && name !== need && name !== 'about') { location.replace('#/' + need); return; }
  }
  if (!routes[name]) name = profile ? 'home' : 'welcome';
  try { cleanup?.(); } catch (e) { console.error(e); }
  cleanup = null; stopSpeaking();
  currentWorld = ['world', 'stage', 'finale', 'placement', 'lab'].includes(name) ? params[0] : null;
  const w = currentWorld ? world(worldId(currentWorld)) : null;
  document.documentElement.style.setProperty('--pri', w ? w.c1 : '#4f5bd5');
  document.documentElement.style.setProperty('--pri2', w ? w.c2 : '#8a5cf6');
  if (w && profile?.settings.music) startMusic(w.id); else stopMusic();
  drawTop(); drawNav(name);
  clear(main).append(h('div', { class: 'spinner' }));
  scrollTo(0, 0);
  try {
    const view = await routes[name]();
    clear(main);
    cleanup = (await view(main, params)) || null;
  } catch (e) {
    console.error(e);
    clear(main).append(h('div', { class: 'card center' }, h('div', { class: 'huge' }, '🛠️'), h('h2', null, t('Something went wrong on this page')), h('p', { class: 'muted small' }, String(e.message || e)), h('a', { class: 'btn', href: '#/home' }, t('Back to the worlds'))));
  }
  main.focus({ preventScroll: true });
}
addEventListener('hashchange', route);
onChange(() => { if (top.isConnected) drawTop(); });

// ---------- accessibility preferences ----------
const darkQuery = matchMedia('(prefers-color-scheme: dark)');
export const themeNow = () => ((device.theme || 'auto') === 'auto' ? (darkQuery.matches ? 'dark' : 'light') : device.theme);
export function setTheme(mode) { device.theme = mode; saveDevice(); applySettings(); if (top.isConnected) drawTop(); }
darkQuery.addEventListener?.('change', () => { applySettings(); if (top.isConnected) drawTop(); });
export function applySettings() {
  const r = document.documentElement, s = profile?.settings;
  r.dataset.theme = themeNow();
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeNow() === 'dark' ? '#151a36' : '#4f5bd5');
  document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', themeNow());
  r.dataset.size = s?.size || 'm'; r.dataset.contrast = s?.contrast || 'normal'; r.dataset.spacing = s?.spacing || 'normal'; r.dataset.motion = s?.motion || 'on';
}

// ---------- install ----------
let deferredInstall = null;
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredInstall = e; document.dispatchEvent(new Event('ukc-installable')); });
export const isInstalled = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
export const canPromptInstall = () => !!deferredInstall;
export async function installApp() {
  if (deferredInstall) { deferredInstall.prompt(); await deferredInstall.userChoice; deferredInstall = null; return; }
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  modal(h('div', null, h('h2', null, '📲 ', t('Install on this device')),
    ios ? h('ol', null, h('li', null, t('Tap the Share button in Safari.')), h('li', null, t('Choose "Add to Home Screen".')), h('li', null, t('Tap "Add". The game now opens like any other app, even offline.')))
      : h('ol', null, h('li', null, t('Open your browser menu (⋮ or ☰).')), h('li', null, t('Choose "Install app" or "Add to Home screen".')), h('li', null, t('The game now opens like any other app, even offline.'))),
    h('p', { class: 'small muted' }, t('Once installed, everything you have opened works in airplane mode. Use "Download all lessons" in Settings to save every world.'))));
}

// ---------- wellbeing: time tracking, breaks, daily limit ----------
setInterval(() => {
  if (document.hidden || !profile) return;
  addTime(15000);
  if (document.querySelector('.modal-back')) return;
  if (dailyLimitReached()) return limitScreen();
  if (breakDue() && !document.querySelector('.arena')) breakScreen();
}, 15000);
function breakScreen() {
  tookBreak(); sfx('step');
  const close = modal(h('div', { class: 'center' }, h('div', { class: 'huge' }, '🌤️'), h('h2', null, t('Time for a short break')),
    h('p', null, t('Your brain keeps working on what you learned while you rest.')), h('p', { class: 'note' }, t(pick(BREAK_IDEAS))),
    h('button', { class: 'btn', onClick: () => close() }, t('I am back'))));
}
function limitScreen() {
  const input = h('input', { class: 'input', type: 'password', inputmode: 'numeric', 'aria-label': t('Guardian PIN') });
  const close = modal(h('div', { class: 'center' }, h('div', { class: 'huge' }, '🌙'), h('h2', null, t('That is all for today')),
    h('p', null, t('You reached the play time your guardian set. Great work — come back tomorrow!')),
    h('p', { class: 'note' }, t(pick(BREAK_IDEAS))),
    profile.guardian ? h('div', { class: 'row center' }, input, h('button', { class: 'btn ghost sm', onClick: async () => { if (await checkGuardianPin(input.value)) { profile.settings.dailyMins = 0; close(); toast(t('Limit lifted for today.')); } } }, t('Guardian: allow more time'))) : h('button', { class: 'btn', onClick: () => close() }, t('OK'))), { dismiss: false });
}

// ---------- boot ----------
async function boot() {
  resume();
  const guess = (navigator.language || 'en').slice(0, 2).toLowerCase();
  await setLang(profile?.lang || device.lang || (LANGS.some((l) => l.code === guess) ? guess : 'en'));
  applySettings();
  addEventListener('pointerdown', unlockAudio, { once: true });
  addEventListener('keydown', unlockAudio, { once: true });
  const bar = $('#offline');
  const net = () => { bar.hidden = navigator.onLine; bar.textContent = '✈️ ' + t('Offline — everything already on this device still works.'); };
  addEventListener('online', net); addEventListener('offline', net); net();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').then((reg) => {
      reg.addEventListener('updatefound', () => { const nw = reg.installing; nw?.addEventListener('statechange', () => { if (nw.state === 'installed' && navigator.serviceWorker.controller) toast(t('A fresh version is ready — it loads next time you open the game.'), 5000); }); });
      if ('periodicSync' in reg) reg.periodicSync.register('ukc-refresh', { minInterval: 12 * 3600000 }).catch(() => {});
    }).catch(() => {});
  }
  await route();
  setTimeout(() => backgroundRefresh().catch(() => {}), 8000);
}
export async function changeLanguage(code) {
  device.lang = code; saveDevice();
  if (profile) { profile.lang = code; }
  await setLang(code);
  route();
}
export const rerender = route;
boot();
