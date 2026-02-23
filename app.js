// ===== Helpers =====
const $ = (sel) => document.querySelector(sel);
const view = $("#view");
const btnHome = $("#btnHome");

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const STORAGE_KEY_ACCOUNT = "kanji-quiz:currentAccount";
const STORAGE_KEY_BJT_CD_BOOKMARK = "kanji-quiz:bjt-cd:bookmark";
const DONE_CONFIG_PATH = "done-config.json";
const DATA_BASE_URL = "https://raw.githubusercontent.com/maiquan2103/Japanese-file/refs/heads/master";
const BJT_STUDY_BASE_PATH = `${DATA_BASE_URL}/bjt-study`;
const CD_ANSWER_FALLBACK_FILES = ["list.json", "answers.json", "answer.json", "data.json"];

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

function isBjtCdBookmarked(book, cd, orderNo) {
  return localStorage.getItem(keyBjtCdBookmark(state.accountId, book, cd, orderNo)) === "1";
}

function setBjtCdBookmarked(book, cd, orderNo, bookmarked) {
  localStorage.setItem(keyBjtCdBookmark(state.accountId, book, cd, orderNo), bookmarked ? "1" : "0");
}

function setCd1BookmarkBtnUI(btn, bookmarked) {
  if (!btn) return;
  btn.textContent = bookmarked ? "★" : "☆";
  btn.title = bookmarked ? "Bo danh dau bai nay" : "Danh dau bai nay";
  btn.setAttribute("aria-label", btn.title);
  btn.setAttribute("aria-pressed", bookmarked ? "true" : "false");
  btn.classList.toggle("isActive", bookmarked);
}

function partFileToLabel(partFile, mode) {
  if ((partFile || "").toLowerCase() === "all.json") {
    return mode === "kanji" ? "Tất cả chữ Hán" : "Tất cả từ vựng";
  }
  const m = /part(\d+)\.json/i.exec(partFile || "");
  const n = m ? parseInt(m[1], 10) : 0;
  return n ? `Phần ${n}` : (partFile || "");
}

function setDone(mode, level, partFile, done) {
  if (!state.accountId) return;
  localStorage.setItem(keyDone(state.accountId, mode, level, partFile), done ? "1" : "0");
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

async function loadDoneConfig() {
  try {
    const res = await fetch(DONE_CONFIG_PATH, { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    if (!data || !data.accounts) return;

    for (const accountId of Object.keys(data.accounts)) {
      const acc = data.accounts[accountId];
      if (!acc || typeof acc !== "object") continue;

      for (const mode of Object.keys(acc)) {
        const levels = acc[mode];
        if (!levels || typeof levels !== "object") continue;

        for (const level of Object.keys(levels)) {
          const parts = levels[level];
          if (!Array.isArray(parts)) continue;

          for (const partFile of parts) {
            localStorage.setItem(keyDone(accountId, mode, level, partFile), "1");
          }
        }
      }
    }
  } catch (_) {}
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
  currentCorrectIndex: null
};

btnHome.addEventListener("click", () => routeToHome());
$("#btnLogout")?.addEventListener("click", logout);

function logout() {
  state.accountId = null;
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

  form.onsubmit = (e) => {
    e.preventDefault();
    const id = input.value.trim();
    if (!id) return;
    state.accountId = id;
    localStorage.setItem(STORAGE_KEY_ACCOUNT, id);
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
  view.innerHTML = `
    <div class="card cardHome">
      <h1 class="h1">Bạn muốn học gì</h1>
      <div class="grid grid2">
        <button class="btn" id="goVocab">Từ vựng</button>
        <button class="btn" id="goKanji">Chữ Hán</button>
        <button class="btn" id="goNgheBjt">Học BJT</button>
      </div>
    </div>
  `;

  $("#goVocab").onclick = () => renderLevels("vocab");
  $("#goKanji").onclick = () => renderLevels("kanji");
  $("#goNgheBjt").onclick = () => renderNgheBjt();
}

function renderNgheBjt() {
  view.innerHTML = `
    <div class="card">
      <div class="cardTitleRow">
        <h1 class="h1">Học BJT</h1>
        <button class="btnSmall" id="backHomeBjt">← Home</button>
      </div>
      <p class="sub">Chọn Book</p>
      <div class="grid grid2" id="ngheBjtBooks"></div>
    </div>
  `;

  $("#backHomeBjt").onclick = () => renderHome();
  const box = $("#ngheBjtBooks");

  ["Book1"].forEach((book) => {
    const btn = document.createElement("button");
    btn.className = "btn btnBjtCd";
    btn.textContent = book;
    btn.onclick = () => renderNgheBjtBook(book);
    box.appendChild(btn);
  });
}

function renderNgheBjtBook(book) {
  view.innerHTML = `
    <div class="card">
      <div class="cardTitleRow">
        <h1 class="h1">Học BJT — ${book}</h1>
        <button class="btnSmall" id="backBjtBooks">← Book</button>
      </div>
      <p class="sub">Chọn CD</p>
      <div class="grid grid2" id="ngheBjtCds"></div>
    </div>
  `;

  $("#backBjtBooks").onclick = () => renderNgheBjt();
  const box = $("#ngheBjtCds");

  ["CD1", "CD2", "Section1"].forEach((cd) => {
    const btn = document.createElement("button");
    btn.className = "btn btnBjtCd";
    btn.textContent = cd;
    btn.onclick = () => renderNgheBjtCD(book, cd);
    box.appendChild(btn);
  });
}

async function renderNgheBjtCD(book, cd) {
  if (cd === "CD1" || cd === "CD2") {
    renderNgheBjtCDFolders(book, cd);
    return;
  }
  if (cd === "Section1") {
    renderNgheBjtSection1Folders(book);
    return;
  }

  view.innerHTML = `
    <div class="card">
      <div class="cardTitleRow">
        <h1 class="h1">Học BJT — ${book} / ${cd}</h1>
        <button class="btnSmall" id="backBjtList">← CD</button>
      </div>
      <p class="sub">Đang tải...</p>
      <div id="ngheBjtTracks"></div>
    </div>
  `;

  $("#backBjtList").onclick = () => renderNgheBjtBook(book);
  const box = $("#ngheBjtTracks");

  try {
    const data = await loadJSON(`${BJT_STUDY_BASE_PATH}/${book}/${cd}/list.json`);
    const tracks = Array.isArray(data) ? data : (data.tracks || []);

    document.querySelector(".sub").textContent = tracks.length
      ? "Nhấn play để nghe"
      : `Chưa có file. Thêm file mp3 vào thư mục ${BJT_STUDY_BASE_PATH}/${book}/${cd} và cập nhật list.json (mảng \"tracks\" với tên file).`;

    tracks.forEach((file, i) => {
      const src = `${BJT_STUDY_BASE_PATH}/${book}/${cd}/${encodeURIComponent(file)}`;
      const wrap = document.createElement("div");
      wrap.className = "ngheBjtRow";
      wrap.innerHTML = `
        <span class="ngheBjtLabel">${i + 1}番</span>
        <audio class="ngheBjtAudio" preload="none" controls src="${src}"></audio>
      `;

      const audio = wrap.querySelector("audio");
      audio.addEventListener("play", () => {
        document.querySelectorAll("#ngheBjtTracks .ngheBjtAudio").forEach((el) => {
          if (el !== audio) el.pause();
        });
      });

      box.appendChild(wrap);
    });
  } catch (e) {
    document.querySelector(".sub").textContent = `Không tải được danh sách. Kiểm tra file ${BJT_STUDY_BASE_PATH}/${book}/${cd}/list.json.`;
  }
}

function getCdAnswerCandidateFiles(cd) {
  return [`${cd}-answer.json`, ...CD_ANSWER_FALLBACK_FILES];
}

async function loadCdAnswerRaw(book, cd) {
  for (const answerBasePath of getCdAnswerBaseCandidatePaths(book, cd)) {
    for (const name of getCdAnswerCandidateFiles(cd)) {
      try {
        const raw = await loadJSON(`${answerBasePath}/${name}`);
        return {
          raw,
          imageBasePaths: getCdImageBaseCandidatePaths(book, cd, answerBasePath),
          audioBasePaths: getCdAudioBaseCandidatePaths(book, cd, answerBasePath)
        };
      } catch (_) {}
    }
  }

  throw new Error(`Không tải được file đáp án ${cd}.`);
}

function parseCdNumber(value) {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;

  const m = String(value).match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
}

function encodePathParts(path) {
  return String(path || "")
    .split("/")
    .filter((x) => x.length > 0)
    .map((x) => encodeURIComponent(x))
    .join("/");
}

function withUniqueValues(arr) {
  const out = [];
  const seen = new Set();
  arr.forEach((x) => {
    const v = String(x ?? "").trim();
    if (!v || seen.has(v)) return;
    seen.add(v);
    out.push(v);
  });
  return out;
}

function buildAssetSrcCandidates(basePaths, fileNames) {
  const joined = (basePaths || []).flatMap((basePath) =>
    (fileNames || []).map((name) => `${basePath}/${encodePathParts(name)}`)
  );

  const direct = (fileNames || []).flatMap((name) => {
    const raw = String(name || "").trim();
    if (!raw) return [];
    if (/^https?:\/\//i.test(raw)) return [raw];
    const trimmed = raw.replace(/^\/+/, "");
    if (trimmed.includes("/")) {
      return [`${DATA_BASE_URL}/${encodePathParts(trimmed)}`];
    }
    return [];
  });

  return withUniqueValues([...joined, ...direct]);
}

function buildCdImageFileCandidates(imageFileRaw, number, cd) {
  const raw = String(imageFileRaw ?? "").trim();
  const noExt = raw.replace(/\.[^./\\]+$/, "");
  const pad2 = String(number).padStart(2, "0");

  const extCandidates = [".png", ".jpg", ".jpeg", ".webp"];
  const baseCandidates = [raw, noExt, String(number), pad2, `${cd}-${number}`, `${cd}-${pad2}`, `${cd}_${number}`, `${cd}_${pad2}`];

  const names = [];
  baseCandidates.forEach((base) => {
    if (!base) return;
    names.push(base);
    if (!/\.[^./\\]+$/.test(base)) {
      extCandidates.forEach((ext) => names.push(`${base}${ext}`));
    }
  });

  return withUniqueValues(names);
}

function buildCdAudioFileCandidates(audioFileRaw, number, cd) {
  const raw = String(audioFileRaw ?? "").trim();
  const noExt = raw.replace(/\.[^./\\]+$/, "");
  const pad2 = String(number).padStart(2, "0");

  const extCandidates = [".mp3", ".m4a", ".wav", ".ogg"];
  const baseCandidates = [
    raw, noExt, String(number), pad2,
    `${cd}-${number}`, `${cd}-${pad2}`, `${cd}_${number}`, `${cd}_${pad2}`,
    `BJTchokai_${cd}-${number}`, `BJTchokai_${cd}-${pad2}`, `BJTchokai_${cd}_${number}`, `BJTchokai_${cd}_${pad2}`
  ];

  const names = [];
  baseCandidates.forEach((base) => {
    if (!base) return;
    names.push(base);
    if (!/\.[^./\\]+$/.test(base)) {
      extCandidates.forEach((ext) => names.push(`${base}${ext}`));
    }
  });

  return withUniqueValues(names);
}

function normalizeCd1Options(item) {
  const listLike =
    item.options || item.choices || item.answers || item.select || item.candidates || item.answer_list || null;

  if (Array.isArray(listLike)) {
    return listLike.slice(0, 4).map((x) => String(x ?? ""));
  }

  const keyCandidates = [
    "a", "b", "c", "d",
    "A", "B", "C", "D",
    "option1", "option2", "option3", "option4",
    "choice1", "choice2", "choice3", "choice4",
    "answer1", "answer2", "answer3", "answer4"
  ];

  const out = [];
  for (const key of keyCandidates) {
    if (key in item) out.push(String(item[key] ?? ""));
    if (out.length === 4) break;
  }

  return out;
}

function resolveCd1CorrectIndex(rawCorrect, options) {
  if (!options.length) return -1;

  if (typeof rawCorrect === "number") {
    if (rawCorrect >= 1 && rawCorrect <= options.length) return rawCorrect - 1;
    if (rawCorrect >= 0 && rawCorrect < options.length) return rawCorrect;
  }

  const s = String(rawCorrect ?? "").trim();
  if (!s) return -1;

  const upper = s.toUpperCase();
  if (["A", "B", "C", "D"].includes(upper)) return "ABCD".indexOf(upper);

  const num = parseCdNumber(s);
  if (num != null) {
    if (num >= 1 && num <= options.length) return num - 1;
    if (num >= 0 && num < options.length) return num;
  }

  const byText = options.findIndex((x) => x.trim() === s);
  return byText;
}

function pickFirstNonEmpty(item, keys) {
  for (const key of keys) {
    const v = item?.[key];
    if (v == null) continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return "";
}

function normalizeCd1Entry(item, idx, imageBasePaths, audioBasePaths, cd) {
  const number = parseCdNumber(item.ban ?? item.number ?? item.no ?? item.id ?? item.index ?? item.name) ?? (idx + 1);
  const imageFile = String(
    item.image ?? item.img ?? item.file ?? item.filename ?? item.photo ?? item.picture ?? `${number}.png`
  );
  const audioFile = String(
    item.audio ?? item.mp3 ?? item.sound ?? item.voice ?? item.listen ?? item.track ?? item.audioFile ?? `${number}.mp3`
  );
  const options = normalizeCd1Options(item);
  const rawCorrect = item.exac ?? item.exact ?? item.correct ?? item.answer;
  const correctIndex = resolveCd1CorrectIndex(rawCorrect, options);
  const imageFileCandidates = buildCdImageFileCandidates(imageFile, number, cd);
  const audioFileCandidates = buildCdAudioFileCandidates(audioFile, number, cd);
  const imageSrcCandidates = buildAssetSrcCandidates(imageBasePaths, imageFileCandidates);
  const audioSrcCandidates = buildAssetSrcCandidates(audioBasePaths, audioFileCandidates);

  const script = pickFirstNonEmpty(item, ["script", "transcript", "text", "scrip"]);
  const questionText = pickFirstNonEmpty(item, ["question", "q", "mondai", "problem"]);
  const explanation = pickFirstNonEmpty(item, [
    "memo",
    "explain", "explanation", "note", "reason",
    "giaithich", "giai_thich", "giaiThich", "kaisetsu", "setsumei", "comment", "analysis"
  ]);

  return {
    number,
    label: "",
    imageSrc: imageSrcCandidates[0],
    imageSrcCandidates,
    audioSrc: audioSrcCandidates[0] || "",
    audioSrcCandidates,
    audioBasePaths,
    script,
    questionText,
    explanation,
    options,
    correctIndex
  };
}

function normalizeCd1Entries(raw, imageBasePaths, audioBasePaths, cd) {
  const rows = Array.isArray(raw)
    ? raw
    : Array.isArray(raw.items)
      ? raw.items
      : Array.isArray(raw.data)
        ? raw.data
        : Object.values(raw || {});

  const normalized = rows
    .filter((x) => x && typeof x === "object")
    .map((x, idx) => normalizeCd1Entry(x, idx, imageBasePaths, audioBasePaths, cd))
    .sort((a, b) => a.number - b.number);

  return normalized.filter((x) => x.options.length === 4 && x.correctIndex >= 0);
}

async function renderNgheBjtCDFolders(book, cd) {
  view.innerHTML = `
    <div class="card">
      <div class="cardTitleRow">
        <h1 class="h1">Học BJT — ${book} / ${cd}</h1>
        <button class="btnSmall" id="backBjtList">← CD</button>
      </div>
      <p class="sub">Đang tải danh sách bài...</p>
      <div class="grid grid2" id="cd1Folders"></div>
    </div>
  `;

  $("#backBjtList").onclick = () => renderNgheBjtBook(book);
  const box = $("#cd1Folders");

  try {
    const loaded = await loadCdAnswerRaw(book, cd);
    const entries = normalizeCd1Entries(loaded.raw, loaded.imageBasePaths, loaded.audioBasePaths, cd);
    entries.forEach((entry, idx) => {
      entry.orderNo = idx + 1;
      entry.label = `${idx + 1}番`;
      const pad2 = String(entry.orderNo).padStart(2, "0");
      const primaryImages = [
        `${BJT_STUDY_BASE_PATH}/${book}/${cd}-image/${pad2}.png`,
        `${BJT_STUDY_BASE_PATH}/${book}/${cd}-image/${cd}-${pad2}.png`,
        `${BJT_STUDY_BASE_PATH}/${book}/${cd}-image/BJTchokai_${cd}-${pad2}.png`
      ];
      entry.imageSrcCandidates = withUniqueValues([...primaryImages, ...(entry.imageSrcCandidates || [])]).slice(0, 8);
      entry.imageSrc = entry.imageSrcCandidates[0] || "";
      const primaryAudio = `${BJT_STUDY_BASE_PATH}/${book}/${cd}/BJTchokai_${cd}-${pad2}.mp3`;
      entry.audioSrcCandidates = withUniqueValues([primaryAudio, ...(entry.audioSrcCandidates || [])]);
      entry.audioSrc = entry.audioSrcCandidates[0] || "";
    });

    document.querySelector(".sub").textContent = entries.length
      ? "Chọn folder (番) để vào làm bài"
      : `Không có dữ liệu hợp lệ trong ${cd}-answer (cần 4 đáp án và trường exac/exact).`;

    entries.forEach((entry, idx) => {
      const row = document.createElement("div");
      row.className = "cd1FolderRow";

      const btn = document.createElement("button");
      btn.className = "btn btnBjtCd btnBjtFolderItem";
      btn.textContent = entry.label;
      btn.onclick = () => renderNgheBjtCDExercise(book, cd, entries, idx);

      const starBtn = document.createElement("button");
      starBtn.className = "btnSmall btnBookmark";
      let bookmarked = isBjtCdBookmarked(book, cd, entry.orderNo);
      setCd1BookmarkBtnUI(starBtn, bookmarked);
      starBtn.onclick = () => {
        bookmarked = !bookmarked;
        setBjtCdBookmarked(book, cd, entry.orderNo, bookmarked);
        setCd1BookmarkBtnUI(starBtn, bookmarked);
      };

      row.appendChild(btn);
      row.appendChild(starBtn);
      box.appendChild(row);
    });
  } catch (e) {
    document.querySelector(".sub").textContent = `Không tải được ${cd}-answer. Kiểm tra folder ${cd}/${cd}-answer và file json.`;
  }
}

function renderNgheBjtCDExercise(book, cd, entries, currentIndex) {
  const total = Array.isArray(entries) ? entries.length : 0;
  const safeIndex = Math.min(Math.max(Number(currentIndex) || 0, 0), Math.max(total - 1, 0));
  const entry = total ? entries[safeIndex] : null;
  if (!entry) {
    renderNgheBjtCDFolders(book, cd);
    return;
  }
  const correctOptionText = entry.correctIndex >= 0 ? (entry.options[entry.correctIndex] || "") : "";
  const explanationText = entry.explanation || "Chưa có giải thích.";
  const hasScriptDetail = !!(entry.script || entry.questionText || correctOptionText || entry.explanation);

  view.innerHTML = `
    <div class="card">
      <div class="cardTitleRow">
        <h1 class="h1">${entry.label}</h1>
        <div class="cardTitleActions">
          <button class="btnSmall" id="backCd1Folders">← Folder</button>
          <button class="btnSmall btnBookmark" id="toggleCd1Bookmark" aria-pressed="false">☆</button>
        </div>
      </div>
      <div class="cd1ImageWrap">
        <img src="${entry.imageSrc}" alt="${entry.label}" class="cd1Image" id="cd1Image" loading="eager" fetchpriority="high" />
      </div>
      <div class="cd1AudioWrap">
        <audio id="cd1Audio" class="cd1Audio" preload="metadata" controls ${entry.audioSrc ? `src="${entry.audioSrc}"` : ""}></audio>
      </div>
      <div class="grid cd1ChoicesRow" id="cd1Choices"></div>
      <div id="cd1Feedback"></div>
      <div class="row">
        <button class="btnSmall" id="toggleCd1Script">${hasScriptDetail ? "Hiện script" : "Không có script"}</button>
      </div>
      <div id="cd1ScriptWrap" class="cd1ScriptWrap" style="display:none;">
        <div class="cd1ScriptTitle">Script</div>
        <div class="cd1ScriptList">
          ${entry.script ? `<div><strong>Script:</strong> ${formatMultilineText(entry.script)}</div>` : ""}
          ${entry.questionText ? `<div><strong>Question:</strong> ${formatMultilineText(entry.questionText)}</div>` : ""}
          ${entry.options.map((opt, i) => `<div><strong>${i + 1}.</strong> ${formatMultilineText(opt)}</div>`).join("")}
          ${correctOptionText ? `<div><strong>Đáp án đúng:</strong> ${formatMultilineText(correctOptionText)}</div>` : ""}
          <div><strong>Giải thích:</strong> ${formatMultilineText(explanationText)}</div>
        </div>
      </div>
      <div class="row" style="margin-top:12px; justify-content:space-between; gap:8px;">
        <button class="btnSmall" id="prevCd1Exercise" ${safeIndex <= 0 ? "disabled" : ""}>← Back</button>
        <button class="btnSmall" id="nextCd1Exercise" ${safeIndex >= total - 1 ? "disabled" : ""}>Next →</button>
      </div>
    </div>
  `;

  $("#backCd1Folders").onclick = () => renderNgheBjtCDFolders(book, cd);

  const img = $("#cd1Image");
  let imageTry = 0;
  img.onerror = () => {
    imageTry += 1;
    if (imageTry < entry.imageSrcCandidates.length) {
      img.src = entry.imageSrcCandidates[imageTry];
    }
  };

  const audio = $("#cd1Audio");
  const orderNo = Number(entry.orderNo) || 1;
  const orderAudioNames = buildCdAudioFileCandidates(`${orderNo}.mp3`, orderNo, cd);
  const orderAudioSrcCandidates = buildAssetSrcCandidates(entry.audioBasePaths || [], orderAudioNames);
  const allAudioCandidates = withUniqueValues([...(entry.audioSrcCandidates || []), ...orderAudioSrcCandidates]).slice(0, 10);
  if (audio && !audio.getAttribute("src") && allAudioCandidates.length) {
    audio.src = allAudioCandidates[0];
    audio.load();
  }
  let audioTry = 0;
  if (audio) {
    audio.addEventListener("error", () => {
      audioTry += 1;
      if (audioTry < allAudioCandidates.length) {
        audio.src = allAudioCandidates[audioTry];
        audio.load();
      }
    });
  }

  const box = $("#cd1Choices");
  const feedback = $("#cd1Feedback");
  const toggleScriptBtn = $("#toggleCd1Script");
  const scriptWrap = $("#cd1ScriptWrap");
  const prevBtn = $("#prevCd1Exercise");
  const nextBtn = $("#nextCd1Exercise");
  const toggleBookmarkBtn = $("#toggleCd1Bookmark");
  let bookmarked = isBjtCdBookmarked(book, cd, entry.orderNo);
  let chosenIndex = -1;

  setCd1BookmarkBtnUI(toggleBookmarkBtn, bookmarked);

  if (!hasScriptDetail) {
    toggleScriptBtn.disabled = true;
  }

  toggleScriptBtn.onclick = () => {
    if (!hasScriptDetail) return;
    const isHidden = scriptWrap.style.display === "none";
    scriptWrap.style.display = isHidden ? "" : "none";
    toggleScriptBtn.textContent = isHidden ? "Ẩn script" : "Hiện script";
  };

  entry.options.forEach((option, idx) => {
    const btn = document.createElement("button");
    btn.className = "btn cd1Choice cd1ChoiceNumberOnly";
    btn.innerHTML = `<span class="cd1Tick">${chosenIndex === idx ? "✓" : ""}</span><span class="cd1ChoiceNumber">${idx + 1}</span>`;
    btn.onclick = () => {
      chosenIndex = idx;
      const all = box.querySelectorAll(".cd1Choice");
      all.forEach((el, i) => {
        const tick = el.querySelector(".cd1Tick");
        if (tick) tick.textContent = i === chosenIndex ? "✓" : "";
      });

      const ok = idx === entry.correctIndex;
      feedback.innerHTML = `
        <div class="feedback ${ok ? "ok" : "ng"}">
          <div class="choiceLine1">${ok ? "Chính xác!" : "Sai rồi, thử lại nhé."}</div>
          <div class="choiceLine2">Đáp án đúng: ${escapeHtml(entry.options[entry.correctIndex])}</div>
        </div>
      `;
    };
    box.appendChild(btn);
  });

  if (prevBtn) {
    prevBtn.onclick = () => {
      if (safeIndex > 0) renderNgheBjtCDExercise(book, cd, entries, safeIndex - 1);
    };
  }
  if (nextBtn) {
    nextBtn.onclick = () => {
      if (safeIndex < total - 1) renderNgheBjtCDExercise(book, cd, entries, safeIndex + 1);
    };
  }
  if (toggleBookmarkBtn) {
    toggleBookmarkBtn.onclick = () => {
      bookmarked = !bookmarked;
      setBjtCdBookmarked(book, cd, entry.orderNo, bookmarked);
      setCd1BookmarkBtnUI(toggleBookmarkBtn, bookmarked);
    };
  }
}

async function loadSection1Raw(book) {
  const candidates = [
    "Section1.json",
    "Section1/Section1.json",
    `${BJT_STUDY_BASE_PATH}/${book}/Section1/Section1.json`,
    `${BJT_STUDY_BASE_PATH}/${book}/Section1.json`,
    `${BJT_STUDY_BASE_PATH}/${book}/Section1-answer/Section1.json`,
    `${book}/Section1/Section1.json`,
    `${book}/Section1.json`,
    `${book}/Section1-answer/Section1.json`
  ];

  for (const path of candidates) {
    try {
      const raw = await loadJSON(path);
      return raw;
    } catch (_) {}
  }

  throw new Error("Không tải được Section1.json.");
}

function normalizeSection1Entries(raw) {
  const rows = Array.isArray(raw)
    ? raw
    : Array.isArray(raw.items)
      ? raw.items
      : Array.isArray(raw.data)
        ? raw.data
        : Object.values(raw || {});

  const normalized = rows
    .filter((x) => x && typeof x === "object")
    .map((item, idx) => {
      const number = parseCdNumber(item.id ?? item.no ?? item.number ?? item.index ?? item.name) ?? (idx + 1);
      const question = pickFirstNonEmpty(item, ["question", "q", "mondai", "problem"]);
      const options = normalizeCd1Options(item);
      const correctIndex = resolveCd1CorrectIndex(item.correct ?? item.exac ?? item.exact ?? item.answer, options);
      const memo = pickFirstNonEmpty(item, ["memo", "explain", "explanation", "note", "reason", "comment", "analysis"]);
      return {
        number,
        label: `${idx + 1}番`,
        question,
        options,
        correctIndex,
        memo,
        orderNo: idx + 1
      };
    })
    .sort((a, b) => a.number - b.number);

  return normalized.filter((x) => x.question && x.options.length === 4 && x.correctIndex >= 0);
}

async function renderNgheBjtSection1Folders(book) {
  view.innerHTML = `
    <div class="card">
      <div class="cardTitleRow">
        <h1 class="h1">Học BJT — ${book} / Section1</h1>
        <button class="btnSmall" id="backBjtList">← CD</button>
      </div>
      <p class="sub">Đang tải danh sách bài...</p>
      <div class="grid grid2" id="section1Folders"></div>
    </div>
  `;

  $("#backBjtList").onclick = () => renderNgheBjtBook(book);
  const box = $("#section1Folders");

  try {
    const raw = await loadSection1Raw(book);
    const entries = normalizeSection1Entries(raw);

    document.querySelector(".sub").textContent = entries.length
      ? "Chọn folder (番) để vào làm bài"
      : "Không có dữ liệu hợp lệ trong Section1.json.";

    entries.forEach((entry, idx) => {
      const row = document.createElement("div");
      row.className = "cd1FolderRow";

      const btn = document.createElement("button");
      btn.className = "btn btnBjtCd btnBjtFolderItem";
      btn.textContent = entry.label;
      btn.onclick = () => renderNgheBjtSection1Exercise(book, entries, idx);

      const starBtn = document.createElement("button");
      starBtn.className = "btnSmall btnBookmark";
      let bookmarked = isBjtCdBookmarked(book, "Section1", entry.orderNo);
      setCd1BookmarkBtnUI(starBtn, bookmarked);
      starBtn.onclick = () => {
        bookmarked = !bookmarked;
        setBjtCdBookmarked(book, "Section1", entry.orderNo, bookmarked);
        setCd1BookmarkBtnUI(starBtn, bookmarked);
      };

      row.appendChild(btn);
      row.appendChild(starBtn);
      box.appendChild(row);
    });
  } catch (e) {
    document.querySelector(".sub").textContent = "Không tải được Section1.json.";
  }
}

function renderNgheBjtSection1Exercise(book, entries, currentIndex) {
  const total = Array.isArray(entries) ? entries.length : 0;
  const safeIndex = Math.min(Math.max(Number(currentIndex) || 0, 0), Math.max(total - 1, 0));
  const entry = total ? entries[safeIndex] : null;
  if (!entry) {
    renderNgheBjtSection1Folders(book);
    return;
  }

  const hasMemo = !!entry.memo;

  view.innerHTML = `
    <div class="card">
      <div class="cardTitleRow">
        <h1 class="h1">${entry.label}</h1>
        <div class="cardTitleActions">
          <button class="btnSmall" id="backSection1Folders">← Folder</button>
          <button class="btnSmall btnBookmark" id="toggleSection1Bookmark" aria-pressed="false">☆</button>
        </div>
      </div>
      <div class="sectionQuestionBox">
        <div class="sectionQuestionLabel">Question</div>
        <div class="sectionQuestionText">${formatMultilineText(entry.question)}</div>
      </div>
      <div class="grid" id="section1Choices"></div>
      <div id="section1Feedback"></div>
      <div class="row">
        <button class="btnSmall" id="toggleSection1Memo">${hasMemo ? "Hiện memo" : "Không có memo"}</button>
      </div>
      <div id="section1MemoWrap" class="cd1ScriptWrap" style="display:none;">
        <div class="cd1ScriptTitle">Memo</div>
        <div class="cd1ScriptList">${hasMemo ? formatMultilineText(entry.memo) : ""}</div>
      </div>
      <div class="row" style="margin-top:12px; justify-content:space-between; gap:8px;">
        <button class="btnSmall" id="prevSection1Exercise" ${safeIndex <= 0 ? "disabled" : ""}>← Back</button>
        <button class="btnSmall" id="nextSection1Exercise" ${safeIndex >= total - 1 ? "disabled" : ""}>Next →</button>
      </div>
    </div>
  `;

  $("#backSection1Folders").onclick = () => renderNgheBjtSection1Folders(book);

  const box = $("#section1Choices");
  const feedback = $("#section1Feedback");
  const toggleMemoBtn = $("#toggleSection1Memo");
  const memoWrap = $("#section1MemoWrap");
  const prevBtn = $("#prevSection1Exercise");
  const nextBtn = $("#nextSection1Exercise");
  const toggleBookmarkBtn = $("#toggleSection1Bookmark");
  let bookmarked = isBjtCdBookmarked(book, "Section1", entry.orderNo);
  let chosenIndex = -1;

  setCd1BookmarkBtnUI(toggleBookmarkBtn, bookmarked);

  if (!hasMemo) {
    toggleMemoBtn.disabled = true;
  }

  toggleMemoBtn.onclick = () => {
    if (!hasMemo) return;
    const isHidden = memoWrap.style.display === "none";
    memoWrap.style.display = isHidden ? "" : "none";
    toggleMemoBtn.textContent = isHidden ? "Ẩn memo" : "Hiện memo";
  };

  entry.options.forEach((option, idx) => {
    const btn = document.createElement("button");
    btn.className = "btn";
    btn.innerHTML = `
      <div class="choiceLine1">${idx + 1}. ${escapeHtml(option)}</div>
    `;
    btn.onclick = () => {
      chosenIndex = idx;
      const all = box.querySelectorAll(".btn");
      all.forEach((el, i) => {
        el.classList.remove("choiceCorrect", "choiceWrong");
        if (i === entry.correctIndex) el.classList.add("choiceCorrect");
        if (i === chosenIndex && i !== entry.correctIndex) el.classList.add("choiceWrong");
      });

      const ok = idx === entry.correctIndex;
      feedback.innerHTML = `
        <div class="feedback ${ok ? "ok" : "ng"}">
          <div class="choiceLine1">${ok ? "Chính xác!" : "Sai rồi, thử lại nhé."}</div>
          <div class="choiceLine2">Đáp án đúng: ${escapeHtml(entry.options[entry.correctIndex] || "")}</div>
        </div>
      `;
    };
    box.appendChild(btn);
  });

  if (prevBtn) {
    prevBtn.onclick = () => {
      if (safeIndex > 0) renderNgheBjtSection1Exercise(book, entries, safeIndex - 1);
    };
  }
  if (nextBtn) {
    nextBtn.onclick = () => {
      if (safeIndex < total - 1) renderNgheBjtSection1Exercise(book, entries, safeIndex + 1);
    };
  }
  if (toggleBookmarkBtn) {
    toggleBookmarkBtn.onclick = () => {
      bookmarked = !bookmarked;
      setBjtCdBookmarked(book, "Section1", entry.orderNo, bookmarked);
      setCd1BookmarkBtnUI(toggleBookmarkBtn, bookmarked);
    };
  }
}

function renderLevels(mode) {
  state.mode = mode;
  const levels = ["N5", "N4", "N3", "N2", "N1"].filter((lv) => state.config[mode]?.[lv]);

  view.innerHTML = `
    <div class="card">
      <h1 class="h1">${mode === "vocab" ? "Từ vựng" : "Chữ Hán"} — chọn cấp</h1>
      <div class="grid grid2" id="levels"></div>
      <div class="row">
        <button class="btnSmall" id="backHome">← Home</button>
      </div>
    </div>
  `;

  $("#backHome").onclick = () => renderHome();
  const box = $("#levels");

  levels.forEach((lv) => {
    const parts = state.config[mode][lv];
    const doneCount = parts.filter((p) => isDone(mode, lv, p)).length;
    const wrap = document.createElement("div");
    wrap.className = "btnWrap";
    const allDone = doneCount === parts.length;

    wrap.innerHTML = `
      <button class="btn btnLevel" type="button">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;">
          <div>
            <div class="choiceLine1">${lv}</div>
            <div class="choiceLine2">${doneCount}/${parts.length} phần đã xong</div>
          </div>
          <span class="badge">${parts.length} phần</span>
        </div>
      </button>
      ${!allDone ? `<button class="btnDone" type="button" title="Đánh dấu tất cả đã xong">✓</button>` : ""}
      <button class="btnReset" type="button" title="Reset cấp ${lv}">↺</button>
    `;

    wrap.querySelector(".btnLevel").onclick = () => renderParts(mode, lv);

    const doneBtn = wrap.querySelector(".btnDone");
    if (doneBtn) {
      doneBtn.onclick = (e) => {
        e.stopPropagation();
        parts.forEach((p) => setDone(mode, lv, p, true));
        renderLevels(mode);
      };
    }

    wrap.querySelector(".btnReset").onclick = (e) => {
      e.stopPropagation();
      parts.forEach((p) => setDone(mode, lv, p, false));
      renderLevels(mode);
    };

    box.appendChild(wrap);
  });
}

function renderParts(mode, level) {
  state.mode = mode;
  state.level = level;
  const parts = state.config[mode][level];

  view.innerHTML = `
    <div class="card">
      <div class="cardTitleRow">
        <h1 class="h1">${mode === "vocab" ? "Từ vựng" : "Chữ Hán"} — ${level}</h1>
        <button class="btnSmall" id="backLevels">← Cấp</button>
      </div>
      <p class="sub">Chọn phần chơi</p>
      <div class="grid" id="parts"></div>
      <div class="row">
        <button class="btnSmall" id="backLevels2">← Cấp</button>
        <button class="btnSmall" id="backHome">Home</button>
      </div>
    </div>
  `;

  $("#backLevels").onclick = () => renderLevels(mode);
  $("#backLevels2").onclick = () => renderLevels(mode);
  $("#backHome").onclick = () => renderHome();

  const box = $("#parts");

  parts.forEach((file) => {
    const done = isDone(mode, level, file);
    const wrap = document.createElement("div");
    wrap.className = "btnWrap";

    wrap.innerHTML = `
      <button class="btn btnPart" type="button">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;">
          <div>
            <div class="choiceLine1">${partFileToLabel(file, mode)}</div>
          </div>
          <span class="badge ${done ? "done" : ""}">${done ? "Đã xong" : "Chưa xong"}</span>
        </div>
      </button>
      ${!done ? `<button class="btnDone" type="button" title="Đánh dấu đã xong">✓</button>` : ""}
      <button class="btnReset" type="button" title="Reset phần này">↺</button>
    `;

    wrap.querySelector(".btnPart").onclick = () => startGame(mode, level, file);

    const doneBtn = wrap.querySelector(".btnDone");
    if (doneBtn) {
      doneBtn.onclick = (e) => {
        e.stopPropagation();
        setDone(mode, level, file, true);
        renderParts(mode, level);
      };
    }

    wrap.querySelector(".btnReset").onclick = (e) => {
      e.stopPropagation();
      setDone(mode, level, file, false);
      renderParts(mode, level);
    };

    box.appendChild(wrap);
  });
}

async function startGame(mode, level, partFile) {
  state.mode = mode;
  state.level = level;
  state.partFile = partFile;
  state.idx = 0;
  state.locked = false;

  const path = `${DATA_BASE_URL}/${mode}/${level}/${partFile}`;
  const items = await loadJSON(path);

  state.questions = items;
  state.order = shuffle([...Array(items.length).keys()]);
  renderQuestion();
}

function buildChoices(correctItem, poolItems) {
  const others = poolItems.filter((x) =>
    !(x.question === correctItem.question && x.answer1 === correctItem.answer1 && x.answer2 === correctItem.answer2)
  );

  const picked = shuffle(others).slice(0, 3);
  const choices = shuffle([correctItem, ...picked]);

  const correctIndex = choices.findIndex((x) =>
    x.question === correctItem.question && x.answer1 === correctItem.answer1 && x.answer2 === correctItem.answer2
  );

  return { choices, correctIndex };
}

function renderQuestion(feedback = null) {
  const total = state.order.length;
  const qIndex = state.order[state.idx];
  const item = state.questions[qIndex];

  let choices;
  let correctIndex;

  if (!feedback) {
    const built = buildChoices(item, state.questions);
    choices = built.choices;
    correctIndex = built.correctIndex;
    state.currentChoices = choices;
    state.currentCorrectIndex = correctIndex;
  } else {
    choices = state.currentChoices;
    correctIndex = state.currentCorrectIndex;
  }

  const partLabel = partFileToLabel(state.partFile, state.mode);

  view.innerHTML = `
    <div class="card">
      <div class="questionCenter">
        <div class="questionMeta">
          <div class="sub">${state.mode === "vocab" ? "Từ vựng" : "Chữ Hán"} / ${state.level} / ${partLabel}</div>
          <div class="progress">Câu ${state.idx + 1} / ${total}</div>
        </div>
        <div class="bigQ">${escapeHtml(item.question)}</div>
        ${feedback && state.mode !== "kanji" ? `<div class="answer1Reveal">${escapeHtml(item.answer1)}</div>` : ""}
        <div class="grid questionChoices" id="choices"></div>
        ${feedback ? `
          <div class="feedback ${feedback.ok ? "ok" : "ng"}">
            <div class="choiceLine1">${feedback.ok ? "Tuyệt vời!" : "Cố lên, lại lần nữa nào!"}</div>
          </div>
        ` : ""}
      </div>
      <div class="row">
        ${feedback && !feedback.ok
          ? `<button class="btnSmall" id="retry">Chơi lại phần này</button><button class="btnSmall" id="toList">Về danh sách phần</button>`
          : `<button class="btnSmall" id="backList">← Danh sách phần</button>`
        }
      </div>
    </div>
  `;

  if (feedback && !feedback.ok) {
    $("#retry").onclick = () => startGame(state.mode, state.level, state.partFile);
    $("#toList").onclick = () => renderParts(state.mode, state.level);
  } else {
    $("#backList").onclick = () => renderParts(state.mode, state.level);
  }

  const box = $("#choices");

  choices.forEach((c, idx) => {
    const btn = document.createElement("button");
    let cls = "btn";

    if (feedback) {
      if (feedback.ok && idx === feedback.correctIndex) cls += " choiceCorrect";
      if (!feedback.ok && idx === feedback.chosenIndex) cls += " choiceWrong";
      if (!feedback.ok && idx === feedback.correctIndex) cls += " choiceCorrect";
    }

    btn.className = cls;

    if (state.mode === "kanji") {
      btn.innerHTML = `<div class="choiceLine1">${escapeHtml(c.answer1 ?? "")}</div><div class="choiceLine2">${escapeHtml(c.answer2 ?? "")}</div>`;
    } else {
      btn.innerHTML = `<div class="choiceLine2">${escapeHtml(c.answer2 ?? "")}</div>`;
    }

    btn.onclick = () => onAnswer(idx === correctIndex, idx, correctIndex);
    box.appendChild(btn);
  });
}

function onAnswer(isCorrect, chosenIndex, correctIndex) {
  if (state.locked) return;
  state.locked = true;

  if (isCorrect) {
    renderQuestion({ ok: true, chosenIndex, correctIndex });

    setTimeout(() => {
      state.idx += 1;
      state.locked = false;

      if (state.idx >= state.order.length) {
        setDone(state.mode, state.level, state.partFile, true);
        renderFinish();
      } else {
        renderQuestion();
      }
    }, state.mode === "kanji" ? 1000 : 1500);
  } else {
    renderQuestion({ ok: false, chosenIndex, correctIndex });
  }
}

function renderFinish() {
  view.innerHTML = `
    <div class="card">
      <h1 class="h1">🎉 Hoàn thành phần!</h1>
      <p class="sub">${state.mode === "vocab" ? "Từ vựng" : "Chữ Hán"} / ${state.level} / ${partFileToLabel(state.partFile, state.mode)}</p>
      <div class="row">
        <button class="btnSmall" id="again">Chơi lại phần này</button>
        <button class="btnSmall" id="toList">Về danh sách phần</button>
        <button class="btnSmall" id="toLevels">Về chọn cấp</button>
      </div>
    </div>
  `;

  $("#again").onclick = () => startGame(state.mode, state.level, state.partFile);
  $("#toList").onclick = () => renderParts(state.mode, state.level);
  $("#toLevels").onclick = () => renderLevels(state.mode);
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatMultilineText(s) {
  const escaped = escapeHtml(String(s ?? ""));
  return escaped.replace(/(\r\n|\n|\r|\\n|\/n)/g, "<br>");
}

// ===== Boot =====
(async function boot() {
  state.config = await loadJSON("config.json");
  await loadDoneConfig();
  state.accountId = localStorage.getItem(STORAGE_KEY_ACCOUNT);

  if (state.accountId) {
    updateTopbar(true);
    renderHome();
  } else {
    updateTopbar(false);
    renderLogin();
  }
})();
