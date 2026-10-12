// Names for every character. The game system chooses them; a different cast appears on every level.
import { rngFrom, shuffle } from './util.js';
import { world } from '../data/worlds.js';
import curriculum from '../data/curriculum.js';

// Given names from many of the world's naming traditions, in no ranked order.
const GIVEN = ['Amara', 'Kofi', 'Zainab', 'Chidi', 'Thandiwe', 'Kwame', 'Nia', 'Tariq', 'Layla', 'Omar', 'Yasmin', 'Idris', 'Mei', 'Hiro', 'Yuki', 'Jin', 'Soo-ah', 'Minh', 'Linh', 'Arjun', 'Priya', 'Ravi', 'Ananya', 'Farah', 'Dara', 'Elif', 'Deniz', 'Nikos', 'Eleni', 'Luca', 'Giulia', 'Sofia', 'Mateo', 'Camila', 'Diego', 'Inés', 'João', 'Beatriz', 'Ingrid', 'Lars', 'Freya', 'Oisín', 'Aoife', 'Hugo', 'Chloé', 'Anya', 'Dmitri', 'Katya', 'Noa', 'Eitan', 'Talia', 'Aroha', 'Tane', 'Kaia', 'Koa', 'Leilani', 'Sione', 'Mila', 'Jarrah', 'Kirra', 'Nayeli', 'Takoda', 'Aiyana', 'Sacnite', 'Ximena', 'Inti', 'Killa', 'Samira', 'Rustam', 'Aigerim', 'Tenzin', 'Sita', 'Bao', 'Lan', 'Nuno', 'Petra', 'Milan', 'Zofia', 'Emeka', 'Folake', 'Sekou', 'Mariam', 'Hana', 'Kenji', 'Naledi', 'Lwazi', 'Wanjiru', 'Baraka', 'Selam', 'Dawit', 'Ama', 'Yaw', 'Ayla', 'Emre', 'Rania', 'Karim', 'Ioana', 'Stefan', 'Maya', 'Leo', 'Ruth', 'Sam', 'Ada', 'Ben', 'Iris', 'Tom', 'Zara', 'Eli'];
const FAMILY = ['Okafor', 'Mensah', 'Abebe', 'Diallo', 'Nkosi', 'Otieno', 'Haddad', 'Rahman', 'Farouk', 'Tanaka', 'Sato', 'Wang', 'Chen', 'Park', 'Nguyen', 'Sharma', 'Iyer', 'Khan', 'Yilmaz', 'Demir', 'Papadakis', 'Rossi', 'Bianchi', 'García', 'Fernández', 'Silva', 'Santos', 'Lindqvist', 'Hansen', 'Murphy', 'Dubois', 'Laurent', 'Ivanova', 'Petrov', 'Cohen', 'Levi', 'Ngata', 'Kealoha', 'Tuilagi', 'Watson', 'Begay', 'Morningstar', 'Quispe', 'Mamani', 'Karimov', 'Dorji', 'Novak', 'Kowalski', 'Adeyemi', 'Traoré', 'Mwangi', 'Tesfaye', 'Boateng', 'Aydin', 'Mansour', 'Popescu', 'Costa', 'Moreno', 'Reyes', 'Castillo', 'Kimura', 'Lim', 'Tran', 'Patel', 'Singh', 'Hosseini', 'Bello', 'Sow', 'Zulu', 'Kamau', 'Stone', 'Rivers', 'Bright', 'Marsh', 'Vale', 'Hart'];

// Friendly pseudonyms offered to players (they never type a real name).
const HANDLE_A = ['Nova', 'Comet', 'Atlas', 'Echo', 'Pixel', 'River', 'Sunny', 'Zephyr', 'Indigo', 'Maple', 'Orbit', 'Cedar', 'Lumen', 'Coral', 'Quill', 'Sage', 'Ember', 'Juno', 'Kite', 'Lotus', 'Onyx', 'Pebble', 'Rune', 'Sol', 'Tango', 'Vega', 'Wren', 'Yara', 'Zuri', 'Kai', 'Nilo', 'Asha', 'Miro', 'Taro', 'Ife', 'Lior', 'Suri', 'Rumi'];
const HANDLE_B = ['Falcon', 'Otter', 'Lynx', 'Heron', 'Fox', 'Panda', 'Dolphin', 'Owl', 'Tiger', 'Gecko', 'Koala', 'Finch', 'Bison', 'Ibis', 'Lemur', 'Puma', 'Raven', 'Seal', 'Swift', 'Turtle', 'Wolf', 'Yak', 'Zebra', 'Crane', 'Hare', 'Moth', 'Newt', 'Robin'];

export function nameMenu(seed, n = 9) {
  const rng = rngFrom('names' + seed);
  const a = shuffle(HANDLE_A, rng), b = shuffle(HANDLE_B, rng);
  return Array.from({ length: n }, (_, i) => `${a[i % a.length]} ${b[i % b.length]}`);
}

const TITLES = { teacher: ['Professor', 'Dr.', 'Mentor', 'Coach', 'Guide'], doctor: ['Dr.'] };

// The cast for one level of one world: teacher, master, three doctors, a beginner to teach, three classmates.
// `run` changes when a level is repeated, so the learner meets the level in a different atmosphere.
export function cast(wkey, level, run = 0) {
  const wid = parseInt(wkey, 10);
  const rng = rngFrom(`cast|${wkey}`);
  const given = shuffle(GIVEN, rng), family = shuffle(FAMILY, rng);
  const base = ((level - 1) * 9 + run * 54) % given.length;
  const person = (i, role, title) => {
    const g = given[(base + i) % given.length], f = family[(base * 3 + i * 7 + run) % family.length];
    return { name: title ? `${title} ${g} ${f}` : `${g} ${f}`, short: g, role, seed: `${wkey}|${level}|${run}|${role}|${i}` };
  };
  const duelTitle = curriculum[wid - 1][level - 1][9];
  const master = person(1, 'master');
  // Masters the documents already name ("Captain Newton", "Dr. Vortex") keep that name; titled roles get a person.
  if (/^The /.test(duelTitle)) { master.title = duelTitle; master.name = `${master.name}, ${duelTitle}`; }
  else { master.name = duelTitle; master.short = duelTitle; master.title = world(wid).short + ' Master'; }
  const teacherTitle = TITLES.teacher[(wid + level + run) % TITLES.teacher.length];
  const teacher = person(0, 'teacher', teacherTitle);
  teacher.title = world(wid).mentor;
  return {
    teacher, master,
    doctors: [person(2, 'doctor', 'Dr.'), person(3, 'doctor', 'Dr.'), person(4, 'doctor', 'Dr.')],
    layman: person(5, 'layman'),
    peers: [person(6, 'peer'), person(7, 'peer'), person(8, 'peer')],
  };
}

// The level's master appears at every stage test of that level, and for the final showdown at stage 10.
export const stageMaster = (wkey, level, run = 0) => cast(wkey, level, run).master;
