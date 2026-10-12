// The 20 learning worlds. Stage titles live in curriculum.json; lesson content in /content.

export const LEVELS = [
  { n: 1, name: 'Discovery', about: 'Recognition, observation, exploration and first ideas', pass: 0.7, master: 0.5 },
  { n: 2, name: 'Foundations', about: 'Fundamental principles, vocabulary and basic applications', pass: 0.7, master: 0.55 },
  { n: 3, name: 'Explorer', about: 'Intermediate concepts, experiments and problem-solving', pass: 0.75, master: 0.6 },
  { n: 4, name: 'Advanced Explorer', about: 'Complex applications, analysis and challenges across subjects', pass: 0.75, master: 0.65 },
  { n: 5, name: 'Young Master', about: 'Advanced ideas, independent reasoning and projects', pass: 0.8, master: 0.7 },
  { n: 6, name: 'Grand Master', about: 'University-style introductory and specialist challenges', pass: 0.85, master: 0.75 },
];

// Credits earned for winning the Master at each stage of a level (stage 10 is the level championship).
export const STAGE_REWARD = [100, 150, 200, 250, 300, 400, 500, 650, 800, 1500];
export const AWARD = { lesson: 10, experiment: 20, hard: 25, investigation: 50, duel: 100, perfect: 50, coop: 75, championship: 1500 };

const W = (id, name, short, em, c1, c2, credit, creditEm, mentor, feature, scene, se, query, extra = {}) =>
  ({ id, name, short, em, c1, c2, credit, creditEm, mentor, feature, scene, se, query, ...extra });

export const WORLDS = [
  W(1, 'Physics and Astronomy', 'Physics & Astronomy', '🪐', '#3b3fd8', '#8a5cf6', 'Cosmic Credits', '✨', 'Professor of the Observatory', 'Memory Palace Observatory', '🌍🌙⭐☄️🔭', 'physics', 'physics astronomy', { live: ['apod', 'iss'] }),
  W(2, 'Chemistry and Materials Science', 'Chemistry & Materials', '⚗️', '#0e9f8e', '#44c96b', 'Element Tokens', '🧪', 'Keeper of the Elements', 'The Molecular Constructor', '⚛️🧪💧🔥🧊', 'chemistry', 'chemistry materials science', { live: ['pubchem'] }),
  W(3, 'Mechanical and Manufacturing Engineering', 'Mechanical Engineering', '⚙️', '#e0662a', '#f5a524', 'Gear Marks', '🔩', 'Chief of the Workshop', 'The Engineering Workshop', '⚙️🔧🏭🤖🛠️', 'engineering', 'mechanical engineering manufacturing'),
  W(4, 'Aerospace and Aeronautical Engineering', 'Aerospace Engineering', '🚀', '#1f8fe5', '#5ad1ff', 'Flight Wings', '🪽', 'Flight Academy Instructor', 'The Flight Academy', '✈️🚁🚀🛰️☁️', 'aviation', 'aerospace engineering aerodynamics', { live: ['iss', 'apod'] }),
  W(5, 'Marine, Offshore and Subsea Engineering', 'Marine & Offshore', '⚓', '#0d6fb8', '#19b8c9', 'Ocean Pearls', '🫧', 'Harbour Master Engineer', 'The Deepwater Mission', '🚢🌊⚓🐋🛟', 'engineering', 'offshore marine engineering naval architecture', { live: ['marine'] }),
  W(6, 'Nuclear Engineering', 'Nuclear Engineering', '⚛️', '#7a4be0', '#c95be0', 'Atom Sparks', '💠', 'Guardian of the Safety Academy', 'The Nuclear Safety Academy', '⚛️💡🛡️🏥🔬', 'physics', 'nuclear engineering reactor safety'),
  W(7, 'Geography', 'Geography', '🌍', '#1b9c5a', '#7cc93d', 'Compass Points', '🧭', 'Expedition Leader', 'The World Expedition', '🗺️🏔️🏝️🌋🧭', 'earthscience', 'geography earth', { live: ['quakes', 'weather'] }),
  W(8, 'World History and Civilisations', 'World History', '🏛️', '#a8641c', '#e0a43a', 'Chronicle Seals', '📜', 'Archivist of the Time Archive', "The Time Traveller's Archive", '🏛️📜🏺🗿⛵', 'history', 'world history civilisation', { live: ['onthisday'] }),
  W(9, 'Mathematics and Statistics', 'Mathematics & Statistics', '🧮', '#d6336c', '#f76707', 'Prime Gems', '💎', 'Guide of the Labyrinth', 'The Mathematical Labyrinth', '➕✖️📐📊∞', 'math', 'mathematics statistics'),
  W(10, 'World Languages', 'World Languages', '🗣️', '#c2255c', '#845ef7', 'Passport Stamps', '🛂', 'Language Guide', 'The Language Passport', '👋🗨️✍️🎧🛂', 'languagelearning', 'language learning linguistics', { live: ['wiktionary'] }),
  W(11, 'Biology and Life Sciences', 'Biology & Life Sciences', '🧬', '#2b8a3e', '#20c997', 'Life Seeds', '🌱', 'Field Naturalist', 'The Living World Explorer', '🧬🌿🦋🔬🐘', 'biology', 'biology life sciences', { live: ['species'] }),
  W(12, 'Economics', 'Economics', '📈', '#0b7285', '#3bc9db', 'Trade Tokens', '🪙', 'Steward of the Economic Kingdom', 'The Economic Kingdom', '📈🏪⚖️🌾🏦', 'economics', 'economics', { live: ['worldbank'] }),
  W(13, 'Chess and Reasoning', 'Chess & Reasoning', '♟️', '#343a40', '#868e96', 'Crown Points', '♛', 'Arena Coach', 'The Grandmaster Arena', '♟️♞♜♛🧩', 'chess', 'chess strategy reasoning', { live: ['lichess'] }),
  W(14, 'Music', 'Music', '🎵', '#e64980', '#fd7e14', 'Melody Notes', '🎶', 'Academy Conductor', 'The Music Academy', '🎹🎸🥁🎻🎷', 'music', 'music theory musicology', { live: ['musicbrainz'] }),
  W(15, 'Arts: Fine Arts and Sculpture', 'Fine Arts & Sculpture', '🎨', '#ae3ec9', '#f06595', 'Palette Drops', '🖌️', 'Gallery Curator', "The Artist's Memory Gallery", '🎨🖼️🗿✏️🏺', 'crafts', 'art history painting sculpture', { live: ['artic'] }),
  W(16, 'Literature, Shakespeare and World Folktales', 'Literature & Folktales', '📚', '#5f3dc4', '#3b5bdb', 'Story Scrolls', '📖', 'Librarian of the Living Library', 'The Living Library', '📚🎭🪶🐉🕷️', 'literature', 'literature folklore', { live: ['poetry', 'books'] }),
  W(17, 'How to Think, Knowledge and Strategy', 'Thinking & Strategy', '🧠', '#1098ad', '#7048e8', 'Insight Keys', '🗝️', 'Guide of the Labyrinth of Reason', 'The Labyrinth of Reason', '🧠💡🧩🔍🎯', 'philosophy', 'critical thinking reasoning decision theory'),
  W(18, 'Medicine — Young Doctor Simulator', 'Young Doctor', '🩺', '#e03131', '#ff8787', 'Care Hearts', '💗', 'Supervising Doctor', 'The Virtual Teaching Hospital', '🩺🏥❤️🧫🩹', 'medicalsciences', 'medicine clinical education', { live: ['health'] }),
  W(19, 'Governance — Mayor for a Day', 'Mayor for a Day', '🏙️', '#2f9e44', '#1c7ed6', 'Civic Stars', '⭐', 'City Hall Adviser', "The Mayor's Challenge", '🏙️🚌🌳🏫🗳️', 'politics', 'local government public administration urban planning', { live: ['worldbank'] }),
  W(20, 'Philosophy and Ethics Quest', 'Philosophy & Ethics', '🦉', '#6741d9', '#f59f00', 'Wisdom Lanterns', '🏮', 'Host of the Council', 'The Council of Philosophers', '🦉⚖️🏺💭🕯️', 'philosophy', 'philosophy ethics'),
];

export const world = (id) => WORLDS[parseInt(id, 10) - 1];

// Language paths inside World 10.
export const TARGET_LANGS = ['en', 'es', 'fr', 'ar', 'ru', 'he', 'it', 'el', 'tr', 'pt', 'zh', 'ja'];

// Everyday settings a learner can say they know well; lessons pick analogies to match.
export const CONTEXTS = [
  ['home', '🏠', 'Home and family life'], ['city', '🏙️', 'City life and transport'], ['farm', '🚜', 'Farming and the countryside'],
  ['sport', '⚽', 'Sport and games'], ['sea', '⛵', 'The sea, rivers and boats'], ['music', '🎵', 'Music and performance'],
  ['nature', '🌳', 'Animals, plants and the outdoors'], ['tech', '💻', 'Computers, phones and machines'],
];

// The nine learning steps every stage follows.
export const STEPS = [
  ['discover', '🔎', 'Discover'], ['understand', '💡', 'Understand'], ['encode', '🧩', 'Remember'], ['recall', '🧠', 'Recall'],
  ['experiment', '🧪', 'Experiment'], ['apply', '🛠️', 'Apply'], ['explain', '🗣️', 'Explain'],
];
