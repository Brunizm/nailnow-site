import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  query,
  where,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDvMxPKyw7M70fvj-YLwzudfIaquohkDIA",
  authDomain: "nailnow-site.firebaseapp.com",
  projectId: "nailnow-site",
  storageBucket: "nailnow-site.appspot.com",
  messagingSenderId: "145591976960",
  appId: "1:145591976960:web:957f13cd9d61acdfda4dde",
};

const SESSION_KEY = "nailnowManicureSession";
const PROFILE_COLLECTIONS = ["profissionais"];

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const loginForm = document.getElementById("login-form");
const statusEl = document.getElementById("login-status");
const submitButton = loginForm.querySelector("button[type='submit']");
const resetButton = document.getElementById("reset-password");
const loginView = document.getElementById("login-view");
const dashboard = document.getElementById("dashboard");
const signOutButton = document.getElementById("sign-out");
const profileNameElements = document.querySelectorAll("[data-profile-name]");
const profileDisplay = document.getElementById("profile-display");
const profileEmail = document.getElementById("profile-email");
const profileSpecialties = document.getElementById("profile-specialties");
const profileArea = document.getElementById("profile-area");
const metricPending = document.getElementById("metric-pending");
const metricConfirmed = document.getElementById("metric-confirmed");
const metricPast = document.getElementById("metric-past");
const badgePending = document.getElementById("badge-pending");
const badgeConfirmed = document.getElementById("badge-confirmed");
const badgePast = document.getElementById("badge-past");
const pendingList = document.getElementById("pending-list");
const confirmedList = document.getElementById("confirmed-list");
const pastList = document.getElementById("past-list");

const defaultAppointmentData = {
  pending: [
    {
      id: "SOL-1842",
      client: "Bianca Lopes",
      service: "Alongamento em fibra de vidro",
      date: "2025-05-08",
      time: "14:00",
      location: "Pinheiros, São Paulo",
      price: "R$ 180,00",
      note: "Prefere acabamento natural e formato amendoado.",
    },
    {
      id: "SOL-1853",
      client: "Thais Camargo",
      service: "Spa das mãos + esmaltação gel",
      date: "2025-05-09",
      time: "09:30",
      location: "Brooklin, São Paulo",
      price: "R$ 140,00",
      note: "Levar paleta de tons nudes.",
    },
  ],
  confirmed: [
    {
      id: "AGEN-1027",
      client: "Larissa Monteiro",
      service: "Blindagem + esmaltação",
      date: "2025-05-06",
      time: "18:30",
      location: "Vila Mariana, São Paulo",
      price: "R$ 165,00",
      note: "Cliente indicou preferência por glitter rosé.",
    },
    {
      id: "AGEN-1028",
      client: "Amanda Reis",
      service: "Pedicure + spa relaxante",
      date: "2025-05-07",
      time: "10:00",
      location: "Moema, São Paulo",
      price: "R$ 120,00",
      note: "Chegar 10 min antes para montagem do espaço.",
    },
  ],
  past: [
    {
      id: "HIST-980",
      client: "Nathalia Cruz",
      service: "Esmaltação em gel",
      date: "2025-04-29",
      time: "16:30",
      location: "Itaim Bibi, São Paulo",
      price: "R$ 110,00",
      note: "Avaliação 5 estrelas enviada.",
    },
    {
      id: "HIST-975",
      client: "Juliana Prado",
      service: "Alongamento em fibra",
      date: "2025-04-25",
      time: "11:00",
      location: "Tatuapé, São Paulo",
      price: "R$ 190,00",
      note: "Cliente agendou manutenção para daqui 3 semanas.",
    },
  ],
};

const appointmentCollections = {
  pending: "solicitacoes",
  confirmed: "confirmados",
  past: "historico",
};

const setStatus = (message, type = "") => {
  statusEl.textContent = message;
  statusEl.classList.remove("auth-status--error", "auth-status--success");
  statusEl.hidden = !message;
  if (type) {
    statusEl.classList.add(`auth-status--${type}`);
  }
};

const setLoading = (isLoading) => {
  submitButton.disabled = isLoading;
  submitButton.textContent = isLoading ? "Entrando..." : "Entrar";
};

const toggleView = (isLoggedIn) => {
  loginView.hidden = isLoggedIn;
  dashboard.hidden = !isLoggedIn;
};

const resetDashboard = () => {
  pendingList.innerHTML = "";
  confirmedList.innerHTML = "";
  pastList.innerHTML = "";
  updateMetrics([], [], []);
};

const formatCurrency = (value) => {
  if (typeof value === "number") {
    return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }
  if (!value) return "—";
  return value;
};

const parseDateValue = (rawDate, rawTime) => {
  if (!rawDate && !rawTime) return null;
  if (rawDate instanceof Timestamp) {
    return rawDate.toDate();
  }
  if (rawDate && typeof rawDate.toDate === "function") {
    return rawDate.toDate();
  }
  if (typeof rawDate === "string" && rawDate.includes("T")) {
    return new Date(rawDate);
  }
  if (typeof rawDate === "string") {
    return new Date(`${rawDate}T${rawTime || "00:00"}`);
  }
  if (rawTime instanceof Timestamp) {
    return rawTime.toDate();
  }
  return null;
};

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  weekday: "short",
});

const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
});

const createAppointmentCard = (appointment, status) => {
  const wrapper = document.createElement("article");
  wrapper.className = `schedule-card schedule-card--${status}`;
  wrapper.setAttribute("role", "listitem");

  const heading = document.createElement("header");
  heading.className = "schedule-card__header";
  heading.innerHTML = `
    <div>
      <p class="schedule-card__service">${appointment.service}</p>
      <h3 class="schedule-card__client">${appointment.client}</h3>
    </div>
    <span class="schedule-card__id">${appointment.id}</span>
  `;
  wrapper.appendChild(heading);

  const details = document.createElement("div");
  details.className = "schedule-card__details";

  const eventDate = parseDateValue(appointment.date, appointment.time);
  const formattedDate = eventDate ? dateFormatter.format(eventDate) : appointment.date || "—";
  const formattedTime = eventDate ? timeFormatter.format(eventDate) : appointment.time || "—";

  details.innerHTML = `
    <dl>
      <div>
        <dt>Data</dt>
        <dd>${formattedDate}</dd>
      </div>
      <div>
        <dt>Horário</dt>
        <dd>${formattedTime}</dd>
      </div>
      <div>
        <dt>Local</dt>
        <dd>${appointment.location || "A combinar"}</dd>
      </div>
      <div>
        <dt>Valor</dt>
        <dd>${formatCurrency(appointment.price)}</dd>
      </div>
    </dl>
  `;

  if (appointment.note) {
    const note = document.createElement("p");
    note.className = "schedule-card__note";
    note.textContent = appointment.note;
    details.appendChild(note);
  }

  wrapper.appendChild(details);

  return wrapper;
};

const renderAppointments = (status, appointments, options = {}) => {
  const mapping = {
    pending: pendingList,
    confirmed: confirmedList,
    past: pastList,
  };
  const target = mapping[status];
  target.innerHTML = "";

  if (options.notice) {
    const notice = document.createElement("p");
    notice.className = "schedule-empty";
    notice.textContent = options.notice;
    target.appendChild(notice);
  }

  if (!appointments.length) {
    const empty = document.createElement("p");
    empty.className = "schedule-empty";
    empty.textContent = "Nenhum agendamento disponível no momento.";
    target.appendChild(empty);
    return;
  }

  appointments.forEach((appointment) => {
    target.appendChild(createAppointmentCard(appointment, status));
  });
};

const updateMetrics = (pending, confirmed, past) => {
  metricPending.textContent = pending.length;
  badgePending.textContent = pending.length;
  metricConfirmed.textContent = confirmed.length;
  badgeConfirmed.textContent = confirmed.length;
  metricPast.textContent = past.length;
  badgePast.textContent = past.length;
};

const buildLookupCandidates = (rawEmail) => {
  const trimmed = (rawEmail ?? "").trim();
  if (!trimmed) {
    return [];
  }

  const lower = trimmed.toLowerCase();
  const combinations = [
    ["email", trimmed],
    ["email", lower],
    ["emailLowercase", lower],
    ["contato.email", trimmed],
    ["contato.email", lower],
    ["contato.emailLowercase", lower],
  ];

  const seen = new Set();
  return combinations.reduce((list, [field, value]) => {
    if (!value) {
      return list;
    }
    const key = `${field}|${value}`;
    if (seen.has(key)) {
      return list;
    }
    seen.add(key);
    list.push({ field, value });
    return list;
  }, []);
};

const getNestedValue = (data, path) => {
  return path.split(".").reduce((acc, key) => {
    if (acc && Object.prototype.hasOwnProperty.call(acc, key)) {
      return acc[key];
    }
    return undefined;
  }, data);
};

const resolveStoredPassword = (data) => {
  const candidates = ["senha", "password", "senhaPortal", "credenciais.senha"];
  for (const field of candidates) {
    const value = getNestedValue(data, field);
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    if (typeof value === "number") {
      return String(value);
    }
  }
  return null;
};

const resolveStatusValue = (data) => {
  const fields = ["status", "situacao", "workflow.status", "approval.status"];
  for (const field of fields) {
    const value = getNestedValue(data, field);
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
};

const normalizeStatus = (status) => (status || "").trim().toLowerCase();

const isBlockedStatus = (status) => {
  const normalized = normalizeStatus(status);
  if (!normalized) return false;
  const blockedValues = [
    "pendente",
    "pendente de aprovação",
    "aguardando",
    "aguardando aprovação",
    "em análise",
    "em analise",
    "bloqueado",
    "inativo",
    "desativado",
  ];
  return blockedValues.includes(normalized);
};

const formatStatusLabel = (status) => {
  const trimmed = (status || "").trim();
  if (!trimmed) return "pendente";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
};

const assertApprovedStatus = (profile) => {
  const statusValue = resolveStatusValue(profile);
  if (isBlockedStatus(statusValue)) {
    const statusError = new Error("status-not-approved");
    statusError.code = "status-not-approved";
    statusError.status = statusValue;
    throw statusError;
  }
  return statusValue;
};

const getStoredSession = () => {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.id) {
      if (!parsed.collection) {
        parsed.collection = PROFILE_COLLECTIONS[0];
      }
      return parsed;
    }
    return null;
  } catch (error) {
    console.warn("Não foi possível ler a sessão salva", error);
    return null;
  }
};

const persistSession = (profile) => {
  const payload = {
    id: profile.id,
    email: profile.email || profile.emailLowercase || "",
    nome: profile.nome || profile.name || "",
    collection: profile.collection || PROFILE_COLLECTIONS[0],
    status: resolveStatusValue(profile) || "",
    savedAt: Date.now(),
  };
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn("Não foi possível salvar a sessão", error);
  }
};

const clearSession = () => {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch (error) {
    console.warn("Não foi possível limpar a sessão", error);
  }
};

const lookupManicuresByEmail = async (email) => {
  const lookups = buildLookupCandidates(email);
  const matches = [];
  const seen = new Set();

  for (const { field, value } of lookups) {
    for (const collectionName of PROFILE_COLLECTIONS) {
      try {
        const manicureQuery = query(collection(db, collectionName), where(field, "==", value), limit(1));
        const snapshot = await getDocs(manicureQuery);
        if (!snapshot.empty) {
          const document = snapshot.docs[0];
          const key = `${collectionName}|${document.id}`;
          if (seen.has(key)) {
            continue;
          }
          seen.add(key);
          matches.push({ id: document.id, data: document.data(), collection: collectionName });
        }
      } catch (error) {
        console.warn(`Falha ao buscar manicure pelo campo ${field} na coleção ${collectionName}`, error);
      }
    }
  }

  return matches;
};

const findManicureByEmail = async (email) => {
  const matches = await lookupManicuresByEmail(email);
  return matches.length ? matches[0] : null;
};

const authenticateManicure = async (email, password) => {
  const records = await lookupManicuresByEmail(email);
  if (!records.length) {
    const notFound = new Error("manicure-not-found");
    notFound.code = "manicure-not-found";
    throw notFound;
  }

  let foundPassword = false;
  let missingPassword = false;
  let blockedStatus = null;

  for (const record of records) {
    const statusValue = resolveStatusValue(record.data);
    if (isBlockedStatus(statusValue)) {
      blockedStatus = statusValue || blockedStatus;
      continue;
    }

    const storedPassword = resolveStoredPassword(record.data);
    if (!storedPassword) {
      missingPassword = true;
      continue;
    }

    foundPassword = true;

    if (storedPassword === password) {
      return { id: record.id, collection: record.collection, ...record.data, status: statusValue };
    }
  }

  if (blockedStatus) {
    const statusError = new Error("status-not-approved");
    statusError.code = "status-not-approved";
    statusError.status = blockedStatus;
    throw statusError;
  }

  if (foundPassword) {
    const mismatch = new Error("wrong-password");
    mismatch.code = "wrong-password";
    throw mismatch;
  }

  if (missingPassword) {
    const missing = new Error("missing-password");
    missing.code = "missing-password";
    throw missing;
  }

  const fallback = new Error("manicure-not-found");
  fallback.code = "manicure-not-found";
  throw fallback;
};

const fetchProfileById = async (id, preferredCollection) => {
  if (!id) return null;
  const collections = preferredCollection
    ? [preferredCollection, ...PROFILE_COLLECTIONS.filter((name) => name !== preferredCollection)]
    : PROFILE_COLLECTIONS;

  for (const collectionName of collections) {
    try {
      const snapshot = await getDoc(doc(db, collectionName, id));
      if (snapshot.exists()) {
        const profile = { id: snapshot.id, collection: collectionName, ...snapshot.data() };
        assertApprovedStatus(profile);
        return profile;
      }
    } catch (error) {
      console.warn(`Falha ao buscar manicure pelo ID na coleção ${collectionName}`, error);
    }
  }

  return null;
};

const fetchProfileFromSession = async (session) => {
  if (!session) return null;
  const byId = await fetchProfileById(session.id, session.collection);
  if (byId) {
    return byId;
  }
  if (session.email) {
    const record = await findManicureByEmail(session.email);
    if (record) {
      const profile = { id: record.id, collection: record.collection, ...record.data };
      assertApprovedStatus(profile);
      return profile;
    }
  }
  return null;
};

const fetchAppointments = async (status, profileId, profileCollection) => {
  if (!profileId || !profileCollection) {
    return [];
  }

  try {
    const parentRef = doc(db, profileCollection, profileId);
    const appointmentsCollection = appointmentCollections[status];
    if (!appointmentsCollection) {
      return [];
    }
    const appointmentsRef = collection(parentRef, appointmentsCollection);
    const snapshot = await getDocs(appointmentsRef);
    if (snapshot.empty) {
      return [];
    }
    return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  } catch (error) {
    if (error.code === "permission-denied") {
      const permissionError = new Error("permission-denied");
      permissionError.cause = error;
      throw permissionError;
    }
    console.warn(`Não foi possível carregar agendamentos ${status}`, error);
    return [];
  }
};

const hydrateDashboard = async (profile, fallbackEmail = "") => {
  setStatus("Carregando seu painel...");

  const displayName =
    profile.nome || profile.name || profile.displayName || profile.email || fallbackEmail || "manicure";
  profileNameElements.forEach((element) => {
    element.textContent = displayName;
  });
  profileDisplay.textContent = displayName;
  profileEmail.textContent = profile.email || profile.emailLowercase || fallbackEmail || "—";
  profileSpecialties.textContent =
    profile.especialidades || profile.specialties || "Alongamento em fibra · Spa das mãos";
  profileArea.textContent =
    profile.atendimento || profile.area || profile.cidade || "São Paulo e região metropolitana";

  const keys = ["pending", "confirmed", "past"];
  const profileCollection = profile.collection || PROFILE_COLLECTIONS[0];
  const results = await Promise.allSettled(
    keys.map((key) => fetchAppointments(key, profile.id, profileCollection)),
  );

  let permissionIssue = false;
  const usedFallback = {};
  const datasets = keys.map((key, index) => {
    const result = results[index];
    if (result.status === "fulfilled") {
      const value = Array.isArray(result.value) ? result.value : [];
      if (value.length) {
        return value;
      }
    } else if (result.reason?.message === "permission-denied") {
      permissionIssue = true;
    }
    usedFallback[key] = true;
    return defaultAppointmentData[key];
  });

  const [pendingAppointments, confirmedAppointments, pastAppointments] = datasets;
  updateMetrics(pendingAppointments, confirmedAppointments, pastAppointments);

  const fallbackNotice = permissionIssue
    ? "Não conseguimos carregar toda a agenda agora. Mostramos um exemplo enquanto sincronizamos seus dados."
    : "";
  let noticeDisplayed = false;

  keys.forEach((key, index) => {
    const data = datasets[index];
    const shouldShowNotice = fallbackNotice && usedFallback[key] && !noticeDisplayed;
    renderAppointments(key, data, {
      notice: shouldShowNotice ? fallbackNotice : "",
    });
    if (shouldShowNotice) {
      noticeDisplayed = true;
    }
  });

  if (permissionIssue) {
    setStatus(
      "Seu acesso foi confirmado, mas não conseguimos carregar todas as informações da agenda agora.",
      "error",
    );
  } else {
    setStatus("");
  }
};

const handleAuthError = (error) => {
  const code = error.code || error.message;
  if (code === "manicure-not-found") {
    setStatus("Não localizamos uma manicure com esse e-mail.", "error");
  } else if (code === "wrong-password") {
    setStatus("Credenciais não conferem. Confira sua senha e tente novamente.", "error");
  } else if (code === "missing-password") {
    setStatus("Seu cadastro está sem senha ativa. Fale com o suporte NailNow.", "error");
  } else if (code === "status-not-approved") {
    const label = formatStatusLabel(error.status);
    setStatus(
      `Seu cadastro ainda está com status "${label}". Confirme a profissional no Firestore para liberar o acesso.`,
      "error",
    );
  } else {
    console.error("Erro inesperado no login", error);
    setStatus("Não foi possível entrar no momento. Tente novamente em instantes ou fale com o suporte.", "error");
  }
};

const loadDashboardForProfile = async (profile, emailForFallback = "") => {
  toggleView(true);
  try {
    assertApprovedStatus(profile);
    await hydrateDashboard(profile, emailForFallback);
    if (!statusEl.classList.contains("auth-status--error")) {
      setStatus("Bem-vinda de volta!", "success");
    }
  } catch (error) {
    console.error("Não foi possível carregar o painel", error);
    if (error.code === "permission-denied" || error.message === "permission-denied") {
      setStatus(
        "Seu acesso foi confirmado, mas não conseguimos carregar as informações agora. Tente novamente em instantes.",
        "error",
      );
    } else {
      setStatus("Não foi possível carregar seu painel. Tente novamente mais tarde.", "error");
    }
  }
};

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = loginForm.email.value.trim();
  const password = loginForm.password.value;

  if (!email || !password) {
    setStatus("Preencha e-mail e senha para continuar.", "error");
    return;
  }

  setStatus("");
  setLoading(true);

  try {
    const profile = await authenticateManicure(email, password);
    persistSession(profile);
    loginForm.reset();
    await loadDashboardForProfile(profile, email);
  } catch (error) {
    handleAuthError(error);
  } finally {
    setLoading(false);
  }
});

resetButton.addEventListener("click", () => {
  setStatus("Entre em contato com o suporte NailNow para redefinir ou atualizar sua senha.", "error");
});

signOutButton.addEventListener("click", () => {
  clearSession();
  resetDashboard();
  toggleView(false);
  loginForm.reset();
  setStatus("Você saiu do portal com segurança.", "success");
});

const bootstrap = async () => {
  const session = getStoredSession();
  if (!session) {
    return;
  }

  setStatus("Carregando seu painel...");
  toggleView(true);

  try {
    const profile = await fetchProfileFromSession(session);
    if (!profile) {
      throw new Error("session-expired");
    }
    assertApprovedStatus(profile);
    await hydrateDashboard(profile, session.email || "");
    if (!statusEl.classList.contains("auth-status--error")) {
      setStatus("Sessão restaurada com sucesso!", "success");
    }
  } catch (error) {
    console.error("Falha ao restaurar sessão", error);
    clearSession();
    resetDashboard();
    toggleView(false);
    if (error.code === "status-not-approved") {
      const label = formatStatusLabel(error.status);
      setStatus(
        `Seu cadastro ainda está com status "${label}". Confirme a profissional no Firestore para liberar o acesso.`,
        "error",
      );
    } else {
      setStatus("Não encontramos sua sessão. Faça login novamente para continuar.", "error");
    }
  }
};

bootstrap();
