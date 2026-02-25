const STORAGE_KEY_ACCOUNT = "kanji-quiz:currentAccount";
const STORAGE_KEY_BJT_CD_BOOKMARK = "kanji-quiz:bjt-cd:bookmark";
const PROGRESS_API_BASE_URL = String(globalThis.__PROGRESS_API_BASE_URL || "").trim().replace(/\/+$/, "");
const PROGRESS_API_PATH = PROGRESS_API_BASE_URL ? `${PROGRESS_API_BASE_URL}/api/progress` : "/api/progress";
const SYNC_DEBOUNCE_MS = 800;
const DATA_BASE_URL = "https://raw.githubusercontent.com/maiquan2103/Japanese-file/refs/heads/master";
const BJT_STUDY_BASE_PATH = `${DATA_BASE_URL}/bjt-study`;
const CD_ANSWER_FALLBACK_FILES = ["list.json", "answers.json", "answer.json", "data.json"];
const PMP_OWNER_ACCOUNT = "maiquan";
const PMP_TESTA_DATA_URL = `${DATA_BASE_URL}/PMP/Knowledge%20areas/Project%20Integration%20Management/TestA.json`;
const PMP_TESTA_MAX_QUESTIONS = 45;
const PMP_FOLDERS = [
  {
    id: "according-to-the-knowledge-areas",
    label: "Knowledge areas",
    children: [
      {
        id: "project-integration-management",
        label: "Project Integration Management",
        children: [
          {
            id: "test-a",
            label: "TestA"
          },
          {
            id: "test-b",
            label: "TestB"
          }
        ]
      }
    ]
  }
];
