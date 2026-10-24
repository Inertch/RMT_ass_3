// Shared synthetic LMS data. Seeded, so every strategy and every run sees identical content.
// No real student or course data is used anywhere in this project.
const SCALE = parseFloat(process.env.DATA_SCALE || '1');               // 1 = baseline size, 2 = sensitivity run
const LATENCY_MS = parseInt(process.env.DATA_LATENCY_MS || '50', 10);  // simulated data-access delay (same for API and SSR)

const SEEDS = { dashboard: 101, gradebook: 202, quiz: 303, forum: 404 };
const WORDS = ['analysis', 'algorithm', 'network', 'database', 'lecture', 'seminar', 'project', 'report',
  'module', 'review', 'design', 'security', 'systems', 'compiler', 'statistics', 'ethics', 'calculus',
  'physics', 'assignment', 'discussion', 'graphics', 'protocol', 'testing', 'research'];

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
function sentence(r, n) {
  const w = []; for (let i = 0; i < n; i++) w.push(pick(r, WORDS));
  const s = w.join(' '); return s.charAt(0).toUpperCase() + s.slice(1) + '.';
}
const count = (n) => Math.round(n * SCALE);

function build(page) {
  const r = mulberry32(SEEDS[page]);
  if (page === 'dashboard') {
    return {
      courses: Array.from({ length: count(6) }, (_, i) => ({
        id: i + 1, code: `CS${100 + i}`, title: sentence(r, 3), instructor: `Instructor ${i + 1}`,
        progress: Math.floor(r() * 100),
      })),
      deadlines: Array.from({ length: count(10) }, (_, i) => ({
        id: i + 1, title: sentence(r, 4), due: `2026-11-${String(1 + Math.floor(r() * 28)).padStart(2, '0')}`,
      })),
    };
  }
  if (page === 'gradebook') {
    return {
      rows: Array.from({ length: count(60) }, (_, i) => ({
        id: i + 1, assignment: sentence(r, 3), weight: 1 + Math.floor(r() * 10),
        score: Math.floor(r() * 100), max: 100, date: `2026-10-${String(1 + Math.floor(r() * 28)).padStart(2, '0')}`,
      })),
    };
  }
  if (page === 'quiz') {
    return {
      questions: Array.from({ length: count(20) }, (_, i) => ({
        id: i + 1, text: sentence(r, 9), options: [0, 1, 2, 3].map(() => sentence(r, 3)),
      })),
    };
  }
  if (page === 'forum') {
    return {
      posts: Array.from({ length: count(50) }, (_, i) => ({
        id: i + 1, author: `Student ${1 + Math.floor(r() * 40)}`, text: sentence(r, 14), replies: Math.floor(r() * 12),
      })),
    };
  }
  throw new Error('unknown page ' + page);
}

// Number of elements marked data-testid="row" that a fully rendered page must contain.
function expectedRows(page) {
  const d = build(page);
  if (page === 'dashboard') return d.courses.length + d.deadlines.length;
  if (page === 'gradebook') return d.rows.length;
  if (page === 'quiz') return d.questions.length;
  return d.posts.length;
}

async function getPageData(page) {
  await new Promise((res) => setTimeout(res, LATENCY_MS));
  return build(page);
}

module.exports = { getPageData, expectedRows, LATENCY_MS, SCALE };
