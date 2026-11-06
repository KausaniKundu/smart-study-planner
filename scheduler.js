 
const BLOCK = 0.5; // smallest study slot, in hours
 
/* ---------- date helpers (all dates are "YYYY-MM-DD" strings in local time) ---------- */
function toDateStr(d) {
const y = d.getFullYear();
const m = String(d.getMonth() + 1).padStart(2, "0");
const day = String(d.getDate()).padStart(2, "0");
return `${y}-${m}-${day}`;
}
 
function parseDate(str) {
const [y, m, d] = str.split("-").map(Number);
return new Date(y, m - 1, d);
}
 
function addDays(date, n) {
const r = new Date(date);
r.setDate(r.getDate() + n);
return r;
}
 
function daysBetween(fromStr, toStr) {
return Math.round((parseDate(toStr) - parseDate(fromStr)) / 86400000);
}
 
/* ---------- priority score ----------
priority = difficulty × confidenceFactor × missedFactor × urgency
- urgency grows as the exam gets closer (1 / daysLeft)
- low confidence raises priority, high confidence lowers it
- hours you missed earlier raise it a little (capped at 2x)
- the day before the exam is a revision day: double weight */
function priorityScore(subject, daysLeft, missedHours, isRevision) {
const confidence = subject.confidence ?? 3;
const confidenceFactor = 1 + (3 - confidence) * 0.2; // conf 1 -> 1.4, conf 5 -> 0.6
const missedFactor = Math.min(1 + missedHours * 0.1, 2);
const urgency = 1 / Math.max(daysLeft, 1);
let p = subject.difficulty * confidenceFactor * missedFactor * urgency;
if (isRevision) p *= 2;
return p;
}
 
/* Split `totalBlocks` between subjects in proportion to their weights.
Uses the largest-remainder method so the blocks always add up exactly. */
function allocateBlocks(weights, totalBlocks) {
const sum = weights.reduce((a, b) => a + b, 0);
if (sum <= 0 || totalBlocks <= 0) return weights.map(() => 0);
 
const exact = weights.map((w) => (w / sum) * totalBlocks);
const blocks = exact.map(Math.floor);
const left = totalBlocks - blocks.reduce((a, b) => a + b, 0);
 
exact
.map((x, i) => ({ i, frac: x - Math.floor(x) }))
.sort((a, b) => b.frac - a.frac)
.slice(0, left)
.forEach(({ i }) => blocks[i]++);
 
return blocks;
}
 
/* ---------- main function ----------
Past days are kept as they were (so history and missed sessions stay visible).
Today keeps whatever you already ticked off; the rest of today and every
future day up to the last exam is planned again from scratch. */
function generateSchedule(subjects, settings, oldSchedule = {}, today = toDateStr(new Date())) {
const schedule = {};
const known = new Set(subjects.map((s) => s.id));
const keepKnown = (tasks) => (tasks || []).filter((t) => known.has(t.subjectId));
 
// 1. keep the past, and work out how many hours were missed per subject
const missed = {};
for (const date of Object.keys(oldSchedule)) {
if (date >= today) continue;
const tasks = keepKnown(oldSchedule[date]);
if (tasks.length) schedule[date] = tasks;
for (const t of tasks) {
if (!t.done) missed[t.subjectId] = (missed[t.subjectId] || 0) + t.hours;
}
}
 
// 2. keep today's finished sessions
const doneToday = keepKnown(oldSchedule[today]).filter((t) => t.done);
if (doneToday.length) schedule[today] = doneToday;
 
if (!subjects.length) return schedule;
 
// 3. plan today (remaining time) and all future days until the last exam
const lastExam = subjects.map((s) => s.examDate).sort().pop();
const blocksPerDay = Math.round(settings.dailyHours / BLOCK);
 
for (let d = parseDate(today); toDateStr(d) < lastExam; d = addDays(d, 1)) {
const date = toDateStr(d);
const kept = date === today ? doneToday : [];
const usedBlocks = Math.round(kept.reduce((sum, t) => sum + t.hours, 0) / BLOCK);
const freeBlocks = Math.max(blocksPerDay - usedBlocks, 0);
 
const active = subjects.filter((s) => s.examDate > date); // studying stops on exam day
const weights = active.map((s) => {
const daysLeft = daysBetween(date, s.examDate);
return priorityScore(s, daysLeft, missed[s.id] || 0, daysLeft === 1);
});
const blocks = allocateBlocks(weights, freeBlocks);
 
const tasks = kept.slice();
active.forEach((s, i) => {
if (blocks[i] > 0) {
tasks.push({
subjectId: s.id,
hours: blocks[i] * BLOCK,
done: false,
revision: daysBetween(date, s.examDate) === 1,
});
}
});
if (tasks.length) schedule[date] = tasks;
}
 
return schedule;
}
 
// lets you test this file in Node: node -e "console.log(require('./scheduler.js'))"
if (typeof module !== "undefined") {
module.exports = { toDateStr, parseDate, addDays, daysBetween, priorityScore, allocateBlocks, generateSchedule };
}
