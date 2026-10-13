// Names for every character. The game system chooses them; a different cast appears on every level.
import { rngFrom, shuffle } from './util.js';
import { world } from '../data/worlds.js';
import curriculum from '../data/curriculum.js';

// English given names and family names for the cast.
const GIVEN = ['Ada', 'Alice', 'Amelia', 'Anna', 'Arthur', 'Ben', 'Charlotte', 'Charlie', 'Chloe', 'Clara', 'Daisy', 'Daniel', 'David', 'Edward', 'Eleanor', 'Elizabeth', 'Ella', 'Emily', 'Emma', 'Ethan', 'Eva', 'Florence', 'Frank', 'Freddie', 'George', 'Grace', 'Hannah', 'Harriet', 'Harry', 'Henry', 'Holly', 'Isaac', 'Isla', 'Jack', 'Jacob', 'James', 'Jane', 'Jessica', 'Joseph', 'Joshua', 'Julia', 'Kate', 'Laura', 'Leo', 'Lily', 'Lucy', 'Luke', 'Lydia', 'Mary', 'Matthew', 'Max', 'Megan', 'Michael', 'Molly', 'Nathan', 'Nora', 'Oliver', 'Olivia', 'Oscar', 'Owen', 'Peter', 'Phoebe', 'Poppy', 'Rachel', 'Rebecca', 'Robert', 'Rose', 'Ruby', 'Ruth', 'Sam', 'Sarah', 'Scarlett', 'Simon', 'Sophie', 'Stella', 'Thomas', 'Toby', 'Victoria', 'Violet', 'William', 'Zoe', 'Adam', 'Alex', 'Bella', 'Caleb', 'Dylan', 'Erin', 'Felix', 'Hazel', 'Ivy', 'Jasper', 'Maya', 'Noah', 'Robin', 'Theo', 'Willow'];
const FAMILY = ['Adams', 'Allen', 'Bailey', 'Baker', 'Barnes', 'Bell', 'Bennett', 'Brooks', 'Brown', 'Carter', 'Clark', 'Cole', 'Collins', 'Cook', 'Cooper', 'Davies', 'Dawson', 'Edwards', 'Ellis', 'Evans', 'Fisher', 'Fletcher', 'Ford', 'Foster', 'Gardner', 'Gibson', 'Graham', 'Grant', 'Gray', 'Green', 'Hall', 'Harris', 'Harvey', 'Hayes', 'Hill', 'Holmes', 'Hughes', 'Hunter', 'Jackson', 'James', 'Jenkins', 'Johnson', 'Jones', 'Kelly', 'Kennedy', 'King', 'Knight', 'Lawson', 'Lee', 'Lewis', 'Marshall', 'Mason', 'Miller', 'Mills', 'Mitchell', 'Moore', 'Morgan', 'Morris', 'Murray', 'Newton', 'Palmer', 'Parker', 'Pearson', 'Porter', 'Reed', 'Reynolds', 'Richards', 'Roberts', 'Robinson', 'Rogers', 'Russell', 'Scott', 'Shaw', 'Smith', 'Spencer', 'Stevens', 'Stone', 'Taylor', 'Thompson', 'Turner', 'Walker', 'Ward', 'Watson', 'Webb', 'West', 'White', 'Wilson', 'Wood', 'Wright', 'Young'];

// Friendly pseudonyms offered to players (they never type a real name).
const HANDLE_A = ['Nova', 'Comet', 'Atlas', 'Echo', 'Pixel', 'River', 'Sunny', 'Breeze', 'Indigo', 'Maple', 'Orbit', 'Cedar', 'Lumen', 'Coral', 'Quill', 'Sage', 'Ember', 'Juniper', 'Kite', 'Lotus', 'Onyx', 'Pebble', 'Rune', 'Sol', 'Tango', 'Vega', 'Wren', 'Aspen', 'Clover', 'Dusty', 'Flint', 'Garnet', 'Harbor', 'Jet', 'Marble', 'Opal', 'Storm', 'Willow'];
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
