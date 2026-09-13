/* =========================================================
   StudyTrack — app logic
   1. Grade tabs (1-10) switch the CSS theme tier
   2. Dynamic subject + exam-date rows
   3. Timetable generator: phases per subject based on days left
   4. Dashboard summary tiles
   5. Per-subject quiz bank + generic fallback quiz
   ========================================================= */

/* ---------- Sample quiz bank (extend anytime) ---------- */
const QUIZ_BANK = {
  math: [
    { q: "What is the value of π (pi) rounded to two decimals?", options: ["3.12", "3.14", "3.41", "4.13"], correct: 1 },
    { q: "Solve: 7 × 8 = ?", options: ["54", "56", "58", "64"], correct: 1 },
    { q: "What is the square root of 81?", options: ["7", "8", "9", "11"], correct: 2 }
  ],
  science: [
    { q: "What gas do plants absorb from the air for photosynthesis?", options: ["Oxygen", "Nitrogen", "Carbon dioxide", "Hydrogen"], correct: 2 },
    { q: "What is the powerhouse of the cell?", options: ["Nucleus", "Mitochondria", "Ribosome", "Cell wall"], correct: 1 },
    { q: "Water freezes at what temperature (°C)?", options: ["0°C", "10°C", "-10°C", "100°C"], correct: 0 }
  ],
  english: [
    { q: "Which word is a synonym for 'happy'?", options: ["Gloomy", "Joyful", "Angry", "Tired"], correct: 1 },
    { q: "Identify the noun: 'The dog ran quickly.'", options: ["ran", "quickly", "dog", "the"], correct: 2 },
    { q: "What is the past tense of 'go'?", options: ["goed", "gone", "went", "going"], correct: 2 }
  ],
  history: [
    { q: "Who is known as the Father of the Nation in India?", options: ["Jawaharlal Nehru", "Mahatma Gandhi", "Subhas Chandra Bose", "B.R. Ambedkar"], correct: 1 },
    { q: "In which year did World War II end?", options: ["1943", "1945", "1947", "1950"], correct: 1 },
    { q: "The Great Wall is located in which country?", options: ["Japan", "India", "China", "Egypt"], correct: 2 }
  ],
  computer: [
    { q: "What does CPU stand for?", options: ["Central Process Unit", "Central Processing Unit", "Computer Processing Unit", "Central Processor Utility"], correct: 1 },
    { q: "Which language is used to style web pages?", options: ["HTML", "CSS", "JS", "SQL"], correct: 1 },
    { q: "What does 'www' stand for?", options: ["World Wide Web", "Web Wide World", "World Web Wide", "Wide World Web"], correct: 0 }
  ]
};

const GENERIC_QUIZ = [
  { q: "What's usually the best time to start revising before an exam?", options: ["The night before", "As early as possible", "Only during free periods", "After the exam"], correct: 1 },
  { q: "Which habit helps memory the most?", options: ["Re-reading notes silently only", "Active recall & self-testing", "Highlighting everything", "Cramming"], correct: 1 },
  { q: "How long should a focused study session ideally be before a short break?", options: ["5 minutes", "25-40 minutes", "3 hours", "10 seconds"], correct: 1 }
];

/* ---------- State ---------- */
let subjectRowCount = 0;
let authMode = "register";
let authToken = localStorage.getItem("studymate_token");

function authHeaders() {
  return authToken ? { Authorization: `Bearer ${authToken}` } : {};
}

async function apiRequest(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { "Content-Type": "application/json", ...authHeaders(), ...(options.headers || {}) } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}

function plannerProfile() {
  return {
    name: document.getElementById("studentName").value.trim(),
    grade: [...document.querySelectorAll(".grade-tab")].findIndex(tab => tab.getAttribute("aria-pressed") === "true") + 1,
    routine: {
      wake: document.getElementById("wakeTime").value || "06:00",
      sleep: document.getElementById("sleepTime").value || "22:00",
      attendSchool: document.getElementById("attendSchool").checked,
      schoolStart: document.getElementById("schoolStart").value || "08:00",
      schoolEnd: document.getElementById("schoolEnd").value || "14:00"
    },
    subjects: readSubjects()
  };
}

async function savePlanner() {
  if (!authToken) return;
  try {
    await apiRequest("/api/planner", { method: "PUT", body: JSON.stringify(plannerProfile()) });
    document.getElementById("authMessage").textContent = "Planner saved";
  } catch (error) { document.getElementById("authMessage").textContent = error.message; }
}

function applyProfile(profile) {
  if (!profile) return;
  document.getElementById("studentName").value = profile.name || "";
  document.getElementById("wakeTime").value = profile.routine?.wake || "06:00";
  document.getElementById("sleepTime").value = profile.routine?.sleep || "22:00";
  document.getElementById("attendSchool").checked = profile.routine?.attendSchool !== false;
  document.getElementById("schoolStart").value = profile.routine?.schoolStart || "08:00";
  document.getElementById("schoolEnd").value = profile.routine?.schoolEnd || "14:00";
  document.getElementById("schoolTimes").classList.toggle("hidden", !document.getElementById("attendSchool").checked);
  document.getElementById("subjectList").innerHTML = "";
  subjectRowCount = 0;
  (profile.subjects || []).forEach(subject => addSubjectRow(subject));
  if (!profile.subjects?.length) { addSubjectRow(); addSubjectRow(); }
  if (profile.grade) selectGrade(profile.grade);
}

function setSignedIn(user) {
  document.getElementById("authSignedOut").classList.toggle("hidden", Boolean(user));
  document.getElementById("authSignedIn").classList.toggle("hidden", !user);
  if (user) document.getElementById("accountName").textContent = user.name;
}

function openAuth(mode) {
  authMode = mode;
  document.getElementById("authTitle").textContent = mode === "login" ? "Welcome back" : "Create your account";
  document.getElementById("authSubmit").textContent = mode === "login" ? "Sign in" : "Create account";
  document.getElementById("authNameField").classList.toggle("hidden", mode === "login");
  document.getElementById("authPassword").autocomplete = mode === "login" ? "current-password" : "new-password";
  document.getElementById("authError").textContent = "";
  document.getElementById("authModal").classList.remove("hidden");
}

async function restoreSession() {
  if (!authToken) return;
  try {
    const { user } = await apiRequest("/api/me");
    setSignedIn(user);
    const { profile } = await apiRequest("/api/planner");
    applyProfile(profile);
  } catch { localStorage.removeItem("studymate_token"); authToken = null; }
}

async function submitAuth(event) {
  event.preventDefault();
  const body = { email: document.getElementById("authEmail").value, password: document.getElementById("authPassword").value };
  if (authMode === "register") body.name = document.getElementById("authName").value;
  try {
    const { token, user } = await apiRequest(`/api/auth/${authMode}`, { method: "POST", body: JSON.stringify(body) });
    authToken = token;
    localStorage.setItem("studymate_token", token);
    setSignedIn(user);
    document.getElementById("authModal").classList.add("hidden");
    await savePlanner();
  } catch (error) { document.getElementById("authError").textContent = error.message; }
}

/* ---------- Grade tabs ---------- */
function initGradeTabs() {
  const wrap = document.getElementById("gradeTabs");
  for (let g = 1; g <= 10; g++) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "grade-tab";
    btn.textContent = g;
    btn.setAttribute("aria-pressed", g === 5 ? "true" : "false");
    btn.addEventListener("click", () => selectGrade(g));
    wrap.appendChild(btn);
  }
  applyGradeTheme(5);
}

function selectGrade(grade) {
  document.querySelectorAll(".grade-tab").forEach((b, i) => {
    b.setAttribute("aria-pressed", i + 1 === grade ? "true" : "false");
  });
  applyGradeTheme(grade);
}

function applyGradeTheme(grade) {
  document.body.classList.remove("grade-primary", "grade-middle", "grade-high");
  if (grade <= 5) document.body.classList.add("grade-primary");
  else if (grade <= 8) document.body.classList.add("grade-middle");
  else document.body.classList.add("grade-high");
}

/* ---------- Subject rows ---------- */
function addSubjectRow(prefill) {
  subjectRowCount++;
  const id = subjectRowCount;
  const row = document.createElement("div");
  row.className = "subject-row";
  row.dataset.rowId = id;
  row.innerHTML = `
    <label class="field">
      <span>Subject</span>
      <input type="text" class="subjectName" placeholder="e.g. Mathematics" value="${prefill ? prefill.name : ""}">
    </label>
    <label class="field">
      <span>Exam date</span>
      <input type="date" class="examDate" value="${prefill ? prefill.date : ""}">
    </label>
    <label class="field">
      <span>Difficulty</span>
      <select class="subjectDifficulty">
        <option value="easy">Easy</option>
        <option value="medium" selected>Medium</option>
        <option value="hard">Hard</option>
      </select>
    </label>
    <button type="button" class="remove-row" aria-label="Remove subject" title="Remove subject">×</button>
  `;
  row.querySelector(".remove-row").addEventListener("click", () => {
    row.remove();
  });
  document.getElementById("subjectList").appendChild(row);
}

function readSubjects() {
  const rows = document.querySelectorAll(".subject-row");
  const subjects = [];
  rows.forEach(row => {
    const name = row.querySelector(".subjectName").value.trim();
    const date = row.querySelector(".examDate").value;
    const difficulty = row.querySelector(".subjectDifficulty").value;
    if (name && date) subjects.push({ name, date, difficulty });
  });
  return subjects;
}

/* Toggle school start/end fields with the checkbox */
function initRoutineToggle() {
  const checkbox = document.getElementById("attendSchool");
  const schoolTimes = document.getElementById("schoolTimes");
  checkbox.addEventListener("change", () => {
    schoolTimes.classList.toggle("hidden", !checkbox.checked);
  });
}

function timeStrToMinutes(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function minutesToTimeStr(mins) {
  mins = ((mins % 1440) + 1440) % 1440;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const period = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

const DIFFICULTY_WEIGHT = { easy: 1, medium: 1.6, hard: 2.4 };

function subjectPhaseLabel(fractionLeft) {
  if (fractionLeft > 0.6) return "Learn & understand new concepts";
  if (fractionLeft > 0.3) return "Practice problems / past questions";
  if (fractionLeft > 0.1) return "Revise notes & summaries";
  return "Final revision & self-quiz";
}

/* Smooth Weighted Round Robin: picks the subject with the highest running
   credit, then reduces its credit by the total weight — spreads picks out
   fairly while favouring higher-weight (harder / more urgent) subjects. */
function swrrPick(state, excludeName) {
  const total = Object.values(state).reduce((s, e) => s + e.weight, 0);
  let best = null;
  Object.entries(state).forEach(([name, e]) => {
    e.current += e.weight;
    if (name === excludeName) return;
    if (!best || e.current > state[best].current) best = name;
  });
  if (best) state[best].current -= total;
  return best;
}

/* ---------- Timetable generation ---------- */
function daysBetween(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exam = new Date(dateStr);
  exam.setHours(0, 0, 0, 0);
  return Math.round((exam - today) / (1000 * 60 * 60 * 24));
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function formatDate(d) {
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

/* Build ONE single day-by-day routine, from today until the last exam,
   mixing the student's wake/school/meal/sleep routine with study blocks
   whose length depends on each subject's difficulty + urgency. */
function generateSingleTimetable(subjects, routine) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Per-subject fixed data, computed once
  const subjectInfo = {};
  subjects.forEach(s => {
    subjectInfo[s.name] = {
      totalDays: Math.max(1, daysBetween(s.date)),
      examDate: new Date(s.date)
    };
  });
  const lastExamDays = Math.max(...subjects.map(s => daysBetween(s.date)));

  const allRows = []; // { date, time, block, detail, badgeClass }
  let recapSubject = null; // carries into next day's morning recap

  for (let d = 0; d <= lastExamDays; d++) {
    const currentDate = addDays(today, d);

    // Which subjects still have an exam today or later?
    const active = subjects.filter(s => daysBetween(s.date) - d >= 0);
    const examToday = subjects.filter(s => daysBetween(s.date) - d === 0);
    const studyPool = subjects.filter(s => daysBetween(s.date) - d > 0);

    const dayRows = [];
    let t = timeStrToMinutes(routine.wake);

    dayRows.push(mkRow(currentDate, t, "Wake up & freshen up", "Start the day", "wake"));
    t += 30;

    // Morning recap of the subject studied hardest the previous evening
    const morningEnd = routine.attendSchool ? Math.max(t, timeStrToMinutes(routine.schoolStart)) : t + 30;
    const recapMinutes = Math.max(15, Math.min(30, morningEnd - t));
    if (recapSubject && studyPool.length) {
      dayRows.push(mkRow(currentDate, t, `Quick recap: ${recapSubject}`, "Flip through yesterday's notes / flashcards", "revision"));
    } else if (studyPool.length) {
      dayRows.push(mkRow(currentDate, t, "Quick recap", "Skim through any subject's key points", "revision"));
    }
    t += recapMinutes;

    if (routine.attendSchool) {
      const schoolStart = timeStrToMinutes(routine.schoolStart);
      const schoolEnd = timeStrToMinutes(routine.schoolEnd);
      t = Math.max(t, schoolStart);
      dayRows.push(mkRow(currentDate, t, "School / college", "Regular classes", "school"));
      t = schoolEnd;
      dayRows.push(mkRow(currentDate, t, "Lunch & rest", "Eat, relax, short nap if needed", "meal"));
      t += 45;
    } else {
      dayRows.push(mkRow(currentDate, t, "Lunch & rest", "Eat, relax, short nap if needed", "meal"));
      t += 45;
    }

    // Exam-today notices
    examToday.forEach(s => {
      dayRows.push(mkRow(currentDate, t, `Exam: ${s.name}`, "Good luck! Do a light final skim only.", "exam"));
    });

    // ----- Weighted study blocks for the evening -----
    if (studyPool.length > 0) {
      const weightState = {};
      studyPool.forEach(s => {
        const daysLeftForSubject = daysBetween(s.date) - d;
        const weight = DIFFICULTY_WEIGHT[s.difficulty] * (1 / daysLeftForSubject);
        weightState[s.name] = { weight, current: 0 };
      });

      const block1 = swrrPick(weightState);
      const block2 = studyPool.length > 1 ? swrrPick(weightState, block1) : block1;

      const dinnerMin = 30, finalRevisionMin = 20, shortBreakMin = 15;
      const sleepMinutes = timeStrToMinutes(routine.sleep);
      let totalDayMinutes = sleepMinutes - t;
      if (totalDayMinutes < 60) totalDayMinutes += 1440; // past midnight edge case
      const reserved = dinnerMin + finalRevisionMin + (block1 !== block2 ? shortBreakMin : 0);
      const studyPoolMinutes = Math.max(40, totalDayMinutes - reserved);

      let block1Minutes, block2Minutes;
      if (block1 === block2) {
        block1Minutes = studyPoolMinutes;
        block2Minutes = 0;
      } else {
        const w1 = weightState[block1].weight, w2 = weightState[block2].weight;
        block1Minutes = Math.max(25, Math.round((studyPoolMinutes * w1) / (w1 + w2)));
        block2Minutes = Math.max(25, studyPoolMinutes - block1Minutes);
      }

      const info1 = subjectInfo[block1];
      const fraction1 = (daysBetween(subjects.find(s => s.name === block1).date) - d) / info1.totalDays;
      dayRows.push(mkRow(
        currentDate, t, `Study block: ${block1}`,
        `${subjectPhaseLabel(fraction1)} (${block1Minutes} min, ${capitalize(subjects.find(s => s.name === block1).difficulty)} difficulty)`,
        "study"
      ));
      t += block1Minutes;

      if (block1 !== block2) {
        dayRows.push(mkRow(currentDate, t, "Short break", "Stretch, hydrate, walk around", "break"));
        t += shortBreakMin;

        const info2 = subjectInfo[block2];
        const fraction2 = (daysBetween(subjects.find(s => s.name === block2).date) - d) / info2.totalDays;
        dayRows.push(mkRow(
          currentDate, t, `Study block: ${block2}`,
          `${subjectPhaseLabel(fraction2)} (${block2Minutes} min, ${capitalize(subjects.find(s => s.name === block2).difficulty)} difficulty)`,
          "study"
        ));
        t += block2Minutes;
      }

      dayRows.push(mkRow(currentDate, t, "Dinner", "Eat & unwind", "meal"));
      t += dinnerMin;

      recapSubject = block2 || block1;
      dayRows.push(mkRow(currentDate, t, `Final light revision: ${recapSubject}`, "One quick pass — no new topics this late", "revision"));
      t += finalRevisionMin;
    } else {
      dayRows.push(mkRow(currentDate, t, "Dinner", "Eat & unwind", "meal"));
      t += 30;
      recapSubject = null;
    }

    if (t < timeStrToMinutes(routine.sleep)) {
      dayRows.push(mkRow(currentDate, t, "Free time / wind down", "Relax before bed", "break"));
    }
    dayRows.push(mkRow(currentDate, routine.sleep, "Sleep", "Aim for a full night's rest", "sleep"));

    allRows.push(...dayRows);
  }

  return allRows;
}

function mkRow(date, timeInput, block, detail, type) {
  const timeLabel = typeof timeInput === "number" ? minutesToTimeStr(timeInput) : minutesToTimeStr(timeStrToMinutes(timeInput));
  return { date, timeLabel, block, detail, type };
}
function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function generateTimetable() {
  const errorEl = document.getElementById("formError");
  errorEl.textContent = "";
  const subjects = readSubjects();

  if (subjects.length === 0) {
    errorEl.textContent = "Add at least one subject with a valid exam date.";
    return;
  }
  const pastDates = subjects.filter(s => daysBetween(s.date) < 0);
  if (pastDates.length > 0) {
    errorEl.textContent = `"${pastDates[0].name}" has an exam date already in the past — please check it.`;
    return;
  }

  const routine = {
    wake: document.getElementById("wakeTime").value || "06:00",
    sleep: document.getElementById("sleepTime").value || "22:00",
    attendSchool: document.getElementById("attendSchool").checked,
    schoolStart: document.getElementById("schoolStart").value || "08:00",
    schoolEnd: document.getElementById("schoolEnd").value || "14:00"
  };
  if (timeStrToMinutes(routine.sleep) - timeStrToMinutes(routine.wake) < 120) {
    errorEl.textContent = "Leave at least a couple of hours between wake-up and sleep time.";
    return;
  }

  const rows = generateSingleTimetable(subjects, routine);
  renderTimetable(rows);
  renderDashboard(subjects);
  renderQuizzes(subjects);
  savePlanner();
}

function renderTimetable(rows) {
  const tbody = document.getElementById("timetableBody");
  tbody.innerHTML = "";
  let lastDateStr = null;
  rows.forEach(row => {
    const dateStr = formatDate(row.date);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${dateStr === lastDateStr ? "" : `<strong>${dateStr}</strong>`}</td>
      <td>${row.timeLabel}</td>
      <td><span class="badge block-${row.type}">${row.block}</span></td>
      <td>${row.detail}</td>
    `;
    tbody.appendChild(tr);
    lastDateStr = dateStr;
  });
  document.getElementById("timetableSection").classList.remove("hidden");
}

/* ---------- Dashboard ---------- */
function renderDashboard(subjects) {
  const statRow = document.getElementById("statRow");
  statRow.innerHTML = "";

  const nearest = subjects.reduce((a, b) => (daysBetween(a.date) < daysBetween(b.date) ? a : b));
  const hardOnes = subjects.filter(s => s.difficulty === "hard");
  const tiles = [
    { num: subjects.length, lbl: "Subjects added", cls: "" },
    { num: `${daysBetween(nearest.date)}d`, lbl: `Until ${nearest.name}`, cls: "urgent" },
    { num: hardOnes.length, lbl: hardOnes.length === 1 ? `Hardest: ${hardOnes[0].name}` : "Marked as hard", cls: hardOnes.length ? "urgent" : "ok" }
  ];

  tiles.forEach(t => {
    const div = document.createElement("div");
    div.className = `stat-tile ${t.cls}`;
    div.innerHTML = `<span class="num">${t.num}</span><span class="lbl">${t.lbl}</span>`;
    statRow.appendChild(div);
  });

  document.getElementById("dashboard").classList.remove("hidden");
}

/* ---------- Quizzes ---------- */
function getQuizFor(subjectName) {
  const key = subjectName.trim().toLowerCase();
  const match = Object.keys(QUIZ_BANK).find(k => key.includes(k));
  return match ? QUIZ_BANK[match] : GENERIC_QUIZ;
}

function renderQuizzes(subjects) {
  const grid = document.getElementById("quizGrid");
  grid.innerHTML = "";
  subjects.forEach(subject => {
    const tile = document.createElement("div");
    tile.className = "quiz-tile";
    tile.innerHTML = `
      <h3>${subject.name}</h3>
      <p>A ${getQuizFor(subject.name).length}-question warm-up to check where you stand.</p>
      <button type="button" class="btn">Take quiz</button>
    `;
    tile.querySelector("button").addEventListener("click", () => openQuiz(subject.name));
    grid.appendChild(tile);
  });
  document.getElementById("quizSection").classList.remove("hidden");
}

function openQuiz(subjectName) {
  const questions = getQuizFor(subjectName);
  const modal = document.getElementById("quizModal");
  const body = document.getElementById("quizModalBody");
  document.getElementById("quizModalTitle").textContent = `${subjectName} — Quick Quiz`;

  let score = 0;
  let answered = 0;
  body.innerHTML = "";

  questions.forEach((item, qi) => {
    const qDiv = document.createElement("div");
    qDiv.className = "quiz-q";
    qDiv.innerHTML = `<p>${qi + 1}. ${item.q}</p>`;
    item.options.forEach((opt, oi) => {
      const optBtn = document.createElement("button");
      optBtn.type = "button";
      optBtn.className = "quiz-opt";
      optBtn.textContent = opt;
      optBtn.addEventListener("click", () => {
        if (optBtn.dataset.answered) return;
        const optionsInQ = qDiv.querySelectorAll(".quiz-opt");
        optionsInQ.forEach(b => (b.dataset.answered = "1"));
        if (oi === item.correct) {
          optBtn.classList.add("correct");
          score++;
        } else {
          optBtn.classList.add("wrong");
          optionsInQ[item.correct].classList.add("correct");
        }
        answered++;
        if (answered === questions.length) {
          const scoreP = document.createElement("p");
          scoreP.className = "quiz-score";
          scoreP.textContent = `Score: ${score} / ${questions.length}`;
          body.appendChild(scoreP);
        }
      });
      qDiv.appendChild(optBtn);
    });
    body.appendChild(qDiv);
  });

  modal.classList.remove("hidden");
}

function closeQuiz() {
  document.getElementById("quizModal").classList.add("hidden");
}

/* ---------- Init ---------- */
document.addEventListener("DOMContentLoaded", () => {
  initGradeTabs();
  initRoutineToggle();
  addSubjectRow();
  addSubjectRow();

  document.getElementById("addSubjectBtn").addEventListener("click", () => addSubjectRow());
  document.getElementById("generateBtn").addEventListener("click", generateTimetable);
  document.getElementById("loginBtn").addEventListener("click", () => openAuth("login"));
  document.getElementById("registerBtn").addEventListener("click", () => openAuth("register"));
  document.getElementById("authForm").addEventListener("submit", submitAuth);
  document.getElementById("authCloseBtn").addEventListener("click", () => document.getElementById("authModal").classList.add("hidden"));
  document.getElementById("logoutBtn").addEventListener("click", () => {
    authToken = null;
    localStorage.removeItem("studymate_token");
    setSignedIn(null);
    document.getElementById("authMessage").textContent = "Signed out";
  });
  restoreSession();
  document.getElementById("quizCloseBtn").addEventListener("click", closeQuiz);
  document.getElementById("quizModal").addEventListener("click", (e) => {
    if (e.target.id === "quizModal") closeQuiz();
  });
});