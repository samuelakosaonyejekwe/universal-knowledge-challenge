// Draws every character as an original SVG portrait. The drawing style follows the player's age band
// (storybook for the youngest, cartoon, then cleaner styles for teens and adults), and the player picks the look.
import { rngFrom, h } from './util.js';

export const SKINS = ['#fde0c8', '#f3c6a0', '#e0a878', '#c68652', '#9a5f38', '#6b4226'];
export const HAIR_COLORS = ['#1f1a17', '#4a2f1d', '#8a5a2b', '#d9a441', '#b5432e', '#5b6170', '#7b4bd6', '#1d8fa8'];
export const OUTFITS = ['#4f5bd5', '#17a673', '#e0662a', '#d6336c', '#8a5cf6', '#1f8fe5', '#f5b700', '#2f9e44'];
export const HAIR_STYLES = 8;
export const CAST_THEMES = [
  { name: 'Storybook', em: '📖', bg: ['#ffe9f3', '#ffd0e4'] }, { name: 'Explorer', em: '🧭', bg: ['#e3f7e8', '#c4ecd0'] },
  { name: 'Starship', em: '🚀', bg: ['#dfe6ff', '#c3ccff'] }, { name: 'Classic', em: '🎓', bg: ['#fff3d6', '#ffe2a6'] },
];

function hairPath(style, band) {
  const big = band === 'tiny' ? 1.08 : 1;
  switch (style) {
    case 0: return `<path d="M22 46 Q20 16 50 14 Q80 16 78 46 Q72 28 50 28 Q28 28 22 46Z"/>`; // short
    case 1: return `<path d="M20 50 Q14 14 50 12 Q86 14 80 50 L80 72 Q74 76 72 50 Q70 30 50 30 Q30 30 28 50 Q26 76 20 72Z"/>`; // long
    case 2: return `<circle cx="50" cy="26" r="${24 * big}"/><circle cx="26" cy="38" r="12"/><circle cx="74" cy="38" r="12"/>`; // afro / curls
    case 3: return `<path d="M22 44 Q22 14 50 14 Q78 14 78 44 Q66 30 50 32 Q34 30 22 44Z"/><circle cx="50" cy="10" r="9"/>`; // bun
    case 4: return `<path d="M22 46 Q20 14 50 14 Q80 14 78 46 Q70 30 50 30 Q30 30 22 46Z"/><path d="M20 44 Q8 60 16 80 Q24 70 24 50Z"/><path d="M80 44 Q92 60 84 80 Q76 70 76 50Z"/>`; // pigtails / braids
    case 5: return `<path d="M24 40 Q26 12 50 10 Q74 12 76 40 L68 30 L60 38 L50 28 L40 38 L32 30Z"/>`; // spiky
    case 6: return `<path d="M20 52 Q12 12 50 12 Q88 12 80 52 Q80 30 50 26 Q20 30 20 52Z"/><path d="M20 50 Q18 66 24 70 L26 46Z"/><path d="M80 50 Q82 66 76 70 L74 46Z"/>`; // head covering / hood shape
    default: return `<path d="M26 40 Q28 20 50 18 Q72 20 74 40 Q62 30 50 31 Q38 30 26 40Z"/>`; // close crop
  }
}

// cfg: { seed } or explicit { skin, hair, hairColor, outfit }. opts: { band, role, cast, emblem }.
export function avatarSVG(cfg = {}, opts = {}) {
  const rng = rngFrom('ava' + (cfg.seed ?? JSON.stringify(cfg)));
  const r = (n) => Math.floor(rng() * n);
  const skin = SKINS[cfg.skin ?? r(SKINS.length)];
  const style = cfg.hair ?? r(HAIR_STYLES);
  const hairCol = HAIR_COLORS[cfg.hairColor ?? r(opts.role === 'student' ? HAIR_COLORS.length : 6)];
  const outfit = OUTFITS[cfg.outfit ?? r(OUTFITS.length)];
  const band = opts.band || 'kid', role = opts.role || 'student';
  const theme = CAST_THEMES[(opts.cast ?? 0) % CAST_THEMES.length];
  const tiny = band === 'tiny', kid = band === 'kid';
  // Younger bands: bigger head and eyes, rosy cheeks. Older bands: calmer proportions.
  const eyeR = tiny ? 6.2 : kid ? 5 : 3.6, eyeY = tiny ? 47 : 46, gap = tiny ? 13 : 12;
  const head = tiny ? 27 : kid ? 25.5 : 24;
  const older = role !== 'student' && role !== 'peer';
  const id = 'g' + Math.floor(rng() * 1e9).toString(36);
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${role === 'master' ? '#3b2f66' : theme.bg[0]}"/><stop offset="1" stop-color="${role === 'master' ? '#17122b' : theme.bg[1]}"/></linearGradient></defs>`;
  s += `<rect width="100" height="100" fill="url(#${id})"/>`;
  if (role === 'master') s += `<path d="M10 100 Q14 66 50 64 Q86 66 90 100Z" fill="#7a1f3d"/><path d="M30 70 L50 64 L70 70 L64 100 L36 100Z" fill="${outfit}"/><path d="M38 66 L50 80 L62 66" fill="none" stroke="#ffcf5c" stroke-width="3"/>`;
  else if (role === 'doctor') s += `<path d="M12 100 Q16 68 50 66 Q84 68 88 100Z" fill="#ffffff" stroke="#cfd6ea"/><path d="M42 68 L50 82 L58 68" fill="${outfit}"/><path d="M36 72 Q30 88 42 90" fill="none" stroke="#5b6585" stroke-width="2.2"/><circle cx="43" cy="90" r="3" fill="#5b6585"/>`;
  else s += `<path d="M12 100 Q16 68 50 66 Q84 68 88 100Z" fill="${outfit}"/><path d="M42 67 Q50 76 58 67" fill="${skin}"/>`;
  if (role === 'teacher') s += `<path d="M44 70 L50 78 L56 70 L53 96 L47 96Z" fill="#fff" opacity=".85"/>`;
  s += `<rect x="44" y="60" width="12" height="10" rx="4" fill="${skin}"/>`;
  s += `<circle cx="${50 - head + 1}" cy="48" r="4.5" fill="${skin}"/><circle cx="${50 + head - 1}" cy="48" r="4.5" fill="${skin}"/>`;
  s += `<ellipse cx="50" cy="44" rx="${head}" ry="${head + 1}" fill="${skin}"/>`;
  s += `<g fill="${older && rng() < 0.25 ? '#b9bfcc' : hairCol}">${hairPath(style, band)}</g>`;
  // eyes
  for (const x of [50 - gap, 50 + gap]) {
    s += `<circle cx="${x}" cy="${eyeY}" r="${eyeR}" fill="#fff"/><circle cx="${x + 0.6}" cy="${eyeY + 0.5}" r="${eyeR * 0.62}" fill="#2a2140"/><circle cx="${x + 1.8}" cy="${eyeY - 1.4}" r="${eyeR * 0.24}" fill="#fff"/>`;
    if (tiny) s += `<circle cx="${x - 1.2}" cy="${eyeY + 1.8}" r="${eyeR * 0.14}" fill="#fff"/>`;
  }
  if (role === 'master') s += `<path d="M${50 - gap - 7} ${eyeY - 9} L${50 - gap + 6} ${eyeY - 6}" stroke="#2a2140" stroke-width="2.4" stroke-linecap="round"/><path d="M${50 + gap + 7} ${eyeY - 9} L${50 + gap - 6} ${eyeY - 6}" stroke="#2a2140" stroke-width="2.4" stroke-linecap="round"/>`;
  if (tiny || kid) s += `<ellipse cx="${50 - gap - 3}" cy="56" rx="4.5" ry="2.8" fill="#ff8fa3" opacity=".5"/><ellipse cx="${50 + gap + 3}" cy="56" rx="4.5" ry="2.8" fill="#ff8fa3" opacity=".5"/>`;
  // mouth: masters smirk, everyone else smiles
  s += role === 'master' ? `<path d="M43 59 Q52 61 58 56" fill="none" stroke="#7a2e2e" stroke-width="2.2" stroke-linecap="round"/>` : `<path d="M42 57 Q50 ${tiny ? 67 : 64} 58 57" fill="${tiny || kid ? '#fff' : 'none'}" stroke="#7a2e2e" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`;
  if ((role === 'teacher' || role === 'doctor') && rng() < 0.7) s += `<g fill="none" stroke="#2a2140" stroke-width="1.8"><circle cx="${50 - gap}" cy="${eyeY}" r="${eyeR + 3}"/><circle cx="${50 + gap}" cy="${eyeY}" r="${eyeR + 3}"/><path d="M${50 - gap + eyeR + 3} ${eyeY} L${50 + gap - eyeR - 3} ${eyeY}"/></g>`;
  if (role === 'layman') s += `<path d="M24 30 Q50 6 76 30 L82 34 L18 34Z" fill="${outfit}" opacity=".95"/><text x="50" y="92" text-anchor="middle" font-size="13">❓</text>`;
  if (opts.emblem) s += `<g transform="translate(66 78)"><circle r="9" fill="#f5b700" stroke="#fff3c4" stroke-width="2"/><path d="M0 -5.5 L1.6 -1.7 L5.6 -1.7 L2.4 0.9 L3.5 5 L0 2.6 L-3.5 5 L-2.4 0.9 L-5.6 -1.7 L-1.6 -1.7Z" fill="#fff"/></g>`;
  return s + '</svg>';
}

export function avatarEl(cfg, opts = {}) {
  const el = h('div', { class: 'ava' + (opts.size ? ' ' + opts.size : '') + (opts.emblem ? ' emblem' : '') });
  el.innerHTML = avatarSVG(cfg, opts);
  return el;
}

export function randomAvatar(rng = Math.random) {
  const r = (n) => Math.floor(rng() * n);
  return { skin: r(SKINS.length), hair: r(HAIR_STYLES), hairColor: r(HAIR_COLORS.length), outfit: r(OUTFITS.length) };
}
