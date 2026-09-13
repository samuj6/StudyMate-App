/* =========================================================
   StudyTrack — app logic
   1. Grade tabs (1-10) switch the CSS theme tier
   2. Dynamic subject + exam-date + difficulty rows
   3. ONE recurring daily routine (wake -> school -> study -> sleep),
      with study minutes split across subjects by difficulty + urgency
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

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}
function formatDate(d) {
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}
function formatShortDate(d) {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
function minutesToHoursLabel(mins) {
  const h = Math.floor(mins / 60), m = mins % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
function subjectPhaseLabel(fractionLeft) {
  if (fractionLeft > 0.6) return "Learn concepts";
  if (fractionLeft > 0.3) return "Practice problems";
  if (fractionLeft > 0.1) return "Revise notes";
  return "Final revision";
}

/* Rough total study minutes available per day, after wake routine, school,
   meals, recap and final revision are reserved. Shared by the daily and
   weekly views so their numbers line up with the "One Routine" view. */
function getStudyPoolMinutes(routine) {
  const wake = timeStrToMinutes(routine.wake);
  const sleep = timeStrToMinutes(routine.sleep);
  let total = sleep - wake;
  if (total < 60) total += 1440;
  const school = routine.attendSchool
    ? (timeStrToMinutes(routine.schoolEnd) - timeStrToMinutes(routine.schoolStart))
    : 0;
  const fixed = 30 /* wake routine */ + 20 /* recap */ + school + 45 /* lunch */ + 30 /* dinner */ + 20 /* final revision */ + 15 /* misc breaks */;
  return Math.max(60, total - fixed);
}

/* ---------- Timetable generation ---------- */
function daysBetween(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exam = new Date(dateStr);
  exam.setHours(0, 0, 0, 0);
  return Math.round((exam - today) / (1000 * 60 * 60 * 24));
}

/* Build ONE recurring daily routine (not repeated per date). The student
   follows this same routine every day until their exams. Study time is
   split, once, across every subject by weight = difficulty × urgency, so
   harder / sooner subjects get a visibly bigger slot. Re-generating later
   (as exam dates get closer) rebalances it automatically. */
function generateSingleTimetable(subjects, routine) {
  const rows = [];
  let t = timeStrToMinutes(routine.wake);

  rows.push(mkRow(t, "Wake up & freshen up", "Start the day", "wake"));
  t += 30;

  // Subjects still to prepare for (exam is at least 1 day away)
  const upcoming = subjects.filter(s => daysBetween(s.date) > 0)
    .sort((a, b) => daysBetween(a.date) - daysBetween(b.date));
  const examToday = subjects.filter(s => daysBetween(s.date) === 0);

  const mostUrgent = upcoming[0] ? upcoming[0].name : null;

  // Morning recap block (fills the gap up to school, or a fixed 30 min)
  const morningEnd = routine.attendSchool ? Math.max(t, timeStrToMinutes(routine.schoolStart)) : t + 30;
  const recapMinutes = Math.max(15, Math.min(30, morningEnd - t));
  if (mostUrgent) {
    rows.push(mkRow(t, `Quick recap: ${mostUrgent}`, "Flip through yesterday's notes / flashcards", "revision"));
  }
  t += recapMinutes;

  if (routine.attendSchool) {
    const schoolStart = timeStrToMinutes(routine.schoolStart);
    const schoolEnd = timeStrToMinutes(routine.schoolEnd);
    t = Math.max(t, schoolStart);
    rows.push(mkRow(t, "School / college", "Regular classes", "school"));
    t = schoolEnd;
  }
  rows.push(mkRow(t, "Lunch & rest", "Eat, relax, short nap if needed", "meal"));
  t += 45;

  examToday.forEach(s => {
    rows.push(mkRow(t, `Exam today: ${s.name}`, "Good luck! Do a light final skim only — no new topics.", "exam"));
  });

  // ----- Split the evening study pool across ALL upcoming subjects -----
  if (upcoming.length > 0) {
    const dinnerMin = 30, finalRevisionMin = 20, breakMin = 10;
    const sleepMinutes = timeStrToMinutes(routine.sleep);
    let totalRemaining = sleepMinutes - t;
    if (totalRemaining < 60) totalRemaining += 1440; // past-midnight edge case
    const reserved = dinnerMin + finalRevisionMin + breakMin * (upcoming.length - 1);
    const studyPoolMinutes = Math.max(40 * upcoming.length, totalRemaining - reserved);

    const weights = upcoming.map(s => DIFFICULTY_WEIGHT[s.difficulty] * (1 / daysBetween(s.date)));
    const totalWeight = weights.reduce((a, b) => a + b, 0);

    // Minutes per subject, proportional to weight, each floored at 20 min
    let minutesEach = weights.map(w => Math.max(20, Math.round((studyPoolMinutes * w) / totalWeight)));

    upcoming.forEach((s, i) => {
      const daysLeft = daysBetween(s.date);
      rows.push(mkRow(
        t, `Study: ${s.name}`,
        `${minutesEach[i]} min — ${capitalize(s.difficulty)} difficulty, exam in ${daysLeft}d`,
        "study"
      ));
      t += minutesEach[i];
      if (i < upcoming.length - 1) {
        rows.push(mkRow(t, "Short break", "Stretch, hydrate, walk around", "break"));
        t += breakMin;
      }
    });

    rows.push(mkRow(t, "Dinner", "Eat & unwind", "meal"));
    t += dinnerMin;

    rows.push(mkRow(t, `Final light revision: ${mostUrgent}`, "One quick pass — no new topics this late", "revision"));
    t += finalRevisionMin;
  } else {
    rows.push(mkRow(t, "Dinner", "Eat & unwind", "meal"));
    t += 30;
  }

  if (t < timeStrToMinutes(routine.sleep)) {
    rows.push(mkRow(t, "Free time / wind down", "Relax before bed", "break"));
  }
  rows.push(mkRow(routine.sleep, "Sleep", "Aim for a full night's rest", "sleep"));

  return rows;
}

function mkRow(timeInput, block, detail, type) {
  const timeLabel = typeof timeInput === "number" ? minutesToTimeStr(timeInput) : minutesToTimeStr(timeStrToMinutes(timeInput));
  return { timeLabel, block, detail, type };
}
function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

/* Day-by-day agenda: one row per subject per day, until every exam is done. */
function buildDailyPlanRows(subjects, routine) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const pool = getStudyPoolMinutes(routine);
  const lastExamDays = Math.max(...subjects.map(s => daysBetween(s.date)));
  const rows = [];

  for (let d = 0; d <= lastExamDays; d++) {
    const dateLabel = formatDate(addDays(today, d));

    subjects.filter(s => daysBetween(s.date) - d === 0).forEach(s => {
      rows.push({ dateLabel, dayOffset: d, subject: s.name, isExam: true });
    });

    const active = subjects.filter(s => daysBetween(s.date) - d > 0);
    if (active.length === 0) continue;

    const weights = active.map(s => DIFFICULTY_WEIGHT[s.difficulty] * (1 / (daysBetween(s.date) - d)));
    const totalWeight = weights.reduce((a, b) => a + b, 0);

    active.forEach((s, i) => {
      const minutes = Math.max(15, Math.round((pool * weights[i]) / totalWeight));
      const daysLeftThatDay = daysBetween(s.date) - d;
      const fraction = daysLeftThatDay / Math.max(1, daysBetween(s.date));
      rows.push({
        dateLabel, dayOffset: d, subject: s.name, minutes,
        phase: subjectPhaseLabel(fraction), difficulty: s.difficulty, isExam: false
      });
    });
  }
  return rows;
}

/* Weekly totals: aggregate the daily plan's minutes by ISO-ish week (7-day
   blocks starting today) so a student can see the big picture at a glance. */
function buildWeeklyPlanRows(subjects, routine) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daily = buildDailyPlanRows(subjects, routine).filter(r => !r.isExam);

  const weeks = {}; // weekIndex -> { subject -> {minutes, phase, difficulty} }
  daily.forEach(r => {
    const weekIndex = Math.floor(r.dayOffset / 7);
    if (!weeks[weekIndex]) weeks[weekIndex] = {};
    if (!weeks[weekIndex][r.subject]) {
      weeks[weekIndex][r.subject] = { minutes: 0, phase: r.phase, difficulty: r.difficulty };
    }
    weeks[weekIndex][r.subject].minutes += r.minutes;
  });

  const rows = [];
  Object.keys(weeks).sort((a, b) => a - b).forEach(weekIndex => {
    const start = addDays(today, weekIndex * 7);
    const end = addDays(today, weekIndex * 7 + 6);
    const weekLabel = `Week ${Number(weekIndex) + 1} (${formatShortDate(start)} – ${formatShortDate(end)})`;
    Object.entries(weeks[weekIndex]).forEach(([subject, info]) => {
      rows.push({ weekLabel, subject, totalLabel: minutesToHoursLabel(info.minutes), phase: info.phase, difficulty: info.difficulty });
    });
  });
  return rows;
}

let lastSubjects = null;
let lastRoutine = null;
let currentMode = "single";

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

  lastSubjects = subjects;
  lastRoutine = routine;

  renderByMode(currentMode);
  renderDashboard(subjects);
  renderQuizzes(subjects);

  document.getElementById("timetableSection").classList.remove("hidden");
  document.getElementById("timetableSection").scrollIntoView({ behavior: "smooth", block: "start" });
}

function setTableHeaders(headers) {
  document.getElementById("timetableHead").innerHTML =
    `<tr>${headers.map(h => `<th scope="col">${h}</th>`).join("")}</tr>`;
}

function renderByMode(mode) {
  if (!lastSubjects) return;
  currentMode = mode;
  document.querySelectorAll(".view-tab").forEach(btn => {
    btn.setAttribute("aria-pressed", btn.dataset.mode === mode ? "true" : "false");
  });

  const tbody = document.getElementById("timetableBody");

  if (mode === "single") {
    setTableHeaders(["Time", "Block", "Details"]);
    const rows = generateSingleTimetable(lastSubjects, lastRoutine);
    tbody.innerHTML = rows.map((r, i) => {
      const isStudy = r.type === "study";
      const pomoButton = isStudy
        ? `<br><button type="button" class="pomo-btn" data-pomo-id="pomo-${i}" data-subject="${escapeAttr(r.block.replace("Study: ", ""))}">▶ Start Focus (25:00)</button>`
        : "";
      return `
        <tr>
          <td>${r.timeLabel}</td>
          <td><span class="badge block-${r.type}">${r.block}</span></td>
          <td>${r.detail}${pomoButton}</td>
        </tr>`;
    }).join("");

  } else if (mode === "daily") {
    setTableHeaders(["Date", "Subject", "Time", "Focus"]);
    const rows = buildDailyPlanRows(lastSubjects, lastRoutine);
    tbody.innerHTML = rows.map(r => r.isExam
      ? `<tr><td>${r.dateLabel}</td><td colspan="3"><span class="badge block-exam">Exam: ${r.subject}</span> — good luck!</td></tr>`
      : `<tr>
          <td>${r.dateLabel}</td>
          <td>${r.subject}</td>
          <td>${r.minutes} min</td>
          <td>${r.phase} <span class="difficulty-${r.difficulty}">(${capitalize(r.difficulty)})</span></td>
        </tr>`
    ).join("");

  } else if (mode === "weekly") {
    setTableHeaders(["Week", "Subject", "Total time", "Focus"]);
    const rows = buildWeeklyPlanRows(lastSubjects, lastRoutine);
    tbody.innerHTML = rows.map(r => `
      <tr>
        <td>${r.weekLabel}</td>
        <td>${r.subject}</td>
        <td>${r.totalLabel}</td>
        <td>${r.phase} <span class="difficulty-${r.difficulty}">(${capitalize(r.difficulty)})</span></td>
      </tr>`).join("");
  }
}

/* ---------- Dashboard ---------- */
function renderDashboard(subjects) {
  const statRow = document.getElementById("statRow");
  statRow.innerHTML = "";

  const hardOnes = subjects.filter(s => s.difficulty === "hard");
  const tiles = [
    { num: subjects.length, lbl: "Subjects added", cls: "", id: "" },
    { num: "", lbl: "", cls: "urgent", id: "countdownTile" },
    { num: hardOnes.length, lbl: hardOnes.length === 1 ? `Hardest: ${hardOnes[0].name}` : "Marked as hard", cls: hardOnes.length ? "urgent" : "ok", id: "" }
  ];

  tiles.forEach(t => {
    const div = document.createElement("div");
    div.className = `stat-tile ${t.cls}`;
    const numId = t.id ? `id="${t.id}Num"` : "";
    const lblId = t.id ? `id="${t.id}Lbl"` : "";
    div.innerHTML = `<span class="num" ${numId}>${t.num}</span><span class="lbl" ${lblId}>${t.lbl}</span>`;
    statRow.appendChild(div);
  });

  updateCountdown();
  if (!countdownInterval) {
    countdownInterval = setInterval(updateCountdown, 60000);
  }
}

/* Live "Xd Yh left" ticker for the nearest exam, refreshed every minute */
let countdownInterval = null;
function updateCountdown() {
  if (!lastSubjects || lastSubjects.length === 0) return;
  const numEl = document.getElementById("countdownTileNum");
  const lblEl = document.getElementById("countdownTileLbl");
  if (!numEl || !lblEl) return;

  const nearest = lastSubjects.reduce((a, b) => (new Date(a.date) < new Date(b.date) ? a : b));
  const examMoment = new Date(nearest.date);
  const diffMs = examMoment - new Date();

  if (diffMs <= 0) {
    numEl.textContent = "Today!";
  } else {
    const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;
    numEl.textContent = days > 0 ? `${days}d ${hours}h` : `${hours}h left`;
  }
  lblEl.textContent = `Until ${nearest.name}`;
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

/* ---------- Pomodoro focus timer (each "Study" row, One Routine view) ---------- */
const pomodoroState = {};

function escapeAttr(s) { return String(s).replace(/"/g, "&quot;"); }
function formatMMSS(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function togglePomodoro(btn) {
  const id = btn.dataset.pomoId;
  const subject = btn.dataset.subject;
  const state = pomodoroState[id];

  // Running -> clicking again turns it OFF (stop & reset)
  if (state && state.intervalId) {
    clearInterval(state.intervalId);
    delete pomodoroState[id];
    btn.textContent = "▶ Start Focus (25:00)";
    btn.classList.remove("running");
    return;
  }

  // Not running -> turn it ON
  let remaining = 25 * 60;
  btn.textContent = `⏸ Stop (${formatMMSS(remaining)})`;
  btn.classList.add("running");

  const intervalId = setInterval(() => {
    remaining--;
    if (remaining <= 0) {
      clearInterval(intervalId);
      delete pomodoroState[id];
      btn.textContent = "▶ Start Focus (25:00)";
      btn.classList.remove("running");
      onPomodoroComplete(subject);
      return;
    }
    btn.textContent = `⏸ Stop (${formatMMSS(remaining)})`;
  }, 1000);

  pomodoroState[id] = { intervalId };
}

function onPomodoroComplete(subject) {
  playBeep();
  showToast(`⏰ Focus session done — great work on ${subject}!`);
  if (window.Notification && Notification.permission === "granted") {
    try { new Notification("StudyTrack", { body: `Focus session on ${subject} complete!` }); } catch (e) { /* ignore */ }
  }
}

function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch (e) { /* Web Audio unavailable — fail silently */ }
}

function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

/* ---------- Dark mode toggle ---------- */
function initThemeToggle() {
  const btn = document.getElementById("themeToggle");
  btn.addEventListener("click", () => {
    const isDark = document.body.getAttribute("data-theme") === "dark";
    if (isDark) {
      document.body.removeAttribute("data-theme");
      btn.textContent = "🌙";
      btn.setAttribute("aria-pressed", "false");
    } else {
      document.body.setAttribute("data-theme", "dark");
      btn.textContent = "☀️";
      btn.setAttribute("aria-pressed", "true");
    }
  });
}

/* ---------- Init ---------- */
document.addEventListener("DOMContentLoaded", () => {
  initGradeTabs();
  initRoutineToggle();
  initThemeToggle();
  addSubjectRow();
  addSubjectRow();

  document.getElementById("addSubjectBtn").addEventListener("click", () => addSubjectRow());
  document.getElementById("generateBtn").addEventListener("click", generateTimetable);
  document.querySelectorAll(".view-tab").forEach(btn => {
    btn.addEventListener("click", () => renderByMode(btn.dataset.mode));
  });
  document.getElementById("timetableBody").addEventListener("click", (e) => {
    const btn = e.target.closest(".pomo-btn");
    if (btn) togglePomodoro(btn);
  });
  document.getElementById("quizCloseBtn").addEventListener("click", closeQuiz);
  document.getElementById("quizModal").addEventListener("click", (e) => {
    if (e.target.id === "quizModal") closeQuiz();
  });
});