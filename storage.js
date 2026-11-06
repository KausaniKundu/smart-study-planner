/* storage.js — everything that touches localStorage lives here. */
 
const STORAGE_KEY = "smartStudyPlanner.v1";
 
function defaultState() {
  return {
    subjects: [],                       // { id, name, examDate, difficulty, confidence, color }
    settings: { dailyHours: 4, dark: false },
    schedule: {},                       // { "YYYY-MM-DD": [ { subjectId, hours, done, revision } ] }
    streak: { count: 0, lastDate: null },
    nextId: 1,
    lastGenerated: null,
  };
}
 
// fills in missing fields so old or imported data never breaks the app
function normalizeState(data) {
  const base = defaultState();
  const state = {
    ...base,
    ...data,
    settings: { ...base.settings, ...(data && data.settings) },
    streak: { ...base.streak, ...(data && data.streak) },
  };
  if (!Array.isArray(state.subjects)) state.subjects = [];
  if (!state.schedule || typeof state.schedule !== "object") state.schedule = {};
  const maxId = state.subjects.reduce((m, s) => Math.max(m, s.id || 0), 0);
  state.nextId = Math.max(state.nextId || 1, maxId + 1);
  return state;
}
 
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? normalizeState(JSON.parse(raw)) : defaultState();
  } catch (err) {
    console.warn("Could not read saved data, starting fresh.", err);
    return defaultState();
  }
}
 
function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn("Could not save data.", err);
  }
}
 
function clearState() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn(err);
  }
}
 
/* ---------- backup: localStorage is lost if the browser data is cleared ---------- */
function exportState(state) {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "study-planner-backup.json";
  link.click();
  URL.revokeObjectURL(link.href);
}
 
function importStateFromFile(file, onDone) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data || !Array.isArray(data.subjects) || typeof data.schedule !== "object") {
        throw new Error("This does not look like a planner backup.");
      }
      onDone(null, normalizeState(data));
    } catch (err) {
      onDone(err);
    }
  };
  reader.onerror = () => onDone(reader.error);
  reader.readAsText(file);
}
 