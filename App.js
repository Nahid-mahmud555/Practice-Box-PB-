/* ==========================================================================
   Practice Box [ PB ] — Application Logic
   Vanilla JS (ES6+) + Supabase
   ========================================================================== */

'use strict';

/* ---------------------------------------------------------------------------
   1. SUPABASE CONFIGURATION
   Replace these two placeholders with your actual Supabase project values.
   Project Settings → API → Project URL / anon public key.
--------------------------------------------------------------------------- */
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

const TABLE_NAME = 'practices';
const MCQ_TARGET_COUNT = 70;
const SHORT_TARGET_COUNT = 30;

/**
 * Expected shape of a row in the `practices` table:
 * {
 *   id: uuid | number,
 *   department: 'CSE' | 'EEE' | 'BBA',
 *   semester: 1-8,
 *   type: 'MCQ' | 'SHORT',
 *   question: string,
 *   options: string[]           -- only for MCQ, exactly 4 options
 *   correct_answer: string,     -- for MCQ: exact text of the correct option
 *                                  for SHORT: the model answer text
 *   explanation: string
 * }
 */

let supabaseClient = null;

function initSupabase() {
  const isConfigured =
    SUPABASE_URL && SUPABASE_ANON_KEY &&
    !SUPABASE_URL.includes('YOUR_SUPABASE_URL') &&
    !SUPABASE_ANON_KEY.includes('YOUR_SUPABASE_ANON_KEY') &&
    window.supabase && typeof window.supabase.createClient === 'function';

  if (isConfigured) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } else {
    supabaseClient = null;
    console.warn(
      '[Practice Box] Supabase is not configured (or the CDN script failed to load). ' +
      'Falling back to local demo questions so the UI remains fully testable.'
    );
  }
}

/* ---------------------------------------------------------------------------
   2. APPLICATION STATE
--------------------------------------------------------------------------- */
const state = {
  department: 'CSE',
  semester: '1',
  questions: [],        // unified array of 100 question objects
  currentIndex: 0,
  score: 0,
  mcqTotal: 0,           // total number of MCQs actually loaded (denominator for score)
  answers: new Map(),    // index -> { answered: true, selected: string, isCorrect: bool }
  loading: false,
};

/* ---------------------------------------------------------------------------
   3. DOM REFERENCES
--------------------------------------------------------------------------- */
const dom = {
  html: document.documentElement,
  departmentSelect: document.getElementById('departmentSelect'),
  semesterSelect: document.getElementById('semesterSelect'),
  loadBtn: document.getElementById('loadBtn'),
  themeToggle: document.getElementById('themeToggle'),

  currentQNum: document.getElementById('currentQNum'),
  totalQNum: document.getElementById('totalQNum'),
  qTypeBadge: document.getElementById('qTypeBadge'),
  scoreValue: document.getElementById('scoreValue'),
  scoreMax: document.getElementById('scoreMax'),
  scoreRingFill: document.getElementById('scoreRingFill'),
  progressBar: document.getElementById('progressBar'),
  progressFill: document.getElementById('progressFill'),

  loadingState: document.getElementById('loadingState'),
  emptyState: document.getElementById('emptyState'),
  emptyStateText: document.getElementById('emptyStateText'),
  errorState: document.getElementById('errorState'),
  errorStateText: document.getElementById('errorStateText'),
  quizContent: document.getElementById('quizContent'),

  questionIndexLabel: document.getElementById('questionIndexLabel'),
  questionText: document.getElementById('questionText'),

  mcqGrid: document.getElementById('mcqGrid'),

  shortBlock: document.getElementById('shortBlock'),
  shortInput: document.getElementById('shortInput'),
  showAnswerBtn: document.getElementById('showAnswerBtn'),
  answerReveal: document.getElementById('answerReveal'),
  correctAnswerText: document.getElementById('correctAnswerText'),
  shortExplanationText: document.getElementById('shortExplanationText'),

  explanationBanner: document.getElementById('explanationBanner'),
  explanationStatus: document.getElementById('explanationStatus'),
  explanationText: document.getElementById('explanationText'),

  prevBtn: document.getElementById('prevBtn'),
  nextBtn: document.getElementById('nextBtn'),
  navPosition: document.getElementById('navPosition'),
};

const SCORE_RING_CIRCUMFERENCE = 2 * Math.PI * 27; // r=27 in the SVG

/* ---------------------------------------------------------------------------
   4. THEME HANDLING
--------------------------------------------------------------------------- */
function initTheme() {
  const saved = localStorage.getItem('pb-theme');
  const prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
  const theme = saved || (prefersLight ? 'light' : 'dark');
  applyTheme(theme);
}

function applyTheme(theme) {
  dom.html.setAttribute('data-theme', theme);
  dom.themeToggle.setAttribute('aria-pressed', String(theme === 'light'));
  localStorage.setItem('pb-theme', theme);
}

function toggleTheme() {
  const current = dom.html.getAttribute('data-theme');
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

/* ---------------------------------------------------------------------------
   5. DATA FETCHING (Supabase)
--------------------------------------------------------------------------- */
async function fetchQuestions(department, semester) {
  // If Supabase isn't configured, serve a local demo set so the app is
  // still fully explorable without a backend connection.
  if (!supabaseClient) {
    return buildDemoQuestionSet(department, semester);
  }

  try {
    const [mcqResult, shortResult] = await Promise.all([
      supabaseClient
        .from(TABLE_NAME)
        .select('*')
        .eq('department', department)
        .eq('semester', Number(semester))
        .eq('type', 'MCQ')
        .limit(MCQ_TARGET_COUNT),
      supabaseClient
        .from(TABLE_NAME)
        .select('*')
        .eq('department', department)
        .eq('semester', Number(semester))
        .eq('type', 'SHORT')
        .limit(SHORT_TARGET_COUNT),
    ]);

    if (mcqResult.error) throw mcqResult.error;
    if (shortResult.error) throw shortResult.error;

    const mcqRows = (mcqResult.data || []).map(normalizeRow);
    const shortRows = (shortResult.data || []).map(normalizeRow);

    if (mcqRows.length === 0 && shortRows.length === 0) {
      return { questions: [], mcqTotal: 0, source: 'supabase-empty' };
    }

    const combined = shuffleArray([...mcqRows, ...shortRows]);
    return { questions: combined, mcqTotal: mcqRows.length, source: 'supabase' };
  } catch (err) {
    console.error('[Practice Box] Supabase query failed:', err);
    throw err;
  }
}

function normalizeRow(row) {
  return {
    id: row.id,
    type: (row.type || 'MCQ').toUpperCase(),
    question: row.question || '',
    options: Array.isArray(row.options) ? row.options : safeParseOptions(row.options),
    correctAnswer: row.correct_answer || '',
    explanation: row.explanation || 'No explanation was provided for this question.',
  };
}

function safeParseOptions(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/* Fisher–Yates shuffle */
function shuffleArray(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ---------------------------------------------------------------------------
   6. LOCAL DEMO DATA (used when Supabase isn't configured / returns nothing)
--------------------------------------------------------------------------- */
function buildDemoQuestionSet(department, semester) {
  const mcqRows = [];
  for (let i = 1; i <= MCQ_TARGET_COUNT; i++) {
    const correctIndex = i % 4;
    const options = ['Option A', 'Option B', 'Option C', 'Option D'].map((label, idx) =>
      idx === correctIndex ? `${label} (Correct concept #${i})` : label
    );
    mcqRows.push({
      id: `demo-mcq-${i}`,
      type: 'MCQ',
      question: `[Demo] ${department} · Semester ${semester} — Sample MCQ question #${i}. This placeholder will be replaced once your Supabase table is connected.`,
      options,
      correctAnswer: options[correctIndex],
      explanation: `This is a placeholder explanation for demo question #${i}. Connect Supabase to load your real question bank.`,
    });
  }

  const shortRows = [];
  for (let i = 1; i <= SHORT_TARGET_COUNT; i++) {
    shortRows.push({
      id: `demo-short-${i}`,
      type: 'SHORT',
      question: `[Demo] ${department} · Semester ${semester} — Sample short question #${i}. Explain the key concept in your own words.`,
      options: [],
      correctAnswer: `This is the model answer for demo short question #${i}.`,
      explanation: `This explanation elaborates on why the model answer for question #${i} is structured this way.`,
    });
  }

  const combined = shuffleArray([...mcqRows, ...shortRows]);
  return { questions: combined, mcqTotal: mcqRows.length, source: 'demo' };
}

/* ---------------------------------------------------------------------------
   7. UI STATE PANELS
--------------------------------------------------------------------------- */
function showPanel(panel) {
  dom.loadingState.hidden = panel !== 'loading';
  dom.emptyState.hidden = panel !== 'empty';
  dom.errorState.hidden = panel !== 'error';
  dom.quizContent.hidden = panel !== 'content';
}

/* ---------------------------------------------------------------------------
   8. LOAD / START PRACTICE
--------------------------------------------------------------------------- */
async function startPractice() {
  if (state.loading) return;

  state.department = dom.departmentSelect.value;
  state.semester = dom.semesterSelect.value;
  state.loading = true;

  dom.loadBtn.disabled = true;
  showPanel('loading');
  dom.loadingState.querySelector('p').textContent = 'Loading your practice set…';
  setNavDisabled(true);

  try {
    const { questions, mcqTotal, source } = await fetchQuestions(state.department, state.semester);

    if (!questions.length) {
      dom.emptyStateText.textContent =
        `No questions were found for ${state.department} · Semester ${state.semester}. Try a different combination, or add rows to your Supabase "practices" table.`;
      showPanel('empty');
      resetSessionState([], 0);
      return;
    }

    resetSessionState(questions, mcqTotal);

    if (source === 'demo') {
      console.info('[Practice Box] Running on local demo data — connect Supabase for real content.');
    }

    renderQuestion(0);
    showPanel('content');
    setNavDisabled(false);
  } catch (err) {
    dom.errorStateText.textContent =
      'We could not reach Supabase. Please check your project URL, anon key and network connection, then try again.';
    showPanel('error');
  } finally {
    state.loading = false;
    dom.loadBtn.disabled = false;
  }
}

function resetSessionState(questions, mcqTotal) {
  state.questions = questions;
  state.currentIndex = 0;
  state.score = 0;
  state.mcqTotal = mcqTotal;
  state.answers = new Map();
  updateScoreUI();
  dom.totalQNum.textContent = String(questions.length);
}

function setNavDisabled(disabled) {
  dom.prevBtn.disabled = disabled;
  dom.nextBtn.disabled = disabled;
}

/* ---------------------------------------------------------------------------
   9. RENDERING A QUESTION
--------------------------------------------------------------------------- */
function renderQuestion(index) {
  const total = state.questions.length;
  if (total === 0) return;

  index = Math.max(0, Math.min(index, total - 1));
  state.currentIndex = index;
  const q = state.questions[index];

  // Dashboard
  dom.currentQNum.textContent = String(index + 1);
  dom.totalQNum.textContent = String(total);
  dom.qTypeBadge.textContent = q.type === 'MCQ' ? 'MCQ' : 'Short Question';
  dom.progressBar.setAttribute('aria-valuenow', String(Math.round(((index + 1) / total) * 100)));
  dom.progressFill.style.width = `${((index + 1) / total) * 100}%`;
  dom.navPosition.textContent = `${index + 1} / ${total}`;

  // Question text
  dom.questionIndexLabel.textContent = `Q${index + 1} · ${q.type === 'MCQ' ? 'Multiple Choice' : 'Short Answer'}`;
  dom.questionText.textContent = q.question;

  // Reset transient UI blocks
  dom.explanationBanner.hidden = true;
  dom.answerReveal.hidden = true;
  dom.shortInput.value = '';

  const existingAnswer = state.answers.get(index);

  if (q.type === 'MCQ') {
    dom.mcqGrid.hidden = false;
    dom.shortBlock.hidden = true;
    renderMcqOptions(q, existingAnswer);
  } else {
    dom.mcqGrid.hidden = true;
    dom.shortBlock.hidden = false;
    dom.mcqGrid.innerHTML = '';
    if (existingAnswer && existingAnswer.revealed) {
      revealShortAnswer(q, false);
      dom.shortInput.value = existingAnswer.typedValue || '';
    }
  }

  // Prev/Next boundary states
  dom.prevBtn.disabled = index === 0;
  dom.nextBtn.disabled = index === total - 1;
}

function renderMcqOptions(question, existingAnswer) {
  dom.mcqGrid.innerHTML = '';
  const letters = ['A', 'B', 'C', 'D', 'E', 'F'];

  question.options.forEach((optionText, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mcq-option';
    btn.dataset.optionIndex = String(i);

    const letterSpan = document.createElement('span');
    letterSpan.className = 'opt-letter';
    letterSpan.textContent = letters[i] || String(i + 1);

    const textSpan = document.createElement('span');
    textSpan.textContent = optionText;

    btn.appendChild(letterSpan);
    btn.appendChild(textSpan);

    btn.addEventListener('click', () => handleMcqAnswer(question, i, btn));
    dom.mcqGrid.appendChild(btn);
  });

  // Restore a previously answered state (locks the buttons + shows result)
  if (existingAnswer && existingAnswer.answered) {
    applyMcqResultToDom(question, existingAnswer.selectedIndex);
    dom.explanationBanner.hidden = false;
    setExplanationBanner(existingAnswer.isCorrect, question.explanation);
  }
}

/* ---------------------------------------------------------------------------
   10. MCQ ANSWER HANDLING
--------------------------------------------------------------------------- */
function handleMcqAnswer(question, selectedIndex, clickedBtn) {
  const idx = state.currentIndex;
  const existing = state.answers.get(idx);
  if (existing && existing.answered) return; // prevent multiple clicks

  const selectedText = question.options[selectedIndex];
  const isCorrect = selectedText === question.correctAnswer;

  state.answers.set(idx, {
    answered: true,
    type: 'MCQ',
    selectedIndex,
    isCorrect,
  });

  if (isCorrect) state.score += 1;
  updateScoreUI();

  applyMcqResultToDom(question, selectedIndex);
  dom.explanationBanner.hidden = false;
  setExplanationBanner(isCorrect, question.explanation);
}

function applyMcqResultToDom(question, selectedIndex) {
  const buttons = Array.from(dom.mcqGrid.querySelectorAll('.mcq-option'));
  const correctIndex = question.options.findIndex((opt) => opt === question.correctAnswer);

  buttons.forEach((btn, i) => {
    btn.disabled = true;
    if (i === correctIndex) {
      btn.classList.add('correct');
    } else if (i === selectedIndex) {
      btn.classList.add('incorrect');
    } else {
      btn.classList.add('dim');
    }
  });
}

function setExplanationBanner(isCorrect, explanationText) {
  dom.explanationStatus.textContent = isCorrect ? 'Correct' : 'Incorrect';
  dom.explanationStatus.className = `explanation-tag ${isCorrect ? 'is-correct' : 'is-incorrect'}`;
  dom.explanationText.textContent = explanationText;
}

/* ---------------------------------------------------------------------------
   11. SHORT ANSWER HANDLING
--------------------------------------------------------------------------- */
function revealShortAnswer(question, persistTypedValue = true) {
  const idx = state.currentIndex;

  if (persistTypedValue) {
    const prior = state.answers.get(idx) || {};
    state.answers.set(idx, {
      ...prior,
      type: 'SHORT',
      revealed: true,
      typedValue: dom.shortInput.value,
    });
  }

  dom.correctAnswerText.textContent = question.correctAnswer;
  dom.shortExplanationText.textContent = question.explanation;
  dom.answerReveal.hidden = false;
}

/* ---------------------------------------------------------------------------
   12. SCORE UI
--------------------------------------------------------------------------- */
function updateScoreUI() {
  dom.scoreValue.textContent = String(state.score);
  dom.scoreMax.textContent = `/${state.mcqTotal}`;

  const ratio = state.mcqTotal > 0 ? state.score / state.mcqTotal : 0;
  const offset = SCORE_RING_CIRCUMFERENCE * (1 - ratio);
  dom.scoreRingFill.style.strokeDasharray = String(SCORE_RING_CIRCUMFERENCE);
  dom.scoreRingFill.style.strokeDashoffset = String(offset);
}

/* ---------------------------------------------------------------------------
   13. NAVIGATION
--------------------------------------------------------------------------- */
function goToPrevious() {
  if (state.currentIndex > 0) renderQuestion(state.currentIndex - 1);
}

function goToNext() {
  if (state.currentIndex < state.questions.length - 1) renderQuestion(state.currentIndex + 1);
}

/* ---------------------------------------------------------------------------
   14. EVENT WIRING
--------------------------------------------------------------------------- */
function attachEventListeners() {
  dom.themeToggle.addEventListener('click', toggleTheme);
  dom.loadBtn.addEventListener('click', startPractice);

  dom.prevBtn.addEventListener('click', goToPrevious);
  dom.nextBtn.addEventListener('click', goToNext);

  dom.showAnswerBtn.addEventListener('click', () => {
    const q = state.questions[state.currentIndex];
    if (q) revealShortAnswer(q, true);
  });

  // Keep typed short-answer drafts in sync with state as the user types
  dom.shortInput.addEventListener('input', () => {
    const idx = state.currentIndex;
    const prior = state.answers.get(idx) || {};
    state.answers.set(idx, { ...prior, type: 'SHORT', typedValue: dom.shortInput.value });
  });

  // Keyboard navigation: left / right arrows move between questions
  document.addEventListener('keydown', (e) => {
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT') return;
    if (e.key === 'ArrowLeft') goToPrevious();
    if (e.key === 'ArrowRight') goToNext();
  });
}

/* ---------------------------------------------------------------------------
   15. INITIALIZATION
--------------------------------------------------------------------------- */
function init() {
  initTheme();
  initSupabase();
  attachEventListeners();
  updateScoreUI();
  showPanel('loading');
}

document.addEventListener('DOMContentLoaded', init);
