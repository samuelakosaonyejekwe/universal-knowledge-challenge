// Draws every character as an original SVG portrait. The drawing style follows the player's age band
// (storybook for the youngest, cartoon, then cleaner styles for teens and adults), and the player picks the look.
import { rngFrom, h } from './util.js';

export const SKINS = ['#fde0c8', '#f3c6a0', '#e0a878', '#c68652', '#9a5f38', '#6b4226'];
export const HAIR_COLORS = ['#1f1a17', '#4a2f1d', '#8a5a2b', '#d9a441', '#b5432e', '#5b6170', '#7b4bd6', '#1d8fa8'];
export const OUTFITS = ['#4f5bd5', '#17a673', '#e0662a', '#d6336c', '#8a5cf6', '#1f8fe5', '#f5b700', '#2f9e44'];
export const HAIR_STYLES = 8;
// Four undersea settings for the portraits. Every character lives in a magical ocean world of coral, pearls,
// shells, sea plants and sparkling water.
export const CAST_THEMES = [
  { name: 'Sunny lagoon', em: '🐚', bg: ['#c9f7f1', '#2fb7c8'], plant: '#1f9d7a', coral: '#ff7f8e' }, { name: 'Coral reef', em: '🪸', bg: ['#ffe6da', '#f27fa8'], plant: '#2a9d8f', coral: '#ff9f43' },
  { name: 'Kelp forest', em: '🌿', bg: ['#dcfad8', '#2fa58a'], plant: '#17805f', coral: '#ff6f91' }, { name: 'Moonlit deep', em: '🌙', bg: ['#c4ccff', '#4a55c4'], plant: '#3a8fb7', coral: '#c77dff' },
];

const EYES = ['#5b3a1e', '#6b4a2a', '#3f6b4f', '#3d6f9c', '#7a5a2e', '#4a4f6b'];
// Lighter (amt > 0) or darker (amt < 0) version of a colour.
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v) => Math.max(0, Math.min(255, Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt))));
  return '#' + [n >> 16, (n >> 8) & 255, n & 255].map((v) => ch(v).toString(16).padStart(2, '0')).join('');
}

// Hair in two layers on a 200-unit canvas: `back` sits behind the head and shoulders, `front` frames the face.
// Big, sweeping shapes with painted highlight strands, in the manner of classic hand-drawn animation.
function hair(style, fill, hi, lo) {
  const strand = (d, w = 4) => `<path d="${d}" fill="none" stroke="${hi}" stroke-width="${w}" stroke-linecap="round" opacity=".8"/>`;
  const dark = (d, w = 3) => `<path d="${d}" fill="none" stroke="${lo}" stroke-width="${w}" stroke-linecap="round" opacity=".55"/>`;
  switch (style) {
    case 0: return { back: `<path d="M52 92 C44 34 156 34 148 92 L144 108 L56 108Z" fill="${fill}"/>`,
      front: `<path d="M54 90 C48 50 92 30 124 40 C146 46 154 70 147 92 C140 72 126 62 104 63 C92 74 70 76 54 90Z" fill="${fill}"/>${strand('M68 58 C84 44 108 40 128 48', 5)}${strand('M62 74 C72 64 86 60 98 60', 3)}${dark('M104 63 C96 72 82 76 66 82')}` };
    case 1: return { back: `<path d="M46 92 C30 22 170 22 154 92 C162 120 184 140 176 172 C172 186 180 194 168 200 L32 200 C20 194 28 186 24 172 C16 140 38 120 46 92Z" fill="${fill}"/>${strand('M34 132 C24 150 26 172 36 190', 5)}${strand('M166 130 C178 150 176 172 166 190', 5)}${dark('M44 120 C38 140 42 164 52 184', 4)}${dark('M156 120 C162 140 158 164 148 184', 4)}`,
      front: `<path d="M56 94 C46 52 80 34 110 38 C140 40 156 66 147 94 C140 74 126 62 108 61 C98 78 76 82 56 94Z" fill="${fill}"/>${strand('M66 60 C82 44 108 40 130 50', 5)}${strand('M60 78 C70 66 84 62 98 61', 3)}${dark('M108 61 C100 74 84 80 68 86')}<path d="M146 90 C152 104 150 118 146 128 C142 116 142 102 146 90Z" fill="${fill}"/><path d="M54 90 C48 104 50 118 54 128 C58 116 58 102 54 90Z" fill="${fill}"/>` };
    case 2: return { back: `<g fill="${fill}"><circle cx="100" cy="52" r="46"/><circle cx="56" cy="64" r="26"/><circle cx="144" cy="64" r="26"/><circle cx="48" cy="96" r="21"/><circle cx="152" cy="96" r="21"/><circle cx="72" cy="28" r="23"/><circle cx="128" cy="28" r="23"/><circle cx="100" cy="16" r="20"/></g>`,
      front: `<g fill="${fill}"><circle cx="66" cy="70" r="13"/><circle cx="82" cy="60" r="13"/><circle cx="100" cy="57" r="13"/><circle cx="118" cy="60" r="13"/><circle cx="134" cy="70" r="13"/></g><g fill="${hi}" opacity=".6"><circle cx="76" cy="26" r="5"/><circle cx="118" cy="20" r="5"/><circle cx="146" cy="52" r="4.5"/><circle cx="52" cy="56" r="4.5"/><circle cx="96" cy="50" r="4"/><circle cx="124" cy="56" r="3.5"/></g>` };
    case 3: return { back: `<circle cx="100" cy="24" r="21" fill="${fill}"/>${strand('M88 16 C94 8 108 8 113 16', 4)}<path d="M52 92 C46 40 154 40 148 92 L142 110 L58 110Z" fill="${fill}"/>`,
      front: `<path d="M54 92 C50 54 86 40 100 50 C114 40 150 54 146 92 C136 72 120 62 100 66 C80 62 64 72 54 92Z" fill="${fill}"/>${strand('M64 66 C74 54 88 50 98 54', 4)}${strand('M104 54 C114 50 128 54 136 66', 4)}<path d="M82 40 Q100 30 118 40" fill="none" stroke="#ff7fa8" stroke-width="6" stroke-linecap="round"/>` };
    case 4: return { back: `<path d="M52 92 C46 38 154 38 148 92 L142 110 L58 110Z" fill="${fill}"/><g fill="${fill}"><ellipse cx="38" cy="116" rx="13" ry="16"/><ellipse cx="34" cy="142" rx="12" ry="15"/><ellipse cx="32" cy="166" rx="11" ry="14"/><ellipse cx="31" cy="188" rx="9" ry="12"/><ellipse cx="162" cy="116" rx="13" ry="16"/><ellipse cx="166" cy="142" rx="12" ry="15"/><ellipse cx="168" cy="166" rx="11" ry="14"/><ellipse cx="169" cy="188" rx="9" ry="12"/></g>${strand('M30 110 C34 118 40 122 46 120', 3)}${strand('M27 136 C31 144 37 148 43 146', 3)}${strand('M170 110 C166 118 160 122 154 120', 3)}${strand('M173 136 C169 144 163 148 157 146', 3)}<g fill="#ffcf5c" stroke="#fff3c4"><circle cx="42" cy="100" r="6"/><circle cx="158" cy="100" r="6"/></g>`,
      front: `<path d="M54 92 C50 46 150 46 146 92 C134 68 116 60 100 72 C84 60 66 68 54 92Z" fill="${fill}"/>${strand('M66 64 C76 54 90 54 98 62', 4)}${strand('M104 60 C114 54 126 56 134 66', 4)}` };
    case 5: return { back: `<path d="M50 94 C42 40 158 40 150 94 L146 108 L54 108Z" fill="${fill}"/>`,
      // soft tousled waves swept up into a gentle quiff
      front: `<path d="M52 92 C44 62 56 42 76 44 C82 30 104 26 114 38 C130 30 150 44 147 64 C153 74 151 84 148 92 C140 74 124 64 104 66 C92 77 68 79 52 92Z" fill="${fill}"/>${strand('M70 56 C80 44 96 40 108 44', 5)}${strand('M112 46 C124 42 136 48 140 60', 4)}${strand('M60 76 C70 66 84 62 98 62', 3)}${dark('M104 66 C96 74 82 78 66 84')}${dark('M78 46 C84 40 92 38 98 40', 2.5)}` };
    case 6: return { back: `<path d="M38 104 C20 14 180 14 162 104 C170 142 166 178 154 200 L46 200 C34 178 30 142 38 104Z" fill="${fill}"/>${strand('M50 54 C70 28 130 28 150 54', 5)}`,
      front: `<path d="M50 102 C42 44 158 44 150 102 C150 70 128 54 100 54 C72 54 50 70 50 102Z" fill="${fill}"/><path d="M50 102 C52 134 72 158 100 162 C128 158 148 134 150 102 C156 144 136 178 100 182 C64 178 44 144 50 102Z" fill="${fill}"/>${dark('M62 150 C76 166 124 166 138 150', 3)}` };
    default: return { back: `<path d="M54 88 C50 40 150 40 146 88 L142 100 L58 100Z" fill="${fill}"/>`,
      front: `<path d="M56 84 C56 48 144 48 144 84 C132 66 116 59 100 59 C84 59 68 66 56 84Z" fill="${fill}"/>${strand('M76 56 C90 50 110 50 124 56', 4)}` };
  }
}

// ----- ocean pieces -----
const pearl = (x, y, rr = 3) => `<circle cx="${x}" cy="${y}" r="${rr}" fill="#fffaf2" stroke="#e8d9c8" stroke-width=".8"/><circle cx="${x - rr * 0.3}" cy="${y - rr * 0.35}" r="${rr * 0.32}" fill="#fff"/>`;
function shell(x, y, rr, c) {
  const ribs = [-0.62, -0.32, 0, 0.32, 0.62].map((k) => `<path d="M${x} ${y + rr * 0.5} L${x + k * rr * 1.25} ${y - rr * 0.82}" stroke="${shade(c, -0.25)}" stroke-width="${Math.max(1, rr * 0.09)}" stroke-linecap="round"/>`).join('');
  return `<path d="M${x - rr} ${y - rr * 0.1} C${x - rr * 1.05} ${y - rr * 1.15} ${x + rr * 1.05} ${y - rr * 1.15} ${x + rr} ${y - rr * 0.1} L${x + rr * 0.28} ${y + rr * 0.55} L${x - rr * 0.28} ${y + rr * 0.55}Z" fill="${c}" stroke="${shade(c, -0.3)}" stroke-width="${Math.max(1, rr * 0.08)}" stroke-linejoin="round"/>${ribs}<path d="M${x - rr * 0.6} ${y - rr * 0.7} Q${x} ${y - rr * 1.05} ${x + rr * 0.3} ${y - rr * 0.85}" fill="none" stroke="#fff" stroke-width="${rr * 0.1}" stroke-linecap="round" opacity=".6"/>`;
}
function starfish(x, y, rr, c, rot = 0) {
  const pts = Array.from({ length: 10 }, (_, i) => { const a = (i * Math.PI) / 5 - Math.PI / 2, q = i % 2 ? rr * 0.46 : rr; return `${(x + Math.cos(a) * q).toFixed(1)},${(y + Math.sin(a) * q).toFixed(1)}`; }).join(' ');
  return `<g transform="rotate(${rot} ${x} ${y})"><polygon points="${pts}" fill="${c}" stroke="${shade(c, -0.28)}" stroke-width="${rr * 0.12}" stroke-linejoin="round"/><circle cx="${x}" cy="${y}" r="${rr * 0.16}" fill="#fff" opacity=".7"/></g>`;
}
const coralSprig = (x, y, k, c) => `<g fill="none" stroke="${c}" stroke-linecap="round" stroke-linejoin="round" stroke-width="${5 * k}"><path d="M${x} ${y} v${-26 * k}"/><path d="M${x} ${y - 12 * k} q${-9 * k} ${-4 * k} ${-10 * k} ${-16 * k}"/><path d="M${x} ${y - 17 * k} q${9 * k} ${-3 * k} ${11 * k} ${-14 * k}"/><path d="M${x - 9 * k} ${y - 22 * k} q${-6 * k} ${-1 * k} ${-7 * k} ${-8 * k}"/></g>`;
const kelp = (x, hgt, c, lean) => `<path d="M${x} 200 C${x + lean} ${200 - hgt * 0.3} ${x - lean} ${200 - hgt * 0.6} ${x + lean * 0.6} ${200 - hgt}" fill="none" stroke="${c}" stroke-width="9" stroke-linecap="round" opacity=".85"/><path d="M${x + 8} 200 C${x + 8 - lean} ${200 - hgt * 0.25} ${x + 8 + lean} ${200 - hgt * 0.5} ${x + 4} ${200 - hgt * 0.74}" fill="none" stroke="${shade(c, 0.25)}" stroke-width="6" stroke-linecap="round" opacity=".8"/>`;
const bubble = (x, y, rr) => `<circle cx="${x}" cy="${y}" r="${rr}" fill="rgba(255,255,255,.22)" stroke="rgba(255,255,255,.85)" stroke-width="1.2"/><path d="M${x - rr * 0.5} ${y - rr * 0.25} a${rr * 0.55} ${rr * 0.55} 0 0 1 ${rr * 0.45} ${-rr * 0.45}" fill="none" stroke="#fff" stroke-width="1.3" stroke-linecap="round"/>`;
// Sparkling water behind every portrait: light rays, sea plants, a coral branch and rising bubbles.
function seaScene(id, theme, master, rng) {
  const plant = master ? '#27406f' : theme.plant, cor = master ? '#b05cff' : theme.coral;
  let o = `<rect width="200" height="200" fill="url(#${id}b)"/>`;
  o += `<g fill="#fff" opacity="${master ? 0.07 : 0.16}"><path d="M30 0 L70 0 L26 200 L-20 200Z"/><path d="M96 0 L122 0 L150 200 L104 200Z"/><path d="M160 0 L182 0 L230 200 L196 200Z"/></g>`;
  o += kelp(10, 92 + rng() * 26, plant, 14) + kelp(178, 78 + rng() * 26, plant, -13) + coralSprig(30, 200, 1.05, cor) + coralSprig(166, 202, 0.8, shade(cor, 0.15));
  for (const [x, y, rr] of [[22, 34, 5.5], [34, 18, 3], [176, 26, 4.5], [186, 62, 3], [168, 96, 2.4], [14, 88, 2.6], [150, 12, 2.2]]) o += bubble(x + rng() * 4, y + rng() * 4, rr);
  if (master) o += `<g fill="#9be7ff" opacity=".85"><circle cx="24" cy="58" r="2.2"/><circle cx="178" cy="84" r="2"/><circle cx="160" cy="34" r="1.6"/></g>`;
  return o;
}

// One large, bright eye: an almond shape with a shaded iris, deep pupil, two sparkles, a bold upper lid and lashes.
function eyeSVG(id, x, y, sx, k, eye, sex, older, master) {
  const w = 15.5 * k, up = 15 * k, down = 11 * k, ir = 10.2 * k;
  const shape = `M${x - w} ${y} Q${x} ${y - up * 1.25} ${x + w} ${y - 1} Q${x} ${y + down * 1.3} ${x - w} ${y}Z`;
  let s = `<clipPath id="${id}"><path d="${shape}"/></clipPath><path d="${shape}" fill="#fff"/>`;
  s += `<g clip-path="url(#${id})"><circle cx="${x + sx * 1.2}" cy="${y + 0.5}" r="${ir}" fill="${eye}"/><circle cx="${x + sx * 1.2}" cy="${y + 3}" r="${ir * 0.72}" fill="${shade(eye, 0.35)}"/><circle cx="${x + sx * 1.2}" cy="${y + 0.5}" r="${ir * 0.46}" fill="#160f28"/>`
    + `<path d="M${x - w} ${y - up} L${x + w} ${y - up} L${x + w} ${y - up * 0.42} Q${x} ${y - up * 0.9} ${x - w} ${y - up * 0.3}Z" fill="#1b1430" opacity=".16"/></g>`;
  s += `<circle cx="${x + 4.6 * k}" cy="${y - 4.6 * k}" r="${3.6 * k}" fill="#fff"/><circle cx="${x - 4 * k}" cy="${y + 4.4 * k}" r="${1.7 * k}" fill="#fff" opacity=".9"/>`;
  // bold upper lid sweeping out into a wing
  const lid = master ? 4.6 : sex === 'm' ? 3.6 : older ? 3.4 : 4.2;
  s += `<path d="M${x - w - 1} ${y + 1} Q${x} ${y - up * 1.32} ${x + w + 1} ${y - 1.5}" fill="none" stroke="#1b1430" stroke-width="${lid}" stroke-linecap="round"/>`;
  s += `<path d="M${x - w * 0.7} ${y + down * 0.72} Q${x} ${y + down * 1.18} ${x + w * 0.8} ${y + down * 0.5}" fill="none" stroke="#1b1430" stroke-width="1.2" stroke-linecap="round" opacity=".45"/>`;
  if (sex !== 'm' && !master) {
    const ox = x + sx * (w + 1), oy = y - 1.5;
    s += `<path d="M${ox} ${oy} q${sx * 5.5} -2.5 ${sx * 7.5} -7.5" fill="none" stroke="#1b1430" stroke-width="${sex === 'f' ? 3 : 2.4}" stroke-linecap="round"/>`;
    if (sex === 'f') s += `<path d="M${x + sx * w * 0.62} ${y - up * 0.72} q${sx * 4} -3 ${sx * 5} -7.5" fill="none" stroke="#1b1430" stroke-width="2.2" stroke-linecap="round"/><path d="M${x + sx * w * 0.2} ${y - up * 0.98} q${sx * 2} -3 ${sx * 2.4} -6.5" fill="none" stroke="#1b1430" stroke-width="1.8" stroke-linecap="round"/>`;
  }
  // eyelid crease
  s += `<path d="M${x - w * 0.8} ${y - up * 0.98} Q${x} ${y - up * 1.72} ${x + w * 0.9} ${y - up * 0.92}" fill="none" stroke="#1b1430" stroke-width="1.1" stroke-linecap="round" opacity=".28"/>`;
  return s;
}

// cfg: { seed } or explicit { g, skin, hair, hairColor, outfit }. opts: { band, role, cast, emblem }.
// An original portrait style in the tradition of classic hand-drawn animated films: very large luminous eyes,
// a small nose, a heart-shaped face, and big sweeping hair with painted highlights.
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
  const tiny = band === 'tiny', kid = band === 'kid', master = role === 'master';
  // 'm' / 'f' / 'n' (rather not say): chosen by the player; it shapes the face a little — nothing else in the game.
  const sex = cfg.g || (cfg.seed != null ? ['m', 'f', 'n'][r(3)] : 'n');
  const k = tiny ? 1.16 : kid ? 1.08 : older ? 0.9 : 1;         // the younger the player, the bigger the eyes
  const id = 'a' + Math.floor(rng() * 1e9).toString(36);
  const H = hair(style, `url(#${id}h)`, shade(hairCol, 0.5), shade(hairCol, -0.35));
  const lip = sex === 'f' ? shade('#e0567a', skin === SKINS[4] || skin === SKINS[5] ? -0.25 : 0) : shade(skin, -0.36), line = shade(skin, -0.42);
  const ex = 24, ey = 98;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" role="img" aria-hidden="true"><defs>`
    + `<radialGradient id="${id}b" cx=".5" cy=".3" r=".85"><stop offset="0" stop-color="${master ? '#6a58b8' : theme.bg[0]}"/><stop offset="1" stop-color="${master ? '#1b1436' : theme.bg[1]}"/></radialGradient>`
    + `<radialGradient id="${id}s" cx=".45" cy=".38" r=".7"><stop offset="0" stop-color="${shade(skin, 0.2)}"/><stop offset=".72" stop-color="${skin}"/><stop offset="1" stop-color="${shade(skin, -0.16)}"/></radialGradient>`
    + `<linearGradient id="${id}o" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shade(outfit, 0.2)}"/><stop offset="1" stop-color="${shade(outfit, -0.25)}"/></linearGradient>`
    + `<linearGradient id="${id}h" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shade(hairCol, 0.22)}"/><stop offset=".45" stop-color="${hairCol}"/><stop offset="1" stop-color="${shade(hairCol, -0.28)}"/></linearGradient>`
    + `<radialGradient id="${id}c"><stop offset="0" stop-color="#ff6f91" stop-opacity=".55"/><stop offset="1" stop-color="#ff6f91" stop-opacity="0"/></radialGradient></defs>`;
  s += seaScene(id, theme, master, rng);
  s += H.back;
  // clothes of the sea: a scalloped shell collar, pearls, and something special for each role
  const scallops = (y, c) => [58, 76, 94, 112, 130].map((x, i) => `<path d="M${x} ${y + Math.abs(i - 2) * -3 + 4} a9 9 0 0 0 18 0Z" fill="${c}" stroke="${shade(c, -0.22)}" stroke-width="1.2"/>`).join('');
  const necklace = (y0) => [-22, -15, -7.5, 0, 7.5, 15, 22].map((dx) => pearl(100 + dx, y0 + 10 - (dx * dx) / 55, 2.6)).join('');
  if (master) {
    // the proud master of the deep: a tall fan collar, a dark cloak and a glowing pearl clasp
    s += `<path d="M34 170 C20 120 54 96 70 132 L100 150 L130 132 C146 96 180 120 166 170Z" fill="#3c1f6e" stroke="#7b4bd6" stroke-width="2.5"/><g stroke="#7b4bd6" stroke-width="1.6" opacity=".8"><path d="M44 160 L66 128"/><path d="M36 140 L60 124"/><path d="M156 160 L134 128"/><path d="M164 140 L140 124"/></g>`;
    s += `<path d="M10 200 Q22 152 100 148 Q178 152 190 200Z" fill="#2a1650"/><path d="M58 200 L68 154 L100 148 L132 154 L142 200Z" fill="url(#${id}o)"/><path d="M68 154 L100 182 L132 154" fill="none" stroke="#ffcf5c" stroke-width="4.5" stroke-linejoin="round"/>`;
    s += `<circle cx="100" cy="184" r="9" fill="#9be7ff" opacity=".35"/>${pearl(100, 184, 6)}`;
  } else if (role === 'doctor') {
    // the healer: a sea-foam coat with a shell badge
    s += `<path d="M20 200 Q28 158 100 154 Q172 158 180 200Z" fill="#f4fffd" stroke="#bfe6e0" stroke-width="2"/><path d="M84 156 L100 180 L116 156" fill="#5fd3c4"/><path d="M84 156 L72 200 M116 156 L128 200" stroke="#bfe6e0" stroke-width="3"/>`;
    s += shell(134, 184, 9, '#7fe0d2') + `<path d="M134 178 v8 M130 182 h8" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>` + necklace(150);
  } else {
    s += `<path d="M22 200 Q30 160 100 156 Q170 160 178 200Z" fill="url(#${id}o)"/>` + scallops(160, shade(outfit, 0.42));
    if (role === 'teacher') s += `<path d="M40 200 C44 174 70 160 100 176 C130 160 156 174 160 200Z" fill="${theme.plant}" opacity=".9"/><path d="M100 176 V200" stroke="${shade(theme.plant, -0.25)}" stroke-width="2"/>` + necklace(152) + shell(100, 172, 7, '#ffd9a8');
    else if (role === 'layman') s += necklace(150);
    else s += necklace(150) + shell(100, 170, 6.5, role === 'peer' ? '#ffc2d4' : '#ffe1a8');
  }
  // slender neck with a soft shadow under the chin
  s += `<path d="M87 134 L86 160 Q100 172 114 160 L113 134Z" fill="${shade(skin, -0.1)}"/><path d="M87 140 Q100 154 113 140 L113 134 L87 134Z" fill="${shade(skin, -0.24)}" opacity=".6"/>`;
  s += `<ellipse cx="59" cy="102" rx="7.5" ry="10.5" fill="${shade(skin, -0.05)}"/><ellipse cx="141" cy="102" rx="7.5" ry="10.5" fill="${shade(skin, -0.05)}"/>`;
  // face: heart-shaped, or a little squarer at the jaw
  s += sex === 'm' ? `<path d="M60 90 C58 46 142 46 140 90 C140 116 128 140 110 148 L90 148 C72 140 60 116 60 90Z" fill="url(#${id}s)"/>`
    : `<path d="M60 90 C58 46 142 46 140 90 C140 114 124 140 100 150 C76 140 60 114 60 90Z" fill="url(#${id}s)"/>`;
  s += `<ellipse cx="${100 - ex - 8}" cy="120" rx="13" ry="9" fill="url(#${id}c)" opacity="${tiny || kid ? 1 : 0.7}"/><ellipse cx="${100 + ex + 8}" cy="120" rx="13" ry="9" fill="url(#${id}c)" opacity="${tiny || kid ? 1 : 0.7}"/>`;
  s += eyeSVG(id + 'l', 100 - ex, ey, -1, k, eye, sex, older, master) + eyeSVG(id + 'r', 100 + ex, ey, 1, k, eye, sex, older, master);
  // brows: soft tapered arches; masters arch theirs sharply
  for (const sx of [-1, 1]) {
    const x = 100 + sx * ex, by = ey - 15 * k * 1.72 - 4, bw = sex === 'm' ? 5 : sex === 'f' ? 3 : 3.8;
    s += master ? `<path d="M${x - sx * 15} ${by + 9} L${x + sx * 14} ${by - 5}" stroke="${shade(hairCol, -0.4)}" stroke-width="5.5" stroke-linecap="round"/>`
      : `<path d="M${x - sx * 14} ${by + 4} Q${x + sx * 2} ${by - 6} ${x + sx * 15} ${by + 1}" fill="none" stroke="${shade(hairCol, -0.35)}" stroke-width="${bw}" stroke-linecap="round" opacity=".9"/>`;
  }
  // small upturned nose
  s += `<path d="M97 114 Q100 119 104.5 115.5" fill="none" stroke="${line}" stroke-width="2.2" stroke-linecap="round" opacity=".75"/>`;
  // mouth
  if (master) s += `<path d="M87 131 Q102 136 115 126" fill="none" stroke="${lip}" stroke-width="3.6" stroke-linecap="round"/>`;
  else if (tiny || kid) s += `<path d="M86 127 Q100 145 114 127 Q100 132 86 127Z" fill="#7a2140" stroke="${lip}" stroke-width="2.6" stroke-linejoin="round"/><path d="M90 129.2 Q100 132.5 110 129.2 L109 131.5 Q100 134.5 91 131.5Z" fill="#fff"/><path d="M94 139 Q100 142.5 106 139 Q100 136 94 139Z" fill="#ff8fa3"/>`;
  else if (sex === 'f') s += `<path d="M87 128 Q94 124.5 100 127 Q106 124.5 113 128 Q100 141 87 128Z" fill="${lip}"/><path d="M87 128 Q100 131.5 113 128" fill="none" stroke="${shade(lip, -0.3)}" stroke-width="1.4"/><path d="M95 133.5 Q100 135.5 105 133.5" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".55"/>`;
  else s += `<path d="M87 128 Q100 139 113 128" fill="none" stroke="${lip}" stroke-width="3.2" stroke-linecap="round"/><path d="M93 137 Q100 140 107 137" fill="none" stroke="${line}" stroke-width="1.4" stroke-linecap="round" opacity=".4"/>`;
  s += H.front;
  if ((role === 'teacher' || role === 'doctor') && rng() < 0.65) s += `<g fill="rgba(255,255,255,.16)" stroke="#2a2140" stroke-width="3"><circle cx="${100 - ex}" cy="${ey}" r="${19 * k}"/><circle cx="${100 + ex}" cy="${ey}" r="${19 * k}"/><path d="M${100 - ex + 19 * k} ${ey} L${100 + ex - 19 * k} ${ey}" fill="none"/></g>`;
  // what each role wears in its hair
  if (master) {
    // a tall crown of branching coral tipped with pearls
    const cc = '#ff5f8f';
    s += `<path d="M62 62 Q100 44 138 62" fill="none" stroke="#ffcf5c" stroke-width="6" stroke-linecap="round"/>`
      + [[72, 58, 0.9, -8], [86, 52, 1.15, -3], [100, 50, 1.4, 0], [114, 52, 1.15, 3], [128, 58, 0.9, 8]].map(([x, y, kk, rot]) => `<g transform="rotate(${rot} ${x} ${y})">${coralSprig(x, y, kk * 0.72, cc)}${pearl(x, y - 26 * kk * 0.72 - 3, 2.6)}</g>`).join('') + pearl(100, 52, 4);
  } else if (role === 'teacher') {
    // the wise guide: a pearl circlet with a little coral at the centre
    s += `<path d="M62 64 Q100 46 138 64" fill="none" stroke="#ffcf5c" stroke-width="4.5" stroke-linecap="round"/>` + [-30, -20, -10, 10, 20, 30].map((dx) => pearl(100 + dx, 56.5 + (dx * dx) / 130, 2.6)).join('') + coralSprig(100, 54, 0.5, theme.coral) + pearl(100, 55, 3.6);
  } else if (role === 'doctor') {
    s += `<path d="M62 64 Q100 48 138 64" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/>` + starfish(100, 53, 9, '#5fd3c4') + `<path d="M100 49.5 v7 M96.5 53 h7" stroke="#fff" stroke-width="2" stroke-linecap="round"/>`;
  } else if (role === 'layman') {
    // the curious newcomer: a big scallop-shell cap and a bubble of questions
    s += shell(100, 50, 44, '#ffb38a') + `<path d="M58 64 Q100 78 142 64" fill="none" stroke="${shade('#ffb38a', -0.3)}" stroke-width="3" stroke-linecap="round"/>` + bubble(160, 44, 13) + `<text x="160" y="50" text-anchor="middle" font-size="16" font-weight="800" fill="#fff">?</text>`;
  } else if (role === 'peer') {
    s += shell(140, 70, 9, '#ffc2d4');
  } else {
    // the young adventurer: a starfish or a shell tucked into the hair
    s += sex === 'm' ? shell(138, 66, 9, '#ffe1a8') : starfish(140, 66, 12, '#ff8a5c', 12) + (sex === 'f' ? pearl(126, 58, 2.8) + pearl(150, 80, 2.4) : '');
  }
  if (opts.emblem) s += `<g transform="translate(140 170)"><circle r="19" fill="#f5b700" stroke="#fff3c4" stroke-width="4"/><path d="M0 -11.6 L3.4 -3.6 L11.8 -3.6 L5 1.8 L7.4 10.4 L0 5.4 L-7.4 10.4 L-5 1.8 L-11.8 -3.6 L-3.4 -3.6Z" fill="#fff"/></g>`;
  return s + '</svg>';
}

export function avatarEl(cfg, opts = {}) {
  const el = h('div', { class: 'ava' + (opts.size ? ' ' + opts.size : '') + (opts.emblem ? ' emblem' : '') });
  el.innerHTML = avatarSVG(cfg, opts);
  return el;
}

// Hair styles usually offered first for each choice; every style stays available to everyone.
export const TYPICAL_HAIR = { m: [0, 5, 7, 2], f: [1, 3, 4, 2], n: [0, 1, 2, 5] };
export function randomAvatar(rng = Math.random, g = 'n') {
  const r = (n) => Math.floor(rng() * n);
  const styles = TYPICAL_HAIR[g] || TYPICAL_HAIR.n;
  const hairs = [0, 1, 3, 4], outfits = [0, 1, 3, 5, 6];   // the colours offered in the pickers
  return { g, skin: r(SKINS.length), hair: styles[r(styles.length)], hairColor: hairs[r(hairs.length)], outfit: outfits[r(outfits.length)] };
}
