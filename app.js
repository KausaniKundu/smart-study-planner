/* app.js — UI, events and rendering. Needs scheduler.js and storage.js loaded first. */
 
let state = loadState();
 
const $ = (id) => document.getElementById(id);
const COLORS = ["#6366f1", "#ec4899", "#f59e0b", "#10b981", "#06b6d4", "#ef4444", "#8b5cf6", "#84cc16"];
 
const todayStr = () => toDateStr(new Date());
const subjectById = (id) => state.subjects.find((s) => s.id === id);
const esc = (str) =>
  String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const prettyDate = (str) =>
  parseDate(str).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
 
/* ---------- central save + redraw ---------- */
function commit(regenerate = false) {
  if (regenerate) {
    state.schedule = generateSchedule(state.subjects, state.settings, state.schedule, todayStr());
    state.lastGenerated = todayStr();
  }
  saveState(state);
  render();
}
 
/* ---------- streak: a day counts when every session planned for today is done ---------- */
function updateStreak() {
  const today = todayStr();
  const yesterday = toDateStr(addDays(new Date(), -1));
  const tasks = state.schedule[today] || [];
  const allDone = tasks.length > 0 && tasks.every((t) => t.done);
  const s = state.streak;
 
  if (allDone && s.lastDate !== today) {
    s.count = s.lastDate === yesterday ? s.count + 1 : 1;
    s.lastDate = today;
  } else if (!allDone && s.lastDate === today) {
    s.count = Math.max(s.count - 1, 0);
    s.lastDate = s.count > 0 ? yesterday : null;
  }
}
 
/* ---------- rendering ---------- */
function taskHtml(date, index, task, editable) {
  const s = subjectById(task.subjectId);
  if (!s) return "";
  return `
    <label class="task ${task.done ? "done" : ""}">
      <input type="checkbox" data-date="${date}" data-index="${index}" ${task.done ? "checked" : ""} ${editable ? "" : "disabled"}>
      <span class="dot" style="background:${s.color}"></span>
      <span class="grow">${esc(s.name)}${task.revision ? '<em class="tag">Revision</em>' : ""}</span>
      <span class="hours">${task.hours}h</span>
    </label>`;
}
 
function renderSubjects() {
  const list = $("subject-list");
  if (!state.subjects.length) {
    list.innerHTML = '<li class="empty">No subjects yet.</li>';
    return;
  }
  const today = todayStr();
  list.innerHTML = state.subjects
    .slice()
    .sort((a, b) => a.examDate.localeCompare(b.examDate))
    .map((s) => {
      const left = daysBetween(today, s.examDate);
      const when = left < 0 ? "Exam passed" : left === 0 ? "Exam today" : `${left} day${left === 1 ? "" : "s"} left`;
      const options = [1, 2, 3, 4, 5]
        .map((n) => `<option value="${n}" ${n === s.confidence ? "selected" : ""}>Conf ${n}</option>`)
        .join("");
      return `
        <li>
          <span class="dot" style="background:${s.color}"></span>
          <div class="grow">
            <strong>${esc(s.name)}</strong>
            <small>${s.examDate} · ${when} · Difficulty ${s.difficulty}</small>
          </div>
          <select data-confidence="${s.id}" title="How confident do you feel? (1 = shaky, 5 = strong)">${options}</select>
          <button class="icon" data-delete="${s.id}" title="Delete subject">✕</button>
        </li>`;
    })
    .join("");
}
 
function renderToday() {
  const today = todayStr();
  $("today-label").textContent = "· " + prettyDate(today);
  const tasks = state.schedule[today] || [];
  const box = $("today-tasks");
 
  if (!state.subjects.length) {
    box.innerHTML = '<p class="empty">Add a subject and its exam date to get started.</p>';
  } else if (!tasks.length) {
    box.innerHTML = '<p class="empty">Nothing planned today. Enjoy the break!</p>';
  } else {
    box.innerHTML = tasks.map((t, i) => taskHtml(today, i, t, true)).join("");
  }
}
 
function renderMissed() {
  const today = todayStr();
  const missed = [];
  Object.keys(state.schedule)
    .filter((date) => date < today)
    .sort()
    .forEach((date) => {
      state.schedule[date].forEach((t, i) => {
        if (!t.done && subjectById(t.subjectId)) missed.push({ date, i, t });
      });
    });
 
  $("missed-card").hidden = missed.length === 0;
  if (!missed.length) return;
 
  const hours = missed.reduce((sum, m) => sum + m.t.hours, 0);
  $("missed-summary").textContent = `${hours}h not completed. Tick anything you did later, then reschedule.`;
  $("missed-tasks").innerHTML = missed
    .map((m) => `<div class="day"><h3>${prettyDate(m.date)}</h3>${taskHtml(m.date, m.i, m.t, true)}</div>`)
    .join("");
}
 
function renderUpcoming() {
  let html = "";
  for (let i = 1; i <= 14; i++) {
    const date = toDateStr(addDays(new Date(), i));
    const tasks = state.schedule[date];
    if (!tasks || !tasks.length) continue;
    html += `<div class="day"><h3>${prettyDate(date)}</h3>${tasks.map((t, idx) => taskHtml(date, idx, t, false)).join("")}</div>`;
  }
  $("upcoming").innerHTML = html || '<p class="empty">No upcoming sessions.</p>';
}
 
function renderStats() {
  const today = todayStr();
 
  // countdown to nearest exam
  const upcoming = state.subjects
    .filter((s) => s.examDate >= today)
    .sort((a, b) => a.examDate.localeCompare(b.examDate))[0];
  if (upcoming) {
    const left = daysBetween(today, upcoming.examDate);
    $("countdown").textContent = left === 0 ? "Today!" : `${left} day${left === 1 ? "" : "s"}`;
    $("countdown-sub").textContent = `${upcoming.name} · ${upcoming.examDate}`;
  } else {
    $("countdown").textContent = "–";
    $("countdown-sub").textContent = state.subjects.length ? "All exams are over." : "No exams added.";
  }
 
  // streak (shown as 0 if you skipped yesterday and haven't finished today yet)
  const yesterday = toDateStr(addDays(new Date(), -1));
  const alive = state.streak.lastDate === today || state.streak.lastDate === yesterday;
  const n = alive ? state.streak.count : 0;
  $("streak").textContent = `🔥 ${n} day${n === 1 ? "" : "s"}`;
 
  // progress = completed hours / planned hours
  const totals = {};
  Object.values(state.schedule).forEach((tasks) =>
    tasks.forEach((t) => {
      if (!totals[t.subjectId]) totals[t.subjectId] = { planned: 0, done: 0 };
      totals[t.subjectId].planned += t.hours;
      if (t.done) totals[t.subjectId].done += t.hours;
    })
  );
 
  const bar = (label, done, planned, color) => {
    const pct = planned ? Math.round((done / planned) * 100) : 0;
    return `
      <div class="progress-row">
        <div class="top"><span>${label}</span><span>${pct}% · ${done}/${planned}h</span></div>
        <div class="bar"><span style="width:${pct}%; ${color ? `background:${color}` : ""}"></span></div>
      </div>`;
  };
 
  let allDone = 0, allPlanned = 0;
  Object.values(totals).forEach((t) => { allDone += t.done; allPlanned += t.planned; });
 
  $("overall-progress").innerHTML = state.subjects.length ? bar("<strong>Overall</strong>", allDone, allPlanned) : "";
  $("subject-progress").innerHTML = state.subjects.length
    ? state.subjects
        .map((s) => {
          const t = totals[s.id] || { planned: 0, done: 0 };
          return bar(esc(s.name), t.done, t.planned, s.color);
        })
        .join("")
    : '<p class="empty">Progress appears once you add subjects.</p>';
}
 
function render() {
  document.body.dataset.theme = state.settings.dark ? "dark" : "light";
  $("btn-theme").textContent = state.settings.dark ? "☀️" : "🌙";
  $("dailyHours").value = state.settings.dailyHours;
  renderSubjects();
  renderToday();
  renderMissed();
  renderUpcoming();
  renderStats();
}
 
/* ---------- events ---------- */
$("subject-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = $("name").value.trim();
  const examDate = $("examDate").value;
  const difficulty = Number($("difficulty").value);
  const msg = $("form-msg");
 
  if (!name) { msg.textContent = "Please enter a subject name."; return; }
  if (!examDate || examDate <= todayStr()) { msg.textContent = "Exam date must be after today."; return; }
 
  state.subjects.push({
    id: state.nextId++,
    name,
    examDate,
    difficulty,
    confidence: 3,
    color: COLORS[state.subjects.length % COLORS.length],
  });
  msg.textContent = "";
  e.target.reset();
  commit(true);
});
 
$("dailyHours").addEventListener("change", (e) => {
  const value = Math.min(Math.max(Number(e.target.value) || 4, 0.5), 16);
  state.settings.dailyHours = Math.round(value * 2) / 2; // keep to 0.5h steps
  commit(true);
});
 
// delete subject / change confidence (event delegation on the list)
$("subject-list").addEventListener("click", (e) => {
  const id = e.target.dataset.delete;
  if (!id) return;
  state.subjects = state.subjects.filter((s) => s.id !== Number(id));
  commit(true);
});
 
$("subject-list").addEventListener("change", (e) => {
  const id = e.target.dataset.confidence;
  if (!id) return;
  const subject = subjectById(Number(id));
  if (subject) subject.confidence = Number(e.target.value);
  commit(true);
});
 
// tick / untick a session (works for today's list and the missed list)
document.addEventListener("change", (e) => {
  const el = e.target;
  if (el.type !== "checkbox" || el.dataset.date === undefined) return;
  const task = (state.schedule[el.dataset.date] || [])[Number(el.dataset.index)];
  if (!task) return;
  task.done = el.checked;
  updateStreak();
  commit(false);
});
 
$("btn-regen").addEventListener("click", () => commit(true));
$("btn-reschedule").addEventListener("click", () => commit(true));
 
$("btn-theme").addEventListener("click", () => {
  state.settings.dark = !state.settings.dark;
  commit(false);
});
 
$("btn-export").addEventListener("click", () => exportState(state));
$("btn-import").addEventListener("click", () => $("import-file").click());
$("import-file").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  importStateFromFile(file, (err, imported) => {
    if (err) {
      alert("Import failed: " + err.message);
    } else {
      state = imported;
      commit(false);
    }
    e.target.value = "";
  });
});
 
$("btn-print").addEventListener("click", () => window.print());
 
$("btn-reset").addEventListener("click", () => {
  if (!confirm("Delete all subjects, schedule and progress? This cannot be undone.")) return;
  clearState();
  state = defaultState();
  commit(false);
});
 
/* ---------- start ---------- */
// exam dates must be in the future
$("examDate").min = toDateStr(addDays(new Date(), 1));
 
// new day since last time? rebuild the plan so missed hours are picked up
commit(state.subjects.length > 0 && state.lastGenerated !== todayStr());
 