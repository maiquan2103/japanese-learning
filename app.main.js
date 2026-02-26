// ===== Helpers =====
const $ = (sel) => document.querySelector(sel);
const view = $("#view");
const btnHome = $("#btnHome");
const LOCAL_PROGRESS_META_PREFIX = "kanji-quiz:progress-meta:";
const LOCAL_IN_PROGRESS_PREFIX = "kanji-quiz:in-progress:";

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

let progressSyncTimer = null;


function getCdAnswerBaseCandidatePaths(book, cd) {
  return [
    `${BJT_STUDY_BASE_PATH}/${book}/${cd}-answer`,
    `${BJT_STUDY_BASE_PATH}/${book}/${cd}/${cd}-answer`,
    `${book}/${cd}-answer`,
    `${book}/${cd}/${cd}-answer`,
    `bjt-study/${book}/${cd}-answer`,
    `bjt-study/${book}/${cd}/${cd}-answer`,
    `${cd}-answer`,
    `${cd}/${cd}-answer`
  ];
}

function getCdImageBaseCandidatePaths(book, cd, answerBasePath) {
  const answerSuffix = new RegExp(`/${cd}-answer$`);
  const fromAnswer = answerBasePath ? [answerBasePath.replace(answerSuffix, `/${cd}-image`)] : [];
  return [
    ...fromAnswer,
    `${BJT_STUDY_BASE_PATH}/${book}/${cd}-image`,
    `${BJT_STUDY_BASE_PATH}/${book}/${cd}/${cd}-image`,
    `${book}/${cd}-image`,
    `${book}/${cd}/${cd}-image`,
    `bjt-study/${book}/${cd}-image`,
    `bjt-study/${book}/${cd}/${cd}-image`,
    `${cd}-image`,
    `${cd}/${cd}-image`
  ];
}

function getCdAudioBaseCandidatePaths(book, cd, answerBasePath) {
  const answerSuffix = new RegExp(`/${cd}-answer$`);
  const fromAnswer = answerBasePath ? [
    answerBasePath.replace(answerSuffix, `/${cd}-audio`),
    answerBasePath.replace(answerSuffix, `/${cd}`)
  ] : [];
  return [
    ...fromAnswer,
    `${BJT_STUDY_BASE_PATH}/${book}/${cd}-audio`,
    `${BJT_STUDY_BASE_PATH}/${book}/${cd}/${cd}-audio`,
    `${BJT_STUDY_BASE_PATH}/${book}/${cd}`,
    `${book}/${cd}-audio`,
    `${book}/${cd}/${cd}-audio`,
    `${book}/${cd}`,
    `bjt-study/${book}/${cd}-audio`,
    `bjt-study/${book}/${cd}/${cd}-audio`,
    `bjt-study/${book}/${cd}`,
    `${cd}-audio`,
    `${cd}/${cd}-audio`,
    `${cd}`
  ];
}

function keyDone(accountId, mode, level, partFile) {
  return `done:${accountId}:${mode}:${level}:${partFile}`;
}

function keyBjtCdBookmark(accountId, book, cd, orderNo) {
  return `${STORAGE_KEY_BJT_CD_BOOKMARK}:${accountId || "guest"}:${book}:${cd}:${orderNo}`;
}

function keyProgressMeta(accountId) {
  return `${LOCAL_PROGRESS_META_PREFIX}${accountId || "guest"}`;
}

function keyInProgress(accountId) {
  return `${LOCAL_IN_PROGRESS_PREFIX}${accountId || "guest"}`;
}

function isBjtCdBookmarked(book, cd, orderNo) {
  return localStorage.getItem(keyBjtCdBookmark(state.accountId, book, cd, orderNo)) === "1";
}

function setBjtCdBookmarked(book, cd, orderNo, bookmarked) {
  localStorage.setItem(keyBjtCdBookmark(state.accountId, book, cd, orderNo), bookmarked ? "1" : "0");
  markLocalProgressDirty(state.accountId);
  scheduleProgressSync();
}

function setCd1BookmarkBtnUI(btn, bookmarked) {
  if (!btn) return;
  btn.textContent = bookmarked ? "★" : "☆";
  btn.title = bookmarked ? "Bỏ đánh dấu bài này" : "Đánh dấu bài này";
  btn.setAttribute("aria-label", btn.title);
  btn.setAttribute("aria-pressed", bookmarked ? "true" : "false");
  btn.classList.toggle("isActive", bookmarked);
}

function canAccessPmp() {
  return String(state.accountId || "").trim().toLowerCase() === PMP_OWNER_ACCOUNT;
}

function partFileToLabel(partFile, mode) {
  if ((partFile || "").toLowerCase() === "all.json") {
    return mode === "kanji" ? "Tất cả chữ Hán" : "Tất cả từ vựng";
  }
  const m = /part(\d+)\.json/i.exec(partFile || "");
  const n = m ? parseInt(m[1], 10) : 0;
  return n ? `Phần ${n}` : (partFile || "");
}

function getNextPartFile(mode, level, currentPartFile) {
  const parts = state.config?.[mode]?.[level];
  if (!Array.isArray(parts)) return null;
  const idx = parts.indexOf(currentPartFile);
  if (idx < 0 || idx >= parts.length - 1) return null;
  return parts[idx + 1];
}

function setDone(mode, level, partFile, done) {
  if (!state.accountId) return;
  localStorage.setItem(keyDone(state.accountId, mode, level, partFile), done ? "1" : "0");
  markLocalProgressDirty(state.accountId);
  scheduleProgressSync();
}

function isDone(mode, level, partFile) {
  if (!state.accountId) return false;
  return localStorage.getItem(keyDone(state.accountId, mode, level, partFile)) === "1";
}

async function loadJSON(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`Không load được: ${path}`);
  return await res.json();
}

function shouldTrackQuizInProgress(mode, partFile) {
  return (mode === "vocab" || mode === "kanji") && String(partFile || "").toLowerCase() === "all.json";
}

function sanitizeInProgressSession(raw) {
  if (!raw || typeof raw !== "object") return null;
  const mode = raw.mode === "vocab" || raw.mode === "kanji" ? raw.mode : null;
  const level = typeof raw.level === "string" ? raw.level : "";
  const partFile = typeof raw.partFile === "string" ? raw.partFile : "";
  const idx = Number(raw.idx);
  const orderRaw = Array.isArray(raw.order) ? raw.order : null;

  if (!mode || !level || !shouldTrackQuizInProgress(mode, partFile)) return null;
  if (!Number.isInteger(idx) || idx < 0) return null;
  if (!orderRaw || orderRaw.length === 0) return null;

  const order = [];
  for (const n of orderRaw) {
    const v = Number(n);
    if (!Number.isInteger(v) || v < 0) return null;
    order.push(v);
  }

  return {
    mode,
    level,
    partFile,
    idx,
    order,
    updatedAt: Number(raw.updatedAt) || 0
  };
}

function getInProgressSession(accountId) {
  if (!accountId) return null;
  try {
    return sanitizeInProgressSession(JSON.parse(localStorage.getItem(keyInProgress(accountId)) || "null"));
  } catch (_) {
    return null;
  }
}

function setInProgressSession(accountId, session) {
  if (!accountId) return;
  const safe = sanitizeInProgressSession(session);
  if (!safe) {
    localStorage.removeItem(keyInProgress(accountId));
    state.resumeSession = null;
    markLocalProgressDirty(accountId);
    scheduleProgressSync();
    return;
  }
  safe.updatedAt = Date.now();
  localStorage.setItem(keyInProgress(accountId), JSON.stringify(safe));
  state.resumeSession = safe;
  markLocalProgressDirty(accountId);
  scheduleProgressSync();
}

function createEmptyProgress() {
  return { done: {}, bookmarks: {}, inProgress: null, updatedAt: 0 };
}

function sanitizeProgress(raw) {
  const safe = createEmptyProgress();
  if (!raw || typeof raw !== "object") return safe;
  if (raw.done && typeof raw.done === "object") {
    for (const k of Object.keys(raw.done)) {
      if (raw.done[k]) safe.done[k] = 1;
    }
  }
  if (raw.bookmarks && typeof raw.bookmarks === "object") {
    for (const k of Object.keys(raw.bookmarks)) {
      if (raw.bookmarks[k]) safe.bookmarks[k] = 1;
    }
  }
  safe.inProgress = sanitizeInProgressSession(raw.inProgress);
  if (Number.isFinite(Number(raw.updatedAt))) {
    safe.updatedAt = Number(raw.updatedAt);
  }
  return safe;
}

function getLocalProgressMeta(accountId) {
  if (!accountId) return { updatedAt: 0, dirty: false };
  try {
    const raw = localStorage.getItem(keyProgressMeta(accountId));
    if (!raw) return { updatedAt: 0, dirty: false };
    const parsed = JSON.parse(raw);
    return {
      updatedAt: Number(parsed?.updatedAt) || 0,
      dirty: parsed?.dirty === true
    };
  } catch (_) {
    return { updatedAt: 0, dirty: false };
  }
}

function setLocalProgressMeta(accountId, meta) {
  if (!accountId) return;
  const safe = {
    updatedAt: Number(meta?.updatedAt) || 0,
    dirty: meta?.dirty === true
  };
  localStorage.setItem(keyProgressMeta(accountId), JSON.stringify(safe));
}

function markLocalProgressDirty(accountId) {
  if (!accountId) return;
  setLocalProgressMeta(accountId, { updatedAt: Date.now(), dirty: true });
}

function isProgressEmpty(progress) {
  if (!progress) return true;
  return (
    Object.keys(progress.done || {}).length === 0 &&
    Object.keys(progress.bookmarks || {}).length === 0 &&
    !progress.inProgress
  );
}

function readLocalProgress(accountId) {
  const out = createEmptyProgress();
  if (!accountId) return out;

  const donePrefix = `done:${accountId}:`;
  const bookmarkPrefix = `${STORAGE_KEY_BJT_CD_BOOKMARK}:${accountId}:`;
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key) continue;

    if (key.startsWith(donePrefix) && localStorage.getItem(key) === "1") {
      out.done[key.slice(donePrefix.length)] = 1;
      continue;
    }

    if (key.startsWith(bookmarkPrefix) && localStorage.getItem(key) === "1") {
      out.bookmarks[key.slice(bookmarkPrefix.length)] = 1;
    }
  }
  out.inProgress = getInProgressSession(accountId);
  out.updatedAt = getLocalProgressMeta(accountId).updatedAt;
  return out;
}

function applyProgressToLocalStorage(accountId, progress) {
  if (!accountId) return;

  const donePrefix = `done:${accountId}:`;
  const bookmarkPrefix = `${STORAGE_KEY_BJT_CD_BOOKMARK}:${accountId}:`;
  const removeKeys = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key) continue;
    if (key.startsWith(donePrefix) || key.startsWith(bookmarkPrefix)) removeKeys.push(key);
  }
  removeKeys.forEach((k) => localStorage.removeItem(k));

  Object.keys(progress.done || {}).forEach((k) => {
    localStorage.setItem(`${donePrefix}${k}`, "1");
  });
  Object.keys(progress.bookmarks || {}).forEach((k) => {
    localStorage.setItem(`${bookmarkPrefix}${k}`, "1");
  });
  if (progress.inProgress) {
    localStorage.setItem(keyInProgress(accountId), JSON.stringify(progress.inProgress));
  } else {
    localStorage.removeItem(keyInProgress(accountId));
  }
  state.resumeSession = sanitizeInProgressSession(progress.inProgress);
  setLocalProgressMeta(accountId, {
    updatedAt: Number(progress?.updatedAt) || Date.now(),
    dirty: false
  });
}

async function fetchServerProgress(accountId) {
  const res = await fetch(`${PROGRESS_API_PATH}?accountId=${encodeURIComponent(accountId)}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`progress_get_failed:${res.status}`);
  const payload = await res.json();
  return sanitizeProgress(payload?.data);
}

async function pushServerProgress(accountId, progress) {
  const payloadProgress = sanitizeProgress(progress);
  payloadProgress.updatedAt = Number(payloadProgress.updatedAt) || Date.now();
  const res = await fetch(PROGRESS_API_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accountId, data: payloadProgress })
  });
  if (!res.ok) throw new Error(`progress_push_failed:${res.status}`);
  setLocalProgressMeta(accountId, { updatedAt: payloadProgress.updatedAt, dirty: false });
}

async function syncAccountProgress(accountId) {
  if (!accountId) return;
  const local = readLocalProgress(accountId);
  try {
    const remote = await fetchServerProgress(accountId);

    // Boot/login sync: GET only, then select source by freshness.
    if (isProgressEmpty(local) && !isProgressEmpty(remote)) {
      applyProgressToLocalStorage(accountId, remote);
      return;
    }
    if ((Number(remote.updatedAt) || 0) > (Number(local.updatedAt) || 0)) {
      applyProgressToLocalStorage(accountId, remote);
      return;
    }
    if ((Number(local.updatedAt) || 0) > (Number(remote.updatedAt) || 0)) {
      setLocalProgressMeta(accountId, { updatedAt: local.updatedAt || Date.now(), dirty: true });
      scheduleProgressSync();
    }
  } catch (_) {}
}

function scheduleProgressSync() {
  if (!state.accountId) return;
  if (progressSyncTimer) clearTimeout(progressSyncTimer);
  progressSyncTimer = setTimeout(() => {
    progressSyncTimer = null;
    const meta = getLocalProgressMeta(state.accountId);
    if (!meta.dirty) return;
    const snapshot = readLocalProgress(state.accountId);
    pushServerProgress(state.accountId, snapshot).catch(() => {});
  }, SYNC_DEBOUNCE_MS);
}

// ===== App State =====
const state = {
  config: null,
  accountId: null,
  mode: null, // "vocab" | "kanji"
  level: null, // "N5".."N1"
  partFile: null,
  questions: [],
  order: [],
  idx: 0,
  locked: false,
  currentChoices: null,
  currentCorrectIndex: null,
  pmpTestAQuestions: null,
  pmpQuestionsByLeaf: {},
  resumeSession: null
};

btnHome.addEventListener("click", () => routeToHome());
$("#btnLogout")?.addEventListener("click", logout);

function logout() {
  if (progressSyncTimer) {
    clearTimeout(progressSyncTimer);
    progressSyncTimer = null;
  }
  state.accountId = null;
  state.resumeSession = null;
  localStorage.removeItem(STORAGE_KEY_ACCOUNT);
  updateTopbar(false);
  renderLogin();
}

function updateTopbar(loggedIn) {
  const home = $("#btnHome");
  const logoutBtn = $("#btnLogout");
  const userInfo = $("#userInfo");

  if (logoutBtn) logoutBtn.style.display = loggedIn ? "" : "none";
  if (home) home.style.display = loggedIn ? "" : "none";
  if (userInfo) {
    userInfo.textContent = loggedIn ? state.accountId : "";
    userInfo.style.display = loggedIn ? "" : "none";
  }
}

// ===== Views =====
function renderLogin() {
  view.innerHTML = `
    <div class="card cardHome cardLogin">
      <h1 class="h1">Đăng nhập</h1>
      <p class="sub">Nhập tên tài khoản (không cần mật khẩu)</p>
      <form id="loginForm" class="loginForm">
        <input type="text" id="loginInput" class="loginInput" placeholder="Tên tài khoản" autocomplete="username" />
        <button type="submit" class="btn" id="loginBtn">Đăng nhập</button>
      </form>
    </div>
  `;

  const form = $("#loginForm");
  const input = $("#loginInput");

  form.onsubmit = async (e) => {
    e.preventDefault();
    const id = input.value.trim();
    if (!id) return;
    state.accountId = id;
    localStorage.setItem(STORAGE_KEY_ACCOUNT, id);
    await syncAccountProgress(id);
    updateTopbar(true);
    renderHome();
  };

  if (input) input.focus();
}

function routeToHome() {
  state.mode = null;
  state.level = null;
  state.partFile = null;
  renderHome();
}

function renderHome() {
  const showPmp = canAccessPmp();
  view.innerHTML = `
    <div class="card cardHome">
      <h1 class="h1">Bạn muốn học gì</h1>
      <div class="grid grid2">
        <button class="btn" id="goVocab">Từ vựng</button>
        <button class="btn" id="goKanji">Chữ Hán</button>
        <button class="btn" id="goNgheBjt">Học BJT</button>
        ${showPmp ? `<button class="btn" id="goPmp">PMP</button>` : ""}
      </div>
    </div>
  `;

  $("#goVocab").onclick = () => renderLevels("vocab");
  $("#goKanji").onclick = () => renderLevels("kanji");
  $("#goNgheBjt").onclick = () => renderNgheBjt();
  if (showPmp) {
    $("#goPmp").onclick = () => renderPmpHome();
  }
}

