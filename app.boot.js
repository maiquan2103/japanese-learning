// ===== Boot =====
(async function boot() {
  state.config = await loadJSON("config.json");
  state.accountId = localStorage.getItem(STORAGE_KEY_ACCOUNT);

  if (state.accountId) {
    await syncAccountProgress(state.accountId);
    updateTopbar(true);
    renderHome();
  } else {
    updateTopbar(false);
    renderLogin();
  }
})();

