const STORAGE_KEY = "mama-care-app-v1";
const SECURE_META_KEY = "mama-care-secure-meta-v2";
const SECURE_DATA_KEY = "mama-care-secure-data-v2";
const REMEMBER_DB_NAME = "mama-care-remembered-session-v1";
const REMEMBER_STORE_NAME = "keys";
const REMEMBER_KEY_ID = "family-key";
const DATA_SALT = "cuidados-mama-family-key-v2";
const PBKDF2_ITERATIONS = 310000;

const initialState = {
  settings: {
    caregiverName: "",
    defaultRate: 12,
    syncUrl: "./api/sync",
    syncToken: "",
  },
  appointments: [],
  careEntries: [],
  medications: [],
};

let state = cloneInitialState();
let familyKey = null;

const formatter = new Intl.DateTimeFormat("es-ES", {
  weekday: "short",
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const money = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
});

const ids = {
  tabs: document.querySelectorAll(".tab"),
  panels: document.querySelectorAll(".panel"),
  appointmentForm: document.querySelector("#appointmentForm"),
  appointmentId: document.querySelector("#appointmentId"),
  appointmentDate: document.querySelector("#appointmentDate"),
  appointmentTime: document.querySelector("#appointmentTime"),
  appointmentAmbulanceTime: document.querySelector("#appointmentAmbulanceTime"),
  appointmentSpecialty: document.querySelector("#appointmentSpecialty"),
  appointmentPlace: document.querySelector("#appointmentPlace"),
  appointmentNotes: document.querySelector("#appointmentNotes"),
  appointmentList: document.querySelector("#appointmentList"),
  appointmentFilter: document.querySelector("#appointmentFilter"),
  clearAppointmentForm: document.querySelector("#clearAppointmentForm"),
  careForm: document.querySelector("#careForm"),
  careId: document.querySelector("#careId"),
  careDate: document.querySelector("#careDate"),
  careStart: document.querySelector("#careStart"),
  careEnd: document.querySelector("#careEnd"),
  careRate: document.querySelector("#careRate"),
  careNotes: document.querySelector("#careNotes"),
  carePaid: document.querySelector("#carePaid"),
  careList: document.querySelector("#careList"),
  careMonthFilter: document.querySelector("#careMonthFilter"),
  careStatusFilter: document.querySelector("#careStatusFilter"),
  clearCareForm: document.querySelector("#clearCareForm"),
  medicationForm: document.querySelector("#medicationForm"),
  medicationId: document.querySelector("#medicationId"),
  medicationName: document.querySelector("#medicationName"),
  medicationPills: document.querySelector("#medicationPills"),
  medicationMoment: document.querySelector("#medicationMoment"),
  medicationTime: document.querySelector("#medicationTime"),
  medicationNotes: document.querySelector("#medicationNotes"),
  medicationList: document.querySelector("#medicationList"),
  medicationFilter: document.querySelector("#medicationFilter"),
  clearMedicationForm: document.querySelector("#clearMedicationForm"),
  summaryMonth: document.querySelector("#summaryMonth"),
  summaryRows: document.querySelector("#summaryRows"),
  summaryHours: document.querySelector("#summaryHours"),
  summaryTotal: document.querySelector("#summaryTotal"),
  summaryPending: document.querySelector("#summaryPending"),
  nextAppointment: document.querySelector("#nextAppointment"),
  monthHours: document.querySelector("#monthHours"),
  monthTotal: document.querySelector("#monthTotal"),
  settingsForm: document.querySelector("#settingsForm"),
  caregiverName: document.querySelector("#caregiverName"),
  defaultRate: document.querySelector("#defaultRate"),
  exportData: document.querySelector("#exportData"),
  importData: document.querySelector("#importData"),
  printPage: document.querySelector("#printPage"),
  lockApp: document.querySelector("#lockApp"),
  lockScreen: document.querySelector("#lockScreen"),
  unlockForm: document.querySelector("#unlockForm"),
  lockTitle: document.querySelector("#lockTitle"),
  lockText: document.querySelector("#lockText"),
  unlockButton: document.querySelector("#unlockButton"),
  lockHint: document.querySelector("#lockHint"),
  familyPassword: document.querySelector("#familyPassword"),
  lockSyncTokenWrap: document.querySelector("#lockSyncTokenWrap"),
  lockSyncToken: document.querySelector("#lockSyncToken"),
  syncUrl: document.querySelector("#syncUrl"),
  syncToken: document.querySelector("#syncToken"),
  syncNow: document.querySelector("#syncNow"),
  syncStatus: document.querySelector("#syncStatus"),
  emptyTemplate: document.querySelector("#emptyTemplate"),
};

setup();

async function setup() {
  document.body.classList.add("locked");
  setupPasswordToggles();
  registerServiceWorker();
  await setupLockScreen();
}

function setupPasswordToggles() {
  document.querySelectorAll("[data-toggle-password]").forEach((button) => {
    button.addEventListener("click", () => {
      const input = document.querySelector(`#${button.dataset.togglePassword}`);
      if (!input) return;
      const visible = input.type === "text";
      input.type = visible ? "password" : "text";
      button.textContent = visible ? "Ver" : "Ocultar";
      button.setAttribute("aria-label", visible ? "Mostrar caracteres" : "Ocultar caracteres");
    });
  });
}

function setupApp() {
  const today = new Date();
  const currentMonth = toMonthValue(today);
  ids.careMonthFilter.value = currentMonth;
  ids.summaryMonth.value = currentMonth;
  ids.appointmentDate.value = toDateValue(today);
  ids.careDate.value = toDateValue(today);
  ids.careRate.value = state.settings.defaultRate;
  ids.medicationPills.value = "1";
  ids.caregiverName.value = state.settings.caregiverName;
  ids.defaultRate.value = state.settings.defaultRate;
  ids.syncUrl.value = state.settings.syncUrl || "";
  ids.syncToken.value = state.settings.syncToken || "";

  ids.tabs.forEach((tab) => tab.addEventListener("click", () => activateTab(tab.dataset.tab)));
  ids.appointmentForm.addEventListener("submit", saveAppointment);
  ids.careForm.addEventListener("submit", saveCareEntry);
  ids.medicationForm.addEventListener("submit", saveMedication);
  ids.settingsForm.addEventListener("submit", saveSettings);
  ids.clearAppointmentForm.addEventListener("click", resetAppointmentForm);
  ids.clearCareForm.addEventListener("click", resetCareForm);
  ids.clearMedicationForm.addEventListener("click", resetMedicationForm);
  ids.appointmentFilter.addEventListener("change", render);
  ids.careMonthFilter.addEventListener("change", render);
  ids.careStatusFilter.addEventListener("change", render);
  ids.medicationFilter.addEventListener("change", render);
  ids.summaryMonth.addEventListener("change", render);
  ids.exportData.addEventListener("click", exportData);
  ids.importData.addEventListener("change", importData);
  ids.lockApp.addEventListener("click", lockApp);
  ids.syncNow.addEventListener("click", syncNow);
  ids.printPage.addEventListener("click", () => {
    activateTab("monthly");
    window.print();
  });

  render();
  document.body.classList.remove("locked");
  autoSync();
}

async function setupLockScreen() {
  const hasPassword = Boolean(localStorage.getItem(SECURE_META_KEY));
  if (hasPassword) {
    const rememberedKey = await loadRememberedKey();
    if (rememberedKey) {
      try {
        await verifyPassword(rememberedKey);
        familyKey = rememberedKey;
        state = await loadSecureState(familyKey);
        setupApp();
        return;
      } catch {
        await forgetRememberedKey();
        familyKey = null;
      }
    }
  }

  ids.lockTitle.textContent = "Clave familiar";
  ids.lockText.textContent = hasPassword
    ? "Introduce la clave familiar para descifrar los datos de este dispositivo."
    : "Introduce la clave familiar y el código privado para conectar este dispositivo.";
  ids.unlockButton.textContent = "Entrar";
  ids.lockSyncTokenWrap.hidden = hasPassword;
  ids.lockSyncToken.required = !hasPassword;

  ids.unlockForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const password = ids.familyPassword.value;
    const syncToken = ids.lockSyncToken.value.trim();

    if (!window.crypto?.subtle) {
      alert("Este navegador no permite cifrado seguro. Abre la app desde una dirección HTTPS privada.");
      return;
    }

    if (!hasPassword && !syncToken) {
      alert("Introduce el código privado de sincronización.");
      return;
    }

    try {
      familyKey = await deriveKey(password);
      if (hasPassword) {
        await verifyPassword(familyKey);
        state = await loadSecureState(familyKey);
      } else {
        state = await loadSharedStateFromServer(familyKey, syncToken);
        await createPasswordVerifier(familyKey);
        await persist();
        localStorage.removeItem(STORAGE_KEY);
      }
      await rememberKey(familyKey);
      ids.familyPassword.value = "";
      ids.lockSyncToken.value = "";
      setupApp();
    } catch (error) {
      alert(error.message || "No se pudo abrir la app. Revisa la clave familiar.");
    }
  });
}

function activateTab(tabId) {
  ids.tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.tab === tabId));
  ids.panels.forEach((panel) => panel.classList.toggle("active", panel.id === tabId));
}

async function saveAppointment(event) {
  event.preventDefault();
  const entry = {
    id: ids.appointmentId.value || crypto.randomUUID(),
    date: ids.appointmentDate.value,
    time: ids.appointmentTime.value,
    ambulanceTime: ids.appointmentAmbulanceTime.value,
    specialty: ids.appointmentSpecialty.value.trim(),
    place: ids.appointmentPlace.value.trim(),
    notes: ids.appointmentNotes.value.trim(),
    updatedAt: new Date().toISOString(),
  };

  state.appointments = upsert(state.appointments, entry);
  await persist();
  autoSync();
  resetAppointmentForm();
  render();
}

async function saveCareEntry(event) {
  event.preventDefault();
  const entry = {
    id: ids.careId.value || crypto.randomUUID(),
    date: ids.careDate.value,
    start: ids.careStart.value,
    end: ids.careEnd.value,
    rate: Number(ids.careRate.value || 0),
    notes: ids.careNotes.value.trim(),
    paid: ids.carePaid.checked,
    updatedAt: new Date().toISOString(),
  };

  state.careEntries = upsert(state.careEntries, entry);
  await persist();
  autoSync();
  resetCareForm();
  render();
}

async function saveMedication(event) {
  event.preventDefault();
  const existing = state.medications.find((entry) => entry.id === ids.medicationId.value);
  const entry = {
    id: ids.medicationId.value || crypto.randomUUID(),
    name: ids.medicationName.value.trim(),
    pills: Number(ids.medicationPills.value || 0),
    moment: ids.medicationMoment.value,
    time: ids.medicationTime.value,
    notes: ids.medicationNotes.value.trim(),
    startedAt: existing?.startedAt || new Date().toISOString(),
    endedAt: existing?.endedAt || "",
    updatedAt: new Date().toISOString(),
  };

  state.medications = upsert(state.medications, entry);
  await persist();
  autoSync();
  resetMedicationForm();
  render();
}

async function saveSettings(event) {
  event.preventDefault();
  state.settings = {
    caregiverName: ids.caregiverName.value.trim(),
    defaultRate: Number(ids.defaultRate.value || 0),
    syncUrl: ids.syncUrl.value.trim(),
    syncToken: ids.syncToken.value.trim(),
  };
  ids.careRate.value = state.settings.defaultRate;
  await persist();
  render();
  autoSync();
}

function render() {
  renderAppointments();
  renderCareEntries();
  renderMedications();
  renderSummary();
  renderTopSummary();
}

function renderAppointments() {
  const today = startOfDay(new Date());
  const oneYearAgo = addYears(today, -1);
  const filter = ids.appointmentFilter.value;
  let appointments = activeItems(state.appointments).sort((a, b) => appointmentDate(a) - appointmentDate(b));

  if (filter === "upcoming") {
    appointments = appointments.filter((item) => appointmentDate(item) >= today);
  }
  if (filter === "historyYear") {
    appointments = appointments
      .filter((item) => appointmentDate(item) < today && appointmentDate(item) >= oneYearAgo)
      .sort((a, b) => appointmentDate(b) - appointmentDate(a));
  }

  ids.appointmentList.innerHTML = "";
  if (!appointments.length) {
    ids.appointmentList.append(emptyState());
    return;
  }

  appointments.forEach((item) => {
    const node = document.createElement("article");
    node.className = "record";
    const safeId = escapeHtml(item.id);
    node.innerHTML = `
      <div class="record-main">
        <div class="record-title">
          <span>${escapeHtml(item.specialty)}</span>
          <span class="pill">${escapeHtml(formatDate(item.date))} · ${escapeHtml(item.time)}</span>
          ${item.ambulanceTime ? `<span class="pill">Ambulancia ${escapeHtml(item.ambulanceTime)}</span>` : ""}
        </div>
        ${item.place ? `<div class="record-meta">${escapeHtml(item.place)}</div>` : ""}
        ${item.notes ? `<div class="record-notes">${escapeHtml(item.notes)}</div>` : ""}
        ${item.place ? renderMapActions(item.place) : ""}
      </div>
      <div class="record-actions">
        <button class="secondary" type="button" data-action="edit" data-id="${safeId}">Editar</button>
        <button class="danger" type="button" data-action="delete" data-id="${safeId}">Borrar</button>
      </div>
    `;
    node.querySelector('[data-action="edit"]').addEventListener("click", () => editAppointment(item.id));
    node.querySelector('[data-action="delete"]').addEventListener("click", () => deleteAppointment(item.id));
    ids.appointmentList.append(node);
  });
}

function renderMedications() {
  const today = startOfDay(new Date());
  const oneYearAgo = addYears(today, -1);
  const filter = ids.medicationFilter.value;
  let medications = activeItems(state.medications).sort((a, b) => itemTimestamp(b) - itemTimestamp(a));

  if (filter === "active") {
    medications = medications.filter((item) => !item.endedAt);
  }
  if (filter === "historyYear") {
    medications = medications.filter((item) => {
      const date = new Date(item.endedAt || item.updatedAt || item.startedAt);
      return date >= oneYearAgo && date <= new Date();
    });
  }

  ids.medicationList.innerHTML = "";
  if (!medications.length) {
    ids.medicationList.append(emptyState());
    return;
  }

  medications.forEach((item) => {
    const node = document.createElement("article");
    node.className = "record";
    const safeId = escapeHtml(item.id);
    node.innerHTML = `
      <div class="record-main">
        <div class="record-title">
          <span>${escapeHtml(item.name)}</span>
          <span class="pill">${escapeHtml(formatPills(item.pills))}</span>
          <span class="pill">${escapeHtml(formatMedicationMoment(item))}</span>
          ${item.endedAt ? '<span class="pill">Suspendida</span>' : '<span class="pill">Activa</span>'}
        </div>
        ${item.notes ? `<div class="record-notes">${escapeHtml(item.notes)}</div>` : ""}
      </div>
      <div class="record-actions">
        ${
          item.endedAt
            ? ""
            : `<button class="secondary" type="button" data-action="stop" data-id="${safeId}">Suspender</button>`
        }
        <button class="secondary" type="button" data-action="edit" data-id="${safeId}">Editar</button>
        <button class="danger" type="button" data-action="delete" data-id="${safeId}">Borrar</button>
      </div>
    `;
    node.querySelector('[data-action="stop"]')?.addEventListener("click", () => stopMedication(item.id));
    node.querySelector('[data-action="edit"]').addEventListener("click", () => editMedication(item.id));
    node.querySelector('[data-action="delete"]').addEventListener("click", () => deleteMedication(item.id));
    ids.medicationList.append(node);
  });
}

function renderCareEntries() {
  const month = ids.careMonthFilter.value;
  const status = ids.careStatusFilter.value;
  let entries = entriesForMonth(month).sort((a, b) => new Date(a.date) - new Date(b.date));
  if (status === "pending") entries = entries.filter((item) => !item.paid);
  if (status === "paid") entries = entries.filter((item) => item.paid);
  ids.careList.innerHTML = "";

  if (!entries.length) {
    ids.careList.append(emptyState());
    return;
  }

  entries.forEach((item) => {
    const hours = getHours(item);
    const total = hours * item.rate;
    const node = document.createElement("article");
    node.className = "record";
    const safeId = escapeHtml(item.id);
    node.innerHTML = `
      <div class="record-main">
        <div class="record-title">
          <span>${escapeHtml(formatDate(item.date))}</span>
          <span class="pill">${escapeHtml(item.start)} - ${escapeHtml(item.end)}</span>
          <span class="pill">${escapeHtml(formatHours(hours))}</span>
          <span class="pill">${escapeHtml(money.format(total))}</span>
          ${item.paid ? '<span class="pill">Pagado</span>' : '<span class="pill">Pendiente</span>'}
        </div>
        ${item.notes ? `<div class="record-notes">${escapeHtml(item.notes)}</div>` : ""}
      </div>
      <div class="record-actions">
        ${
          item.paid
            ? ""
            : `<button class="primary" type="button" data-action="pay" data-id="${safeId}">Marcar pagado</button>`
        }
        <button class="secondary" type="button" data-action="edit" data-id="${safeId}">Editar</button>
        <button class="danger" type="button" data-action="delete" data-id="${safeId}">Borrar</button>
      </div>
    `;
    node.querySelector('[data-action="pay"]')?.addEventListener("click", () => markCareEntryPaid(item.id));
    node.querySelector('[data-action="edit"]').addEventListener("click", () => editCareEntry(item.id));
    node.querySelector('[data-action="delete"]').addEventListener("click", () => deleteCareEntry(item.id));
    ids.careList.append(node);
  });
}

function renderSummary() {
  const entries = entriesForMonth(ids.summaryMonth.value).sort((a, b) => new Date(a.date) - new Date(b.date));
  const totals = calculateTotals(entries);
  ids.summaryHours.textContent = formatHours(totals.hours);
  ids.summaryTotal.textContent = money.format(totals.total);
  ids.summaryPending.textContent = money.format(totals.pending);
  ids.summaryRows.innerHTML = "";

  if (!entries.length) {
    const row = document.createElement("tr");
    row.innerHTML = '<td colspan="6">No hay horas registradas en este mes.</td>';
    ids.summaryRows.append(row);
    return;
  }

  entries.forEach((entry) => {
    const hours = getHours(entry);
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${escapeHtml(formatDate(entry.date))}</td>
      <td>${escapeHtml(entry.start)} - ${escapeHtml(entry.end)}</td>
      <td>${escapeHtml(formatHours(hours))}</td>
      <td>${escapeHtml(money.format(entry.rate))}</td>
      <td>${escapeHtml(money.format(hours * entry.rate))}</td>
      <td>${entry.paid ? "Pagado" : "Pendiente"}</td>
    `;
    ids.summaryRows.append(row);
  });
}

function renderTopSummary() {
  const today = startOfDay(new Date());
  const next = activeItems(state.appointments)
    .filter((item) => appointmentDate(item) >= today)
    .sort((a, b) => appointmentDate(a) - appointmentDate(b))[0];
  const totals = calculateTotals(entriesForMonth(toMonthValue(new Date())));

  ids.nextAppointment.textContent = next
    ? `${formatDate(next.date)} · ${next.time}${next.ambulanceTime ? ` · Ambulancia ${next.ambulanceTime}` : ""} · ${next.specialty}`
    : "Sin citas";
  ids.monthHours.textContent = formatHours(totals.hours);
  ids.monthTotal.textContent = money.format(totals.pending);
}

function editAppointment(id) {
  const item = state.appointments.find((entry) => entry.id === id);
  if (!item) return;
  ids.appointmentId.value = item.id;
  ids.appointmentDate.value = item.date;
  ids.appointmentTime.value = item.time;
  ids.appointmentAmbulanceTime.value = item.ambulanceTime || "";
  ids.appointmentSpecialty.value = item.specialty;
  ids.appointmentPlace.value = item.place;
  ids.appointmentNotes.value = item.notes;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function editCareEntry(id) {
  const item = state.careEntries.find((entry) => entry.id === id);
  if (!item) return;
  ids.careId.value = item.id;
  ids.careDate.value = item.date;
  ids.careStart.value = item.start;
  ids.careEnd.value = item.end;
  ids.careRate.value = item.rate;
  ids.careNotes.value = item.notes;
  ids.carePaid.checked = item.paid;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function editMedication(id) {
  const item = state.medications.find((entry) => entry.id === id);
  if (!item) return;
  ids.medicationId.value = item.id;
  ids.medicationName.value = item.name;
  ids.medicationPills.value = item.pills;
  ids.medicationMoment.value = item.moment;
  ids.medicationTime.value = item.time || "";
  ids.medicationNotes.value = item.notes;
  activateTab("medication");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function deleteAppointment(id) {
  if (!confirm("¿Borrar esta cita?")) return;
  state.appointments = state.appointments.map((entry) =>
    entry.id === id ? { ...entry, deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() } : entry,
  );
  await persist();
  autoSync();
  render();
}

async function stopMedication(id) {
  state.medications = state.medications.map((entry) =>
    entry.id === id ? { ...entry, endedAt: new Date().toISOString(), updatedAt: new Date().toISOString() } : entry,
  );
  await persist();
  autoSync();
  render();
}

async function deleteMedication(id) {
  if (!confirm("¿Borrar esta medicación?")) return;
  state.medications = state.medications.map((entry) =>
    entry.id === id ? { ...entry, deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() } : entry,
  );
  await persist();
  autoSync();
  render();
}

async function deleteCareEntry(id) {
  if (!confirm("¿Borrar este registro de horas?")) return;
  state.careEntries = state.careEntries.map((entry) =>
    entry.id === id ? { ...entry, deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() } : entry,
  );
  await persist();
  autoSync();
  render();
}

async function markCareEntryPaid(id) {
  state.careEntries = state.careEntries.map((entry) =>
    entry.id === id ? { ...entry, paid: true, updatedAt: new Date().toISOString() } : entry,
  );
  await persist();
  autoSync();
  render();
}

function resetAppointmentForm() {
  ids.appointmentForm.reset();
  ids.appointmentId.value = "";
  ids.appointmentDate.value = toDateValue(new Date());
}

function resetCareForm() {
  ids.careForm.reset();
  ids.careId.value = "";
  ids.careDate.value = toDateValue(new Date());
  ids.careRate.value = state.settings.defaultRate;
}

function resetMedicationForm() {
  ids.medicationForm.reset();
  ids.medicationId.value = "";
  ids.medicationPills.value = "1";
}

function entriesForMonth(month) {
  return activeItems(state.careEntries).filter((entry) => entry.date.startsWith(month));
}

function activeItems(items) {
  return items.filter((entry) => !entry.deletedAt);
}

function calculateTotals(entries) {
  return entries.reduce(
    (acc, entry) => {
      const amount = getHours(entry) * entry.rate;
      acc.hours += getHours(entry);
      acc.total += amount;
      if (!entry.paid) acc.pending += amount;
      return acc;
    },
    { hours: 0, total: 0, pending: 0 },
  );
}

function getHours(entry) {
  const start = minutes(entry.start);
  let end = minutes(entry.end);
  if (end < start) end += 24 * 60;
  return Math.max(0, (end - start) / 60);
}

function minutes(time) {
  const [hours, mins] = time.split(":").map(Number);
  return hours * 60 + mins;
}

function upsert(items, next) {
  const exists = items.some((item) => item.id === next.id);
  return exists ? items.map((item) => (item.id === next.id ? next : item)) : [...items, next];
}

async function persist() {
  if (!familyKey) return;
  const encrypted = await encryptJson(familyKey, state);
  localStorage.setItem(SECURE_DATA_KEY, JSON.stringify(encrypted));
}

function loadLegacyState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return cloneInitialState();
  try {
    return normalizeState(JSON.parse(raw));
  } catch {
    return cloneInitialState();
  }
}

function cloneInitialState() {
  return JSON.parse(JSON.stringify(initialState));
}

async function exportData() {
  const encrypted = await encryptJson(familyKey, state);
  const blob = new Blob([JSON.stringify({ app: "cuidados-mama", version: 2, encrypted }, null, 2)], {
    type: "application/json",
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `cuidados-mama-${toDateValue(new Date())}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function importData(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    importJson(reader.result)
      .then(() => {
        ids.caregiverName.value = state.settings.caregiverName;
        ids.defaultRate.value = state.settings.defaultRate;
        ids.careRate.value = state.settings.defaultRate;
        ids.syncUrl.value = state.settings.syncUrl || "";
        ids.syncToken.value = state.settings.syncToken || "";
        render();
      })
      .catch(() => alert("No se pudo importar el archivo. Revisa que sea el archivo correcto y la clave familiar."))
      .finally(() => {
        event.target.value = "";
      });
  };
  reader.readAsText(file);
}

async function importJson(raw) {
  const imported = JSON.parse(raw);
  if (imported?.encrypted) {
    state = normalizeState(await decryptJson(familyKey, imported.encrypted));
  } else {
    state = normalizeState(imported);
  }
  await persist();
}

function normalizeState(imported) {
  return {
    settings: normalizeSettings(imported.settings || {}),
    appointments: Array.isArray(imported.appointments) ? imported.appointments.map(normalizeAppointment) : [],
    careEntries: Array.isArray(imported.careEntries) ? imported.careEntries.map(normalizeCareEntry) : [],
    medications: Array.isArray(imported.medications) ? imported.medications.map(normalizeMedication) : [],
  };
}

function normalizeSettings(settings) {
  return {
    caregiverName: cleanText(settings.caregiverName, 80),
    defaultRate: settings.defaultRate === undefined ? initialState.settings.defaultRate : cleanNumber(settings.defaultRate),
    syncUrl: cleanText(settings.syncUrl || initialState.settings.syncUrl, 400),
    syncToken: cleanText(settings.syncToken, 300),
  };
}

function normalizeAppointment(item) {
  return {
    id: cleanId(item.id),
    date: cleanDate(item.date),
    time: cleanTime(item.time),
    ambulanceTime: cleanTime(item.ambulanceTime),
    specialty: cleanText(item.specialty, 120),
    place: cleanText(item.place, 180),
    notes: cleanText(item.notes, 1200),
    updatedAt: cleanIsoDate(item.updatedAt),
    deletedAt: cleanIsoDate(item.deletedAt),
  };
}

function normalizeCareEntry(item) {
  return {
    id: cleanId(item.id),
    date: cleanDate(item.date),
    start: cleanTime(item.start),
    end: cleanTime(item.end),
    rate: cleanNumber(item.rate),
    notes: cleanText(item.notes, 1200),
    paid: Boolean(item.paid),
    updatedAt: cleanIsoDate(item.updatedAt),
    deletedAt: cleanIsoDate(item.deletedAt),
  };
}

function normalizeMedication(item) {
  return {
    id: cleanId(item.id),
    name: cleanText(item.name, 140),
    pills: cleanNumber(item.pills),
    moment: cleanMedicationMoment(item.moment),
    time: cleanTime(item.time),
    notes: cleanText(item.notes, 1200),
    startedAt: cleanIsoDate(item.startedAt) || cleanIsoDate(item.updatedAt) || new Date().toISOString(),
    endedAt: cleanIsoDate(item.endedAt),
    updatedAt: cleanIsoDate(item.updatedAt),
    deletedAt: cleanIsoDate(item.deletedAt),
  };
}

function cleanId(value) {
  const id = cleanText(value, 80);
  return id || crypto.randomUUID();
}

function cleanDate(value) {
  const text = cleanText(value, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : toDateValue(new Date());
}

function cleanTime(value) {
  const text = cleanText(value, 5);
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(text) ? text : "";
}

function cleanMedicationMoment(value) {
  return ["desayuno", "mediaManana", "comida", "mediaTarde", "cena", "hora"].includes(value) ? value : "desayuno";
}

function cleanNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function cleanText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function cleanIsoDate(value) {
  const text = cleanText(value, 40);
  return Number.isNaN(Date.parse(text)) ? "" : text;
}

async function deriveKey(password) {
  const material = await crypto.subtle.importKey("raw", textBytes(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: textBytes(DATA_SALT),
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function createPasswordVerifier(key) {
  const verifier = await encryptJson(key, { ok: true, createdAt: new Date().toISOString() });
  localStorage.setItem(SECURE_META_KEY, JSON.stringify({ version: 2, verifier }));
}

async function verifyPassword(key) {
  const meta = JSON.parse(localStorage.getItem(SECURE_META_KEY) || "{}");
  const verified = await decryptJson(key, meta.verifier);
  if (!verified.ok) throw new Error("Invalid verifier");
}

async function loadSecureState(key) {
  const raw = localStorage.getItem(SECURE_DATA_KEY);
  if (!raw) return cloneInitialState();
  return normalizeState(await decryptJson(key, JSON.parse(raw)));
}

async function loadSharedStateFromServer(key, syncToken) {
  const syncUrl = initialState.settings.syncUrl;
  if (location.protocol === "file:") {
    throw new Error(
      "Firefox ha abierto la app como archivo local. Para sincronizar y entrar por primera vez, abre la dirección privada de la app con https:// o desde el servidor instalado.",
    );
  }

  let response;
  try {
    response = await fetch(syncUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${syncToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "pull" }),
      cache: "no-store",
    });
  } catch {
    throw new Error(
      "No se pudo conectar con la sincronización privada. Abre la app desde su dirección HTTPS privada y revisa que el servidor esté activo.",
    );
  }

  if (response.status === 401) {
    throw new Error("El código privado de sincronización no coincide.");
  }
  if (!response.ok) {
    throw new Error(`No se pudo comprobar la clave familiar. El servidor respondió ${response.status}.`);
  }

  const payload = await response.json();
  if (!payload?.encrypted) {
    const firstState = loadLegacyState();
    firstState.settings.syncUrl = syncUrl;
    firstState.settings.syncToken = syncToken;
    return firstState;
  }

  try {
    const sharedState = normalizeState(await decryptJson(key, payload.encrypted));
    sharedState.settings.syncUrl = syncUrl;
    sharedState.settings.syncToken = syncToken;
    return sharedState;
  } catch {
    throw new Error("La clave familiar no coincide con la clave ya creada.");
  }
}

async function encryptJson(key, value) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = textBytes(JSON.stringify(value));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  return {
    alg: "AES-GCM",
    kdf: "PBKDF2-SHA256",
    iterations: PBKDF2_ITERATIONS,
    iv: base64(iv),
    data: base64(new Uint8Array(encrypted)),
    updatedAt: new Date().toISOString(),
  };
}

async function decryptJson(key, payload) {
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(payload.iv) },
    key,
    fromBase64(payload.data),
  );
  return JSON.parse(new TextDecoder().decode(decrypted));
}

async function rememberKey(key) {
  try {
    const db = await openRememberDb();
    await rememberDbRequest(db.transaction(REMEMBER_STORE_NAME, "readwrite").objectStore(REMEMBER_STORE_NAME).put(key, REMEMBER_KEY_ID));
    db.close();
  } catch {
    localStorage.removeItem("mama-care-remembered");
  }
}

async function loadRememberedKey() {
  try {
    const db = await openRememberDb();
    const key = await rememberDbRequest(db.transaction(REMEMBER_STORE_NAME, "readonly").objectStore(REMEMBER_STORE_NAME).get(REMEMBER_KEY_ID));
    db.close();
    return key || null;
  } catch {
    return null;
  }
}

async function forgetRememberedKey() {
  try {
    const db = await openRememberDb();
    await rememberDbRequest(db.transaction(REMEMBER_STORE_NAME, "readwrite").objectStore(REMEMBER_STORE_NAME).delete(REMEMBER_KEY_ID));
    db.close();
  } catch {
    return;
  }
}

function openRememberDb() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("IndexedDB no disponible"));
      return;
    }
    const request = indexedDB.open(REMEMBER_DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(REMEMBER_STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function rememberDbRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function syncNow() {
  const syncUrl = state.settings.syncUrl;
  const syncToken = state.settings.syncToken;
  if (!syncUrl || !syncToken) {
    ids.syncStatus.textContent = "Sincronización privada no configurada.";
    return;
  }
  if (location.protocol === "file:") {
    ids.syncStatus.textContent =
      "No se puede sincronizar si la app está abierta como archivo local. Abre la dirección HTTPS privada de la app.";
    return;
  }

  try {
    ids.syncStatus.textContent = "Sincronizando...";
    const remote = await fetch(syncUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${syncToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "pull" }),
      cache: "no-store",
    });

    if (remote.status === 401) {
      ids.syncStatus.textContent = "No se pudo sincronizar: el código privado no coincide o falta configurar SYNC_TOKEN_HASH en Easypanel.";
      return;
    }
    if (!remote.ok) {
      ids.syncStatus.textContent = `No se pudo sincronizar: el servidor respondió ${remote.status}.`;
      return;
    }

    if (remote.ok) {
      const payload = await remote.json();
      if (payload?.encrypted) {
        let remoteState;
        try {
          remoteState = normalizeState(await decryptJson(familyKey, payload.encrypted));
        } catch {
          ids.syncStatus.textContent =
            "No se pudo sincronizar: los datos del servidor no se pueden abrir con esta clave familiar.";
          return;
        }
        state = mergeStates(state, remoteState);
        await persist();
      }
    }

    const encrypted = await encryptJson(familyKey, state);
    const pushed = await fetch(syncUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${syncToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "push", app: "cuidados-mama", version: 2, encrypted }),
    });

    if (pushed.status === 401) {
      ids.syncStatus.textContent = "No se pudo sincronizar: el código privado no coincide o falta configurar SYNC_TOKEN_HASH en Easypanel.";
      return;
    }
    if (pushed.status === 409) {
      const conflict = await pushed.json();
      if (conflict?.current?.encrypted) {
        let conflictState;
        try {
          conflictState = normalizeState(await decryptJson(familyKey, conflict.current.encrypted));
        } catch {
          ids.syncStatus.textContent =
            "No se pudo sincronizar: los datos del servidor no se pueden abrir con esta clave familiar.";
          return;
        }
        state = mergeStates(state, conflictState);
        await persist();
        const retryEncrypted = await encryptJson(familyKey, state);
        const retry = await fetch(syncUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${syncToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ action: "push", app: "cuidados-mama", version: 2, encrypted: retryEncrypted }),
        });
        if (!retry.ok) {
          ids.syncStatus.textContent = `No se pudo sincronizar: el servidor respondió ${retry.status}.`;
          return;
        }
      }
    }
    if (!pushed.ok && pushed.status !== 409) {
      ids.syncStatus.textContent = `No se pudo sincronizar: el servidor respondió ${pushed.status}.`;
      return;
    }

    ids.syncStatus.textContent = `Sincronizado: ${new Date().toLocaleString("es-ES")}`;
    render();
  } catch (error) {
    ids.syncStatus.textContent = `No se pudo sincronizar: ${error.message || "fallo de conexión"}.`;
  }
}

function autoSync() {
  if (!state.settings.syncUrl || !state.settings.syncToken) return;
  window.setTimeout(syncNow, 200);
}

function localUpdatedAt() {
  try {
    return JSON.parse(localStorage.getItem(SECURE_DATA_KEY) || "{}").updatedAt || "1970-01-01T00:00:00.000Z";
  } catch {
    return "1970-01-01T00:00:00.000Z";
  }
}

function mergeStates(localState, remoteState) {
  return normalizeState({
    settings: {
      ...remoteState.settings,
      ...localState.settings,
      syncUrl: localState.settings.syncUrl || remoteState.settings.syncUrl,
      syncToken: localState.settings.syncToken || remoteState.settings.syncToken,
    },
    appointments: mergeById(localState.appointments, remoteState.appointments),
    careEntries: mergeById(localState.careEntries, remoteState.careEntries),
    medications: mergeById(localState.medications, remoteState.medications),
  });
}

function mergeById(localItems, remoteItems) {
  const merged = new Map();
  [...remoteItems, ...localItems].forEach((item) => {
    const previous = merged.get(item.id);
    if (!previous || itemTimestamp(item) >= itemTimestamp(previous)) {
      merged.set(item.id, item);
    }
  });
  return [...merged.values()];
}

function itemTimestamp(item) {
  return Date.parse(item.updatedAt || item.deletedAt || "1970-01-01T00:00:00.000Z") || 0;
}

async function lockApp() {
  await forgetRememberedKey();
  familyKey = null;
  window.location.reload();
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  if (!window.isSecureContext && location.protocol !== "http:") return;
  navigator.serviceWorker.register("./service-worker.js").catch(() => {});
}

function textBytes(value) {
  return new TextEncoder().encode(value);
}

function base64(bytes) {
  return btoa(String.fromCharCode(...bytes));
}

function fromBase64(value) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

function appointmentDate(item) {
  return new Date(`${item.date}T${item.time || "00:00"}`);
}

function startOfDay(date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addYears(date, years) {
  const next = new Date(date);
  next.setFullYear(next.getFullYear() + years);
  return next;
}

function toDateValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toMonthValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function formatDate(value) {
  return formatter.format(new Date(`${value}T12:00:00`));
}

function formatHours(value) {
  return `${value.toLocaleString("es-ES", { minimumFractionDigits: value % 1 ? 2 : 0, maximumFractionDigits: 2 })} h`;
}

function formatPills(value) {
  return `${value.toLocaleString("es-ES", { maximumFractionDigits: 2 })} ${value === 1 ? "pastilla" : "pastillas"}`;
}

function formatMedicationMoment(item) {
  const labels = {
    desayuno: "Desayuno",
    mediaManana: "Media mañana",
    comida: "Comida",
    mediaTarde: "Media tarde",
    cena: "Cena",
    hora: "Hora concreta",
  };
  return item.time ? `${labels[item.moment] || "Hora"} · ${item.time}` : labels[item.moment] || "Desayuno";
}

function renderMapActions(place) {
  const destination = encodeURIComponent(place);
  const searchUrl = `https://www.google.com/maps/search/?api=1&query=${destination}`;
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`;
  return `
    <div class="map-card">
      <div>
        <strong>Mapa y ruta</strong>
        <span>${escapeHtml(place)}</span>
      </div>
      <div class="map-actions">
        <a class="secondary button-link" href="${searchUrl}" target="_blank" rel="noopener noreferrer">Ver en Maps</a>
        <a class="primary button-link" href="${directionsUrl}" target="_blank" rel="noopener noreferrer">Cómo llegar</a>
      </div>
    </div>
  `;
}

function emptyState() {
  return ids.emptyTemplate.content.firstElementChild.cloneNode(true);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
