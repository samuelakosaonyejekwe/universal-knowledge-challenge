// Live knowledge: fresh material fetched by the player's own browser from open, reputable sources.
// Nothing here depends on the publisher's machine. Every result is cached on the device (so it also works
// offline) and refreshed in the background when it gets old.
import { kvGet, kvSet } from './idb.js';
import { lang, langInfo } from './i18n.js';
import { can, filterItems, isSafeText } from './safety.js';
import { profile } from './store.js';
import { world } from '../data/worlds.js';

const HOUR = 3600000;
const ID = { headers: { 'Api-User-Agent': 'UniversalKnowledgeChallenge/1.0 (educational app)' } };

async function getJSON(url, opts) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 12000);
  try {
    const r = await fetch(url, { ...opts, signal: ctl.signal });
    if (!r.ok) throw new Error(String(r.status));
    return await r.json();
  } finally { clearTimeout(timer); }
}

// Stale-while-revalidate: return what we have at once, refresh behind the scenes when it is older than maxAge.
// Result: { items, at, stale, offline }.
export async function cached(key, maxAge, loader) {
  const k = 'live|' + key;
  const hit = await kvGet(k);
  const fresh = hit && Date.now() - hit.at < maxAge;
  const refresh = async () => {
    const items = await loader();
    const rec = { items, at: Date.now() };
    await kvSet(k, rec);
    return rec;
  };
  if (fresh) return { ...hit, stale: false };
  if (!navigator.onLine || !can('live')) return hit ? { ...hit, stale: true, offline: true } : { items: [], at: 0, stale: true, offline: true };
  if (hit) { refresh().catch(() => {}); return { ...hit, stale: true }; }
  try { return { ...(await refresh()), stale: false }; } catch { return { items: [], at: 0, stale: true, failed: true }; }
}

const wikiHost = (code = lang) => `https://${langInfo(code).wiki}.wikipedia.org`;
const strip = (html) => String(html || '').replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#039;/g, "'").replace(/\s+/g, ' ').trim();

// ---------- encyclopedia (in the player's language when the article exists there) ----------
export async function wikiSummary(title, code = lang) {
  const res = await cached(`wiki|${code}|${title}`, 7 * 24 * HOUR, async () => {
    let t = title, host = wikiHost(code);
    if (code !== 'en') {
      // Find the same article in the player's language through its interlanguage link.
      try {
        const j = await getJSON(`https://en.wikipedia.org/w/api.php?action=query&prop=langlinks&lllang=${langInfo(code).wiki}&titles=${encodeURIComponent(title)}&redirects=1&format=json&origin=*`);
        const page = Object.values(j.query.pages)[0];
        const ll = page?.langlinks?.[0]?.['*'];
        if (ll) t = ll; else host = 'https://en.wikipedia.org';
      } catch { host = 'https://en.wikipedia.org'; }
    }
    const s = await getJSON(`${host}/api/rest_v1/page/summary/${encodeURIComponent(t.replace(/ /g, '_'))}?redirect=true`, ID);
    if (s.type === 'disambiguation') throw new Error('disambiguation');
    return [{ title: s.title, text: s.extract, img: s.thumbnail?.source || null, url: s.content_urls?.desktop?.page, source: 'Wikipedia', lang: host.includes('//en.') ? 'en' : code }];
  });
  const it = filterItems(res.items)[0] || null;
  return it ? { ...it, stale: res.stale, offline: res.offline } : null;
}

// ---------- adapters: each returns [{ title, text, url, img, meta, source }] ----------
const A = {
  // Courses and textbooks written for learners.
  curricula: (w) => async () => {
    const out = [];
    for (const [site, name] of [['en.wikiversity.org', 'Wikiversity'], ['en.wikibooks.org', 'Wikibooks']]) {
      const j = await getJSON(`https://${site}/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(w.query)}&srlimit=6&format=json&origin=*`);
      for (const r of j.query.search) out.push({ title: r.title, text: strip(r.snippet), url: `https://${site}/wiki/${encodeURIComponent(r.title.replace(/ /g, '_'))}`, source: name });
    }
    return out;
  },
  // Recent peer-reviewed research, newest first.
  research: (w) => async () => {
    const since = new Date(Date.now() - 400 * 24 * HOUR).toISOString().slice(0, 10);
    const j = await getJSON(`https://api.openalex.org/works?search=${encodeURIComponent(w.query)}&filter=from_publication_date:${since},is_oa:true,type:article&sort=cited_by_count:desc&per-page=10&mailto=learn@example.org`);
    return j.results.map((r) => ({ title: r.title, text: r.primary_location?.source?.display_name || '', meta: `${r.publication_date} · ${r.cited_by_count} citations`, url: r.primary_location?.landing_page_url || r.id, source: 'OpenAlex' }));
  },
  // Conference papers and proceedings.
  conferences: (w) => async () => {
    const j = await getJSON(`https://api.openalex.org/works?search=${encodeURIComponent(w.query + ' education')}&filter=type:proceedings-article|article,primary_location.source.type:conference&sort=publication_date:desc&per-page=8&mailto=learn@example.org`);
    return j.results.map((r) => ({ title: r.title, text: r.primary_location?.source?.display_name || '', meta: r.publication_date, url: r.primary_location?.landing_page_url || r.id, source: 'OpenAlex · conferences' }));
  },
  // Recorded lectures, seminars, interviews and webinars held by the Internet Archive.
  talks: (w) => async () => {
    const q = `title:(${w.query.split(' ')[0]}) AND (lecture OR seminar OR webinar OR interview OR conference OR course) AND mediatype:(movies OR audio)`;
    const j = await getJSON(`https://archive.org/advancedsearch.php?q=${encodeURIComponent(q)}&fl[]=identifier&fl[]=title&fl[]=description&fl[]=year&fl[]=mediatype&sort[]=downloads+desc&rows=12&output=json`);
    return j.response.docs.map((d) => ({ title: d.title, text: strip([d.description].flat()[0] || '').slice(0, 220), meta: `${d.mediatype === 'audio' ? '🎧' : '🎬'} ${d.year || ''}`, url: `https://archive.org/details/${d.identifier}`, img: `https://archive.org/services/img/${d.identifier}`, source: 'Internet Archive' }));
  },
  // Community questions and answers (titles only, highest-voted).
  forums: (w) => async () => {
    const j = await getJSON(`https://api.stackexchange.com/2.3/questions?pagesize=10&order=desc&sort=votes&site=${w.se}&filter=default`);
    return j.items.map((q) => ({ title: strip(q.title), text: q.tags.slice(0, 4).join(' · '), meta: `▲ ${q.score} · ${q.answer_count} answers`, url: q.link, source: 'Stack Exchange · ' + w.se }));
  },
  // Open-source projects and teaching repositories.
  repos: (w) => async () => {
    const j = await getJSON(`https://api.github.com/search/repositories?q=${encodeURIComponent(w.query.split(' ').slice(0, 2).join(' ') + ' education')}&sort=stars&per_page=8`);
    return j.items.map((r) => ({ title: r.full_name, text: r.description || '', meta: `★ ${r.stargazers_count} · updated ${r.pushed_at.slice(0, 10)}`, url: r.html_url, source: 'GitHub' }));
  },
  // Open books.
  library: (w) => async () => {
    const j = await getJSON(`https://openlibrary.org/search.json?q=${encodeURIComponent(w.query)}&has_fulltext=true&limit=8&fields=key,title,author_name,first_publish_year,cover_i`);
    return j.docs.map((d) => ({ title: d.title, text: (d.author_name || []).slice(0, 2).join(', '), meta: d.first_publish_year ? String(d.first_publish_year) : '', url: `https://openlibrary.org${d.key}`, img: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : null, source: 'Open Library' }));
  },
};

async function worldBank(indicators) {
  const out = [];
  for (const [code, name] of indicators) {
    const j = await getJSON(`https://api.worldbank.org/v2/country/WLD/indicator/${code}?format=json&per_page=12`);
    const rows = (j[1] || []).filter((r) => r.value != null);
    if (rows.length) out.push({ title: name, text: rows.slice(0, 5).map((r) => `${r.date}: ${r.value.toFixed(1)}`).join(' · '), source: 'World Bank Open Data', url: `https://data.worldbank.org/indicator/${code}`, data: rows.slice(0, 8).map((r) => [+r.date, r.value]) });
  }
  return out;
}

// World-specific live data.
const SPECIAL = {
  apod: async () => { const j = await getJSON('https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY'); return [{ title: j.title, text: j.explanation, img: j.media_type === 'image' ? j.url : null, url: j.hdurl || j.url, meta: j.date, source: 'NASA · Astronomy Picture of the Day' }]; },
  iss: async () => { const j = await getJSON('https://api.wheretheiss.at/v1/satellites/25544'); return [{ title: 'International Space Station — right now', text: `Latitude ${j.latitude.toFixed(2)}°, longitude ${j.longitude.toFixed(2)}°, altitude ${j.altitude.toFixed(0)} km, speed ${Math.round(j.velocity)} km/h.`, meta: new Date(j.timestamp * 1000).toLocaleTimeString(), source: 'wheretheiss.at', data: j }]; },
  quakes: async () => { const j = await getJSON('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson'); return j.features.slice(0, 10).map((f) => ({ title: `M ${f.properties.mag.toFixed(1)} — ${f.properties.place}`, text: `Depth ${f.geometry.coordinates[2].toFixed(0)} km`, meta: new Date(f.properties.time).toLocaleString(), url: f.properties.url, source: 'USGS', data: { mag: f.properties.mag, lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] } })); },
  weather: async () => {
    const cities = [['Lagos', 6.45, 3.39], ['Nicosia', 35.17, 33.36], ['Tokyo', 35.68, 139.69], ['São Paulo', -23.55, -46.63], ['Sydney', -33.87, 151.21], ['Reykjavík', 64.15, -21.94], ['Mexico City', 19.43, -99.13], ['McMurdo Station', -77.85, 166.67]];
    const j = await getJSON(`https://api.open-meteo.com/v1/forecast?latitude=${cities.map((c) => c[1]).join(',')}&longitude=${cities.map((c) => c[2]).join(',')}&current=temperature_2m,wind_speed_10m,relative_humidity_2m`);
    return [j].flat().map((r, i) => ({ title: cities[i][0], text: `${r.current.temperature_2m} °C · wind ${r.current.wind_speed_10m} km/h · humidity ${r.current.relative_humidity_2m}%`, meta: `${cities[i][1]}°, ${cities[i][2]}°`, source: 'Open-Meteo', data: r.current }));
  },
  marine: async () => {
    const spots = [['North Sea', 56.5, 3], ['Gulf of Guinea', 3, 5], ['Gulf of Mexico', 27, -90], ['Bass Strait', -39.5, 146], ['Santos Basin', -25, -43], ['Eastern Mediterranean', 34, 32]];
    const j = await getJSON(`https://marine-api.open-meteo.com/v1/marine?latitude=${spots.map((c) => c[1]).join(',')}&longitude=${spots.map((c) => c[2]).join(',')}&current=wave_height,wave_period,wave_direction`);
    return [j].flat().map((r, i) => ({ title: spots[i][0], text: `Wave height ${r.current.wave_height} m · period ${r.current.wave_period} s · from ${r.current.wave_direction}°`, source: 'Open-Meteo Marine', data: r.current }));
  },
  onthisday: async () => {
    const d = new Date();
    const j = await getJSON(`https://api.wikimedia.org/feed/v1/wikipedia/${langInfo(lang).wiki}/onthisday/events/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`, ID);
    return (j.events || []).slice(0, 14).map((e) => ({ title: String(e.year), text: e.text, url: e.pages?.[0]?.content_urls?.desktop?.page, img: e.pages?.[0]?.thumbnail?.source || null, source: 'Wikipedia · On this day', data: { year: e.year } }));
  },
  worldbank: () => worldBank([['NY.GDP.MKTP.KD.ZG', 'World GDP growth (% per year)'], ['FP.CPI.TOTL.ZG', 'World inflation, consumer prices (% per year)'], ['SL.UEM.TOTL.ZS', 'World unemployment (% of labour force)'], ['SP.URB.TOTL.IN.ZS', 'People living in cities (% of population)']]),
  health: () => worldBank([['SP.DYN.LE00.IN', 'World life expectancy at birth (years)'], ['SH.DYN.MORT', 'Deaths of children under five (per 1,000 births)'], ['SH.MED.PHYS.ZS', 'Doctors per 1,000 people'], ['SH.IMM.MEAS', 'One-year-olds immunised against measles (%)']]),
  pubchem: async () => {
    const names = ['water', 'carbon dioxide', 'glucose', 'sodium chloride', 'ethanol', 'ammonia', 'methane', 'calcium carbonate'];
    const out = [];
    for (const n of names.sort(() => Math.random() - 0.5).slice(0, 4)) {
      const j = await getJSON(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(n)}/property/MolecularFormula,MolecularWeight,IUPACName/JSON`);
      const p = j.PropertyTable.Properties[0];
      out.push({ title: n, text: `${p.MolecularFormula} · ${p.MolecularWeight} g/mol · ${p.IUPACName}`, img: `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${p.CID}/PNG?image_size=160x160`, url: `https://pubchem.ncbi.nlm.nih.gov/compound/${p.CID}`, source: 'PubChem' });
    }
    return out;
  },
  lichess: async () => { const j = await getJSON('https://lichess.org/api/puzzle/daily'); return [{ title: 'Puzzle of the day', text: `Rating ${j.puzzle.rating} · themes: ${j.puzzle.themes.slice(0, 4).join(', ')}`, url: `https://lichess.org/training/${j.puzzle.id}`, source: 'Lichess', data: j }]; },
  musicbrainz: async () => {
    const genres = ['jazz', 'reggae', 'opera', 'country', 'rock and roll', 'rhythm and blues', 'classical', 'pop', 'rock', 'afrobeat', 'highlife', 'samba'];
    const g = genres[new Date().getDate() % genres.length];
    const j = await getJSON(`https://musicbrainz.org/ws/2/artist?query=tag:${encodeURIComponent('"' + g + '"')}&limit=8&fmt=json`);
    return j.artists.map((a) => ({ title: a.name, text: [a.type, a.country, a['life-span']?.begin].filter(Boolean).join(' · '), meta: g, url: `https://musicbrainz.org/artist/${a.id}`, source: 'MusicBrainz' }));
  },
  artic: async () => {
    const j = await getJSON(`https://api.artic.edu/api/v1/artworks/search?query[term][is_public_domain]=true&limit=8&page=${1 + (new Date().getDate() % 20)}&fields=id,title,artist_display,date_display,image_id,place_of_origin`);
    return j.data.filter((a) => a.image_id).map((a) => ({ title: a.title, text: `${a.artist_display || ''} · ${a.place_of_origin || ''}`.trim(), meta: a.date_display, img: `https://www.artic.edu/iiif/2/${a.image_id}/full/200,/0/default.jpg`, url: `https://www.artic.edu/artworks/${a.id}`, source: 'Art Institute of Chicago' }));
  },
  poetry: async () => { const j = await getJSON('https://poetrydb.org/author,linecount/Shakespeare;14'); const p = j[new Date().getDate() % j.length]; return [{ title: p.title, text: p.lines.join('\n'), meta: p.author, source: 'PoetryDB', pre: true }]; },
  books: async () => { const j = await getJSON('https://openlibrary.org/subjects/folklore.json?limit=8'); return j.works.map((b) => ({ title: b.title, text: (b.authors || []).map((a) => a.name).join(', '), img: b.cover_id ? `https://covers.openlibrary.org/b/id/${b.cover_id}-M.jpg` : null, url: `https://openlibrary.org${b.key}`, source: 'Open Library' })); },
  species: async () => {
    const names = ['Panthera leo', 'Loxodonta africana', 'Aptenodytes forsteri', 'Ailuropoda melanoleuca', 'Macropus rufus', 'Vultur gryphus', 'Balaenoptera musculus', 'Apis mellifera'];
    const out = [];
    for (const n of names.sort(() => Math.random() - 0.5).slice(0, 4)) {
      const j = await getJSON(`https://api.gbif.org/v1/species/match?name=${encodeURIComponent(n)}`);
      out.push({ title: `${j.canonicalName}`, text: [j.kingdom, j.phylum, j.class, j.order, j.family, j.genus].filter(Boolean).join(' › '), url: `https://www.gbif.org/species/${j.usageKey}`, source: 'GBIF' });
    }
    return out;
  },
  wiktionary: async () => { const j = await getJSON(`https://api.wikimedia.org/feed/v1/wikipedia/${langInfo(lang).wiki}/featured/${new Date().toISOString().slice(0, 10).replace(/-/g, '/')}`, ID); const a = j.tfa; return a ? [{ title: a.titles?.normalized || a.title, text: a.extract, img: a.thumbnail?.source || null, url: a.content_urls?.desktop?.page, source: 'Wikipedia · Featured article today' }] : []; },
};

export const CHANNELS = [
  ['today', '📡', 'Live today', 'Fresh data for this world, straight from its source', 'live'],
  ['curricula', '🎓', 'Courses', 'Open courses and textbooks', 'live'],
  ['research', '🔬', 'Research', 'Recent open-access research papers', 'live'],
  ['conferences', '🏛️', 'Conferences', 'Papers presented at academic conferences', 'live'],
  ['talks', '🎬', 'Talks', 'Recorded lectures, seminars, interviews and webinars', 'live'],
  ['library', '📚', 'Library', 'Open books on this subject', 'live'],
  ['forums', '💬', 'Forums', 'Top community questions', 'forums'],
  ['repos', '🧰', 'Repositories', 'Open projects and teaching code', 'repos'],
];
const MAXAGE = { today: HOUR, curricula: 72 * HOUR, research: 24 * HOUR, conferences: 48 * HOUR, talks: 72 * HOUR, library: 168 * HOUR, forums: 24 * HOUR, repos: 48 * HOUR };

export async function channel(wid, name) {
  const w = world(wid);
  if (name === 'today') {
    const keys = w.live || [];
    const parts = await Promise.all(keys.map((k) => cached(`sp|${k}|${k === 'onthisday' || k === 'wiktionary' ? lang + new Date().toDateString() : ''}`, MAXAGE.today, SPECIAL[k])));
    const items = parts.flatMap((p) => p.items);
    return { items: filterItems(items), at: Math.max(0, ...parts.map((p) => p.at)), stale: parts.some((p) => p.stale), offline: parts.some((p) => p.offline), empty: !keys.length };
  }
  const res = await cached(`ch|${wid}|${name}`, MAXAGE[name], A[name](w));
  return { ...res, items: filterItems(res.items) };
}

// Quietly refreshes the channels of worlds the player has opened, so material is fresh even on the next offline visit.
export async function backgroundRefresh() {
  if (!profile || !navigator.onLine || !can('live')) return;
  for (const wkey of Object.keys(profile.worlds).slice(0, 6)) {
    const wid = parseInt(wkey, 10);
    for (const [name, , , , perm] of CHANNELS) { if (can(perm)) { try { await channel(wid, name); } catch { /* next */ } } }
  }
}
export { isSafeText };
