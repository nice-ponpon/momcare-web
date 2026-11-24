// 孕期小幫手 網頁試玩版。遊戲規則與 iOS 版（MomCare/Core/Game）一致；知識資料由 data.js 提供。
(() => {
"use strict";
const D = window.MOMCARE_DATA;
const KEY = "momcare-web-v1";

// ───────── 日期工具 ─────────
const DAY = 86400000;
const pad = n => String(n).padStart(2, "0");
const startOfDay = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const dayKey = d => { const x = new Date(d); return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`; };
const todayKey = () => dayKey(new Date());
const isToday = t => dayKey(t) === todayKey();
const hm = t => { const x = new Date(t); return `${pad(x.getHours())}:${pad(x.getMinutes())}`; };
const mmss = s => `${pad(Math.floor(s / 60))}:${pad(Math.floor(s % 60))}`;
const daysBetween = (a, b) => Math.round((startOfDay(b) - startOfDay(a)) / DAY);
const parseDate = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// ───────── 資料保存（只存在這台裝置的瀏覽器）─────────
const blankGame = () => ({ stars: 0, exp: 0, completed: {}, dailyQuiz: {}, quizResults: {}, purchased: [], equipped: null,
  learned: {}, practiced: {}, claimedMilestones: [], chestDays: [] });
const blank = () => ({ profile: null, game: blankGame(), kicks: [], events: [], tummyStart: null, kickSession: null });
let S = blank();
let storageOK = true;
try {
  const raw = localStorage.getItem(KEY);
  if (raw) { const p = JSON.parse(raw); S = Object.assign(blank(), p); S.game = Object.assign(blankGame(), p.game || {}); }
} catch (e) { storageOK = false; }
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); storageOK = true; } catch (e) { storageOK = false; } }

// ───────── 孕期／月齡 ─────────
function pregnancy() {
  const due = parseDate(S.profile.dueDate);
  const days = daysBetween(addDays(due, -280), new Date());
  const week = Math.floor(days / 7);
  return { week, day: ((days % 7) + 7) % 7, shown: Math.min(Math.max(week, 4), 40), daysLeft: daysBetween(new Date(), due) };
}
function ageMonths() {
  const b = parseDate(S.profile.birthDate), n = new Date();
  let m = (n.getFullYear() - b.getFullYear()) * 12 + n.getMonth() - b.getMonth();
  if (n.getDate() < b.getDate()) m -= 1;
  return Math.max(m, 0);
}
function ageText() {
  const days = Math.max(daysBetween(parseDate(S.profile.birthDate), new Date()), 0);
  if (days < 31) return `出生第 ${days + 1} 天`;
  const m = ageMonths();
  return m < 12 ? `${m} 個月大` : `${Math.floor(m / 12)} 歲 ${m % 12} 個月`;
}
const sizeFor = w => D.sizes.filter(s => s.week <= Math.min(Math.max(w, 4), 40)).pop() || D.sizes[0];
const activityFor = w => w < 8 ? "sleeping" : D.activity.plan[Math.min(w, 40) - 8];
const trimesterIndex = w => w < 14 ? 0 : w < 28 ? 1 : 2;
const mode = () => S.profile.mode;

// ───────── 遊戲規則（與 iOS GameRules 相同）─────────
const TUMMY_TARGET = 30, TUMMY_DAYS = 7, LEARN_REWARD = 30, PRACTICE_REWARD = 5, CHEST_EVERY = 7, CHEST_REWARD = 50, MILESTONE_REWARD = 10;
const cost = level => 40 + level * 10;
function levelInfo(exp = S.game.exp) {
  let level = 1, rest = Math.max(exp, 0);
  while (rest >= cost(level)) { rest -= cost(level); level++; }
  return { level, into: rest, needed: cost(level) };
}
function streak() {
  const has = d => (S.game.completed[dayKey(d)] || []).length > 0;
  let d = startOfDay(new Date());
  if (!has(d)) d = addDays(d, -1);
  let n = 0;
  while (has(d)) { n++; d = addDays(d, -1); }
  return n;
}
const chestProgress = s => s <= 0 ? 0 : (s % CHEST_EVERY === 0 ? CHEST_EVERY : s % CHEST_EVERY);
const canOpenChest = () => { const s = streak(); return s > 0 && s % CHEST_EVERY === 0 && !S.game.chestDays.includes(todayKey()) && (S.game.completed[todayKey()] || []).length > 0; };

const Q = (id, emoji, title, reward, check, tip) => ({ id, emoji, title, reward, check, tip });
function quests() {
  if (mode() === "pregnancy") {
    const list = [
      Q("water", "💧", "喝足白開水", 10, "manual", "少喝含糖飲料，水分足夠也能減少便秘。"),
      Q("greens", "🥦", "吃到深綠色蔬菜", 10, "manual", "深綠色蔬菜有葉酸和鐵質。"),
      Q("protein", "🐟", "吃到一份魚肉蛋豆", 10, "manual", "蛋白質幫寶寶長肉，魚類的 DHA 幫寶寶長腦袋。"),
      Q("walk", "🚶‍♀️", "散步或伸展 20 分鐘", 10, "manual", "醫師要妳多休息時，這題可以跳過。"),
      Q("quiz", "🧠", "回答今日知識題", 15, "quiz", "答案會收進百科的知識圖鑑。"),
    ];
    if (pregnancy().week >= 28) list.unshift(Q("kicks", "👣", "數一次胎動", 20, "kicks", "28 週起每天固定時間數 10 次胎動。"));
    return list;
  }
  const list = [
    Q("feeds", "🍼", "記錄 3 次餵奶", 10, "feeds", "記錄下來，看醫生時更好說明。"),
    Q("sleep", "🌙", "記錄一次睡覺", 10, "sleep", "寶寶睡覺要仰睡，床上不放枕頭和玩偶。"),
  ];
  if (ageMonths() < 12) list.push(Q("tummy", "🐢", `趴趴 ${TUMMY_TARGET} 分鐘`, 20, "tummy", "寶寶醒著、大人在旁，一天分好幾次累計。"));
  list.push(
    Q("read", "📖", "陪寶寶說話或讀繪本", 10, "manual", "多和寶寶說話，幫助語言發展。"),
    Q("momRest", "☕️", "媽咪喝杯水、休息一下", 10, "manual", "照顧好自己，才有力氣照顧寶寶。"),
    Q("quiz", "🧠", "回答今日知識題", 15, "quiz", "答案會收進百科的知識圖鑑。"));
  return list;
}
const todayEvents = kind => S.events.filter(e => e.kind === kind && isToday(e.time));
const tummyMinutesOn = key => S.events.filter(e => e.kind === "tummy" && dayKey(e.time) === key).reduce((a, e) => a + (e.minutes || 0), 0);
function tummyDays() {
  const per = {};
  S.events.filter(e => e.kind === "tummy").forEach(e => { const k = dayKey(e.time); per[k] = (per[k] || 0) + (e.minutes || 0); });
  return Object.values(per).filter(m => m >= TUMMY_TARGET).length;
}
function satisfied(check) {
  switch (check) {
    case "kicks": return S.kicks.some(k => isToday(k.start));
    case "quiz": return S.game.dailyQuiz[todayKey()] != null;
    case "feeds": return todayEvents("feed").length >= 3;
    case "sleep": return todayEvents("sleep").length > 0;
    case "tummy": return tummyMinutesOn(todayKey()) >= TUMMY_TARGET;
    default: return false;
  }
}
const isDone = q => (S.game.completed[todayKey()] || []).includes(q.id);

let toastQueue = [];
function grant(n, text) {
  const before = levelInfo().level;
  S.game.stars += n; S.game.exp += n;
  const after = levelInfo().level;
  toast(`${text}　+${n} ⭐️` + (after > before ? `\n升到 Lv ${after}！🎉` : ""));
}
function complete(q) {
  if (isDone(q)) return;
  (S.game.completed[todayKey()] ||= []).push(q.id);
  grant(q.reward, `完成「${q.title}」`);
}
function undo(q) {
  if (q.check !== "manual" || !isDone(q)) return;
  S.game.completed[todayKey()] = S.game.completed[todayKey()].filter(id => id !== q.id);
  S.game.stars = Math.max(S.game.stars - q.reward, 0);
  S.game.exp = Math.max(S.game.exp - q.reward, 0);
}
function sync() {
  if (!S.profile) return;
  quests().forEach(q => { if (q.check !== "manual" && satisfied(q.check) && !isDone(q)) complete(q); });
  if (mode() === "baby" && tummyDays() >= TUMMY_DAYS && skillState("tummy") === "training") learn("tummy");
  save();
}

// 知識題
const quizPool = () => mode() === "pregnancy" ? D.quiz.pregnancy.concat(foodQuiz) : D.quiz.baby;
const verdictIndex = { ok: 0, limit: 1, avoid: 2 };
const catEmoji = { eatingOut: "🍜", drinks: "🧋", seafood: "🦐", eggDairy: "🥚", meat: "🥓", tonic: "🍲", fruitDessert: "🍰" };
const foodQuiz = D.foods.map(f => ({ id: "food." + f.name, emoji: catEmoji[f.cat], prompt: `${f.name}，孕期可以吃嗎？`,
  options: ["⭕️ 可以吃", "⚠️ 適量", "❌ 避免"], answer: verdictIndex[f.verdict], explanation: [f.reason, f.tip].filter(Boolean).join("\n") }));
const allQuiz = D.quiz.pregnancy.concat(foodQuiz, D.quiz.baby);
const quizById = id => allQuiz.find(q => q.id === id);
function todayQuiz() {
  const id = S.game.dailyQuiz[todayKey()];
  if (id && quizById(id)) return quizById(id);
  const all = quizPool();
  const pool = all.filter(q => !(q.id in S.game.quizResults));
  const list = pool.length ? pool : all;
  const n = Math.floor(startOfDay(new Date()).getTime() / DAY);
  return list[((n % list.length) + list.length) % list.length];
}
let lastChoice = null;
function answer(choice) {
  const q = todayQuiz();
  if (S.game.dailyQuiz[todayKey()] != null) return;
  S.game.dailyQuiz[todayKey()] = q.id;
  if (!(q.id in S.game.quizResults)) S.game.quizResults[q.id] = choice === q.answer;
  lastChoice = choice;
}

// 寶寶技能
const SKILLS = [
  { id: "headUp", title: "抬頭", emoji: "👀", age: "約 2–4 個月", pre: null, how: "趴趴、直立抱著讓寶寶看妳的臉，都在練脖子力氣。" },
  { id: "tummy", title: "趴趴", emoji: "🐢", age: "出生後就能開始", pre: null, how: "寶寶醒著、大人在旁，每次幾分鐘、一天多次，慢慢加長。" },
  { id: "roll", title: "翻身", emoji: "🔄", age: "約 4–6 個月", pre: "tummy", how: "趴趴時把玩具放在側邊，吸引寶寶轉頭、轉身。" },
  { id: "sit", title: "坐坐", emoji: "🪑", age: "約 4–9 個月", pre: "roll", how: "在軟墊上用雙手扶著寶寶，或讓寶寶用手撐地練坐。" },
  { id: "crawl", title: "爬爬", emoji: "🐛", age: "約 5–13 個月", pre: "sit", how: "在寶寶前方放玩具，鼓勵寶寶往前移動。" },
  { id: "stand", title: "站站", emoji: "🧍", age: "約 7–17 個月", pre: "crawl", how: "讓寶寶扶著穩固的家具站起來。" },
  { id: "walk", title: "走走", emoji: "👣", age: "約 8–18 個月", pre: "stand", how: "牽著寶寶雙手走，或讓寶寶推穩固的學步推車。" },
];
const skill = id => SKILLS.find(s => s.id === id);
function skillState(id) {
  if (S.game.learned[id]) return "learned";
  const pre = skill(id).pre;
  return !pre || S.game.learned[pre] ? "training" : "locked";
}
const currentSkill = () => SKILLS.find(s => skillState(s.id) === "training");
const practicedToday = id => (S.game.practiced[id] || []).includes(todayKey());
function practice(id) {
  if (skillState(id) !== "training" || practicedToday(id)) return;
  (S.game.practiced[id] ||= []).push(todayKey());
  grant(PRACTICE_REWARD, `練習${skill(id).title}`);
}
function learn(id) {
  if (skillState(id) !== "training") return;
  S.game.learned[id] = new Date().toISOString();
  grant(LEARN_REWARD, `學會${skill(id).title}了 🎉`);
}

// 服裝
const OUTFITS = [
  { id: "bear", title: "小熊裝", emoji: "🐻", unlock: ["free"] },
  { id: "strawberry", title: "草莓帽", emoji: "🍓", unlock: ["stars", 30] },
  { id: "lemon", title: "檸檬帽", emoji: "🍋", unlock: ["stars", 40] },
  { id: "grape", title: "葡萄帽", emoji: "🍇", unlock: ["stars", 50] },
  { id: "bunny", title: "小兔裝", emoji: "🐰", unlock: ["stars", 60] },
  { id: "duck", title: "小鴨裝", emoji: "🐥", unlock: ["stars", 80] },
  { id: "watermelon", title: "西瓜帽", emoji: "🍉", unlock: ["stars", 120] },
  { id: "pineapple", title: "鳳梨王冠", emoji: "🍍", unlock: ["level", 5] },
  { id: "kitty", title: "小貓裝", emoji: "🐱", unlock: ["quiz", 10] },
  { id: "frog", title: "青蛙裝", emoji: "🐸", unlock: ["skill", "roll"] },
];
const outfit = id => OUTFITS.find(o => o.id === id);
function unlockText(o) {
  const [k, v] = o.unlock;
  return k === "free" ? "免費" : k === "stars" ? `⭐️ ${v}` : k === "level" ? `Lv ${v} 解鎖` : k === "quiz" ? `知識圖鑑 ${v} 題` : `學會${skill(v).title}`;
}
function owned(o) {
  const [k, v] = o.unlock;
  return k === "free" || (k === "stars" && S.game.purchased.includes(o.id)) || (k === "level" && levelInfo().level >= v)
    || (k === "quiz" && Object.keys(S.game.quizResults).length >= v) || (k === "skill" && !!S.game.learned[v]);
}
function buy(o) {
  if (o.unlock[0] !== "stars" || owned(o)) return;
  if (S.game.stars < o.unlock[1]) { toast("星星不夠喔，完成任務就能拿到星星。"); return; }
  S.game.stars -= o.unlock[1]; S.game.purchased.push(o.id); S.game.equipped = o.id;
  toast(`${o.emoji} 換上${o.title}了！`);
}

// ───────── Q 版寶寶（SVG）─────────
const LOOK = {
  none: { body: "#BFE3F6" },
  bear: { body: "#C99A6E", hood: "#C99A6E", ear: "#B5835A", inner: "#F2C7A5", kind: "bear" },
  bunny: { body: "#FFF3F6", hood: "#FFF3F6", ear: "#FFF3F6", inner: "#FFC2D1", kind: "bunny" },
  kitty: { body: "#F5C48A", hood: "#F5C48A", ear: "#F5C48A", inner: "#FFD9C2", kind: "kitty" },
  frog: { body: "#8ED494", hood: "#8ED494", kind: "frog" },
  duck: { body: "#FFE27A", hood: "#FFE27A", kind: "duck" },
  strawberry: { body: "#FF9CAE", hat: "🍓" }, lemon: { body: "#FFE97E", hat: "🍋" }, grape: { body: "#C2A8F0", hat: "🍇" },
  watermelon: { body: "#86DB98", hat: "🍉" }, pineapple: { body: "#FFD668", hat: "🍍" },
};
function babySVG({ look = "none", eyes = "open", mouth = "smile", womb = false, hat = null, animate = true, early = null, cls = "baby" } = {}) {
  const L = LOOK[look] || LOOK.none;
  const ink = "#4A3540";
  const anim = animate ? "bob" : "";
  let back = "", front = "", inner = "", wombBg = "";
  if (womb) wombBg = `<circle cx="100" cy="100" r="97" fill="var(--womb)"/><circle cx="100" cy="100" r="88" fill="none" stroke="var(--surface)" stroke-width="3" stroke-dasharray="2 10" stroke-linecap="round" opacity=".8"/>`;
  if (early) {
    // 4–7 週：小種子或小豆子
    const r = early === "seed" ? 26 : 40;
    inner = `<g class="${anim}"><ellipse cx="100" cy="104" rx="${r}" ry="${r * 0.86}" fill="#FFC9B5"/>
      <path d="M${100 - r * .35} 100 q5 5 10 0 M${100 + r * .35 - 10} 100 q5 5 10 0" stroke="${ink}" stroke-width="3" fill="none" stroke-linecap="round"/>
      <ellipse cx="${100 - r * .55}" cy="${110}" rx="6" ry="3.5" fill="#FF9EAD" opacity=".8"/><ellipse cx="${100 + r * .55}" cy="110" rx="6" ry="3.5" fill="#FF9EAD" opacity=".8"/>
      ${early === "embryo" ? `<circle cx="100" cy="128" r="5" fill="#FF7A93" class="zzz"/>` : ""}</g>`;
    return `<svg class="${cls}" viewBox="0 0 200 200" role="img" aria-label="寶寶">${wombBg}${inner}</svg>`;
  }
  // 頭套與耳朵（畫在頭後面）
  if (L.kind) {
    if (L.kind === "bear") back += `<circle cx="52" cy="48" r="21" fill="${L.ear}"/><circle cx="148" cy="48" r="21" fill="${L.ear}"/><circle cx="52" cy="48" r="10" fill="${L.inner}"/><circle cx="148" cy="48" r="10" fill="${L.inner}"/>`;
    if (L.kind === "bunny") back += `<ellipse cx="76" cy="22" rx="14" ry="36" fill="${L.ear}" stroke="#F2D4DC" stroke-width="2"/><ellipse cx="124" cy="22" rx="14" ry="36" fill="${L.ear}" stroke="#F2D4DC" stroke-width="2"/><ellipse cx="76" cy="24" rx="6" ry="25" fill="${L.inner}"/><ellipse cx="124" cy="24" rx="6" ry="25" fill="${L.inner}"/>`;
    if (L.kind === "kitty") back += `<path d="M44 66 L50 18 L88 44 Z" fill="${L.ear}"/><path d="M156 66 L150 18 L112 44 Z" fill="${L.ear}"/><path d="M54 52 L56 32 L74 45 Z" fill="${L.inner}"/><path d="M146 52 L144 32 L126 45 Z" fill="${L.inner}"/>`;
    back += `<circle cx="100" cy="94" r="68" fill="${L.hood}"/>`;
    if (L.kind === "kitty") back += `<path d="M90 30 q10 8 20 0" stroke="#D99A55" stroke-width="5" fill="none" stroke-linecap="round"/>`;
    if (L.kind === "frog") front += `<circle cx="70" cy="40" r="19" fill="${L.hood}"/><circle cx="130" cy="40" r="19" fill="${L.hood}"/><circle cx="70" cy="40" r="11" fill="#fff"/><circle cx="130" cy="40" r="11" fill="#fff"/><circle cx="72" cy="41" r="6" fill="${ink}"/><circle cx="132" cy="41" r="6" fill="${ink}"/>`;
    if (L.kind === "duck") front += `<ellipse cx="100" cy="34" rx="17" ry="8" fill="#FF9F43"/><path d="M96 24 q4 -14 12 -10" stroke="#F2C94C" stroke-width="5" fill="none" stroke-linecap="round"/>`;
  }
  const body = `<ellipse cx="100" cy="170" rx="50" ry="30" fill="${L.body}"/><circle cx="56" cy="160" r="13" fill="var(--skin)"/><circle cx="144" cy="160" r="13" fill="var(--skin)"/>`;
  const head = `<circle cx="100" cy="98" r="56" fill="var(--skin)"/>`;
  const hair = !L.kind && !hat ? `<path d="M100 44 q-10 -16 4 -20 q-11 9 3 16" stroke="#7A5560" stroke-width="4" fill="none" stroke-linecap="round"/>` : "";
  const eyeOpen = x => `<ellipse cx="${x}" cy="100" rx="6.5" ry="8" fill="${ink}"/><circle cx="${x + 2.2}" cy="96.5" r="2.4" fill="#fff"/>`;
  const eyeClosed = x => `<path d="M${x - 8} 99 q8 7 16 0" stroke="${ink}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`;
  const eyesSvg = eyes === "open" ? eyeOpen(78) + eyeOpen(122) : eyeClosed(78) + eyeClosed(122);
  const mouths = {
    smile: `<path d="M93 118 q7 7 14 0" stroke="${ink}" stroke-width="3.2" fill="none" stroke-linecap="round"/>`,
    happy: `<path d="M91 116 q9 14 18 0 z" fill="#E4607A" stroke="${ink}" stroke-width="2.5" stroke-linejoin="round"/>`,
    sleep: `<ellipse cx="100" cy="120" rx="4" ry="3" fill="${ink}" opacity=".8"/>`,
  };
  const cheeks = `<ellipse cx="66" cy="115" rx="10" ry="6" fill="#FF9EAD" opacity=".75"/><ellipse cx="134" cy="115" rx="10" ry="6" fill="#FF9EAD" opacity=".75"/>`;
  const hatSvg = hat ? `<text x="100" y="58" font-size="54" text-anchor="middle">${hat}</text>` : "";
  const zz = eyes === "closed" && mouth === "sleep" ? `<text x="150" y="52" font-size="22" font-family="var(--font-display)" fill="var(--muted)" class="zzz">z</text><text x="166" y="36" font-size="16" font-family="var(--font-display)" fill="var(--muted)" class="zzz" style="animation-delay:.8s">z</text>` : "";
  const scale = womb ? `transform="translate(100 104) scale(.8) translate(-100 -104)"` : "";
  return `<svg class="${cls}" viewBox="0 0 200 200" role="img" aria-label="寶寶">${wombBg}
    <g ${scale}><g class="${anim}">${back}${body}${head}${hair}${front}${eyesSvg}${cheeks}${mouths[mouth]}${hatSvg}</g></g>${zz}</svg>`;
}
// 目前要穿的造型：自己選的服裝；「自動」時孕期戴當週水果帽、出生後穿連身衣
function currentLook(override) {
  const id = override !== undefined ? override : S.game.equipped;
  const o = id && outfit(id);
  if (o && owned(o)) return { look: o.id, hat: LOOK[o.id].hat || null };
  if (mode() === "pregnancy") return { look: "none", hat: pregnancy().shown >= 8 ? sizeFor(pregnancy().shown).emoji : null };
  return { look: "none", hat: null };
}
function fetusSVG(week, opts = {}) {
  if (week < 5) return babySVG({ womb: true, early: "seed", ...opts });
  if (week < 8) return babySVG({ womb: true, early: "embryo", ...opts });
  const act = activityFor(week);
  const eyes = week >= 26 && act !== "sleeping" && act !== "yawning" ? "open" : "closed";
  const mouth = act === "sleeping" ? "sleep" : act === "smiling" || act === "waving" || act === "kicking" ? "happy" : "smile";
  return babySVG({ womb: true, eyes, mouth, ...opts });
}
function babyMood() {
  if (S.events.some(e => e.kind === "sleep" && !e.end)) return "sleeping";
  const last = S.events.filter(e => e.kind === "feed").sort((a, b) => b.time.localeCompare(a.time))[0];
  if (last && Date.now() - new Date(last.time) < 30 * 60000) return "fed";
  return "awake";
}
function newbornSVG(look, opts = {}) {
  const m = babyMood();
  return babySVG({ ...look, eyes: m === "sleeping" ? "closed" : "open", mouth: m === "sleeping" ? "sleep" : m === "fed" ? "happy" : "smile", ...opts });
}

// ───────── 小元件 ─────────
const bar = (f, cls = "") => `<div class="bar ${cls}"><i style="width:${Math.round(Math.min(Math.max(f, 0), 1) * 100)}%"></i></div>`;
function ring(value, total, label, color, text) {
  const f = Math.min(value / total, 1), r = 32, c = 2 * Math.PI * r;
  return `<div class="ring"><svg viewBox="0 0 80 80" aria-hidden="true"><circle class="ring-track" cx="40" cy="40" r="${r}" fill="none" stroke-width="9"/>
    <circle cx="40" cy="40" r="${r}" fill="none" stroke="${color}" stroke-width="9" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - f)}" transform="rotate(-90 40 40)"/>
    <text class="ring-text" x="40" y="46" font-size="17" text-anchor="middle">${text}</text></svg>${label}</div>`;
}
function statusBar() {
  const L = levelInfo();
  return `<header class="status"><div class="lv"><span class="lv-badge">Lv ${L.level}</span>${bar(L.into / L.needed)}</div>
    <span class="chip">⭐️ ${S.game.stars}</span><span class="chip">🔥 ${streak()}</span>
    ${S.profile.demo ? `<span class="demo-tag">示範</span>` : ""}
    <button class="gear" data-act="go" data-arg="settings" aria-label="設定">⚙️</button></header>`;
}
function questRow(q) {
  const done = isDone(q), manual = q.check === "manual";
  return `<button class="quest ${done ? "done" : ""}" data-act="quest" data-arg="${q.id}" ${!manual && !done ? `data-hint="1"` : ""}>
    <span class="q-emoji">${q.emoji}</span><span class="grow"><span class="q-title">${q.title}</span>
    <span class="q-tip" style="display:block">${manual ? q.tip : (done ? "完成了！" : "<span class='auto-tag'>有紀錄就自動完成</span>　" + q.tip)}</span></span>
    <span class="reward">+${q.reward}</span><span class="check">${done ? "✓" : ""}</span></button>`;
}
const backBtn = () => `<button class="back" data-act="back">‹ 返回</button>`;

// ───────── 畫面：家 ─────────
function viewHome() {
  if (mode() === "pregnancy") {
    const p = pregnancy(), size = sizeFor(p.shown), act = activityFor(p.shown);
    const bubble = p.shown < 8 ? (p.shown < 5 ? "我是一顆小種子 🌱" : "我的心臟開始跳了！") : D.activity.bubbles[act];
    const progress = Math.min(Math.max((p.week * 7 + p.day) / 280, 0), 1);
    const left = p.daysLeft > 0 ? `距離預產期 ${p.daysLeft} 天` : p.daysLeft === 0 ? "今天就是預產期！" : `已超過預產期 ${-p.daysLeft} 天`;
    return `<div class="stack">
      <section class="hero"><span class="bubble">${bubble}</span>${fetusSVG(p.shown, currentLook())}
        <h1 class="hero-title">${p.week < 4 ? "懷孕初期" : `懷孕 ${p.week} 週 ${p.day} 天`}</h1>
        <p class="hero-sub">${size.emoji} 寶寶大約像${size.comparison}${p.shown >= 8 ? `・${D.activity.titles[act]}` : ""}</p>
        <div class="row" style="margin-top:10px">${bar(progress, "mint")}<span class="small muted" style="white-space:nowrap">${left}</span></div></section>
      <div class="tiles">
        <button class="tile" data-act="go" data-arg="kicks"><span class="ico pink">👣</span>數胎動</button>
        <button class="tile" data-act="go" data-arg="food"><span class="ico mint">🍱</span>能吃嗎</button>
        <button class="tile" data-act="go" data-arg="weekly"><span class="ico sky">👶</span>每週寶寶</button>
        <button class="tile" data-act="go" data-arg="nutrition"><span class="ico sun">🥗</span>飲食</button>
      </div>
      ${questPreview()}</div>`;
  }
  const m = babyMood(), sleeping = m === "sleeping";
  const bubble = sleeping ? "呼嚕呼嚕… 😴" : m === "fed" ? "喝飽飽了，好滿足！" : (ageMonths() < 12 && tummyMinutesOn(todayKey()) < TUMMY_TARGET ? "想練趴趴！" : "媽咪陪我玩～");
  const feeds = todayEvents("feed").length, sleepH = sleepHoursToday(), qs = quests(), qd = qs.filter(isDone).length;
  const name = S.profile.babyName ? esc(S.profile.babyName) : "寶寶";
  return `<div class="stack">
    <section class="hero"><span class="bubble">${bubble}</span>${newbornSVG(currentLook())}
      <h1 class="hero-title">${name}・${ageText()}</h1>
      <div class="rings" style="margin-top:12px">${ring(feeds, 8, "餵奶", "var(--accent)", `${feeds}`)}${ring(sleepH, 14, "睡眠", "#7FB6E6", `${sleepH.toFixed(1)}h`)}${ring(qd, qs.length, "任務", "var(--mint)", `${qd}/${qs.length}`)}</div></section>
    <div class="tiles">
      <button class="tile" data-act="sheet" data-arg="feed"><span class="ico pink">🍼</span>餵奶</button>
      <button class="tile ${sleeping ? "on" : ""}" data-act="sleep"><span class="ico sky">${sleeping ? "🌞" : "🌙"}</span>${sleeping ? "起床" : "睡覺"}</button>
      <button class="tile" data-act="sheet" data-arg="diaper"><span class="ico sun">🧷</span>尿布</button>
      <button class="tile ${S.tummyStart ? "on" : ""}" data-act="go" data-arg="tummy"><span class="ico mint">🐢</span>趴趴</button>
    </div>
    ${todayLogCard()}
    ${questPreview()}</div>`;
}
function questPreview() {
  const left = quests().filter(q => !isDone(q)).slice(0, 3);
  return `<section class="stack" style="gap:10px"><div class="section-title"><span>今日任務</span><button class="small" style="color:var(--accent);font-weight:700" data-act="tab" data-arg="quests">全部 ›</button></div>
    ${left.length ? left.map(questRow).join("") : `<div class="card" style="text-align:center">今天的任務都完成了，好棒！🎉</div>`}</section>`;
}
function sleepHoursToday() {
  const s0 = startOfDay(new Date()).getTime(), now = Date.now();
  return S.events.filter(e => e.kind === "sleep").reduce((a, e) => {
    const st = Math.max(new Date(e.time).getTime(), s0), en = Math.min(e.end ? new Date(e.end).getTime() : now, now);
    return a + Math.max(en - st, 0);
  }, 0) / 3600000;
}
function eventText(e) {
  switch (e.kind) {
    case "feed": return `🍼 ${e.detail}`;
    case "sleep": return e.end ? `🌙 睡覺 ${Math.round((new Date(e.end) - new Date(e.time)) / 60000)} 分鐘` : "🌙 睡覺中…";
    case "diaper": return `🧷 尿布・${e.detail}`;
    case "tummy": return `🐢 趴趴 ${e.minutes} 分鐘`;
  }
  return "";
}
function eventRows(list) {
  return list.map(e => `<div class="timeline-item"><span class="time">${hm(e.time)}</span><span class="grow">${eventText(e)}</span>
    <button class="x" data-act="del-event" data-arg="${e.id}" aria-label="刪除這筆">✕</button></div>`).join("");
}
function todayLogCard() {
  const list = S.events.filter(e => isToday(e.time) || (e.kind === "sleep" && !e.end)).sort((a, b) => b.time.localeCompare(a.time));
  return `<section class="card"><div class="section-title" style="font-size:17px"><span>今天的紀錄</span><button class="small" style="color:var(--accent);font-weight:700" data-act="go" data-arg="log">全部 ›</button></div>
    ${list.length ? eventRows(list.slice(0, 5)) : `<p class="muted small" style="padding-top:6px">按上面的按鈕，一鍵記錄餵奶、睡覺和尿布。</p>`}</section>`;
}

// ───────── 畫面：任務 ─────────
function viewQuests() {
  const q = todayQuiz(), answered = S.game.dailyQuiz[todayKey()] != null;
  const s = streak(), prog = chestProgress(s), qs = quests();
  let quiz;
  if (!answered) {
    quiz = `<div class="options">${q.options.map((o, i) => `<button class="option" data-act="answer" data-arg="${i}">${esc(o)}</button>`).join("")}</div>`;
  } else {
    const correct = S.game.quizResults[q.id];
    quiz = `<div class="options">${q.options.map((o, i) => `<div class="option ${i === q.answer ? "right" : i === lastChoice ? "wrong" : ""}">${esc(o)}${i === q.answer ? "　✓" : ""}</div>`).join("")}</div>
      <p style="text-align:center;font-weight:700">${lastChoice === null ? "今天的題目答過囉，明天再來！" : correct ? "答對了！🎉" : "差一點！記起來就學會了 💪"}</p>
      <div class="explain">💡 ${esc(q.explanation)}</div>`;
  }
  return `<div class="stack">
    <section class="card stack" style="gap:12px"><div class="row between"><span class="section-title">🧠 今日知識題</span><span class="reward">+15 ⭐️</span></div>
      <div class="quiz-emoji">${q.emoji}</div><p class="quiz-prompt">${esc(q.prompt)}</p>${quiz}</section>
    <section class="stack" style="gap:10px"><div class="section-title"><span>今日任務</span><span class="small muted">${qs.filter(isDone).length}/${qs.length} 完成</span></div>
      ${qs.map(questRow).join("")}<p class="note">自己打勾的任務點錯了，再點一次就能取消。</p></section>
    <section class="card stack" style="gap:10px"><div class="row"><span style="font-size:40px">${canOpenChest() ? "🎁" : "🧰"}</span>
      <div class="grow"><b>連續 7 天寶箱</b><p class="small muted">每天完成任一任務，連續 7 天就能開寶箱 +${CHEST_REWARD} ⭐️</p></div></div>
      <div class="row">${bar(prog / CHEST_EVERY, "sun")}<b style="font-variant-numeric:tabular-nums">${prog}/${CHEST_EVERY}</b></div>
      ${canOpenChest() ? `<button class="btn block" data-act="chest">打開寶箱！</button>` : ""}</section></div>`;
}

// ───────── 畫面：技能 ─────────
let selectedSkill = null, confirmLearn = false;
function viewSkills() {
  if (mode() === "pregnancy") {
    const w = pregnancy().week;
    const nodes = D.milestones.map((m, i) => {
      const claimed = S.game.claimedMilestones.includes(m.title), ready = w >= m.week && !claimed;
      const st = claimed ? "claimed" : ready ? "ready" : "locked";
      return `${i ? `<div class="connector"></div>` : ""}<div class="node ${st} off-${i % 4}">
        <div class="dot">${claimed ? "✓" : ready ? "🎁" : "🔒"}</div><div class="n-title">${m.title}</div>
        <div class="n-sub">${m.week} 週</div>
        ${ready ? `<button class="btn" style="padding:6px 12px;font-size:13px" data-act="claim" data-arg="${i}">領取 +${MILESTONE_REWARD} ⭐️</button>` : ""}</div>`;
    }).join("");
    const next = D.milestones.find(m => m.week > w);
    return `<div class="stack"><section class="card"><h2 style="font-size:22px">寶寶的成長地圖</h2>
      <p class="muted small">寶寶在肚子裡每學會一個新本領，就來領一顆禮物。${next ? `下一個：${next.week} 週「${next.title}」` : "全部都解鎖了！"}</p></section>
      <div class="path">${nodes}</div>
      <p class="note">週數依常見衛教資料，每個寶寶發育時間不同，以產檢結果為準。</p></div>`;
  }
  const cur = currentSkill();
  const sel = skill(selectedSkill) || cur || SKILLS[SKILLS.length - 1];
  const st = skillState(sel.id);
  let action = "";
  if (st === "learned") action = `<p class="btn mint block" style="cursor:default">已經學會了 🎉</p>`;
  else if (st === "locked") action = `<p class="btn secondary block" style="cursor:default">🔒 先學會「${skill(sel.pre).title}」</p>`;
  else if (sel.id === "tummy") {
    const days = tummyDays(), today = tummyMinutesOn(todayKey());
    action = `<div class="stack" style="gap:8px;text-align:left"><div class="row"><span class="small grow">今天趴趴</span><b class="small">${today}/${TUMMY_TARGET} 分鐘</b></div>${bar(today / TUMMY_TARGET, "mint")}
      <div class="row"><span class="small grow">達標天數</span><b class="small">${Math.min(days, TUMMY_DAYS)}/${TUMMY_DAYS} 天</b></div>${bar(days / TUMMY_DAYS, "sun")}
      <p class="small muted">累計 ${TUMMY_DAYS} 天、每天 ${TUMMY_TARGET} 分鐘，就會自動學會，並解鎖翻身訓練。</p>
      <button class="btn block" data-act="go" data-arg="tummy">🐢 開始趴趴計時</button></div>`;
  } else {
    action = `<div class="stack" style="gap:8px"><p class="small muted">已練習 ${(S.game.practiced[sel.id] || []).length} 天</p>
      <button class="btn secondary block" data-act="practice" data-arg="${sel.id}" ${practicedToday(sel.id) ? "disabled" : ""}>${practicedToday(sel.id) ? "今天練過了 ✓" : `今天陪寶寶練習了 +${PRACTICE_REWARD} ⭐️`}</button>
      ${confirmLearn ? `<div class="row"><button class="btn secondary grow" data-act="learn-cancel">還沒</button><button class="btn mint grow" data-act="learn" data-arg="${sel.id}">對，學會了！</button></div>`
        : `<button class="btn block" data-act="learn-ask">寶寶學會${sel.title}了！+${LEARN_REWARD} ⭐️</button>`}</div>`;
  }
  const nodes = SKILLS.map((s, i) => {
    const ss = skillState(s.id);
    return `${i ? `<div class="connector"></div>` : ""}<button class="node ${ss} off-${i % 4} ${s.id === sel.id ? "selected" : ""}" data-act="pick-skill" data-arg="${s.id}">
      <div class="dot">${ss === "locked" ? "🔒" : s.emoji}</div><div class="n-title">${s.title}${ss === "learned" ? " ✓" : ""}</div><div class="n-sub">${s.age}</div></button>`;
  }).join("");
  return `<div class="stack">
    <section class="hero stack" style="gap:8px"><div style="font-size:54px;line-height:1">${sel.emoji}</div><h2 style="font-size:26px">${sel.title}</h2>
      <p class="small muted">${sel.age}</p><p>${sel.how}</p>${action}</section>
    <div class="path">${nodes}</div>
    <p class="note">技能順序和「7 天學會趴趴」是遊戲安排，不是發展評估。每個寶寶速度不同，有疑慮請和兒科醫師討論。趴趴一定要在寶寶醒著、大人在旁時進行。</p></div>`;
}

// ───────── 畫面：衣櫃 ─────────
let pickedOutfit;
function viewWardrobe() {
  const sel = pickedOutfit === undefined ? S.game.equipped : pickedOutfit;
  const o = sel && outfit(sel);
  const look = o ? { look: o.id, hat: LOOK[o.id].hat || null } : currentLook(null);
  const preview = mode() === "pregnancy" ? fetusSVG(Math.max(pregnancy().shown, 8), look) : newbornSVG(look);
  let action;
  const wearing = (S.game.equipped || null) === (sel || null);
  if (!o) action = `<button class="btn block" data-act="equip" data-arg="" ${wearing ? "disabled" : ""}>${wearing ? "穿著中" : "換回自動造型"}</button>`;
  else if (owned(o)) action = `<button class="btn block" data-act="equip" data-arg="${o.id}" ${wearing ? "disabled" : ""}>${wearing ? "穿著中" : `穿上${o.title}`}</button>`;
  else if (o.unlock[0] === "stars") action = `<button class="btn block" data-act="buy" data-arg="${o.id}" ${S.game.stars < o.unlock[1] ? "disabled" : ""}>用 ⭐️ ${o.unlock[1]} 買下來</button>
    ${S.game.stars < o.unlock[1] ? `<p class="small muted">還差 ${o.unlock[1] - S.game.stars} 顆星星，去做任務吧！</p>` : ""}`;
  else action = `<p class="btn secondary block" style="cursor:default">🔒 ${unlockText(o)}</p>`;
  const tile = (id, title, sub, subOn, locked) => `<button class="outfit ${(sel || "") === id ? "sel" : ""} ${locked ? "locked" : ""}" data-act="pick-outfit" data-arg="${id}">
    ${id ? (mode() === "pregnancy" ? fetusSVG(20, { look: id, hat: LOOK[id].hat || null, animate: false, cls: "" }) : babySVG({ look: id, hat: LOOK[id].hat || null, animate: false, cls: "" }))
      : (mode() === "pregnancy" ? fetusSVG(Math.max(pregnancy().shown, 8), { ...currentLook(null), animate: false, cls: "" }) : babySVG({ animate: false, cls: "" }))}
    <span>${title}</span><span class="o-sub ${subOn ? "on" : ""}">${sub}</span></button>`;
  const autoSub = mode() === "pregnancy" ? "當週水果" : "連身衣";
  return `<div class="stack">
    <section class="hero"><div style="width:min(52vw,190px);margin:0 auto">${preview.replace('class="baby"', 'class="baby" style="width:100%"')}</div>
      <h2 style="font-size:24px;margin-block:4px 10px">${o ? `${o.emoji} ${o.title}` : "✨ 自動造型"}</h2>${action}</section>
    <div class="wardrobe">${tile("", "自動", !S.game.equipped ? "穿著中" : autoSub, !S.game.equipped, false)}
      ${OUTFITS.map(x => tile(x.id, x.title, S.game.equipped === x.id ? "穿著中" : owned(x) ? "已擁有" : unlockText(x), S.game.equipped === x.id || owned(x), !owned(x))).join("")}</div></div>`;
}

// ───────── 畫面：百科 ─────────
function viewWiki() {
  const n = Object.keys(S.game.quizResults).length, total = quizPool().length;
  const kb = (page, ico, color, title, sub) => `<button class="kb" data-act="go" data-arg="${page}"><span class="ico ${color}">${ico}</span><b>${title}</b><span>${sub}</span></button>`;
  const tiles = mode() === "pregnancy" ? [
    kb("food", "🍱", "mint", "能不能吃", "外食、飲料、海鮮、補品"),
    kb("nutrition", "🥗", "sun", "飲食建議", "這個孕期的營養重點與菜單"),
    kb("weekly", "👶", "sky", "每週寶寶", "寶寶多大、會做什麼"),
    kb("kicks", "👣", "pink", "數胎動", "28 週起每天數 10 下"),
    kb("warning", "🚨", "pink", "就醫警訊", "出現這些狀況要馬上就醫"),
    kb("settings", "⚙️", "sky", "設定", "預產期、資料、加到主畫面"),
  ] : [
    kb("log", "📒", "pink", "育兒紀錄", "餵奶、睡覺、尿布、趴趴"),
    kb("tummy", "🐢", "mint", "趴趴計時", "每天累計 30 分鐘"),
    kb("warning", "🚨", "pink", "就醫警訊", "寶寶出現這些狀況要就醫"),
    kb("settings", "⚙️", "sky", "設定", "寶寶生日、資料、加到主畫面"),
  ];
  return `<div class="stack">
    <button class="card row" style="text-align:left" data-act="go" data-arg="book"><span style="font-size:40px">📚</span>
      <span class="grow"><b style="font-size:17px">知識圖鑑</b><span class="small muted" style="display:block">每天答一題，收集到這裡　${n}/${total}</span>${bar(n / total, "sun")}</span><span class="muted">›</span></button>
    <div class="kb-grid">${tiles.join("")}</div>
    <p class="note">內容整理自衛福部國健署、WHO 與國內外醫療衛教資料，僅供參考，不能取代醫師與營養師的建議。</p></div>`;
}
let foodQuery = "", foodVerdict = "all";
function foodResults() {
  const q = foodQuery.trim().toLowerCase();
  const order = { avoid: 0, limit: 1, ok: 2 }, label = { avoid: "❌ 避免", limit: "⚠️ 適量", ok: "⭕️ 可以吃" };
  const list = D.foods.filter(f => (foodVerdict === "all" || f.verdict === foodVerdict) &&
    (!q || f.name.toLowerCase().includes(q) || f.aliases.some(a => a.toLowerCase().includes(q)) || D.foodCategories[f.cat].includes(q)))
    .sort((a, b) => order[a.verdict] - order[b.verdict]);
  if (!list.length) return `<div class="card muted">找不到「${esc(foodQuery)}」。可以試試更短的關鍵字，例如「蛋」、「魚」、「茶」。不確定時請問醫師或營養師。</div>`;
  return list.map(f => `<article class="card food"><span class="verdict ${f.verdict}">${label[f.verdict]}</span>
    <div style="min-width:0"><b>${esc(f.name)}</b><p class="small">${esc(f.reason)}</p>${f.tip ? `<p class="tip">👉 ${esc(f.tip)}</p>` : ""}</div></article>`).join("");
}
function pageFood() {
  const v = (id, t) => `<button class="pill" aria-pressed="${foodVerdict === id}" data-act="food-verdict" data-arg="${id}">${t}</button>`;
  return `${backBtn()}<h1 class="page-title">能不能吃？</h1><div class="stack">
    <input class="input" id="food-q" type="search" placeholder="搜尋：生魚片、珍奶、麻油雞…" value="${esc(foodQuery)}" autocomplete="off">
    <div class="pill-row">${v("all", "全部")}${v("avoid", "❌ 避免")}${v("limit", "⚠️ 適量")}${v("ok", "⭕️ 可以吃")}</div>
    <div class="stack" id="food-list">${foodResults()}</div>
    <p class="note">正式上架前會再請營養師審閱。有妊娠糖尿病、過敏或特殊飲食時，請依醫師建議。</p></div>`;
}
let nutritionTab = null;
function pageNutrition() {
  const cur = nutritionTab ?? (mode() === "pregnancy" ? trimesterIndex(pregnancy().week) : 2);
  const t = D.trimesters[cur], names = ["第一孕期", "第二孕期", "第三孕期"];
  const meal = (ico, title, list) => `<div><b>${ico} ${title}</b><ul class="list small">${list.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>`;
  return `${backBtn()}<h1 class="page-title">飲食建議</h1><div class="stack">
    <div class="pill-row">${names.map((n, i) => `<button class="pill" aria-pressed="${i === cur}" data-act="nutrition-tab" data-arg="${i}">${n}</button>`).join("")}</div>
    <section class="card stack" style="gap:8px"><span class="verdict ok" style="align-self:flex-start">${esc(t.extraCalories)}</span><p><b>${esc(t.summary)}</b></p>
      <ul class="list small">${t.tips.map(x => `<li>${esc(x)}</li>`).join("")}</ul></section>
    <section class="card stack" style="gap:10px"><h3 style="font-size:18px">一日菜單靈感</h3>
      ${meal("🌅", "早餐", t.meals.breakfast)}${meal("☀️", "午餐", t.meals.lunch)}${meal("🌙", "晚餐", t.meals.dinner)}${meal("🍎", "點心", t.meals.snack)}</section>
    <h3 style="font-size:19px">重要營養素</h3>
    ${D.nutrients.map(n => `<section class="card stack" style="gap:6px"><div class="row between"><b style="font-size:16px">${esc(n.name)}</b><span class="verdict limit">${esc(n.purpose)}</span></div>
      <p class="small">${esc(n.why)}</p><p class="small"><b>建議：</b>${esc(n.amount)}</p><p class="tip">🍽 ${n.foods.map(esc).join("、")}</p></section>`).join("")}
    <p class="note">數值依國健署「國人膳食營養素參考攝取量」整理，實際需求請依醫師與營養師建議。</p></div>`;
}
let weeklyWeek = null;
function pageWeekly() {
  const w = weeklyWeek ?? (mode() === "pregnancy" ? pregnancy().shown : 20);
  const s = sizeFor(w), act = activityFor(w);
  const ms = D.milestones.filter(m => m.week <= w);
  const weight = s.g >= 1000 ? `${(s.g / 1000).toFixed(1)} 公斤` : s.g > 0 ? `${s.g} 公克` : "不到 1 公克";
  return `${backBtn()}<h1 class="page-title">每週寶寶</h1><div class="stack">
    <section class="hero"><div style="width:min(56vw,210px);margin:0 auto">${fetusSVG(w, currentLook()).replace('class="baby"', 'class="baby" style="width:100%"')}</div>
      <h2 style="font-size:30px">第 ${w} 週</h2><p class="hero-sub">${s.emoji} 大約像${s.comparison}・${s.cm} 公分・${weight}</p>
      ${w >= 8 ? `<p class="small" style="margin-top:4px">今天在「${D.activity.titles[act]}」</p>` : ""}
      <label class="small muted" for="week-range" style="display:block;margin-top:10px">拖拉看看其他週數</label>
      <input class="range" id="week-range" type="range" min="4" max="40" value="${w}"></section>
    <h3 style="font-size:19px">到這週已經會的本領</h3>
    ${ms.length ? ms.slice().reverse().map(m => `<section class="card"><div class="row between"><b>${esc(m.title)}</b><span class="small muted">${m.week} 週</span></div><p class="small">${esc(m.detail)}</p></section>`).join("")
      : `<p class="card small muted">寶寶正在著床、慢慢長大中。</p>`}
    <p class="note">20 週前為頭臀長，20 週後為頭到腳跟長。數值是約略平均，以產檢超音波為準。</p></div>`;
}
function pageBook() {
  const pool = quizPool(), answered = pool.filter(q => q.id in S.game.quizResults);
  return `${backBtn()}<h1 class="page-title">知識圖鑑</h1><div class="stack">
    <section class="card"><div class="row"><b class="grow">已收集 ${answered.length}/${pool.length} 題</b><span class="small muted">答對 ${answered.filter(q => S.game.quizResults[q.id]).length} 題</span></div>${bar(answered.length / pool.length, "sun")}
      <p class="small muted" style="margin-top:6px">每天在「任務」答一題，答過的題目和說明都會收在這裡。</p></section>
    ${answered.length ? answered.map(q => `<section class="card stack" style="gap:6px"><div class="row"><span style="font-size:26px">${q.emoji}</span><b class="grow">${esc(q.prompt)}</b><span>${S.game.quizResults[q.id] ? "✅" : "📝"}</span></div>
      <p class="small"><b>答案：</b>${esc(q.options[q.answer])}</p><p class="tip" style="white-space:pre-line">${esc(q.explanation)}</p></section>`).join("")
      : `<section class="card muted" style="text-align:center">還沒有收集到題目，去「任務」答今天的題目吧！</section>`}
    <button class="btn secondary" data-act="tab" data-arg="quests">去答今天的題目</button></div>`;
}
function pageWarning() {
  const signs = D.warningSigns[mode()];
  return `${backBtn()}<h1 class="page-title">就醫警訊</h1><div class="stack">
    <section class="warn"><h3>${mode() === "pregnancy" ? "出現以下狀況請立即就醫" : "寶寶出現以下狀況請盡快就醫"}</h3><ul class="list">${signs.map(s => `<li>${esc(s)}</li>`).join("")}</ul></section>
    <p style="font-weight:700">緊急時請撥打 119 或直接到急診。</p></div>`;
}

// 數胎動
function pageKicks() {
  const k = S.kickSession, todays = S.kicks.filter(x => isToday(x.start));
  const body = k ? `<p class="big-timer" data-timer="kick">${mmss((Date.now() - new Date(k.start)) / 1000)}</p>
      <button class="kick-btn" data-act="kick">踢了一下<br>👣 ${k.count}/10</button>
      ${bar(k.count / 10, "mint")}
      <div class="row"><button class="btn secondary grow" data-act="kick-cancel">取消</button><button class="btn mint grow" data-act="kick-finish" ${k.count ? "" : "disabled"}>完成記錄</button></div>`
    : `<button class="kick-btn" data-act="kick-start">開始<br>數胎動</button>
      <p class="small muted" style="text-align:center">找個舒服的姿勢側躺，感覺到一次踢、扭、翻身就按一下。</p>`;
  return `${backBtn()}<h1 class="page-title">數胎動</h1><div class="stack">
    <section class="card stack" style="gap:12px">${body}</section>
    ${todays.length ? `<section class="card"><b>今天的紀錄</b>${todays.map(x => `<div class="timeline-item"><span class="time">${hm(x.start)}</span><span class="grow">👣 ${x.count} 次・${Math.max(1, Math.round(x.seconds / 60))} 分鐘</span></div>`).join("")}</section>` : ""}
    <section class="warn"><h3>什麼時候要聯絡醫師？</h3><p class="small">一般建議 2 小時內感覺到 10 次胎動。如果胎動明顯比平常少，或 2 小時數不到 10 次，請盡快聯絡產檢醫師或到醫院，不要等到明天。</p></section></div>`;
}

// 趴趴計時
function pageTummy() {
  const today = tummyMinutesOn(todayKey()), days = tummyDays();
  const running = !!S.tummyStart;
  return `${backBtn()}<h1 class="page-title">趴趴計時</h1><div class="stack">
    <section class="card stack" style="gap:12px;text-align:center">
      <div style="width:150px;margin:0 auto">${newbornSVG({ look: currentLook().look, hat: currentLook().hat }, { cls: "baby" }).replace('class="baby"', 'class="baby" style="width:100%"')}</div>
      <p class="big-timer" data-timer="tummy">${running ? mmss((Date.now() - new Date(S.tummyStart)) / 1000) : "00:00"}</p>
      ${running ? `<button class="btn mint block" data-act="tummy-stop">結束並記錄</button>`
        : `<button class="btn block" data-act="tummy-start">🐢 開始趴趴</button>
           <div class="row"><span class="small muted grow" style="text-align:left">忘了計時？直接補記：</span><button class="pill" data-act="tummy-add" data-arg="5">+5 分</button><button class="pill" data-act="tummy-add" data-arg="10">+10 分</button></div>`}
      <div class="row"><span class="small grow" style="text-align:left">今天累計</span><b class="small">${today}/${TUMMY_TARGET} 分鐘</b></div>${bar(today / TUMMY_TARGET, "mint")}
      <div class="row"><span class="small grow" style="text-align:left">學會趴趴</span><b class="small">${Math.min(days, TUMMY_DAYS)}/${TUMMY_DAYS} 天</b></div>${bar(days / TUMMY_DAYS, "sun")}
    </section>
    <section class="warn"><h3>安全提醒</h3><ul class="list small"><li>只在寶寶醒著、大人在旁邊時趴趴</li><li>寶寶想睡了，就翻回仰躺放到床上</li><li>從每次 1–2 分鐘開始，一天多次慢慢加長</li><li>選平穩的地墊，避開柔軟的床和枕頭</li></ul></section>
    <p class="note">每天累計 30 分鐘來自 WHO 對還不會爬的嬰兒的建議；「7 天學會」是遊戲安排。</p></div>`;
}

function pageLog() {
  const byDay = {};
  S.events.slice().sort((a, b) => b.time.localeCompare(a.time)).forEach(e => (byDay[dayKey(e.time)] ||= []).push(e));
  const days = Object.keys(byDay).slice(0, 14);
  return `${backBtn()}<h1 class="page-title">育兒紀錄</h1><div class="stack">
    ${days.length ? days.map(d => `<section class="card"><div class="row between"><b>${d === todayKey() ? "今天" : d.slice(5).replace("-", "/")}</b>
      <span class="small muted">🍼 ${byDay[d].filter(e => e.kind === "feed").length}・🧷 ${byDay[d].filter(e => e.kind === "diaper").length}・🐢 ${tummyMinutesOn(d)} 分</span></div>${eventRows(byDay[d])}</section>`).join("")
      : `<section class="card muted">還沒有紀錄。回到「家」按餵奶、睡覺、尿布或趴趴就會出現在這裡。</section>`}
    <p class="note">顯示最近 14 天。</p></div>`;
}

let confirmReset = false;
function pageSettings() {
  const p = S.profile;
  return `${backBtn()}<h1 class="page-title">設定</h1><div class="stack">
    <section class="card stack" style="gap:12px">
      <div class="pill-row"><button class="pill" aria-pressed="${p.mode === "pregnancy"}" data-act="set-mode" data-arg="pregnancy">🤰 懷孕中</button><button class="pill" aria-pressed="${p.mode === "baby"}" data-act="set-mode" data-arg="baby">👶 寶寶出生了</button></div>
      <label class="field">預產期<input class="input" id="set-due" type="date" value="${p.dueDate || ""}"></label>
      ${p.mode === "baby" ? `<label class="field">寶寶生日<input class="input" id="set-birth" type="date" value="${p.birthDate || ""}"></label>
      <label class="field">寶寶小名<input class="input" id="set-name" type="text" maxlength="12" placeholder="例如：小湯圓" value="${esc(p.babyName || "")}"></label>` : ""}
    </section>
    <section class="card stack" style="gap:8px"><b>📲 加到手機主畫面</b>
      <p class="small"><b>iPhone：</b>用 Safari 打開這個網頁 → 點下方「分享」按鈕 → 選「加入主畫面」。</p>
      <p class="small"><b>Android：</b>用 Chrome 打開 → 點右上角「⋮」→「加到主畫面」或「安裝應用程式」。</p></section>
    <section class="card stack" style="gap:8px"><b>🔒 資料存在哪裡？</b>
      <p class="small">這是試玩版，所有紀錄只存在這支手機的瀏覽器裡，不會上傳。換手機、清除瀏覽器資料或用無痕模式時，紀錄會不見。</p>
      ${storageOK ? "" : `<p class="small" style="color:var(--danger)">目前這個瀏覽器無法保存資料，關掉頁面後紀錄會消失。</p>`}
      ${confirmReset ? `<p class="small" style="color:var(--danger)">確定要清除所有紀錄和遊戲進度嗎？清除後無法復原。</p>
        <div class="row"><button class="btn secondary grow" data-act="reset-cancel">取消</button><button class="btn danger grow" data-act="reset">確定清除</button></div>`
        : `<button class="btn danger" data-act="reset-ask">清除所有資料，重新開始</button>`}</section>
    <p class="note">孕期小幫手 網頁試玩版・內容僅供參考，不能取代醫療建議。完整版（含 Apple 健康、產檢行事曆）為 iPhone App。</p></div>`;
}

// ───────── 首次使用 ─────────
function viewWelcome() {
  const due = dayKey(addDays(new Date(), 112)), birth = dayKey(addDays(new Date(), -60));
  return `<div class="welcome">
    <div style="width:180px;margin:0 auto">${babySVG({ look: "bear", eyes: "open", mouth: "happy" }).replace('class="baby"', 'class="baby" style="width:100%"')}</div>
    <h1>孕期小幫手</h1><p class="muted" style="text-align:center">每天陪寶寶完成小任務、學新技能、換可愛衣服，<br>順便學會孕期和育兒知識。</p>
    <section class="card stack" style="gap:10px"><b style="font-size:17px">🤰 我懷孕了</b>
      <label class="field small">預產期<input class="input" id="w-due" type="date" value="${due}"></label>
      <button class="btn block" data-act="start" data-arg="pregnancy">開始</button></section>
    <section class="card stack" style="gap:10px"><b style="font-size:17px">👶 寶寶出生了</b>
      <label class="field small">寶寶生日<input class="input" id="w-birth" type="date" value="${birth}"></label>
      <button class="btn block" data-act="start" data-arg="baby">開始</button></section>
    <div class="row"><button class="btn secondary grow" data-act="demo" data-arg="pregnancy">看示範：孕期</button><button class="btn secondary grow" data-act="demo" data-arg="baby">看示範：育兒</button></div>
    <p class="note" style="text-align:center">資料只存在這支手機的瀏覽器裡，不會上傳。內容僅供參考，不能取代醫療建議。</p></div>`;
}
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
function seedDemo(m) {
  S = blank();
  const now = new Date();
  if (m === "pregnancy") S.profile = { mode: m, dueDate: dayKey(addDays(now, 280 - 24 * 7 - 3)), demo: true };
  else {
    S.profile = { mode: m, birthDate: dayKey(addDays(now, -95)), dueDate: dayKey(addDays(now, -98)), babyName: "小湯圓", demo: true };
    for (let i = 5; i >= 1; i--) { const t = addDays(startOfDay(now), -i); t.setHours(10); S.events.push({ id: uid(), kind: "tummy", time: t.toISOString(), minutes: 33 }); }
    const at = h => { const t = startOfDay(now); t.setHours(h, 0); return t.getTime() > now.getTime() ? addDays(t, -1) : t; };
    S.events.push({ id: uid(), kind: "feed", time: at(7).toISOString(), detail: "配方奶 120 ml" },
      { id: uid(), kind: "diaper", time: at(8).toISOString(), detail: "濕" },
      { id: uid(), kind: "tummy", time: at(9).toISOString(), minutes: 12 });
    S.game.learned.headUp = addDays(now, -10).toISOString();
  }
  S.game.stars = 128; S.game.exp = 300;
  for (let i = 6; i >= 1; i--) S.game.completed[dayKey(addDays(now, -i))] = ["water"];
}

// ───────── 底部選單 ─────────
let sheet = null;
function renderSheet() {
  const root = document.getElementById("sheet-root");
  if (!sheet) { root.innerHTML = ""; return; }
  const opt = (act, arg, label) => `<button class="btn secondary" data-act="${act}" data-arg="${arg}">${label}</button>`;
  const content = sheet === "feed"
    ? `<h3 style="font-size:20px">🍼 記錄餵奶</h3><div class="sheet-grid">${opt("log-feed", "母乳・左", "🤱 母乳・左")}${opt("log-feed", "母乳・右", "🤱 母乳・右")}
       ${[60, 90, 120, 150].map(ml => opt("log-feed", `配方奶 ${ml} ml`, `🍼 配方奶 ${ml}`)).join("")}${opt("log-feed", "擠出母乳", "🍶 擠出母乳")}${opt("log-feed", "副食品", "🥣 副食品")}</div>`
    : `<h3 style="font-size:20px">🧷 記錄尿布</h3><div class="sheet-grid">${opt("log-diaper", "濕", "💧 濕")}${opt("log-diaper", "便便", "💩 便便")}${opt("log-diaper", "濕＋便便", "💧💩 都有")}${opt("log-diaper", "乾", "✨ 乾的")}</div>`;
  root.innerHTML = `<div class="sheet-bg" data-act="sheet-close"><div class="sheet" role="dialog" aria-modal="true" data-stop="1">${content}
    <button class="btn block" data-act="sheet-close" style="background:var(--surface);color:var(--muted)">取消</button></div></div>`;
}

// ───────── 提示 ─────────
let toastTimer = null;
function toast(text) { toastQueue.push(text); if (!toastTimer) nextToast(); }
function nextToast() {
  const root = document.getElementById("toast-root");
  const t = toastQueue.shift();
  if (!t) { root.innerHTML = ""; toastTimer = null; return; }
  root.innerHTML = `<div class="toast">${esc(t)}</div>`;
  toastTimer = setTimeout(nextToast, 2200);
}

// ───────── 導覽與繪製 ─────────
let tab = "home", stack = [];
const pages = { food: pageFood, nutrition: pageNutrition, weekly: pageWeekly, book: pageBook, warning: pageWarning, kicks: pageKicks, tummy: pageTummy, log: pageLog, settings: pageSettings };
const tabs = { home: viewHome, quests: viewQuests, skills: viewSkills, wardrobe: viewWardrobe, wiki: viewWiki };
function render() {
  const app = document.getElementById("app"), nav = document.getElementById("tabbar");
  if (!S.profile) { app.innerHTML = viewWelcome(); app.classList.add("no-tabs"); nav.hidden = true; return; }
  sync();
  const page = stack[stack.length - 1];
  app.classList.remove("no-tabs");
  app.innerHTML = page ? `<div style="padding-bottom:12px">${pages[page]()}</div>` : statusBar() + tabs[tab]();
  nav.hidden = false;
  nav.querySelectorAll(".tab").forEach(b => b.setAttribute("aria-current", b.dataset.arg === tab && !page ? "page" : "false"));
  renderSheet();
}
function go(page) { stack.push(page); render(); window.scrollTo(0, 0); }

const A = {
  tab(arg) { tab = arg; stack = []; selectedSkill = null; confirmLearn = false; pickedOutfit = undefined; confirmReset = false; render(); window.scrollTo(0, 0); },
  go(arg) { confirmReset = false; go(arg); },
  back() { stack.pop(); confirmReset = false; render(); },
  quest(id) {
    const q = quests().find(x => x.id === id);
    if (!q) return;
    if (q.check === "manual") { isDone(q) ? undo(q) : complete(q); }
    else if (!isDone(q)) {
      const target = { kicks: "kicks", feeds: null, sleep: null, tummy: "tummy", quiz: null }[q.check];
      if (q.check === "quiz") { A.tab("quests"); return; }
      if (target) { go(target); return; }
      if (tab !== "home") { A.tab("home"); }
      toast("在「家」記錄後，這個任務會自動完成 ✨"); return;
    }
    save(); render();
  },
  answer(i) { answer(Number(i)); sync(); render(); },
  chest() { if (!canOpenChest()) return; S.game.chestDays.push(todayKey()); grant(CHEST_REWARD, "打開寶箱 🎁"); save(); render(); },
  claim(i) {
    const m = D.milestones[Number(i)];
    if (pregnancy().week < m.week || S.game.claimedMilestones.includes(m.title)) return;
    S.game.claimedMilestones.push(m.title); grant(MILESTONE_REWARD, `寶寶會「${m.title}」了`); save(); render();
  },
  "pick-skill"(id) { selectedSkill = id; confirmLearn = false; render(); },
  practice(id) { practice(id); save(); render(); },
  "learn-ask"() { confirmLearn = true; render(); },
  "learn-cancel"() { confirmLearn = false; render(); },
  learn(id) { learn(id); confirmLearn = false; save(); render(); },
  "pick-outfit"(id) { pickedOutfit = id || null; render(); },
  equip(id) { const o = id && outfit(id); if (o && !owned(o)) return; S.game.equipped = id || null; pickedOutfit = undefined; save(); render(); },
  buy(id) { buy(outfit(id)); pickedOutfit = undefined; save(); render(); },
  sheet(arg) { sheet = arg; renderSheet(); },
  "sheet-close"() { sheet = null; renderSheet(); },
  "log-feed"(detail) { S.events.push({ id: uid(), kind: "feed", time: new Date().toISOString(), detail }); sheet = null; toast(`已記錄：${detail}`); save(); render(); },
  "log-diaper"(detail) { S.events.push({ id: uid(), kind: "diaper", time: new Date().toISOString(), detail }); sheet = null; toast(`已記錄尿布：${detail}`); save(); render(); },
  sleep() {
    const open = S.events.find(e => e.kind === "sleep" && !e.end);
    if (open) { open.end = new Date().toISOString(); toast(`睡了 ${Math.max(1, Math.round((new Date(open.end) - new Date(open.time)) / 60000))} 分鐘，早安！🌞`); }
    else { S.events.push({ id: uid(), kind: "sleep", time: new Date().toISOString(), end: null }); toast("晚安，記得讓寶寶仰睡 🌙"); }
    save(); render();
  },
  "del-event"(id) { S.events = S.events.filter(e => e.id !== id); save(); render(); },
  "kick-start"() { S.kickSession = { start: new Date().toISOString(), count: 0 }; save(); render(); },
  kick() {
    S.kickSession.count++;
    if (navigator.vibrate) try { navigator.vibrate(30); } catch (e) {}
    if (S.kickSession.count >= 10) { A["kick-finish"](); return; }
    save(); render();
  },
  "kick-cancel"() { S.kickSession = null; save(); render(); },
  "kick-finish"() {
    const k = S.kickSession; if (!k || !k.count) return;
    S.kicks.push({ start: k.start, count: k.count, seconds: (Date.now() - new Date(k.start)) / 1000 });
    S.kickSession = null; toast(`記錄好了：${k.count} 次胎動 👣`); save(); render();
  },
  "tummy-start"() { S.tummyStart = new Date().toISOString(); save(); render(); },
  "tummy-stop"() {
    const min = Math.min(Math.max(1, Math.round((Date.now() - new Date(S.tummyStart)) / 60000)), 120);
    S.events.push({ id: uid(), kind: "tummy", time: S.tummyStart, minutes: min }); S.tummyStart = null;
    toast(`趴趴 ${min} 分鐘，寶寶好棒！🐢`); save(); render();
  },
  "tummy-add"(n) { S.events.push({ id: uid(), kind: "tummy", time: new Date().toISOString(), minutes: Number(n) }); toast(`補記趴趴 ${n} 分鐘`); save(); render(); },
  "food-verdict"(v) { foodVerdict = v; render(); },
  "nutrition-tab"(i) { nutritionTab = Number(i); render(); },
  "set-mode"(m) {
    if (m === "baby" && !S.profile.birthDate) S.profile.birthDate = todayKey();
    if (m === "pregnancy" && !S.profile.dueDate) S.profile.dueDate = dayKey(addDays(new Date(), 140));
    S.profile.mode = m; save(); render();
  },
  "reset-ask"() { confirmReset = true; render(); },
  "reset-cancel"() { confirmReset = false; render(); },
  reset() { S = blank(); try { localStorage.removeItem(KEY); } catch (e) {} confirmReset = false; stack = []; tab = "home"; render(); },
  start(m) {
    const v = document.getElementById(m === "pregnancy" ? "w-due" : "w-birth").value;
    if (!v) { toast("請先選日期"); return; }
    S.profile = m === "pregnancy" ? { mode: m, dueDate: v } : { mode: m, birthDate: v };
    save(); tab = "home"; render();
  },
  demo(m) { seedDemo(m); save(); tab = "home"; render(); },
};

document.addEventListener("click", e => {
  const el = e.target.closest("[data-act]");
  if (!el) return;
  if (el.dataset.act === "sheet-close" && e.target.closest("[data-stop]") && !e.target.closest("button")) return;
  A[el.dataset.act]?.(el.dataset.arg ?? "", el);
});
document.addEventListener("input", e => {
  if (e.target.id === "food-q") { foodQuery = e.target.value; document.getElementById("food-list").innerHTML = foodResults(); }
  if (e.target.id === "week-range") { weeklyWeek = Number(e.target.value); const y = window.scrollY; render(); window.scrollTo(0, y); document.getElementById("week-range")?.focus(); }
});
document.addEventListener("change", e => {
  const v = e.target.value;
  if (e.target.id === "set-due" && v) { S.profile.dueDate = v; save(); render(); }
  if (e.target.id === "set-birth" && v) { S.profile.birthDate = v; save(); render(); }
  if (e.target.id === "set-name") { S.profile.babyName = v.trim().slice(0, 12); save(); }
});
// 計時器每秒更新數字，不重畫整頁
setInterval(() => {
  document.querySelectorAll("[data-timer]").forEach(el => {
    const start = el.dataset.timer === "kick" ? S.kickSession?.start : S.tummyStart;
    if (start) el.textContent = mmss((Date.now() - new Date(start)) / 1000);
  });
}, 1000);
// 跨午夜或回到 App 時重新整理今天的任務
document.addEventListener("visibilitychange", () => { if (!document.hidden && !document.activeElement?.matches("input")) render(); });

render();
if (document.querySelector('link[rel="manifest"]') && "serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
})();
