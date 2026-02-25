function renderPmpHome() {
  if (!canAccessPmp()) {
    renderHome();
    return;
  }

  view.innerHTML = `
    <div class="card">
      <div class="cardTitleRow pmpTitleRow">
        <h1 class="h1">PMP</h1>
        <button class="btnSmall" id="backFromPmp">←</button>
      </div>
      <div class="grid grid2" id="pmpFolderList"></div>
    </div>
  `;

  $("#backFromPmp").onclick = () => renderHome();
  const box = $("#pmpFolderList");
  PMP_FOLDERS.forEach((folder) => {
    const btn = document.createElement("button");
    btn.className = "btn btnBjtCd btnPmpFolder";
    btn.textContent = folder.label;
    btn.onclick = () => renderPmpFolder(folder);
    box.appendChild(btn);
  });
}

function renderPmpFolder(folder) {
  if (!canAccessPmp()) {
    renderHome();
    return;
  }

  view.innerHTML = `
    <div class="card">
      <div class="cardTitleRow pmpTitleRow">
        <h1 class="h1">${folder.label}</h1>
        <button class="btnSmall" id="backPmpFolders">←</button>
      </div>
      <div class="grid grid2" id="pmpChildFolderList"></div>
    </div>
  `;

  $("#backPmpFolders").onclick = () => renderPmpHome();
  const box = $("#pmpChildFolderList");
  const children = Array.isArray(folder.children) ? folder.children : [];
  children.forEach((child) => {
    const btn = document.createElement("button");
    btn.className = "btn btnBjtCd btnPmpFolder";
    btn.textContent = child.label;
    btn.onclick = () => renderPmpChildFolder(folder, child);
    box.appendChild(btn);
  });
}

function renderPmpChildFolder(parentFolder, childFolder) {
  if (!canAccessPmp()) {
    renderHome();
    return;
  }

  const nestedChildren = Array.isArray(childFolder.children) ? childFolder.children : [];
  view.innerHTML = `
    <div class="card">
      <div class="cardTitleRow pmpTitleRow">
        <h1 class="h1">${childFolder.label}</h1>
        <button class="btnSmall" id="backToPmpParent">←</button>
      </div>
      <div class="grid grid2" id="pmpNestedChildList"></div>
    </div>
  `;

  $("#backToPmpParent").onclick = () => renderPmpFolder(parentFolder);
  const box = $("#pmpNestedChildList");
  nestedChildren.forEach((nested) => {
    const btn = document.createElement("button");
    btn.className = "btn btnBjtCd btnPmpFolder";
    btn.textContent = nested.label;
    btn.onclick = () => renderPmpLeafFolder(childFolder, nested);
    box.appendChild(btn);
  });
}

function renderPmpLeafFolder(parentFolder, leafFolder) {
  if (!canAccessPmp()) {
    renderHome();
    return;
  }

  if (leafFolder.id === "test-a") {
    renderPmpTestAList(parentFolder, leafFolder);
    return;
  }

  view.innerHTML = `
    <div class="card">
      <div class="cardTitleRow pmpTitleRow">
      <h1 class="h1">${leafFolder.label}</h1>
        <button class="btnSmall" id="backToPmpChild">←</button>
      </div>
    </div>
  `;

  $("#backToPmpChild").onclick = () => {
    const rootFolder = PMP_FOLDERS.find((folder) =>
      (Array.isArray(folder.children) ? folder.children : []).some((child) => child.id === parentFolder.id)
    );
    if (rootFolder) {
      renderPmpChildFolder(rootFolder, parentFolder);
      return;
    }
    renderPmpHome();
  };
}

function getPmpRootByChildId(childId) {
  return PMP_FOLDERS.find((folder) =>
    (Array.isArray(folder.children) ? folder.children : []).some((child) => child.id === childId)
  ) || null;
}

function toLooseKey(s) {
  return String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function getByLooseKey(obj, keys) {
  if (!obj || typeof obj !== "object") return undefined;
  const entries = Object.entries(obj);

  for (const key of keys) {
    const target = toLooseKey(key);
    for (const [rawKey, value] of entries) {
      if (toLooseKey(rawKey) === target) return value;
    }
  }

  return undefined;
}

function valueToText(v) {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v).trim();
  if (typeof v === "object") {
    const nested = getByLooseKey(v, ["content", "text", "value", "name", "title", "label", "en", "vn"]);
    if (nested != null) return valueToText(nested);
  }
  return "";
}

function pickFirstNonEmptyLoose(item, keys) {
  const exact = pickFirstNonEmpty(item, keys);
  if (exact) return exact;

  const looseValue = getByLooseKey(item, keys);
  const looseText = valueToText(looseValue);
  if (looseText) return looseText;

  return "";
}

function getPmpRows(raw) {
  if (Array.isArray(raw)) return raw;

  const preferred = getByLooseKey(raw, [
    "items",
    "data",
    "questions",
    "questionList",
    "list",
    "rows",
    "records"
  ]);
  if (Array.isArray(preferred)) return preferred;

  if (raw && typeof raw === "object") {
    for (const value of Object.values(raw)) {
      if (Array.isArray(value)) return value;
    }
  }

  return Object.values(raw || {});
}

function findLargestObjectArrayDeep(value) {
  let best = null;

  function walk(node) {
    if (Array.isArray(node)) {
      const objectItems = node.filter((x) => x && typeof x === "object" && !Array.isArray(x));
      if (objectItems.length) {
        if (!best || objectItems.length > best.length) best = objectItems;
      }
      node.forEach(walk);
      return;
    }

    if (node && typeof node === "object") {
      Object.values(node).forEach(walk);
    }
  }

  walk(value);
  return best;
}

function findByKeyIncludesDeep(value, keyParts) {
  const targets = (keyParts || []).map((x) => toLooseKey(x));
  let found;

  function walk(node) {
    if (found != null) return;
    if (!node || typeof node !== "object") return;

    for (const [k, v] of Object.entries(node)) {
      const lk = toLooseKey(k);
      if (targets.some((t) => lk.includes(t))) {
        const text = valueToText(v);
        if (text) {
          found = text;
          return;
        }
      }
    }

    for (const child of Object.values(node)) {
      if (child && typeof child === "object") walk(child);
      if (found != null) return;
    }
  }

  walk(value);
  return found || "";
}

function collectObjectNodesDeep(value, limit = 300) {
  const out = [];

  function walk(node) {
    if (out.length >= limit) return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (node && typeof node === "object") {
      out.push(node);
      Object.values(node).forEach(walk);
    }
  }

  walk(value);
  return out;
}

function collectStringValuesDeep(value, limit = 20) {
  const out = [];

  function walk(node) {
    if (out.length >= limit) return;
    if (node == null) return;
    if (typeof node === "string" || typeof node === "number" || typeof node === "boolean") {
      const s = String(node).trim();
      if (s) out.push(s);
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (typeof node === "object") {
      Object.values(node).forEach(walk);
    }
  }

  walk(value);
  return out;
}

function normalizePmpOptionArrayFromAnyArray(arr) {
  if (!Array.isArray(arr)) return [];
  const normalized = arr.map((opt, idx) => normalizePmpOption(opt, idx)).filter((x) => x.text);
  if (normalized.length >= 4) return normalized.slice(0, 4);
  return [];
}

function findOptionsDeep(item) {
  const fromDirect = normalizePmpOptions(item);
  if (fromDirect.length >= 4) return fromDirect.slice(0, 4);

  let found = [];

  function walk(node) {
    if (found.length >= 4) return;

    if (Array.isArray(node)) {
      const mapped = normalizePmpOptionArrayFromAnyArray(node);
      if (mapped.length >= 4) {
        found = mapped.slice(0, 4);
        return;
      }
      node.forEach(walk);
      return;
    }

    if (node && typeof node === "object") {
      const a = getByLooseKey(node, ["a", "A", "optionA", "answerA", "choiceA"]);
      const b = getByLooseKey(node, ["b", "B", "optionB", "answerB", "choiceB"]);
      const c = getByLooseKey(node, ["c", "C", "optionC", "answerC", "choiceC"]);
      const d = getByLooseKey(node, ["d", "D", "optionD", "answerD", "choiceD"]);
      const abcd = [a, b, c, d].map((x, idx) => normalizePmpOption(x, idx)).filter((x) => x.text);
      if (abcd.length === 4) {
        found = abcd;
        return;
      }

      Object.values(node).forEach(walk);
    }
  }

  walk(item);
  if (found.length >= 4) return found.slice(0, 4);

  const fallback = fromDirect.filter((x) => x.text);
  while (fallback.length < 4) fallback.push({ text: `Option ${fallback.length + 1}`, vn: "" });
  return fallback.slice(0, 4);
}

function normalizePmpOption(item, idx) {
  if (item == null) return { text: "", vn: "" };

  if (typeof item === "string" || typeof item === "number" || typeof item === "boolean") {
    return { text: String(item), vn: "" };
  }

  if (typeof item === "object") {
    return {
      text: pickFirstNonEmptyLoose(item, [
        "optionContent", "content", "text", "option", "answer",
        "questionContent", "value"
      ]),
      vn: pickFirstNonEmptyLoose(item, [
        "optionContent_vn", "content_vn", "text_vn", "vn", "translation", "answer_vn"
      ])
    };
  }

  return { text: `Option ${idx + 1}`, vn: "" };
}

function normalizePmpOptions(item) {
  const exactQuestionOptions = [1, 2, 3, 4].map((n) => ({
    text: pickFirstNonEmptyLoose(item, [`questionOption${n}`]),
    vn: pickFirstNonEmptyLoose(item, [`questionOption${n}_vn`])
  }));
  if (exactQuestionOptions.every((x) => x.text)) {
    return exactQuestionOptions;
  }

  const listLike = getByLooseKey(item, [
    "options", "choices", "answers", "answer_list", "candidates", "optionList", "choiceList"
  ]);

  if (Array.isArray(listLike)) {
    return listLike.slice(0, 4).map((opt, idx) => normalizePmpOption(opt, idx));
  }

  if (listLike && typeof listLike === "object") {
    const fromObj = ["A", "B", "C", "D"].map((k, idx) => {
      const v = listLike[k] ?? listLike[k.toLowerCase()] ?? getByLooseKey(listLike, [`option${k}`, `answer${k}`]);
      return normalizePmpOption(v, idx);
    }).filter((x) => x.text);
    if (fromObj.length === 4) return fromObj;
  }

  const byABCD = ["A", "B", "C", "D"].map((ch, idx) => ({
    text: pickFirstNonEmptyLoose(item, [
      `option${ch}`,
      `answer${ch}`,
      `choice${ch}`,
      ch.toLowerCase()
    ]),
    vn: pickFirstNonEmptyLoose(item, [
      `option${ch}_vn`,
      `answer${ch}_vn`,
      `choice${ch}_vn`,
      `${ch.toLowerCase()}_vn`
    ])
  }));

  const byIndex = [1, 2, 3, 4].map((n) => ({
    text: pickFirstNonEmptyLoose(item, [
      `option${n}`,
      `answer${n}`,
      `choice${n}`,
      `option_${n}`,
      `answer_${n}`
    ]),
    vn: pickFirstNonEmptyLoose(item, [
      `option${n}_vn`,
      `answer${n}_vn`,
      `choice${n}_vn`,
      `option_${n}_vn`,
      `answer_${n}_vn`
    ])
  }));

  const picked = byABCD.some((x) => x.text) ? byABCD : byIndex;
  return picked.filter((x) => x.text).slice(0, 4);
}

function normalizePmpTestAEntries(raw) {
  const rows = getPmpRows(raw);
  const deepRows = findLargestObjectArrayDeep(raw);
  const usingRows = Array.isArray(deepRows) && deepRows.length > (rows?.length || 0) ? deepRows : rows;

  const normalized = (usingRows || [])
    .filter((x) => x && typeof x === "object")
    .map((item, idx) => {
      const options = findOptionsDeep(item);
      const optionTexts = options.map((x) => x.text);
      const correctIndex = resolveCd1CorrectIndex(
        getByLooseKey(item, [
          "questionResult",
          "correct", "answer", "exac", "exact", "correctAnswer", "rightAnswer", "correct_option", "right_option"
        ]),
        optionTexts
      );

      return {
        number: parseCdNumber(
          getByLooseKey(item, [
            "questionNo", "questionNumber", "no", "id", "index", "stt", "number"
          ])
        ) ?? (idx + 1),
        areaName: pickFirstNonEmptyLoose(item, ["areaName", "area_name", "area", "knowledgeArea"])
          || findByKeyIncludesDeep(item, ["area", "knowledge"]),
        groupName: pickFirstNonEmptyLoose(item, ["groupName", "group_name", "group", "processGroup"])
          || findByKeyIncludesDeep(item, ["group", "process"]),
        questionContent: pickFirstNonEmptyLoose(item, [
          "questionContent", "question", "content", "questionText", "problem"
        ]) || findByKeyIncludesDeep(item, ["question", "problem", "content"]),
        questionContentVn: pickFirstNonEmptyLoose(item, [
          "questionContent_vn", "question_vn", "content_vn", "questionText_vn", "vn", "translation"
        ]),
        options,
        rationale: pickFirstNonEmptyLoose(item, ["rationale", "explanation", "reason", "note", "memo"]),
        whyWrong: getByLooseKey(item, ["why_wrong", "whyWrong", "wrongReason"]) ?? "",
        correctIndex
      };
    })
    .filter((x) => x.questionContent || x.options.length === 4)
    .sort((a, b) => a.number - b.number);

  if (normalized.length) return normalized.slice(0, PMP_TESTA_MAX_QUESTIONS);

  const fallbackObjects = collectObjectNodesDeep(raw, 500);
  const fallbackEntries = fallbackObjects
    .map((item, idx) => {
      const areaName = findByKeyIncludesDeep(item, ["area", "knowledge"]);
      const groupName = findByKeyIncludesDeep(item, ["group", "process"]);
      const questionContent = findByKeyIncludesDeep(item, ["question", "problem", "content"]);
      const strings = collectStringValuesDeep(item, 40);
      const optionTextCandidates = strings.filter((s) => s !== questionContent && s !== areaName && s !== groupName);
      const options = optionTextCandidates.slice(0, 4).map((text) => ({ text, vn: "" }));
      while (options.length < 4) options.push({ text: `Option ${options.length + 1}`, vn: "" });

      return {
        number: idx + 1,
        areaName,
        groupName,
        questionContent: questionContent || `Question ${idx + 1}`,
        questionContentVn: "",
        options: options.slice(0, 4),
        rationale: findByKeyIncludesDeep(item, ["rationale", "explain", "reason", "memo"]),
        whyWrong: findByKeyIncludesDeep(item, ["whywrong", "wrong", "incorrect"]),
        correctIndex: -1
      };
    })
    .filter((x) => x.questionContent)
    .slice(0, PMP_TESTA_MAX_QUESTIONS);

  return fallbackEntries;
}

function formatPmpWhyWrong(value) {
  if (value == null || value === "") return "Chua co why_wrong.";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return formatMultilineText(String(value));
  }
  if (Array.isArray(value)) {
    return value.map((x, idx) => `${idx + 1}. ${formatMultilineText(String(x ?? ""))}`).join("<br>");
  }
  if (typeof value === "object") {
    return Object.entries(value)
      .map(([k, v]) => `<strong>${escapeHtml(k)}:</strong> ${formatMultilineText(String(v ?? ""))}`)
      .join("<br>");
  }
  return formatMultilineText(String(value));
}

async function loadPmpTestAQuestions() {
  if (Array.isArray(state.pmpTestAQuestions) && state.pmpTestAQuestions.length) {
    return state.pmpTestAQuestions;
  }

  const raw = await loadJSON(PMP_TESTA_DATA_URL);
  const entries = normalizePmpTestAEntries(raw);
  state.pmpTestAQuestions = entries.length ? entries : null;
  return entries;
}

function getPmpBookmarkSectionId(parentFolder, leafFolder) {
  return `pmp:${parentFolder?.id || "root"}:${leafFolder?.id || "test-a"}`;
}

function getPmpBookmarkOrderNo(entry, fallbackIndex) {
  const n = Number(entry?.number);
  if (Number.isFinite(n) && n > 0) return n;
  return (Number(fallbackIndex) || 0) + 1;
}

async function renderPmpTestAList(parentFolder, leafFolder) {
  if (!canAccessPmp()) {
    renderHome();
    return;
  }

  view.innerHTML = `
    <div class="card">
      <div class="cardTitleRow">
        <h1 class="h1">${leafFolder.label}</h1>
        <button class="btnSmall" id="backToPmpChild">←</button>
      </div>
      <p class="sub">Dang tai du lieu 45 cau hoi...</p>
      <div class="grid grid2" id="pmpTestAList"></div>
    </div>
  `;

  $("#backToPmpChild").onclick = () => {
    const rootFolder = getPmpRootByChildId(parentFolder.id);
    if (rootFolder) {
      renderPmpChildFolder(rootFolder, parentFolder);
      return;
    }
    renderPmpHome();
  };

  const box = $("#pmpTestAList");
  try {
    const entries = await loadPmpTestAQuestions();
    document.querySelector(".sub").textContent = entries.length
      ? `Hien thi ${entries.length} cau hoi.`
      : "Khong co du lieu cau hoi hop le.";

    const bookmarkSection = getPmpBookmarkSectionId(parentFolder, leafFolder);
    entries.forEach((entry, idx) => {
      const orderNo = getPmpBookmarkOrderNo(entry, idx);
      const row = document.createElement("div");
      row.className = "cd1FolderRow";

      const btn = document.createElement("button");
      btn.className = "btn btnBjtFolderItem";
      btn.textContent = `Câu ${entry.number || (idx + 1)}`;
      btn.onclick = () => renderPmpTestAQuestion(parentFolder, leafFolder, entries, idx);

      const starBtn = document.createElement("button");
      starBtn.className = "btnSmall btnBookmark";
      let bookmarked = isBjtCdBookmarked("pmp", bookmarkSection, orderNo);
      setCd1BookmarkBtnUI(starBtn, bookmarked);
      starBtn.onclick = () => {
        bookmarked = !bookmarked;
        setBjtCdBookmarked("pmp", bookmarkSection, orderNo, bookmarked);
        setCd1BookmarkBtnUI(starBtn, bookmarked);
      };

      row.appendChild(btn);
      row.appendChild(starBtn);
      box.appendChild(row);
    });
  } catch (_) {
    document.querySelector(".sub").textContent = "Khong tai duoc du lieu TestA.json.";
  }
}

function renderPmpTestAQuestion(parentFolder, leafFolder, entries, currentIndex) {
  if (!canAccessPmp()) {
    renderHome();
    return;
  }

  const total = Array.isArray(entries) ? entries.length : 0;
  const safeIndex = Math.min(Math.max(Number(currentIndex) || 0, 0), Math.max(total - 1, 0));
  const entry = total ? entries[safeIndex] : null;
  if (!entry) {
    renderPmpTestAList(parentFolder, leafFolder);
    return;
  }
  const orderNo = getPmpBookmarkOrderNo(entry, safeIndex);
  const bookmarkSection = getPmpBookmarkSectionId(parentFolder, leafFolder);

  view.innerHTML = `
    <div class="card">
      <div class="cardTitleRow">
        <h1 class="h1">Câu ${entry.number || (safeIndex + 1)}</h1>
        <div class="cardTitleActions">
          <button class="btnSmall" id="backToTestAList">←</button>
          <button class="btnSmall btnBookmark" id="togglePmpBookmark" aria-pressed="false">☆</button>
        </div>
      </div>

      <div class="cd1ScriptWrap pmpHiddenBlock">
        <strong>groupName:</strong> ${formatMultilineText(entry.groupName || "Chua co groupName.")}
      </div>

      <div class="sectionQuestionBox">
        <div class="sectionQuestionLabel">Question</div>
        <div class="pmpQuestionLine">
          <div class="sectionQuestionText">
            ${formatMultilineText(entry.questionContent)}
            <button type="button" class="pmpInlineTinyBtn" id="toggleQuestionVnBtn">Dịch</button>
            <span id="questionVnInline" class="pmpInlineVn" style="display:none;">${formatMultilineText(entry.questionContentVn || "Chua co questionContent_vn.")}</span>
          </div>
        </div>
      </div>

      <div class="grid" id="pmpOptionList"></div>
      <div id="pmpAnswerFeedback"></div>
      <div class="row">
        <button class="btnSmall" id="toggleExplainBtn">Giải thích</button>
      </div>
      <div id="pmpExplainWrap" class="cd1ScriptWrap pmpHiddenBlock" style="display:none;">
        <div><strong>rationale:</strong> ${formatMultilineText(entry.rationale || "Chua co rationale.")}</div>
        <div style="margin-top:8px;"><strong>why_wrong:</strong><br>${formatPmpWhyWrong(entry.whyWrong)}</div>
      </div>

      <div class="row" style="margin-top:12px; justify-content:space-between; gap:8px;">
        <button class="btnSmall" id="prevPmpQuestion" ${safeIndex <= 0 ? "disabled" : ""}>←</button>
        <button class="btnSmall" id="nextPmpQuestion" ${safeIndex >= total - 1 ? "disabled" : ""}>→</button>
      </div>
    </div>
  `;

  $("#backToTestAList").onclick = () => renderPmpTestAList(parentFolder, leafFolder);
  const bookmarkBtn = $("#togglePmpBookmark");
  let bookmarked = isBjtCdBookmarked("pmp", bookmarkSection, orderNo);
  setCd1BookmarkBtnUI(bookmarkBtn, bookmarked);
  if (bookmarkBtn) {
    bookmarkBtn.onclick = () => {
      bookmarked = !bookmarked;
      setBjtCdBookmarked("pmp", bookmarkSection, orderNo, bookmarked);
      setCd1BookmarkBtnUI(bookmarkBtn, bookmarked);
    };
  }

  const questionVnInline = $("#questionVnInline");
  const explainWrap = $("#pmpExplainWrap");

  $("#toggleQuestionVnBtn").onclick = () => {
    const hidden = questionVnInline.style.display === "none";
    questionVnInline.style.display = hidden ? "" : "none";
  };
  $("#toggleExplainBtn").onclick = () => {
    const hidden = explainWrap.style.display === "none";
    explainWrap.style.display = hidden ? "" : "none";
  };

  const optionList = $("#pmpOptionList");
  const feedback = $("#pmpAnswerFeedback");
  let chosenIndex = -1;
  const optionButtons = [];

  function updateOptionUI() {
    optionButtons.forEach((btn, idx) => {
      btn.classList.remove("choiceCorrect", "choiceWrong");
      if (chosenIndex < 0) return;

      const ok = chosenIndex === entry.correctIndex;
      if (ok) {
        if (idx === chosenIndex) btn.classList.add("choiceCorrect");
        return;
      }

      if (idx === chosenIndex) btn.classList.add("choiceWrong");
      if (idx === entry.correctIndex) btn.classList.add("choiceCorrect");
    });
  }

  entry.options.forEach((opt, idx) => {
    const row = document.createElement("div");
    row.className = "pmpOptionRow";

    const optionBtn = document.createElement("button");
    optionBtn.className = "btn pmpOptionBtn";
    optionBtn.innerHTML = `
      <div class="choiceLine2">
        <strong>${idx + 1}.</strong> ${formatMultilineText(opt.text || "")}
        <button type="button" class="pmpInlineTinyBtn">Dịch</button>
        <span class="pmpInlineVn" style="display:none;">${formatMultilineText(opt.vn || "Chua co ban dich.")}</span>
      </div>
    `;
    optionBtn.onclick = () => {
      chosenIndex = idx;
      updateOptionUI();

      const correctText = entry.options[entry.correctIndex]?.text || `Lựa chọn ${entry.correctIndex + 1}`;
      if (entry.correctIndex < 0) {
        feedback.innerHTML = `
          <div class="feedback ng">
            <div class="choiceLine1">Không xác định được đáp án đúng.</div>
          </div>
        `;
        return;
      }

      if (chosenIndex === entry.correctIndex) {
        feedback.innerHTML = `
          <div class="feedback ok">
            <div class="choiceLine1">Chính xác!</div>
            <div class="choiceLine2">Đáp án đúng: ${formatMultilineText(correctText)}</div>
          </div>
        `;
      } else {
        feedback.innerHTML = `
          <div class="feedback ng">
            <div class="choiceLine1">Sai rồi.</div>
            <div class="choiceLine2">Đáp án đúng: ${formatMultilineText(correctText)}</div>
          </div>
        `;
      }
    };

    const inlineBtn = optionBtn.querySelector(".pmpInlineTinyBtn");
    const inlineVn = optionBtn.querySelector(".pmpInlineVn");
    if (inlineBtn && inlineVn) {
      inlineBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const hidden = inlineVn.style.display === "none";
        inlineVn.style.display = hidden ? "" : "none";
      };
    }

    row.appendChild(optionBtn);
    optionList.appendChild(row);
    optionButtons.push(optionBtn);
  });

  const prevBtn = $("#prevPmpQuestion");
  const nextBtn = $("#nextPmpQuestion");
  if (prevBtn) {
    prevBtn.onclick = () => {
      if (safeIndex > 0) renderPmpTestAQuestion(parentFolder, leafFolder, entries, safeIndex - 1);
    };
  }
  if (nextBtn) {
    nextBtn.onclick = () => {
      if (safeIndex < total - 1) renderPmpTestAQuestion(parentFolder, leafFolder, entries, safeIndex + 1);
    };
  }
}


