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

const EYES = ['#5b3a1e', '#6b4a2a', '#3f6b4f', '#3d6f9c', '#7a5a2e', '#4a4f6b'];
// Lighter (amt > 0) or darker (amt < 0) version of a colour.
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v) => Math.max(0, Math.min(255, Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt))));
  return '#' + [n >> 16, (n >> 8) & 255, n & 255].map((v) => ch(v).toString(16).padStart(2, '0')).join('');
}

// Hair drawn in two layers: `back` sits behind the head and shoulders, `front` frames the face.
function hair(style, c, hi) {
  const shine = (d) => `<path d="${d}" fill="none" stroke="${hi}" stroke-width="2.2" stroke-linecap="round" opacity=".75"/>`;
  switch (style) {
    case 0: return { back: `<path d="M24 46 C20 18 80 16 78 46 C78 56 74 60 72 62 L28 62 C24 58 24 52 24 46Z" fill="${c}"/>`,
      front: `<path d="M25 44 C24 22 52 14 66 20 C76 24 79 36 76 46 C72 34 62 28 46 30 C36 31 28 36 25 44Z" fill="${c}"/>${shine('M36 27 C46 21 58 21 66 26')}` };
    case 1: return { back: `<path d="M22 44 C16 10 84 10 78 44 C82 62 88 78 80 96 L20 96 C12 78 18 62 22 44Z" fill="${c}"/>${shine('M24 60 C20 72 20 84 23 93')}${shine('M78 62 C82 74 81 84 78 92')}`,
      front: `<path d="M25 46 C22 22 46 14 60 18 C74 20 80 34 76 48 C72 36 64 30 54 30 C50 36 36 38 25 46Z" fill="${c}"/>${shine('M34 28 C42 22 54 21 62 24')}` };
    case 2: return { back: `<g fill="${c}"><circle cx="50" cy="28" r="26"/><circle cx="26" cy="36" r="14"/><circle cx="74" cy="36" r="14"/><circle cx="24" cy="54" r="11"/><circle cx="76" cy="54" r="11"/><circle cx="36" cy="14" r="12"/><circle cx="64" cy="14" r="12"/></g>`,
      front: `<path d="M27 42 C28 28 40 22 50 23 C60 22 72 28 73 42 C66 34 58 31 50 32 C42 31 34 34 27 42Z" fill="${c}"/><g fill="${hi}" opacity=".5"><circle cx="38" cy="16" r="3"/><circle cx="60" cy="12" r="3"/><circle cx="74" cy="30" r="2.6"/><circle cx="26" cy="32" r="2.6"/></g>` };
    case 3: return { back: `<circle cx="50" cy="10" r="11" fill="${c}"/><path d="M24 46 C22 20 78 20 76 46 L72 58 L28 58Z" fill="${c}"/>`,
      front: `<path d="M25 45 C24 24 44 17 54 18 C68 19 78 30 76 46 C70 36 62 30 50 31 C40 31 30 36 25 45Z" fill="${c}"/>${shine('M43 9 C47 5 54 5 57 9')}${shine('M36 27 C44 22 56 22 64 26')}<path d="M40 19 Q50 14 60 19" fill="none" stroke="#ff8fa3" stroke-width="2.6" stroke-linecap="round"/>` };
    case 4: return { back: `<path d="M24 46 C22 18 78 18 76 46 L72 58 L28 58Z" fill="${c}"/><g fill="${c}"><ellipse cx="17" cy="62" rx="7" ry="9"/><ellipse cx="15" cy="78" rx="6.5" ry="8.5"/><ellipse cx="14" cy="92" rx="5.5" ry="7"/><ellipse cx="83" cy="62" rx="7" ry="9"/><ellipse cx="85" cy="78" rx="6.5" ry="8.5"/><ellipse cx="86" cy="92" rx="5.5" ry="7"/></g><g fill="#ffcf5c"><circle cx="19" cy="54" r="3.2"/><circle cx="81" cy="54" r="3.2"/></g>`,
      front: `<path d="M25 45 C24 22 76 22 75 45 C68 32 58 29 50 36 C42 29 32 32 25 45Z" fill="${c}"/>${shine('M34 28 C40 23 46 23 50 28')}${shine('M54 27 C60 23 66 24 70 30')}` };
    case 5: return { back: `<path d="M24 46 C22 22 78 22 76 46 L72 56 L28 56Z" fill="${c}"/>`,
      front: `<path d="M24 46 L27 24 L34 32 L38 14 L46 28 L52 10 L57 27 L66 14 L68 30 L76 24 L76 46 C70 36 62 31 50 32 C38 31 30 36 24 46Z" fill="${c}"/>${shine('M40 20 L44 28')}${shine('M53 16 L55 26')}${shine('M65 20 L66 28')}` };
    case 6: return { back: `<path d="M18 52 C10 10 90 10 82 52 C86 70 84 88 78 100 L22 100 C16 88 14 70 18 52Z" fill="${c}"/>`,
      front: `<path d="M24 50 C20 22 80 22 76 50 C76 34 64 26 50 26 C36 26 24 34 24 50Z" fill="${c}"/><path d="M24 50 C24 66 34 78 50 80 C66 78 76 66 76 50 C78 70 68 86 50 88 C32 86 22 70 24 50Z" fill="${c}"/>${shine('M30 30 C40 22 60 22 70 30')}` };
    default: return { back: `<path d="M26 44 C24 20 76 20 74 44 L72 52 L28 52Z" fill="${c}"/>`,
      front: `<path d="M27 42 C27 24 73 24 73 42 C66 32 58 29 50 29 C42 29 34 32 27 42Z" fill="${c}"/>${shine('M38 27 C46 24 54 24 62 27')}` };
  }
}

// cfg: { seed } or explicit { skin, hair, hairColor, outfit }. opts: { band, role, cast, emblem }.
// An original storybook-animation look: large bright eyes, soft shading, flowing hair with highlights.
export function avatarSVG(cfg = {}, opts = {}) {
  const rng = rngFrom('ava' + (cfg.seed ?? JSON.stringify(cfg)));
  const r = (n) => Math.floor(rng() * n);
  const skin = SKINS[cfg.skin ?? r(SKINS.length)];
  const style = cfg.hair ?? r(HAIR_STYLES);
  const band = opts.band || 'kid', role = opts.role || 'student';
  const older = role !== 'student' && role !== 'peer';
  const hairCol = older && rng() < 0.22 ? '#c9ced8' : HAIR_COLORS[cfg.hairColor ?? r(role === 'student' ? HAIR_COLORS.length : 6)];
  const outfit = role === 'doctor' ? '#ffffff' : OUTFITS[cfg.outfit ?? r(OUTFITS.length)];
  const eye = EYES[r(EYES.length)];
  const theme = CAST_THEMES[(opts.cast ?? 0) % CAST_THEMES.length];
  const tiny = band === 'tiny', kid = band === 'kid';
  // The younger the player, the larger and rounder the eyes.
  const ex = tiny ? 12.5 : 12, ey = 47, erx = tiny ? 6.6 : kid ? 6 : older ? 4.6 : 5.2, ery = tiny ? 7.8 : kid ? 7 : older ? 5 : 5.8;
  const id = 'a' + Math.floor(rng() * 1e9).toString(36);
  const master = role === 'master';
  const H = hair(style, hairCol, shade(hairCol, 0.45));
  const lip = shade(skin, -0.38), line = shade(skin, -0.5);
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img" aria-hidden="true"><defs>`
    + `<radialGradient id="${id}b" cx=".5" cy=".35" r=".8"><stop offset="0" stop-color="${master ? '#5a4a9a' : theme.bg[0]}"/><stop offset="1" stop-color="${master ? '#1b1436' : theme.bg[1]}"/></radialGradient>`
    + `<radialGradient id="${id}s" cx=".42" cy=".36" r=".75"><stop offset="0" stop-color="${shade(skin, 0.22)}"/><stop offset=".7" stop-color="${skin}"/><stop offset="1" stop-color="${shade(skin, -0.14)}"/></radialGradient>`
    + `<linearGradient id="${id}o" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shade(outfit, 0.18)}"/><stop offset="1" stop-color="${shade(outfit, -0.22)}"/></linearGradient>`
    + `<radialGradient id="${id}i" cx=".5" cy=".7" r=".7"><stop offset="0" stop-color="${shade(eye, 0.45)}"/><stop offset="1" stop-color="${eye}"/></radialGradient></defs>`;
  s += `<rect width="100" height="100" fill="url(#${id}b)"/>`;
  if (!master) s += `<g fill="#fff" opacity=".55"><circle cx="14" cy="16" r="1.6"/><circle cx="86" cy="22" r="1.2"/><circle cx="90" cy="60" r="1.4"/><circle cx="9" cy="66" r="1.1"/></g>`;
  s += H.back;
  // shoulders and clothes
  if (master) s += `<path d="M6 100 Q12 70 50 68 Q88 70 94 100Z" fill="#6b1a3a"/><path d="M28 100 L34 72 L50 68 L66 72 L72 100Z" fill="url(#${id}o)"/><path d="M34 72 L50 86 L66 72" fill="none" stroke="#ffcf5c" stroke-width="2.6" stroke-linejoin="round"/><path d="M30 70 L24 58 L40 68Z M70 70 L76 58 L60 68Z" fill="#8a2450"/><circle cx="50" cy="88" r="3.2" fill="#ffcf5c" stroke="#fff3c4"/>`;
  else if (role === 'doctor') s += `<path d="M10 100 Q14 72 50 70 Q86 72 90 100Z" fill="url(#${id}o)" stroke="#d5dbec"/><path d="M42 71 L50 84 L58 71" fill="${OUTFITS[r(OUTFITS.length)]}"/><path d="M42 71 L36 100 M58 71 L64 100" stroke="#d5dbec" stroke-width="1.5"/><path d="M38 76 Q30 92 40 94" fill="none" stroke="#56618a" stroke-width="2.2" stroke-linecap="round"/><circle cx="41.5" cy="94" r="3" fill="#8f9ac0" stroke="#56618a"/>`;
  else s += `<path d="M10 100 Q14 72 50 70 Q86 72 90 100Z" fill="url(#${id}o)"/><path d="M40 71 Q50 82 60 71 L57 69 Q50 76 43 69Z" fill="${shade(outfit, 0.4)}"/>`;
  if (role === 'teacher') s += `<path d="M46 76 L50 80 L54 76 L52.5 98 L47.5 98Z" fill="#fff" opacity=".9"/>`;
  // neck, ears, face
  s += `<path d="M43 62 L43 73 Q50 78 57 73 L57 62Z" fill="${shade(skin, -0.12)}"/>`;
  s += `<ellipse cx="25.5" cy="48" rx="4" ry="5.2" fill="${shade(skin, -0.06)}"/><ellipse cx="74.5" cy="48" rx="4" ry="5.2" fill="${shade(skin, -0.06)}"/>`;
  s += `<path d="M26 43 C26 22 74 22 74 43 C74 58 63 71 50 71 C37 71 26 58 26 43Z" fill="url(#${id}s)"/>`;
  s += `<ellipse cx="${50 - ex - 3}" cy="57.5" rx="5" ry="3" fill="#ff7f9a" opacity="${tiny || kid ? 0.42 : 0.26}"/><ellipse cx="${50 + ex + 3}" cy="57.5" rx="5" ry="3" fill="#ff7f9a" opacity="${tiny || kid ? 0.42 : 0.26}"/>`;
  // eyes: white, shaded iris, pupil, two sparkles, lashes
  for (const sx of [-1, 1]) {
    const x = 50 + sx * ex;
    s += `<ellipse cx="${x}" cy="${ey}" rx="${erx}" ry="${ery}" fill="#fff"/>`;
    s += `<circle cx="${x + sx * 0.4}" cy="${ey + 0.8}" r="${Math.min(erx, ery) * 0.78}" fill="url(#${id}i)"/><circle cx="${x + sx * 0.4}" cy="${ey + 0.8}" r="${Math.min(erx, ery) * 0.4}" fill="#1b1430"/>`;
    s += `<circle cx="${x + 1.9}" cy="${ey - 1.6}" r="${erx * 0.3}" fill="#fff"/><circle cx="${x - 1.6}" cy="${ey + 2.4}" r="${erx * 0.15}" fill="#fff" opacity=".9"/>`;
    s += `<path d="M${x - erx - 0.6} ${ey - 1} Q${x} ${ey - ery - 2.6} ${x + erx + 0.6} ${ey - 1}" fill="none" stroke="#231a33" stroke-width="${older ? 1.5 : 1.9}" stroke-linecap="round"/>`;
    if (!older || role === 'teacher') s += `<path d="M${x + sx * (erx + 0.4)} ${ey - 1.4} l${sx * 2.4} -2.2" stroke="#231a33" stroke-width="1.4" stroke-linecap="round"/>`;
    // brows: masters arch theirs
    s += master ? `<path d="M${x - sx * 7} ${ey - ery - 2.5} L${x + sx * 6} ${ey - ery - 7}" stroke="${shade(hairCol, -0.3)}" stroke-width="2.6" stroke-linecap="round"/>`
      : `<path d="M${x - 5.5} ${ey - ery - 5} Q${x} ${ey - ery - 7.6} ${x + 5.5} ${ey - ery - 5}" fill="none" stroke="${shade(hairCol, -0.25)}" stroke-width="1.9" stroke-linecap="round" opacity=".85"/>`;
  }
  s += `<path d="M48.6 55.5 Q50 57.2 51.4 55.5" fill="none" stroke="${line}" stroke-width="1.3" stroke-linecap="round" opacity=".7"/>`;
  s += master ? `<path d="M43.5 62 Q51 64.5 57.5 60" fill="none" stroke="${lip}" stroke-width="2" stroke-linecap="round"/>`
    : `<path d="M43 61 Q50 ${tiny ? 69.5 : 67.5} 57 61 Q50 63.5 43 61Z" fill="${tiny || kid ? '#fff' : lip}" stroke="${lip}" stroke-width="1.6" stroke-linejoin="round"/>`;
  s += H.front;
  if ((role === 'teacher' || role === 'doctor') && rng() < 0.65) s += `<g fill="rgba(255,255,255,.18)" stroke="#2a2140" stroke-width="1.6"><circle cx="${50 - ex}" cy="${ey}" r="${erx + 3}"/><circle cx="${50 + ex}" cy="${ey}" r="${erx + 3}"/><path d="M${50 - ex + erx + 3} ${ey} L${50 + ex - erx - 3} ${ey}" fill="none"/></g>`;
  if (role === 'layman') s += `<path d="M22 32 Q50 2 78 32 L84 36 L16 36Z" fill="url(#${id}o)"/><path d="M16 36 L84 36" stroke="${shade(outfit, -0.3)}" stroke-width="2"/>`;
  if (opts.emblem) s += `<g transform="translate(69 84)"><circle r="9.5" fill="#f5b700" stroke="#fff3c4" stroke-width="2"/><path d="M0 -5.8 L1.7 -1.8 L5.9 -1.8 L2.5 0.9 L3.7 5.2 L0 2.7 L-3.7 5.2 L-2.5 0.9 L-5.9 -1.8 L-1.7 -1.8Z" fill="#fff"/></g>`;
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
