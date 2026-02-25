function renderNgheBjt() {
  view.innerHTML = `
    <div class="card">
      <div class="cardTitleRow">
        <h1 class="h1">Học BJT</h1>
        <button class="btnSmall" id="backHomeBjt">←</button>
      </div>
      <p class="sub">Chọn Book</p>
      <div class="grid grid2" id="ngheBjtBooks"></div>
    </div>
  `;

  $("#backHomeBjt").onclick = () => renderHome();
  const box = $("#ngheBjtBooks");

  ["Book1"].forEach((book) => {
    const btn = document.createElement("button");
    btn.className = "btn btnBjtCd btnBjtFolder";
    btn.textContent = book;
    btn.onclick = () => renderNgheBjtBook(book);
    box.appendChild(btn);
  });
}

function renderNgheBjtBook(book) {
  view.innerHTML = `
    <div class="card">
      <div class="cardTitleRow">
        <h1 class="h1">Học BJT ở ${book}</h1>
        <button class="btnSmall" id="backBjtBooks">←</button>
      </div>
      <p class="sub">Chọn CD</p>
      <div class="grid grid2" id="ngheBjtCds"></div>
    </div>
  `;

  $("#backBjtBooks").onclick = () => renderNgheBjt();
  const box = $("#ngheBjtCds");

  ["CD1", "CD2", "Section1", "Section2", "Section3"].forEach((cd) => {
    const btn = document.createElement("button");
    btn.className = "btn btnBjtCd btnBjtFolder";
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
  if (cd === "Section1" || cd === "Section2" || cd === "Section3") {
    renderNgheBjtSectionFolders(book, cd);
    return;
  }

  view.innerHTML = `
    <div class="card">
      <div class="cardTitleRow">
        <h1 class="h1">Học BJT ở ${book} / ${cd}</h1>
        <button class="btnSmall" id="backBjtList">←</button>
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
        <h1 class="h1">Học BJT ở ${book} / ${cd}</h1>
        <button class="btnSmall" id="backBjtList">←</button>
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
      btn.className = "btn btnBjtCd btnBjtFolder btnBjtFolderItem";
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
          <button class="btnSmall" id="backCd1Folders">←</button>
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
        <button class="btnSmall" id="prevCd1Exercise" ${safeIndex <= 0 ? "disabled" : ""}>←</button>
        <button class="btnSmall" id="nextCd1Exercise" ${safeIndex >= total - 1 ? "disabled" : ""}>→</button>
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
    btn.innerHTML = `<span class="cd1Tick">${chosenIndex === idx ? "?" : ""}</span><span class="cd1ChoiceNumber">${idx + 1}</span>`;
    btn.onclick = () => {
      chosenIndex = idx;
      const all = box.querySelectorAll(".cd1Choice");
      all.forEach((el, i) => {
        const tick = el.querySelector(".cd1Tick");
        if (tick) tick.textContent = i === chosenIndex ? "?" : "";
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

async function loadSectionRaw(book, sectionName) {
  const candidates = [
    `${sectionName}.json`,
    `${sectionName}/${sectionName}.json`,
    `${BJT_STUDY_BASE_PATH}/${book}/${sectionName}/${sectionName}.json`,
    `${BJT_STUDY_BASE_PATH}/${book}/${sectionName}.json`,
    `${BJT_STUDY_BASE_PATH}/${book}/${sectionName}-answer/${sectionName}.json`,
    `${book}/${sectionName}/${sectionName}.json`,
    `${book}/${sectionName}.json`,
    `${book}/${sectionName}-answer/${sectionName}.json`
  ];

  for (const path of candidates) {
    try {
      const raw = await loadJSON(path);
      return raw;
    } catch (_) {}
  }

  throw new Error(`Không tải được ${sectionName}.json.`);
}

function normalizeSectionEntries(raw) {
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
      const script = pickFirstNonEmpty(item, ["script", "transcript", "text", "scrip", "html"]);
      return {
        number,
        label: `${idx + 1}番`,
        question,
        script,
        options,
        correctIndex,
        memo,
        orderNo: idx + 1
      };
    })
    .sort((a, b) => a.number - b.number);

  return normalized.filter((x) => x.question && x.options.length === 4 && x.correctIndex >= 0);
}

async function renderNgheBjtSectionFolders(book, sectionName) {
  view.innerHTML = `
    <div class="card">
      <div class="cardTitleRow">
        <h1 class="h1">Học BJT ở ${book} / ${sectionName}</h1>
        <button class="btnSmall" id="backBjtList">←</button>
      </div>
      <p class="sub">Đang tải danh sách bài...</p>
      <div class="grid grid2" id="section1Folders"></div>
    </div>
  `;

  $("#backBjtList").onclick = () => renderNgheBjtBook(book);
  const box = $("#section1Folders");

  try {
    const raw = await loadSectionRaw(book, sectionName);
    const entries = normalizeSectionEntries(raw);

    document.querySelector(".sub").textContent = entries.length
      ? "Chọn folder (番) để vào làm bài"
      : `Không có dữ liệu hợp lệ trong ${sectionName}.json.`;

    entries.forEach((entry, idx) => {
      const row = document.createElement("div");
      row.className = "cd1FolderRow";

      const btn = document.createElement("button");
      btn.className = "btn btnBjtCd btnBjtFolder btnBjtFolderItem";
      btn.textContent = entry.label;
      btn.onclick = () => renderNgheBjtSectionExercise(book, sectionName, entries, idx);

      const starBtn = document.createElement("button");
      starBtn.className = "btnSmall btnBookmark";
      let bookmarked = isBjtCdBookmarked(book, sectionName, entry.orderNo);
      setCd1BookmarkBtnUI(starBtn, bookmarked);
      starBtn.onclick = () => {
        bookmarked = !bookmarked;
        setBjtCdBookmarked(book, sectionName, entry.orderNo, bookmarked);
        setCd1BookmarkBtnUI(starBtn, bookmarked);
      };

      row.appendChild(btn);
      row.appendChild(starBtn);
      box.appendChild(row);
    });
  } catch (e) {
    document.querySelector(".sub").textContent = `Không tải được ${sectionName}.json.`;
  }
}

function renderNgheBjtSectionExercise(book, sectionName, entries, currentIndex) {
  const total = Array.isArray(entries) ? entries.length : 0;
  const safeIndex = Math.min(Math.max(Number(currentIndex) || 0, 0), Math.max(total - 1, 0));
  const entry = total ? entries[safeIndex] : null;
  if (!entry) {
    renderNgheBjtSectionFolders(book, sectionName);
    return;
  }

  const hasMemo = !!entry.memo;
  const hasScript = !!entry.script;
  const isSection3 = String(sectionName).toLowerCase() === "section3";
  const pad2 = String(entry.orderNo || (safeIndex + 1)).padStart(2, "0");
  const sectionLower = String(sectionName).toLowerCase();
  const sectionImageNameCandidates = [
    `${sectionLower}-${pad2}.png`,
    `${sectionLower}-${pad2}.jpg`,
    `${sectionLower}-${pad2}.jpeg`,
    `${sectionLower}_${pad2}.png`,
    `${sectionLower}_${pad2}.jpg`
  ];
  const sectionImageBaseCandidates = [
    `${BJT_STUDY_BASE_PATH}/${book}/${sectionName}-image`,
    `${BJT_STUDY_BASE_PATH}/${book}/${sectionName}/${sectionName}-image`,
    `${BJT_STUDY_BASE_PATH}/${book}/Secttion3-image`,
    `${BJT_STUDY_BASE_PATH}/${book}/${sectionName.toLowerCase()}-image`,
    `${sectionName}-image`,
    `${sectionName}/${sectionName}-image`,
    "Secttion3-image",
    `${sectionName.toLowerCase()}-image`
  ];
  const sectionImageSrcCandidates = buildAssetSrcCandidates(sectionImageBaseCandidates, sectionImageNameCandidates);
  const hasSectionImage = isSection3 && sectionImageSrcCandidates.length > 0;

  view.innerHTML = `
    <div class="card">
      <div class="cardTitleRow">
        <h1 class="h1">${entry.label}</h1>
        <div class="cardTitleActions">
          <button class="btnSmall" id="backSection1Folders">←</button>
          <button class="btnSmall btnBookmark" id="toggleSection1Bookmark" aria-pressed="false">☆</button>
        </div>
      </div>
      <div class="sectionQuestionBox">
        <div class="sectionQuestionLabel">Question</div>
        <div class="sectionQuestionText">${formatMultilineText(entry.question)}</div>
      </div>
      ${hasSectionImage ? `
        <div class="sectionImageWrap">
          <img src="${sectionImageSrcCandidates[0]}" alt="${entry.label}" class="sectionImage" id="sectionImage" loading="eager" fetchpriority="high" />
        </div>
      ` : ""}
      ${hasScript ? `
        <div class="sectionQuestionBox">
          <button class="btnSmall" id="toggleSection1Script">Hiện script</button>
          <div id="section1ScriptWrap" class="cd1ScriptWrap" style="display:none; margin-top:10px;">
            <div class="cd1ScriptTitle">Script</div>
            <div class="sectionScriptHtml">${formatHtmlTextContent(entry.script)}</div>
          </div>
        </div>
      ` : ""}
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
        <button class="btnSmall" id="prevSection1Exercise" ${safeIndex <= 0 ? "disabled" : ""}>←</button>
        <button class="btnSmall" id="nextSection1Exercise" ${safeIndex >= total - 1 ? "disabled" : ""}>→</button>
      </div>
    </div>
  `;

  $("#backSection1Folders").onclick = () => renderNgheBjtSectionFolders(book, sectionName);

  const box = $("#section1Choices");
  const feedback = $("#section1Feedback");
  const toggleMemoBtn = $("#toggleSection1Memo");
  const memoWrap = $("#section1MemoWrap");
  const toggleScriptBtn = $("#toggleSection1Script");
  const scriptWrap = $("#section1ScriptWrap");
  const prevBtn = $("#prevSection1Exercise");
  const nextBtn = $("#nextSection1Exercise");
  const toggleBookmarkBtn = $("#toggleSection1Bookmark");
  let bookmarked = isBjtCdBookmarked(book, sectionName, entry.orderNo);
  let chosenIndex = -1;

  setCd1BookmarkBtnUI(toggleBookmarkBtn, bookmarked);

  const sectionImg = $("#sectionImage");
  let sectionImgTry = 0;
  if (sectionImg) {
    sectionImg.onerror = () => {
      sectionImgTry += 1;
      if (sectionImgTry < sectionImageSrcCandidates.length) {
        sectionImg.src = sectionImageSrcCandidates[sectionImgTry];
      } else {
        sectionImg.style.display = "none";
      }
    };
  }

  if (!hasMemo) {
    toggleMemoBtn.disabled = true;
  }

  toggleMemoBtn.onclick = () => {
    if (!hasMemo) return;
    const isHidden = memoWrap.style.display === "none";
    memoWrap.style.display = isHidden ? "" : "none";
    toggleMemoBtn.textContent = isHidden ? "Ẩn memo" : "Hiện memo";
  };

  if (toggleScriptBtn && scriptWrap) {
    toggleScriptBtn.onclick = () => {
      const isHidden = scriptWrap.style.display === "none";
      scriptWrap.style.display = isHidden ? "" : "none";
      toggleScriptBtn.textContent = isHidden ? "Ẩn script" : "Hiện script";
    };
  }

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
      if (safeIndex > 0) renderNgheBjtSectionExercise(book, sectionName, entries, safeIndex - 1);
    };
  }
  if (nextBtn) {
    nextBtn.onclick = () => {
      if (safeIndex < total - 1) renderNgheBjtSectionExercise(book, sectionName, entries, safeIndex + 1);
    };
  }
  if (toggleBookmarkBtn) {
    toggleBookmarkBtn.onclick = () => {
      bookmarked = !bookmarked;
      setBjtCdBookmarked(book, sectionName, entry.orderNo, bookmarked);
      setCd1BookmarkBtnUI(toggleBookmarkBtn, bookmarked);
    };
  }
}


