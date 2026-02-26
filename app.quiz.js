function renderLevels(mode) {
  state.mode = mode;
  const levels = ["N5", "N4", "N3", "N2", "N1"].filter((lv) => state.config[mode]?.[lv]);

  view.innerHTML = `
    <div class="card">
      <h1 class="h1">${mode === "vocab" ? "Từ vựng" : "Chữ Hán"} - chọn cấp</h1>
      <div class="grid grid2" id="levels"></div>
      <div class="row">
        <button class="btnSmall" id="backHome">←</button>
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
        <h1 class="h1">${mode === "vocab" ? "Từ vựng" : "Chữ Hán"} - ${level}</h1>
        <button class="btnSmall" id="backLevels">←</button>
      </div>
      <p class="sub">Chọn phần chơi</p>
      <div class="grid" id="parts"></div>
      <div class="row">
        <button class="btnSmall" id="backLevels2">←</button>
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

    wrap.querySelector(".btnPart").onclick = () => {
      if (String(file || "").toLowerCase() === "all.json") {
        showResumePopupForAllIfNeeded(mode, level);
        return;
      }
      startGame(mode, level, file);
    };

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

function isValidResumeOrder(order, total) {
  if (!Array.isArray(order) || order.length !== total) return false;
  const seen = new Set();
  for (const n of order) {
    if (!Number.isInteger(n) || n < 0 || n >= total || seen.has(n)) return false;
    seen.add(n);
  }
  return seen.size === total;
}

function saveCurrentQuizInProgress() {
  if (!state.accountId) return;
  if (!shouldTrackQuizInProgress(state.mode, state.partFile)) return;
  if (!Array.isArray(state.order) || state.order.length === 0) return;
  if (!Number.isInteger(state.idx) || state.idx < 0 || state.idx >= state.order.length) return;

  setInProgressSession(state.accountId, {
    mode: state.mode,
    level: state.level,
    partFile: state.partFile,
    idx: state.idx,
    order: state.order
  });
}

function clearCurrentQuizInProgress() {
  if (!state.accountId) return;
  setInProgressSession(state.accountId, null);
}

function showResumePopupForAllIfNeeded(mode, level) {
  const resume = getInProgressSession(state.accountId);
  if (!resume || resume.mode !== mode || resume.level !== level || String(resume.partFile || "").toLowerCase() !== "all.json") {
    startGame(mode, level, "all.json");
    return;
  }
  if (!Number.isInteger(resume.idx) || resume.idx <= 0) {
    startGame(mode, level, "all.json", resume);
    return;
  }

  const overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.inset = "0";
  overlay.style.background = "rgba(0,0,0,0.45)";
  overlay.style.display = "flex";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.padding = "16px";
  overlay.style.zIndex = "9999";

  const card = document.createElement("div");
  card.className = "card";
  card.style.maxWidth = "420px";
  card.style.width = "100%";
  card.innerHTML = `
    <h2 class="h1" style="margin-bottom:8px;">Bạn đang học dở</h2>
    <p class="sub" style="margin-bottom:14px;">${resume.mode === "vocab" ? "Từ vựng" : "Chữ Hán"} / ${resume.level} / ${partFileToLabel("all.json", resume.mode)}</p>
    <div class="row">
      <button class="btnSmall" id="resumeRestart">Học lại từ đầu</button>
      <button class="btnSmall" id="resumeContinue">Học tiếp</button>
    </div>
  `;
  overlay.appendChild(card);
  document.body.appendChild(overlay);

  card.querySelector("#resumeRestart").onclick = () => {
    overlay.remove();
    clearCurrentQuizInProgress();
    startGame(mode, level, "all.json");
  };

  card.querySelector("#resumeContinue").onclick = () => {
    overlay.remove();
    startGame(mode, level, "all.json", resume);
  };
}

async function startGame(mode, level, partFile, resumeSession = null) {
  if (!shouldTrackQuizInProgress(mode, partFile)) {
    clearCurrentQuizInProgress();
  }
  state.mode = mode;
  state.level = level;
  state.partFile = partFile;
  state.idx = 0;
  state.locked = false;

  const path = `${DATA_BASE_URL}/${mode}/${level}/${partFile}`;
  const items = await loadJSON(path);

  state.questions = items;
  const canResumeThisSession =
    resumeSession &&
    resumeSession.mode === mode &&
    resumeSession.level === level &&
    String(resumeSession.partFile || "").toLowerCase() === String(partFile || "").toLowerCase() &&
    isValidResumeOrder(resumeSession.order, items.length) &&
    Number.isInteger(resumeSession.idx) &&
    resumeSession.idx >= 0 &&
    resumeSession.idx < items.length;

  if (canResumeThisSession) {
    state.order = resumeSession.order.slice();
    state.idx = resumeSession.idx;
  } else {
    state.order = shuffle([...Array(items.length).keys()]);
    state.idx = 0;
  }
  saveCurrentQuizInProgress();
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
          : `<button class="btnSmall" id="backList">←</button>`
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
        clearCurrentQuizInProgress();
        setDone(state.mode, state.level, state.partFile, true);
        renderFinish();
      } else {
        saveCurrentQuizInProgress();
        renderQuestion();
      }
    }, state.mode === "kanji" ? 1000 : 2000);
  } else {
    renderQuestion({ ok: false, chosenIndex, correctIndex });
  }
}

function renderFinish() {
  const nextPartFile = getNextPartFile(state.mode, state.level, state.partFile);

  view.innerHTML = `
    <div class="card">
      <h1 class="h1">Đã hoàn thành phần!</h1>
      <p class="sub">${state.mode === "vocab" ? "Từ vựng" : "Chữ Hán"} / ${state.level} / ${partFileToLabel(state.partFile, state.mode)}</p>
      <div class="row">
        <button class="btnSmall" id="toList">Về danh sách phần</button>
        <button class="btnSmall" id="nextPart" ${nextPartFile ? "" : "disabled"}>→</button>
      </div>
    </div>
  `;

  $("#toList").onclick = () => renderParts(state.mode, state.level);
  const nextBtn = $("#nextPart");
  if (nextBtn && nextPartFile) {
    nextBtn.onclick = () => startGame(state.mode, state.level, nextPartFile);
  }
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function decodeBasicHtmlEntities(s) {
  return String(s ?? "")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&#039;/gi, "'")
    .replace(/&#(\d+);/g, (_, num) => {
      const code = Number(num);
      return Number.isFinite(code) ? String.fromCharCode(code) : _;
    });
}

function normalizeDisplayText(s) {
  return decodeBasicHtmlEntities(String(s ?? ""))
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/\\r\\n|\\n|\\r/g, "\n")
    .replace(/\r\n|\r/g, "\n")
    .replace(/\/n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function formatMultilineText(s) {
  const escaped = escapeHtml(normalizeDisplayText(s));
  return escaped.replace(/\n/g, "<br>");
}

function formatHtmlTextContent(s) {
  return formatMultilineText(String(s ?? ""));
}


