/* =========================================================
   Practice Box [ PB ] — Application Logic
   ========================================================= */

/* ---------- 1. Supabase Configuration ---------- */
// Replace these placeholders with your project credentials.
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

const MCQ_COUNT = 70;
const SHORT_COUNT = 30;

// Only build a real client when credentials have been provided.
const isConfigured =
  SUPABASE_URL &&
  SUPABASE_ANON_KEY &&
  SUPABASE_URL !== 'YOUR_SUPABASE_URL' &&
  SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY' &&
  typeof window.supabase !== 'undefined';

const db = isConfigured
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

/* ---------- 2. Application State ---------- */
const state = {
  questions: [], // unified array of up to 100 questions
  index: 0,
  score: 0,
  answered: {}, // { questionIndex: chosenOptionIndex } for MCQ lock
  department: 'CSE',
  semester: '1',
};

/* ---------- 3. DOM References ---------- */
const el = {
  department: document.getElementById('departmentSelect'),
  semester: document.getElementById('semesterSelect'),
  themeToggle: document.getElementById('themeToggle'),

  progressFill: document.getElementById('progressFill'),
  progressText: document.getElementById('progressText'),
  scoreValue: document.getElementById('scoreValue'),
  typeBadge: document.getElementById('typeBadge'),

  loadingState: document.getElementById('loadingState'),
  messageState: document.getElementById('messageState'),
  messageText: document.getElementById('messageText'),
  retryBtn: document.getElementById('retryBtn'),
  questionView: document.getElementById('questionView'),

  qIndexBadge: document.getElementById('qIndexBadge'),
  qTypePill: document.getElementById('qTypePill'),
  questionText: document.getElementById('questionText'),

  optionsGrid: document.getElementById('optionsGrid'),

  shortBlock: document.getElementById('shortBlock'),
  shortInput: document.getElementById('shortInput'),
  showAnswerBtn: document.getElementById('showAnswerBtn'),
  answerReveal: document.getElementById('answerReveal'),
  answerText: document.getElementById('answerText'),

  explanationBanner: document.getElementById('explanationBanner'),
  explanationText: document.getElementById('explanationText'),

  prevBtn: document.getElementById('prevBtn'),
  nextBtn: document.getElementById('nextBtn'),
  navCounter: document.getElementById('navCounter'),
};

/* ---------- 4. Theme Handling ---------- */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  el.themeToggle.setAttribute('aria-checked', theme === 'light' ? 'true' : 'false');
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme === 'light' ? '#eef1f9' : '#0b0f1a');
  try {
    localStorage.setItem('pb-theme', theme);
  } catch (_) {
    /* storage may be unavailable */
  }
}

function initTheme() {
  let saved = 'dark';
  try {
    saved = localStorage.getItem('pb-theme') || 'dark';
  } catch (_) {
    /* ignore */
  }
  applyTheme(saved);
}

el.themeToggle.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  applyTheme(current === 'light' ? 'dark' : 'light');
});

/* ---------- 5. Data Fetching ---------- */
async function fetchQuestions(department, semester) {
  // Fetch 70 MCQ and 30 SHORT rows filtered by department + semester.
  const [mcqRes, shortRes] = await Promise.all([
    db
      .from('practices')
      .select('*')
      .eq('department', department)
      .eq('semester', Number(semester))
      .eq('type', 'MCQ')
      .limit(MCQ_COUNT),
    db
      .from('practices')
      .select('*')
      .eq('department', department)
      .eq('semester', Number(semester))
      .eq('type', 'SHORT')
      .limit(SHORT_COUNT),
  ]);

  if (mcqRes.error) throw mcqRes.error;
  if (shortRes.error) throw shortRes.error;

  const mcqs = (mcqRes.data || []).map(normalizeRow);
  const shorts = (shortRes.data || []).map(normalizeRow);

  // Unified session array of up to 100 questions (MCQ first, then SHORT).
  return [...mcqs, ...shorts];
}

// Normalize a Supabase row into the shape the UI expects.
function normalizeRow(row) {
  const type = (row.type || 'MCQ').toUpperCase();
  let options = row.options;
  if (typeof options === 'string') {
    try {
      options = JSON.parse(options);
    } catch (_) {
      options = options.split('|');
    }
  }
  return {
    id: row.id,
    type,
    question: row.question || '',
    options: Array.isArray(options) ? options : [],
    // correct answer stored as index (0-based) or exact text
    answer: row.answer,
    explanation: row.explanation || '',
  };
}

/* ---------- 6. Rendering ---------- */
function render() {
  const total = state.questions.length;
  if (total === 0) return;

  const q = state.questions[state.index];

  // Meta
  el.qIndexBadge.textContent = 'Q' + (state.index + 1);
  el.qTypePill.textContent = q.type === 'SHORT' ? 'Short Question' : 'MCQ';
  el.typeBadge.textContent = q.type === 'SHORT' ? 'SHORT' : 'MCQ';
  el.questionText.textContent = q.question;

  // Progress + score
  el.progressText.textContent = `Question ${state.index + 1} of ${total}`;
  el.progressFill.style.width = `${((state.index + 1) / total) * 100}%`;
  el.scoreValue.textContent = state.score;
  el.navCounter.textContent = `${state.index + 1} / ${total}`;

  // Reset shared banners
  el.explanationBanner.hidden = true;
  el.answerReveal.hidden = true;

  // Toggle mode
  if (q.type === 'SHORT') {
    renderShort(q);
  } else {
    renderMCQ(q);
  }

  // Nav buttons
  el.prevBtn.disabled = state.index === 0;
  el.nextBtn.disabled = state.index === total - 1;
}

function renderMCQ(q) {
  el.optionsGrid.hidden = false;
  el.shortBlock.hidden = true;
  el.optionsGrid.innerHTML = '';

  const correctIndex = resolveCorrectIndex(q);
  const previouslyChosen = state.answered[state.index];
  const isAnswered = previouslyChosen !== undefined;

  q.options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'option';
    btn.innerHTML = `<span class="option__key">${String.fromCharCode(65 + i)}</span><span class="option__label"></span>`;
    btn.querySelector('.option__label').textContent = opt;

    if (isAnswered) {
      btn.disabled = true;
      if (i === correctIndex) btn.classList.add('correct');
      else if (i === previouslyChosen) btn.classList.add('incorrect');
      else btn.classList.add('dimmed');
    } else {
      btn.addEventListener('click', () => handleAnswer(i, correctIndex, btn));
    }

    el.optionsGrid.appendChild(btn);
  });

  // Reveal explanation immediately if already answered
  if (isAnswered && q.explanation) {
    showExplanation(q.explanation);
  }
}

function renderShort(q) {
  el.optionsGrid.hidden = true;
  el.shortBlock.hidden = false;
  el.shortInput.value = '';
  el.answerReveal.hidden = true;

  // Rebind show-answer button freshly each render
  el.showAnswerBtn.onclick = () => {
    el.answerText.textContent = getAnswerText(q);
    el.answerReveal.hidden = false;
    if (q.explanation) showExplanation(q.explanation);
  };
}

/* ---------- 7. Answer Logic ---------- */
function handleAnswer(chosenIndex, correctIndex, btn) {
  // Prevent multiple clicks on an already answered question
  if (state.answered[state.index] !== undefined) return;

  state.answered[state.index] = chosenIndex;

  const q = state.questions[state.index];
  const buttons = el.optionsGrid.querySelectorAll('.option');

  buttons.forEach((b, i) => {
    b.disabled = true;
    if (i === correctIndex) b.classList.add('correct');
    else if (i === chosenIndex) b.classList.add('incorrect');
    else b.classList.add('dimmed');
  });

  if (chosenIndex === correctIndex) {
    state.score += 1;
    el.scoreValue.textContent = state.score;
  }

  if (q.explanation) showExplanation(q.explanation);
}

function showExplanation(text) {
  el.explanationText.textContent = text;
  el.explanationBanner.hidden = false;
}

// Resolve the correct option index whether "answer" is an index or text.
function resolveCorrectIndex(q) {
  if (typeof q.answer === 'number') return q.answer;
  const asNum = Number(q.answer);
  if (!Number.isNaN(asNum) && q.options[asNum] !== undefined) return asNum;
  const idx = q.options.findIndex(
    (o) => String(o).trim().toLowerCase() === String(q.answer).trim().toLowerCase()
  );
  return idx;
}

function getAnswerText(q) {
  if (q.options.length && typeof q.answer === 'number') return q.options[q.answer];
  return q.answer != null ? String(q.answer) : 'No answer provided.';
}

/* ---------- 8. Navigation ---------- */
el.prevBtn.addEventListener('click', () => {
  if (state.index > 0) {
    state.index -= 1;
    render();
  }
});

el.nextBtn.addEventListener('click', () => {
  if (state.index < state.questions.length - 1) {
    state.index += 1;
    render();
  }
});

/* ---------- 9. View State Helpers ---------- */
function showLoading() {
  el.loadingState.classList.remove('state-panel--hidden');
  el.messageState.classList.add('state-panel--hidden');
  el.questionView.classList.add('state-panel--hidden');
}

function showMessage(msg) {
  el.messageText.textContent = msg;
  el.loadingState.classList.add('state-panel--hidden');
  el.messageState.classList.remove('state-panel--hidden');
  el.questionView.classList.add('state-panel--hidden');
}

function showQuiz() {
  el.loadingState.classList.add('state-panel--hidden');
  el.messageState.classList.add('state-panel--hidden');
  el.questionView.classList.remove('state-panel--hidden');
}

/* ---------- 10. Session Loading ---------- */
async function loadSession() {
  state.department = el.department.value;
  state.semester = el.semester.value;
  state.index = 0;
  state.score = 0;
  state.answered = {};

  showLoading();

  try {
    let questions;
    if (isConfigured) {
      questions = await fetchQuestions(state.department, state.semester);
    } else {
      // Demo fallback so the app is fully interactive before Supabase is wired up.
      questions = buildDemoQuestions(state.department, state.semester);
    }

    if (!questions || questions.length === 0) {
      showMessage(
        `No questions found for ${state.department} · Semester ${state.semester}.`
      );
      el.scoreValue.textContent = '0';
      el.progressText.textContent = 'Question 0 of 0';
      el.progressFill.style.width = '0%';
      el.navCounter.textContent = '0 / 0';
      return;
    }

    state.questions = questions;
    showQuiz();
    render();
  } catch (err) {
    console.log('[v0] Failed to load questions:', err.message || err);
    showMessage('Could not load questions. Please check your connection and try again.');
  }
}

el.department.addEventListener('change', loadSession);
el.semester.addEventListener('change', loadSession);
el.retryBtn.addEventListener('click', loadSession);

/* ---------- 11. Demo Data (fallback only) ---------- */
function buildDemoQuestions(dept, sem) {
  const topics = {
    CSE: 'Data Structures & Algorithms',
    EEE: 'Circuit Theory & Electronics',
    BBA: 'Principles of Management',
  };
  const topic = topics[dept] || 'General Studies';
  const list = [];

  for (let i = 0; i < MCQ_COUNT; i++) {
    const a = (i % 9) + 1;
    const b = (i % 5) + 2;
    const sum = a + b;
    const opts = [sum, sum + 1, sum - 1, sum + 2].map(String);
    list.push({
      id: `demo-mcq-${i}`,
      type: 'MCQ',
      question: `[${dept} · Sem ${sem} · ${topic}] Q${i + 1}: What is ${a} + ${b}?`,
      options: opts,
      answer: 0,
      explanation: `${a} + ${b} equals ${sum}. This is sample demo content — connect Supabase to load real questions.`,
    });
  }

  for (let i = 0; i < SHORT_COUNT; i++) {
    list.push({
      id: `demo-short-${i}`,
      type: 'SHORT',
      question: `[${dept} · Sem ${sem} · ${topic}] Short Q${i + 1}: Briefly define concept #${i + 1}.`,
      options: [],
      answer: `Concept #${i + 1} is a key idea in ${topic}. This is sample demo content — connect Supabase to load real questions.`,
      explanation: `Review your ${topic} notes for a complete explanation of concept #${i + 1}.`,
    });
  }

  return list;
}

/* ---------- 12. Boot ---------- */
initTheme();
loadSession();

if (!isConfigured) {
  console.log(
    '[v0] Supabase not configured — running in demo mode. Add SUPABASE_URL and SUPABASE_ANON_KEY in app.js to use live data.'
  );
}
