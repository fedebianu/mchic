const API_BASE = resolveApiBase();
const API_URL = `${API_BASE}/api/songs`;
const RESET_URL = `${API_BASE}/api/reset`;
const LOGIN_KEY = "mchic-auth-token";
const VOICE_LABELS = { lucio: "Lucio", cristiano: "Cristiano" };
const INSTRUMENT_LABELS = { chitarra: "Chitarra", basso: "Basso" };

const state = {
  songs: [],
  filterTerm: "",
  isLoading: true,
  errorMessage: "",
  editingId: null,
  editingTitle: "",
  authToken: restoreToken(),
  hasInitialized: false,
};

const mainElement = document.querySelector("main");
const mobileFormMedia =
  typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia("(max-width: 720px)") : null;

const elements = {
  songCount: document.getElementById("song-count"),
  voiceCount: document.getElementById("voice-count"),
  tableBody: document.getElementById("song-table-body"),
  form: document.getElementById("song-form"),
  submitBtn: document.getElementById("submit-btn"),
  cancelEditBtn: document.getElementById("cancel-edit-btn"),
  editBanner: document.getElementById("edit-banner"),
  reset: document.getElementById("reset-btn"),
  filter: document.getElementById("filter-input"),
  tonalityButtons: Array.from(document.querySelectorAll(".tonality-btn")),
  mobileFormOpen: document.getElementById("mobile-form-open"),
  mobileFormClose: document.getElementById("mobile-form-close"),
  loginGate: document.getElementById("login-gate"),
  loginForm: document.getElementById("login-form"),
  loginUser: document.getElementById("login-user"),
  loginPass: document.getElementById("login-pass"),
  loginError: document.getElementById("login-error"),
  authorInput: document.getElementById("author-input"),
  titleInput: document.getElementById("title-input"),
  keyInput: document.getElementById("key-input"),
  voiceInputs: Array.from(document.querySelectorAll('input[name="voices"]')),
  extraInstrumentInputs: Array.from(document.querySelectorAll('input[name="extra-instrument"]')),
};

if (elements.loginForm) {
  elements.loginForm.addEventListener("submit", handleLoginSubmit);
}

if (mobileFormMedia) {
  const listener = (event) => handleMobileViewportChange(event);
  if (typeof mobileFormMedia.addEventListener === "function") {
    mobileFormMedia.addEventListener("change", listener);
  } else if (typeof mobileFormMedia.addListener === "function") {
    mobileFormMedia.addListener(listener);
  }
}

document.addEventListener("keydown", handleGlobalKeydown);

if (state.authToken) {
  hideLoginGate();
  initApp();
} else {
  showLoginGate();
}

function initApp() {
  if (state.hasInitialized) {
    return;
  }
  state.hasInitialized = true;
  wireEvents();
  render();
  refreshSongs();
}

function resolveApiBase() {
  const origin = window.location.origin;
  if (origin && origin.startsWith("http") && origin !== "null") {
    return origin;
  }
  return "http://localhost:4000";
}

async function refreshSongs() {
  state.isLoading = true;
  state.errorMessage = "";
  render();
  try {
    const data = await safeFetch(API_URL);
    state.songs = Array.isArray(data) ? data : [];
  } catch (error) {
    if (error.status === 401) {
      state.errorMessage = "";
      state.isLoading = false;
      render();
      return;
    }
    state.errorMessage = error.message || "Impossibile contattare il server. Avvia `npm run dev`.";
  } finally {
    state.isLoading = false;
    render();
  }
}

function render() {
  renderCounters();
  renderTable();
  updateFormMode();
}

function renderCounters() {
  if (elements.songCount) {
    elements.songCount.textContent = state.songs.length.toString();
  }

  if (elements.voiceCount) {
    const uniqueVoices = new Set();
    state.songs.forEach((song) => {
      (song.voices ?? []).forEach((voice) => uniqueVoices.add(voice));
    });
    elements.voiceCount.textContent = uniqueVoices.size.toString();
  }
}

function renderTable() {
  elements.tableBody.innerHTML = "";

  if (state.isLoading) {
    elements.tableBody.appendChild(buildMessageRow("Carico la scaletta..."));
    return;
  }

  if (state.errorMessage) {
    elements.tableBody.appendChild(buildMessageRow(state.errorMessage, true));
    return;
  }

  const filtered = getFilteredSongs().sort(sortSongs);
  if (!filtered.length) {
    const message = state.songs.length ? "Nessun brano corrisponde al filtro." : "La lista è vuota: aggiungi il primo brano per iniziare.";
    elements.tableBody.appendChild(buildMessageRow(message));
    return;
  }

  filtered.forEach((song) => {
    elements.tableBody.appendChild(createRow(song));
  });
}

function buildMessageRow(text, isError = false) {
  const tr = document.createElement("tr");
  const td = document.createElement("td");
  td.colSpan = 6;
  td.className = `table-message${isError ? " table-message--error" : ""}`;
  td.textContent = text;
  tr.appendChild(td);
  return tr;
}

function createRow(song) {
  const tr = document.createElement("tr");

  const authorCell = document.createElement("td");
  authorCell.textContent = song.author || "—";
  authorCell.dataset.label = "Autore";

  const titleCell = document.createElement("td");
  titleCell.textContent = song.title;
  titleCell.dataset.label = "Titolo";

  const voiceCell = document.createElement("td");
  voiceCell.textContent = formatVoices(song.voices);
  voiceCell.dataset.label = "Voci";

  const instrumentsCell = document.createElement("td");
  instrumentsCell.textContent = formatInstruments(song.instruments);
  instrumentsCell.dataset.label = "Strumenti";

  const keyCell = document.createElement("td");
  keyCell.textContent = formatKeyOffset(song.keyOffset);
  keyCell.dataset.label = "Tonalità";

  const actionsCell = document.createElement("td");
  actionsCell.dataset.label = "Azioni";
  const actions = document.createElement("div");
  actions.className = "table-actions";

  const editBtn = document.createElement("button");
  editBtn.type = "button";
  editBtn.className = "table-btn btn-edit";
  editBtn.dataset.editId = song.id;
  editBtn.textContent = "Modifica";
  editBtn.setAttribute("aria-label", `Modifica ${song.title}`);

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "table-btn btn-delete";
  deleteBtn.dataset.deleteId = song.id;
  deleteBtn.textContent = "Elimina";
  deleteBtn.setAttribute("aria-label", `Rimuovi ${song.title}`);

  actions.append(editBtn, deleteBtn);
  actionsCell.appendChild(actions);

  tr.append(authorCell, titleCell, voiceCell, instrumentsCell, keyCell, actionsCell);
  return tr;
}

function formatVoices(value) {
  const list = normalizeToArray(value);
  if (!list.length) {
    return "—";
  }
  return list.map((key) => VOICE_LABELS[key] ?? capitalize(key)).join(", ");
}

function formatInstruments(value) {
  const list = normalizeToArray(value);
  if (!list.length) {
    return "—";
  }
  const counts = list.reduce((acc, item) => {
    const key = item?.toLowerCase();
    if (!key) {
      return acc;
    }
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  return Object.entries(counts)
    .map(([key, count]) => {
      const label = INSTRUMENT_LABELS[key] ?? capitalize(key);
      return count > 1 ? `${label} ×${count}` : label;
    })
    .join(", ");
}

function formatKeyOffset(value) {
  const number = Number(value) || 0;
  if (!number) {
    return "0 st";
  }
  const formatted = Number.isInteger(number) ? number : number.toString();
  return `${number > 0 ? "+" : ""}${formatted} st`;
}

function wireEvents() {
  elements.form.addEventListener("submit", handleSubmit);
  if (elements.reset) {
    elements.reset.addEventListener("click", handleReset);
  }
  elements.cancelEditBtn.addEventListener("click", exitEditMode);
  elements.tableBody.addEventListener("click", handleTableClick);
  elements.filter.addEventListener("input", handleFilter);
  elements.tonalityButtons.forEach((btn) => btn.addEventListener("click", handleTonalityStep));
  elements.mobileFormOpen?.addEventListener("click", openMobileForm);
  elements.mobileFormClose?.addEventListener("click", () => closeMobileForm());
}

async function handleSubmit(event) {
  event.preventDefault();
  const author = sanitize(elements.authorInput.value);
  const title = sanitize(elements.titleInput.value);
  const voices = getSelectedVoices();
  const instruments = buildInstrumentList();
  const keyOffset = Number(elements.keyInput.value || 0);
  const payload = { author, title, voices, instruments, keyOffset };

  if (!author) {
    alert("Inserisci l'autore.");
    return;
  }

  if (!title) {
    alert("Inserisci il titolo del brano.");
    return;
  }

  if (!voices.length) {
    alert("Seleziona almeno una voce (Lucio e/o Cristiano).");
    return;
  }

  try {
    const url = state.editingId ? `${API_URL}/${state.editingId}` : API_URL;
    const method = state.editingId ? "PUT" : "POST";
    await safeFetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    exitEditMode();
    elements.titleInput.focus();
    await refreshSongs();
    if (isMobileViewport()) {
      closeMobileForm({ skipFocus: true });
    }
  } catch (error) {
    state.errorMessage = error.message;
    render();
  }
}

async function handleReset() {
  const confirmed = window.confirm("Vuoi davvero ripristinare la scaletta originale? Perderai le modifiche.");
  if (!confirmed) {
    return;
  }
  try {
    await safeFetch(RESET_URL, { method: "POST" });
    exitEditMode();
    await refreshSongs();
  } catch (error) {
    state.errorMessage = error.message;
    render();
  }
}

function handleTableClick(event) {
  const editBtn = event.target.closest("[data-edit-id]");
  if (editBtn) {
    const song = state.songs.find((item) => item.id === editBtn.dataset.editId);
    if (song) {
      enterEditMode(song);
    }
    return;
  }

  const deleteBtn = event.target.closest("[data-delete-id]");
  if (deleteBtn) {
    deleteSong(deleteBtn.dataset.deleteId);
  }
}

async function deleteSong(id) {
  if (!id) {
    return;
  }
  try {
    await safeFetch(`${API_URL}/${id}`, { method: "DELETE" });
    if (state.editingId === id) {
      exitEditMode();
    }
    await refreshSongs();
  } catch (error) {
    state.errorMessage = error.message;
    render();
  }
}

function handleFilter(event) {
  state.filterTerm = event.target.value.toLowerCase();
  renderTable();
}

function handleTonalityStep(event) {
  const step = Number(event.currentTarget.dataset.step);
  if (!Number.isFinite(step)) {
    return;
  }
  const current = Number(elements.keyInput.value || 0);
  const next = Math.round((current + step) * 100) / 100;
  const sanitized = Math.abs(next) === 0 ? 0 : next;
  const text = Number.isInteger(sanitized) ? sanitized.toString() : sanitized.toString().replace(/(\.\d)0$/, "$1");
  elements.keyInput.value = text;
}

function getFilteredSongs() {
  if (!state.filterTerm.trim()) {
    return [...state.songs];
  }
  return state.songs.filter((song) => {
    const haystack = `${song.author || ""} ${song.title} ${formatVoices(song.voices)} ${formatInstruments(
      song.instruments
    )} ${formatKeyOffset(song.keyOffset)}`.toLowerCase();
    return haystack.includes(state.filterTerm);
  });
}

function sortSongs(a, b) {
  const authorA = (a.author || "").trim().toLowerCase();
  const authorB = (b.author || "").trim().toLowerCase();
  if (authorA && authorB && authorA !== authorB) {
    return authorA.localeCompare(authorB, "it", { sensitivity: "base" });
  }
  if (!authorA && authorB) {
    return 1;
  }
  if (authorA && !authorB) {
    return -1;
  }
  return (a.title || "").localeCompare(b.title || "", "it", {
    sensitivity: "base",
  });
}

function buildInstrumentList() {
  const instruments = ["chitarra"];
  const extra = elements.extraInstrumentInputs.find((input) => input.checked)?.value;
  if (extra && extra !== "nessuno") {
    instruments.push(extra);
  }
  return instruments;
}

function getSelectedVoices() {
  return elements.voiceInputs.filter((input) => input.checked).map((input) => input.value);
}

function enterEditMode(song) {
  state.editingId = song.id;
  state.editingTitle = song.title;
  elements.authorInput.value = song.author ?? "";
  elements.titleInput.value = song.title;
  elements.keyInput.value = (Number(song.keyOffset) || 0).toString();
  applyVoices(normalizeToArray(song.voices ?? song.voice));
  applyInstrumentInputs(normalizeToArray(song.instruments));
  updateFormMode();
  elements.titleInput.focus();
  if (isMobileViewport()) {
    openMobileForm();
  }
}

function exitEditMode() {
  state.editingId = null;
  state.editingTitle = "";
  resetFormFields();
  updateFormMode();
}

function resetFormFields() {
  elements.form.reset();
  if (elements.authorInput) {
    elements.authorInput.value = "";
  }
  elements.extraInstrumentInputs.forEach((input, index) => {
    input.checked = index === 0; // default to "nessuno" if present
  });
  elements.keyInput.value = "0";
}

function applyVoices(list) {
  const values = new Set(list);
  let hasChecked = false;
  elements.voiceInputs.forEach((input) => {
    const shouldCheck = values.has(input.value);
    input.checked = shouldCheck;
    if (shouldCheck) {
      hasChecked = true;
    }
  });
  if (!hasChecked && elements.voiceInputs.length) {
    elements.voiceInputs[0].checked = true;
  }
}

function applyInstrumentInputs(list) {
  const counts = list.reduce((acc, instrument) => {
    const key = instrument?.toLowerCase();
    if (!key) {
      return acc;
    }
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  const extraValue = (counts.chitarra ?? 0) > 1 ? "chitarra" : (counts.basso ?? 0) > 0 ? "basso" : "nessuno";

  elements.extraInstrumentInputs.forEach((input) => {
    input.checked = input.value === extraValue;
  });
}

function updateFormMode() {
  if (!elements.submitBtn) {
    return;
  }
  const isEditing = Boolean(state.editingId);
  elements.submitBtn.textContent = isEditing ? "Salva modifiche" : "Aggiungi brano";

  if (elements.cancelEditBtn) {
    elements.cancelEditBtn.classList.toggle("is-hidden", !isEditing);
  }

  if (elements.editBanner) {
    elements.editBanner.classList.toggle("is-hidden", !isEditing);
    elements.editBanner.textContent = isEditing ? `Stai modificando: ${state.editingTitle}` : "";
  }
}

function normalizeToArray(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function sanitize(value) {
  return value?.trim() ?? "";
}

function restoreToken() {
  try {
    return sessionStorage.getItem(LOGIN_KEY);
  } catch {
    return null;
  }
}

function showLoginGate(message) {
  if (message && elements.loginError) {
    elements.loginError.textContent = message;
    elements.loginError.classList.remove("is-hidden");
  } else {
    elements.loginError?.classList.add("is-hidden");
  }
  elements.loginGate?.classList.remove("is-hidden");
  mainElement?.setAttribute("aria-hidden", "true");
}

function hideLoginGate() {
  elements.loginGate?.classList.add("is-hidden");
  elements.loginError?.classList.add("is-hidden");
  mainElement?.setAttribute("aria-hidden", "false");
}

async function handleLoginSubmit(event) {
  event.preventDefault();
  const user = sanitize(elements.loginUser.value);
  const pass = elements.loginPass.value;
  if (!user || !pass) {
    elements.loginError.textContent = "Inserisci user e password.";
    elements.loginError.classList.remove("is-hidden");
    return;
  }
  try {
    const response = await fetch(`${API_BASE}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user, pass }),
    });
    if (!response.ok) {
      throw new Error("Credenziali errate.");
    }
    const token = `Basic ${btoa(`${user}:${pass}`)}`;
    state.authToken = token;
    try {
      sessionStorage.setItem(LOGIN_KEY, token);
    } catch {
      // ignore storage errors
    }
    hideLoginGate();
    if (!state.hasInitialized) {
      initApp();
    } else {
      refreshSongs();
    }
  } catch (error) {
    elements.loginError.textContent = error.message || "Accesso negato.";
    elements.loginError.classList.remove("is-hidden");
  }
}

function forceLogout(message) {
  state.authToken = null;
  try {
    sessionStorage.removeItem(LOGIN_KEY);
  } catch {
    // ignore
  }
  showLoginGate(message || "Sessione scaduta, accedi di nuovo.");
}

function capitalize(value) {
  if (typeof value !== "string" || !value.length) {
    return value;
  }
  return value.charAt(0).toUpperCase() + value.slice(1);
}

async function safeFetch(url, options = {}) {
  if (!state.authToken) {
    throw new Error("Sessione non autenticata.");
  }
  const headers = new Headers(options.headers || {});
  headers.set("Authorization", state.authToken);
  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    let message = `Errore ${response.status}`;
    try {
      const payload = await response.json();
      if (payload?.message) {
        message = payload.message;
      }
    } catch {
      // best effort
    }
    if (response.status === 401) {
      forceLogout(message);
    }
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  if (response.status === 204) {
    return null;
  }
  return response.json();
}

function openMobileForm() {
  if (!isMobileViewport()) {
    return;
  }
  document.body.classList.add("is-mobile-form-open");
  elements.mobileFormOpen?.setAttribute("aria-expanded", "true");
  elements.authorInput?.focus();
}

function closeMobileForm(options = {}) {
  const { skipFocus = false } = options;
  document.body.classList.remove("is-mobile-form-open");
  elements.mobileFormOpen?.setAttribute("aria-expanded", "false");
  if (!skipFocus && isMobileViewport()) {
    elements.mobileFormOpen?.focus();
  }
}

function isMobileViewport() {
  return mobileFormMedia?.matches ?? false;
}

function handleMobileViewportChange(event) {
  if (!event.matches) {
    closeMobileForm({ skipFocus: true });
  }
}

function handleGlobalKeydown(event) {
  if (event.key === "Escape" && document.body.classList.contains("is-mobile-form-open")) {
    closeMobileForm();
  }
}
