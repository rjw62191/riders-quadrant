import { firebaseConfig } from "./firebase-config.js";
import { STOPS, TYPES, TOTAL_MILES } from "./content.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  initializeFirestore, persistentLocalCache, doc, setDoc, updateDoc, onSnapshot,
  collection, addDoc, deleteDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* ---------- Firebase ---------- */
const fbApp = initializeApp(firebaseConfig);
const auth = getAuth(fbApp);
const db = initializeFirestore(fbApp, { localCache: persistentLocalCache() });

/* ---------- State ---------- */
let user = null, challengeId = null;
let challenge = { rewards: {} };
let entries = [];
let unsubs = [], challengeUnsubs = [];
let selectedType = "miles", signingUp = false, editingReward = null;

/* ---------- Helpers ---------- */
const $ = id => document.getElementById(id);
const fmt = n => (Math.round(n * 10) / 10).toLocaleString(undefined, { maximumFractionDigits: 1 });
const total = () => entries.reduce((s, e) => s + (e.miles || 0), 0);
const isoOf = d => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const todayISO = () => isoOf(new Date());
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const svg = id => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#${id}"></use></svg>`;
const reached = (s, t = total()) => t >= s.mile - 1e-9;
const rewardOf = s => (challenge.rewards || {})[s.id] || {};
const shortDate = iso => new Date(iso + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
const crossed = (before, after) => STOPS.filter(s => s.mile > 0 && before < s.mile - 1e-9 && after >= s.mile - 1e-9);

function toast(msg) {
  const t = $("toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("show"), 2800);
}
function sortedAsc() {
  return [...entries].sort((a, b) => a.date.localeCompare(b.date) || (a.createdMs || 0) - (b.createdMs || 0));
}
function reachedDates() {
  const out = {}; let run = 0;
  for (const e of sortedAsc()) { const b = run; run += e.miles || 0; crossed(b, run).forEach(s => out[s.id] = e.date); }
  return out;
}

/* ---------- Routing ---------- */
const VIEWS = ["loading", "signin", "map", "log", "postcards", "logbook", "rewards"];
const TABS = ["map", "postcards", "logbook", "rewards"];
function show(name) {
  VIEWS.forEach(v => $("view-" + v).hidden = v !== name);
  $("tabbar").hidden = !TABS.includes(name);
  document.querySelectorAll("#tabbar a").forEach(a => {
    if (a.dataset.tab === name) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
  if (name === "log") prepareLog();
  if (name === "map") requestAnimationFrame(renderMap);
}
function route() {
  if (!user) return;
  const h = location.hash.replace("#", "") || "map";
  show([...TABS, "log"].includes(h) ? h : "map");
}
window.addEventListener("hashchange", route);

/* ---------- Auth ---------- */
$("signup-toggle").onclick = () => {
  signingUp = !signingUp;
  $("signin-btn").textContent = signingUp ? "Create account" : "Sign in";
  $("signup-toggle").textContent = signingUp ? "Have an account? Sign in" : "New here? Create an account";
  $("password").autocomplete = signingUp ? "new-password" : "current-password";
  $("signin-error").textContent = "";
};
$("signin-form").onsubmit = async e => {
  e.preventDefault();
  const email = $("email").value.trim(), pw = $("password").value;
  if (!email || pw.length < 6) { $("signin-error").textContent = "Enter your email and a password of at least 6 characters."; return; }
  $("signin-btn").disabled = true;
  try {
    if (signingUp) await createUserWithEmailAndPassword(auth, email, pw);
    else await signInWithEmailAndPassword(auth, email, pw);
  } catch (err) {
    const map = {
      "auth/invalid-credential": "That email and password don’t match.",
      "auth/wrong-password": "That email and password don’t match.",
      "auth/user-not-found": "No account with that email. Tap “Create an account.”",
      "auth/email-already-in-use": "That email already has an account. Sign in instead.",
      "auth/invalid-email": "That email address isn’t valid.",
      "auth/network-request-failed": "No connection. Check your signal and try again."
    };
    $("signin-error").textContent = map[err.code] || "Sign-in failed. Try again.";
  } finally { $("signin-btn").disabled = false; }
};
$("settings-btn").onclick = () => { $("settings-email").textContent = user?.email || ""; $("settings-dialog").showModal(); };
$("signout-btn").onclick = async () => { $("settings-dialog").close(); await signOut(auth); };

onAuthStateChanged(auth, u => {
  unsubs.forEach(f => f()); unsubs = [];
  user = u; entries = []; challengeId = null;
  if (!u) { show("signin"); return; }
  show("loading");
  watchProfile();
});

/* ---------- Data ---------- */
function watchProfile() {
  unsubs.push(onSnapshot(doc(db, "users", user.uid), async snap => {
    const cid = snap.exists() ? snap.data().currentChallenge : null;
    if (!cid) { await startChallenge(); return; }
    if (cid !== challengeId) { challengeId = cid; watchChallenge(); }
  }, err => { console.error(err); toast("Couldn’t load your data."); }));
}
function watchChallenge() {
  challengeUnsubs.forEach(f => f()); challengeUnsubs = [];
  const cRef = doc(db, "users", user.uid, "challenges", challengeId);
  challengeUnsubs.push(onSnapshot(cRef, snap => {
    if (snap.exists()) challenge = { rewards: {}, ...snap.data() };
    renderAll();
  }));
  challengeUnsubs.push(onSnapshot(collection(cRef, "entries"), snap => {
    entries = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderAll();
    if (!$("view-loading").hidden) route();
    if (pendingSync) applyHealthSync();
  }));
  unsubs.push(() => challengeUnsubs.forEach(f => f()));
}
async function startChallenge(rewards = {}) {
  const cRef = await addDoc(collection(db, "users", user.uid, "challenges"), {
    totalMiles: TOTAL_MILES, rewards, startedAt: serverTimestamp()
  });
  await setDoc(doc(db, "users", user.uid), { currentChallenge: cRef.id }, { merge: true });
}

/* ---------- Map ---------- */
function riderPoint(t) {
  for (let i = 0; i < STOPS.length - 1; i++) {
    const a = STOPS[i], b = STOPS[i + 1];
    if (t <= b.mile) {
      const f = Math.max(0, (t - a.mile) / (b.mile - a.mile));
      return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, seg: i };
    }
  }
  const last = STOPS[STOPS.length - 1];
  return { x: last.x, y: last.y, seg: STOPS.length - 1 };
}
function renderMap() {
  const t = Math.min(total(), TOTAL_MILES);
  const p = riderPoint(t);
  const pts = STOPS.map(s => `${s.x},${s.y}`).join(" ");
  $("route-ahead").setAttribute("points", pts);
  const done = STOPS.slice(0, p.seg + 1).map(s => `${s.x},${s.y}`);
  done.push(`${p.x},${p.y}`);
  $("route-done").setAttribute("points", done.join(" "));
  $("rider").setAttribute("transform", `translate(${p.x} ${p.y})`);
  const next = STOPS.find(s => !reached(s, t));
  $("map-stops").innerHTML = STOPS.map(s => {
    const r = reached(s, t), isNext = next && s.id === next.id;
    const dot = r ? `<circle cx="${s.x}" cy="${s.y}" r="8" fill="#d4a85c" stroke="#1b2431" stroke-width="2"/>`
      : isNext ? `<circle cx="${s.x}" cy="${s.y}" r="10" fill="#1b2431" stroke="#e8915f" stroke-width="3"/>`
      : `<circle cx="${s.x}" cy="${s.y}" r="8" fill="#1b2431" stroke="#4a5568" stroke-width="2.5"/>`;
    const below = s.labelBelow, left = !below && s.x > 250;
    const lx = below ? s.x : left ? s.x - 14 : s.x + 14, anchor = below ? "middle" : left ? "end" : "start";
    const ly = below ? s.y + 26 : s.y + 4;
    const color = isNext ? "#e8915f" : r ? "#cfc4ad" : "#8f877a";
    return `${dot}<text x="${lx}" y="${ly}" text-anchor="${anchor}" font-family="Cinzel, Georgia, serif" font-size="${isNext ? 13 : 11}" font-weight="${isNext ? 700 : 500}" fill="${color}">${esc(s.name)}</text>`;
  }).join("");
  $("map-svg").setAttribute("aria-label", `Journey map. ${fmt(total())} of ${TOTAL_MILES} miles.${next ? " Next stop: " + next.name + "." : ""}`);

  $("total-miles").textContent = fmt(total());
  $("bar-fill").style.width = (Math.min(1, total() / TOTAL_MILES) * 100) + "%";
  if (next) {
    const rw = rewardOf(next);
    $("next-label").textContent = rw.name ? "Next postcard and reward" : "Next postcard";
    $("next-name").textContent = next.name;
    $("next-dist").innerHTML = `<strong class="accent">${fmt(next.mile - total())} miles</strong> away`;
  } else {
    $("next-label").textContent = "Journey complete";
    $("next-name").textContent = "You graduated";
    $("next-dist").innerHTML = `<a href="#rewards">Claim your rewards</a>`;
  }
}

/* ---------- Postcards ---------- */
function cardArt(s, w = 40, h = 28) {
  return `<svg width="${w}" height="${h}" viewBox="0 0 40 28" fill="none" stroke="#ede3cd" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${s.art}"/></svg>`;
}
function renderPostcards() {
  const dates = reachedDates();
  const got = STOPS.filter(s => reached(s)).length;
  $("cards-count").textContent = `${got} of ${STOPS.length} collected`;
  $("card-grid").innerHTML = STOPS.map(s => reached(s)
    ? `<button class="card" data-card="${s.id}">
         <span class="card-art" style="background:${s.sky}">${cardArt(s)}</span>
         <span class="card-body"><span class="card-name">${esc(s.name)}</span>
         <span class="card-meta">Mile ${s.mile}${dates[s.id] ? " · " + shortDate(dates[s.id]) : ""}</span></span>
       </button>`
    : `<div class="card locked">${svg("i-lock")}<span>Mile ${s.mile}</span></div>`).join("");
  $("card-grid").querySelectorAll("[data-card]").forEach(b => b.onclick = () => openPostcard(STOPS.find(s => s.id === b.dataset.card)));
}
function openPostcard(s, fresh = false) {
  const idx = STOPS.indexOf(s), date = reachedDates()[s.id];
  $("pc-kicker").textContent = fresh ? `Postcard ${idx + 1} of ${STOPS.length} unlocked` : `Postcard ${idx + 1} of ${STOPS.length}`;
  $("pc-art").style.background = s.sky;
  $("pc-art").innerHTML = cardArt(s, 160, 112);
  $("pc-title").textContent = s.name;
  $("pc-meta").textContent = `Mile ${s.mile}${date ? " · " + shortDate(date) : ""}`;
  $("pc-story").textContent = s.story;
  const rw = rewardOf(s);
  $("pc-reward").hidden = !rw.name;
  $("pc-reward-name").textContent = rw.name || "";
  $("pc-reward-link").hidden = !rw.url;
  if (rw.url) $("pc-reward-link").href = rw.url;
  $("postcard-dialog").showModal();
}

/* ---------- Log ---------- */
function renderTiles() {
  $("type-tiles").innerHTML = Object.entries(TYPES).map(([k, t]) =>
    `<button type="button" class="tile" data-type="${k}" aria-pressed="${k === selectedType}">${esc(t.label)}<span>${esc(t.rule)}</span></button>`).join("");
  $("type-tiles").querySelectorAll(".tile").forEach(b => b.onclick = () => {
    selectedType = b.dataset.type; renderTiles(); updatePreview(); $("amount").focus();
  });
}
function prepareLog() {
  renderTiles();
  $("amount").value = ""; $("entry-note").value = "";
  $("entry-date").value = todayISO(); $("entry-date").max = todayISO();
  updatePreview();
}
function updatePreview() {
  const t = TYPES[selectedType];
  $("amount-label").textContent = t.ask;
  $("amount-unit").textContent = t.unit;
  const amt = parseFloat($("amount").value), valid = amt > 0;
  const miles = valid ? t.toMiles(amt) : 0;
  $("amount-preview").innerHTML = valid ? `Moves you <strong>${fmt(miles)} miles</strong> along the march` : "";
  $("log-submit").disabled = !valid;
  $("log-submit").textContent = valid ? `Add ${fmt(miles)} miles` : "Add miles";
  const hits = valid ? crossed(total(), total() + miles) : [];
  $("unlock-hint").hidden = !hits.length;
  if (hits.length) {
    const last = hits[hits.length - 1], rw = rewardOf(last);
    $("unlock-text").innerHTML = `This entry reaches <strong>${esc(last.name)}</strong>. You’ll unlock a postcard${rw.name ? " and your reward" : ""}.`;
  }
}
$("amount").addEventListener("input", updatePreview);
$("log-form").onsubmit = e => {
  e.preventDefault();
  const t = TYPES[selectedType], amount = parseFloat($("amount").value);
  if (!(amount > 0)) return;
  const miles = Math.round(t.toMiles(amount) * 100) / 100, before = total();
  const entry = { type: selectedType, amount, miles, date: $("entry-date").value || todayISO(),
    note: $("entry-note").value.trim(), source: "manual", createdMs: Date.now(), createdAt: serverTimestamp() };
  $("log-submit").disabled = true;
  addDoc(collection(db, "users", user.uid, "challenges", challengeId, "entries"), entry)
    .catch(err => { console.error(err); toast("That entry didn’t save. Try again."); });
  const hits = crossed(before, before + miles);
  location.hash = "#map";
  if (hits.length) setTimeout(() => openPostcard(hits[hits.length - 1], true), 300);
  else toast(`+${fmt(miles)} miles logged`);
};

/* ---------- Health sync (from an iPhone Shortcut) ----------
   The Shortcut opens  ?sync=health&steps=8421  (or &miles=3.4, optional &date=YYYY-MM-DD).
   One entry per day with a fixed id, so running it again the same day updates
   that day's total instead of adding to it. */
let pendingSync = (() => {
  const q = new URLSearchParams(location.search);
  if (q.get("sync") !== "health") return null;
  const num = v => { const n = parseFloat(String(v ?? "").replace(/[^0-9.]/g, "")); return n > 0 ? n : 0; };
  const d = q.get("date") || "";
  return { steps: num(q.get("steps")), miles: num(q.get("miles")), date: /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : todayISO() };
})();
function applyHealthSync() {
  const s = pendingSync; pendingSync = null;
  history.replaceState(null, "", location.pathname + location.hash);
  if (s.date > todayISO()) { toast("Health sync skipped: that date is in the future."); return; }
  const useMiles = s.miles > 0 && s.miles < 100, useSteps = s.steps > 0 && s.steps < 200000;
  if (!useMiles && !useSteps) { toast("Nothing to sync from Health yet today."); return; }
  const type = useMiles ? "miles" : "steps", amount = useMiles ? s.miles : Math.round(s.steps);
  const miles = Math.round(TYPES[type].toMiles(amount) * 100) / 100;
  const id = "health-" + s.date, prev = entries.find(e => e.id === id);
  const after = total() - (prev?.miles || 0) + miles;
  setDoc(doc(db, "users", user.uid, "challenges", challengeId, "entries", id), {
    type, amount, miles, date: s.date, note: "", source: "health",
    createdMs: prev?.createdMs || Date.now(), createdAt: serverTimestamp()
  }).catch(err => { console.error(err); toast("Health sync didn’t save. Try again."); });
  const hits = crossed(total(), after);
  location.hash = "#map";
  if (hits.length) setTimeout(() => openPostcard(hits[hits.length - 1], true), 300);
  else toast(`Synced from Health: ${fmt(miles)} miles ${s.date === todayISO() ? "today" : "on " + shortDate(s.date)}`);
}

/* ---------- Logbook ---------- */
function describe(e) {
  if (e.type === "steps") return `${Math.round(e.amount).toLocaleString()} steps`;
  if (e.type === "bike") return `${fmt(e.amount)} mi cycling`;
  if (e.type === "minutes") return `${Math.round(e.amount)} min workout`;
  return `${fmt(e.amount)} mi walk/run`;
}
function weekMiles() {
  const s = new Date(); s.setDate(s.getDate() - ((s.getDay() + 6) % 7));
  const start = isoOf(s);
  return entries.filter(e => e.date >= start).reduce((a, e) => a + e.miles, 0);
}
function streak() {
  const days = new Set(entries.map(e => e.date)); const d = new Date(); let n = 0;
  if (!days.has(isoOf(d))) d.setDate(d.getDate() - 1);
  while (days.has(isoOf(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
function dayLabel(iso) {
  if (iso === todayISO()) return "Today";
  const y = new Date(); y.setDate(y.getDate() - 1);
  if (iso === isoOf(y)) return "Yesterday";
  return new Date(iso + "T12:00:00").toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}
function renderLogbook() {
  $("stat-week").textContent = fmt(weekMiles());
  $("stat-streak").textContent = streak();
  $("stat-count").textContent = entries.length;
  if (!entries.length) { $("logbook-list").innerHTML = `<p class="empty">Nothing logged yet. Your first mile starts the march.</p>`; return; }
  const msByDate = {}; let run = 0;
  for (const e of sortedAsc()) { const b = run; run += e.miles; crossed(b, run).forEach(s => (msByDate[e.date] ||= []).push(s.name)); }
  const byDay = {};
  [...entries].sort((a, b) => b.date.localeCompare(a.date) || (b.createdMs || 0) - (a.createdMs || 0))
    .forEach(e => (byDay[e.date] ||= []).push(e));
  $("logbook-list").innerHTML = Object.keys(byDay).map(day => `
    <h2 class="day">${esc(dayLabel(day))}</h2>
    ${(msByDate[day] || []).map(n => `<div class="ms-row">${svg("i-star")}<div>Reached <strong>${esc(n)}</strong></div></div>`).join("")}
    ${byDay[day].map(e => `
      <div class="entry">
        <div><div class="entry-what">${esc(describe(e))}</div>
          <div class="muted small">${esc(e.note || (e.source === "health" ? "From Health app" : TYPES[e.type]?.label || ""))}</div></div>
        <div class="entry-right"><span class="entry-miles">${fmt(e.miles)} mi</span>
          <button class="icon-btn bare" data-del="${e.id}" aria-label="Remove this entry">${svg("i-dots")}</button></div>
      </div>`).join("")}`).join("");
  $("logbook-list").querySelectorAll("[data-del]").forEach(b => b.onclick = async () => {
    if (!confirm("Remove this entry?")) return;
    await deleteDoc(doc(db, "users", user.uid, "challenges", challengeId, "entries", b.dataset.del));
    toast("Entry removed");
  });
}

/* ---------- Rewards ---------- */
function renderRewards() {
  const stops = STOPS.filter(s => s.mile > 0);
  const set = stops.filter(s => rewardOf(s).name).length;
  const earned = stops.filter(s => reached(s) && rewardOf(s).name).length;
  $("rewards-count").textContent = set < stops.length
    ? `${set} of ${stops.length} picked · ${earned} earned`
    : `${earned} of ${stops.length} earned`;
  $("reward-list").innerHTML = stops.map(s => {
    const rw = rewardOf(s), r = reached(s);
    const status = !rw.name ? `<span class="muted">No reward picked yet</span>`
      : rw.claimed ? `<span class="tag done">Claimed</span>`
      : r ? `<span class="tag earned">Earned</span>`
      : `<span class="muted">${fmt(s.mile - total())} miles to go</span>`;
    return `<li class="reward ${r ? "is-reached" : ""}">
      <div class="reward-head"><span class="reward-stop">${esc(s.name)}</span><span class="muted small">Mile ${s.mile}</span></div>
      <div class="reward-name">${rw.name ? esc(rw.name) : "—"}</div>
      <div class="reward-foot">${status}
        <span class="reward-actions">
          ${r && rw.name && rw.url && !rw.claimed ? `<a class="link-btn" href="${esc(rw.url)}" target="_blank" rel="noopener">Open link</a>` : ""}
          ${r && rw.name && !rw.claimed ? `<button class="link-btn" data-claim="${s.id}">Mark claimed</button>` : ""}
          <button class="link-btn" data-edit="${s.id}">${rw.name ? "Edit" : "Add"}</button>
        </span></div>
    </li>`;
  }).join("");
  $("reward-list").querySelectorAll("[data-edit]").forEach(b => b.onclick = () => openRewardEditor(b.dataset.edit));
  $("reward-list").querySelectorAll("[data-claim]").forEach(b => b.onclick = () => saveReward(b.dataset.claim, { ...rewardOf(STOPS.find(s => s.id === b.dataset.claim)), claimed: true }));
}
function openRewardEditor(id) {
  editingReward = id;
  const s = STOPS.find(x => x.id === id), rw = rewardOf(s);
  $("rw-title").textContent = `Reward for ${s.name}`;
  $("rw-name").value = rw.name || ""; $("rw-url").value = rw.url || "";
  $("reward-dialog").showModal();
}
async function saveReward(id, value) {
  try {
    await updateDoc(doc(db, "users", user.uid, "challenges", challengeId), { [`rewards.${id}`]: value });
  } catch (err) { console.error(err); toast("That reward didn’t save. Try again."); }
}
$("reward-dialog").addEventListener("close", async () => {
  if ($("reward-dialog").returnValue !== "save" || !editingReward) return;
  let url = $("rw-url").value.trim();
  if (url && !/^https?:\/\//i.test(url)) url = "https://" + url;
  const prev = rewardOf(STOPS.find(s => s.id === editingReward));
  await saveReward(editingReward, { name: $("rw-name").value.trim(), url, claimed: !!prev.claimed });
  toast("Reward saved");
});

$("new-challenge").onclick = async () => {
  if (!confirm("Start a new challenge? Your current one stays saved, but the map resets to mile 0. Your reward list carries over.")) return;
  const keep = {};
  Object.entries(challenge.rewards || {}).forEach(([k, v]) => keep[k] = { name: v.name || "", url: v.url || "", claimed: false });
  await startChallenge(keep);
  $("settings-dialog").close(); location.hash = "#map"; toast("New challenge started");
};

/* ---------- Render ---------- */
function renderAll() { renderMap(); renderPostcards(); renderLogbook(); renderRewards(); }
window.addEventListener("resize", () => { if (!$("view-map").hidden) renderMap(); });

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
show("loading");
