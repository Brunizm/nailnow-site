import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBHVZ9M6btJemXCIG-g5dG0xWq_jy50H7o",
  authDomain: "nailnow-site.firebaseapp.com",
  projectId: "nailnow-site",
  storageBucket: "nailnow-site.appspot.com",
  messagingSenderId: "726392294571",
  appId: "1:726392294571:web:a363a40231f7ac162e7bee",
};

const SESSION_KEY = "nailnowManicureSession";
const PROFILE_COLLECTIONS = ["profissionais"];

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const statusEl = document.getElementById("dashboard-status");
const dashboard = document.getElementById("dashboard");
const signOutButton = document.getElementById("sign-out");
const profileNameElements = document.querySelectorAll("[data-profile-name]");
const profileDisplay = document.getElementById("profile-display");
const profileEmail = document.getElementById("profile-email");
const profileSpecialties = document.getElementById("profile-specialties");
const profileArea = document.getElementById("profile-area");
const servicesList = document.getElementById("services-list");
const servicesEmpty = document.getElementById("services-empty");
const metricPending = document.getElementById("metric-pending");
const metricConfirmed = document.getElementById("metric-confirmed");
const metricCancelled = document.getElementById("metric-cancelled");
const badgePending = document.getElementById("badge-pending");
const badgeConfirmed = document.getElementById("badge-confirmed");
const badgeCancelled = document.getElementById("badge-cancelled");
const pendingList = document.getElementById("pending-list");
const confirmedList = document.getElementById("confirmed-list");
const cancelledList = document.getElementById("cancelled-list");
let currentProfile = null;
let fallbackProfileEmail = "";

const appointmentCollections = {
  pending: "solicitacoes",
  confirmed: "confirmados",
  cancelled: "cancelados",
};

const legacyAppointmentCollections = {
  cancelled: ["historico"],
};

const appointmentStatusLabels = {
  pending: "Pendente",
  confirmed: "Confirmado",
  cancelled: "Cancelado",
};

const resolveStatusLabel = (status) => {
  const normalized = (status || "").toString().toLowerCase();
  if (appointmentStatusLabels[normalized]) {
    return appointmentStatusLabels[normalized];
  }
  if (normalized === "rejected" || normalized === "cancelado" || normalized === "canceled") {
    return appointmentStatusLabels.cancelled;
  }
  if (normalized === "confirmado" || normalized === "confirmed") {
    return appointmentStatusLabels.confirmed;
  }
  if (normalized === "pendente" || normalized === "pending") {
    return appointmentStatusLabels.pending;
  }
  return appointmentStatusLabels.pending;
};

const setStatus = (message, type = "") => {
  if (!statusEl) {
    return;
  }
  statusEl.textContent = message;
  statusEl.classList.remove("auth-status--error", "auth-status--success");
  statusEl.hidden = !message;
  if (type) {
    statusEl.classList.add(`auth-status--${type}`);
  }
};

const resetDashboard = () => {
  pendingList.innerHTML = "";
  confirmedList.innerHTML = "";
  cancelledList.innerHTML = "";
  updateMetrics([], [], []);
  if (servicesList) {
    servicesList.innerHTML = "";
  }
  if (servicesEmpty) {
    servicesEmpty.hidden = false;
  }
  currentProfile = null;
  fallbackProfileEmail = "";
};

const formatCurrency = (value) => {
  if (typeof value === "number") {
    return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }
  if (!value) return "—";
  return value;
};

const parsePriceValue = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.replace(/[^0-9,.-]/g, "").replace(/,/g, ".");
    const parsed = Number.parseFloat(normalized);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
};

const renderServices = (services) => {
  if (!servicesList || !servicesEmpty) {
    return;
  }
  servicesList.innerHTML = "";
  if (!Array.isArray(services) || services.length === 0) {
    servicesEmpty.hidden = false;
    return;
  }
  servicesEmpty.hidden = true;
  services.forEach((service) => {
    const item = document.createElement("li");
    item.className = "profile-services__item";

    const info = document.createElement("div");
    info.className = "profile-services__info";
    const name = document.createElement("span");
    name.className = "profile-services__name";
    name.textContent = service.name || "Serviço NailNow";
    info.appendChild(name);

    if (service.duration) {
      const duration = document.createElement("span");
      duration.className = "profile-services__meta";
      duration.textContent = service.duration;
      info.appendChild(duration);
    }

    const price = document.createElement("span");
    price.className = "profile-services__price";
    if (typeof service.price === "number") {
      price.textContent = formatCurrency(service.price);
    } else if (service.priceLabel) {
      price.textContent = service.priceLabel;
    } else {
      price.textContent = "Sob consulta";
    }

    item.appendChild(info);
    item.appendChild(price);
    servicesList.appendChild(item);
  });
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
  const statusLabel = resolveStatusLabel(status);
  heading.innerHTML = `
    <div>
      <p class="schedule-card__service">${
        appointment.service || appointment.servico || appointment.serviceName || "Serviço NailNow"
      }</p>
      <h3 class="schedule-card__client">${
        appointment.client || appointment.cliente || appointment.clientName || "Cliente NailNow"
      }</h3>
    </div>
    <div class="schedule-card__meta">
      <span class="schedule-card__status">${statusLabel}</span>
      <span class="schedule-card__id">${appointment.id || "—"}</span>
    </div>
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

  if (status === "pending") {
    const actions = document.createElement("div");
    actions.className = "schedule-card__actions";

    const approveButton = document.createElement("button");
    approveButton.type = "button";
    approveButton.className = "schedule-card__button schedule-card__button--approve";
    approveButton.textContent = "Aceitar solicitação";
    approveButton.addEventListener("click", () => {
      handleAppointmentDecision(appointment, "accept", actions);
    });

    const rejectButton = document.createElement("button");
    rejectButton.type = "button";
    rejectButton.className = "schedule-card__button schedule-card__button--reject";
    rejectButton.textContent = "Recusar";
    rejectButton.addEventListener("click", () => {
      handleAppointmentDecision(appointment, "reject", actions);
    });

    actions.appendChild(approveButton);
    actions.appendChild(rejectButton);
    wrapper.appendChild(actions);
  }

  return wrapper;
};

const renderAppointments = (status, appointments, options = {}) => {
  const mapping = {
    pending: pendingList,
    confirmed: confirmedList,
    cancelled: cancelledList,
  };
  const target = mapping[status];
  if (!target) {
    return;
  }
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
    const emptyMessages = {
      pending: "Nenhuma solicitação aguardando resposta.",
      confirmed: "Nenhum atendimento confirmado por enquanto.",
      cancelled: "Nenhuma solicitação cancelada registrada.",
    };
    empty.textContent = emptyMessages[status] || "Nenhum agendamento disponível no momento.";
    target.appendChild(empty);
    return;
  }

  appointments.forEach((appointment) => {
    target.appendChild(createAppointmentCard(appointment, status));
  });
};

const mirrorDecisionToClient = async (appointment, decision) => {
  const clientId =
    appointment.clientId || appointment.clienteId || appointment.clientUID || appointment.clientUid || appointment.clientRefId;
  if (!clientId) {
    return;
  }

  const clientCollection = appointment.clientCollection || "clientes";
  const clientRef = doc(db, clientCollection, clientId);
  const pendingRef = doc(clientRef, appointmentCollections.pending, appointment.id);
  const confirmedRef = doc(clientRef, appointmentCollections.confirmed, appointment.id);
  const cancelledCollectionName =
    appointmentCollections.cancelled || (legacyAppointmentCollections.cancelled || [])[0];
  const cancelledRef = cancelledCollectionName
    ? doc(clientRef, cancelledCollectionName, appointment.id)
    : null;
  const legacyCancelledRefs = (legacyAppointmentCollections.cancelled || [])
    .filter((collectionName) => collectionName && collectionName !== cancelledCollectionName)
    .map((collectionName) => doc(clientRef, collectionName, appointment.id));

  const basePayload = {
    ...appointment,
    status: decision === "accept" ? "confirmed" : "cancelled",
    decision: decision === "accept" ? "accepted" : "declined",
    decisionAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    if (decision === "accept") {
      await Promise.all([
        setDoc(confirmedRef, basePayload),
        deleteDoc(pendingRef).catch(() => {}),
        ...(cancelledRef ? [deleteDoc(cancelledRef).catch(() => {})] : []),
        ...legacyCancelledRefs.map((ref) => deleteDoc(ref).catch(() => {})),
      ]);
    } else {
      await Promise.all([
        ...(cancelledRef ? [setDoc(cancelledRef, basePayload)] : []),
        deleteDoc(pendingRef).catch(() => {}),
        deleteDoc(confirmedRef).catch(() => {}),
        ...legacyCancelledRefs.map((ref) => setDoc(ref, basePayload)),
      ]);
    }
  } catch (error) {
    console.warn("Não foi possível sincronizar a decisão com a cliente", error);
  }
};

const toggleActionButtons = (container, disabled) => {
  if (!container) {
    return;
  }
  container.querySelectorAll("button").forEach((button) => {
    button.disabled = disabled;
  });
};

const handleAppointmentDecision = async (appointment, decision, actionsContainer) => {
  if (!currentProfile?.id) {
    return;
  }

  toggleActionButtons(actionsContainer, true);
  setStatus(decision === "accept" ? "Confirmando atendimento..." : "Atualizando solicitação...");

  const collectionName = currentProfile.collection || PROFILE_COLLECTIONS[0];
  const professionalRef = doc(db, collectionName, currentProfile.id);
  const pendingRef = doc(professionalRef, appointmentCollections.pending, appointment.id);
  const cancelledCollectionName =
    appointmentCollections.cancelled || (legacyAppointmentCollections.cancelled || [])[0];
  const cancelledRef = cancelledCollectionName
    ? doc(professionalRef, cancelledCollectionName, appointment.id)
    : null;
  const legacyCancelledRefs = (legacyAppointmentCollections.cancelled || [])
    .filter((name) => name && name !== cancelledCollectionName)
    .map((name) => doc(professionalRef, name, appointment.id));

  const payload = {
    ...appointment,
    status: decision === "accept" ? "confirmed" : "cancelled",
    decision: decision === "accept" ? "accepted" : "declined",
    decisionBy: currentProfile.id,
    decisionAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    if (decision === "accept") {
      const confirmedRef = doc(professionalRef, appointmentCollections.confirmed, appointment.id);
      await Promise.all([
        setDoc(confirmedRef, payload),
        deleteDoc(pendingRef).catch(() => {}),
        ...(cancelledRef ? [deleteDoc(cancelledRef).catch(() => {})] : []),
        ...legacyCancelledRefs.map((ref) => deleteDoc(ref).catch(() => {})),
        mirrorDecisionToClient(appointment, decision),
      ]);
      setStatus("Solicitação confirmada!", "success");
    } else {
      await Promise.all([
        ...(cancelledRef ? [setDoc(cancelledRef, payload)] : []),
        deleteDoc(pendingRef).catch(() => {}),
        ...legacyCancelledRefs.map((ref) => setDoc(ref, payload)),
        mirrorDecisionToClient(appointment, decision),
      ]);
      setStatus("Solicitação atualizada.", "success");
    }

    await loadAppointmentsForProfile(currentProfile);
  } catch (error) {
    console.error("Não foi possível atualizar a solicitação", error);
    handleAuthError(error);
  } finally {
    toggleActionButtons(actionsContainer, false);
  }
};

const updateMetrics = (pending, confirmed, cancelled) => {
  metricPending.textContent = pending.length;
  badgePending.textContent = pending.length;
  metricConfirmed.textContent = confirmed.length;
  badgeConfirmed.textContent = confirmed.length;
  metricCancelled.textContent = cancelled.length;
  badgeCancelled.textContent = cancelled.length;
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

const toArray = (value) => {
  if (Array.isArray(value)) {
    return value;
  }
  if (value && typeof value === "object") {
    return Object.values(value);
  }
  return [];
};

const normalizeServiceEntry = (entry, index = 0) => {
  if (!entry) {
    return null;
  }
  if (typeof entry === "string") {
    return {
      id: `service-${index}`,
      name: entry,
      price: null,
      priceLabel: "Sob consulta",
      duration: "",
    };
  }
  if (typeof entry === "object") {
    const name =
      entry.nome ||
      entry.name ||
      entry.titulo ||
      entry.title ||
      entry.servico ||
      entry.service ||
      `Serviço ${index + 1}`;
    const rawPrice =
      entry.preco ??
      entry.price ??
      entry.valor ??
      entry.valorMinimo ??
      entry.valor_maximo ??
      entry.amount ??
      entry.investimento ??
      entry.precoSugerido ??
      entry.valorSugerido;
    const numericPrice = parsePriceValue(rawPrice);
    let priceLabel = "Sob consulta";
    if (typeof numericPrice === "number") {
      priceLabel = formatCurrency(numericPrice);
    } else if (rawPrice) {
      priceLabel = typeof rawPrice === "string" ? rawPrice : String(rawPrice);
    }
    const duration = entry.duracao || entry.duration || entry.tempo || entry.time || "";
    const id = entry.id || entry.uid || entry.slug || entry.codigo || `service-${index}`;
    return {
      id,
      name,
      price: typeof numericPrice === "number" ? numericPrice : null,
      priceLabel,
      duration,
    };
  }
  return null;
};

const collectInlineServices = (profile) => {
  const candidateFields = [
    "servicos",
    "services",
    "catalogo.servicos",
    "catalogo.services",
    "portfolio.servicos",
    "portfolio.services",
    "ofertas",
    "tabelaServicos",
    "serviceList",
    "pricing.servicos",
    "pricing.services",
  ];

  const services = [];
  const seen = new Set();

  candidateFields.forEach((path) => {
    const value = getNestedValue(profile, path);
    toArray(value).forEach((entry, index) => {
      const normalized = normalizeServiceEntry(entry, services.length + index);
      if (normalized && !seen.has(normalized.id)) {
        seen.add(normalized.id);
        services.push(normalized);
      }
    });
  });

  return services;
};

const fetchServicesSubcollection = async (profile) => {
  if (!profile?.id || !profile?.collection) {
    return [];
  }
  try {
    const ref = collection(doc(db, profile.collection, profile.id), "servicos");
    const snapshot = await getDocs(ref);
    if (snapshot.empty) {
      return [];
    }
    return snapshot.docs
      .map((docSnap, index) => {
        const normalized = normalizeServiceEntry({ id: docSnap.id, ...docSnap.data() }, index);
        return normalized;
      })
      .filter(Boolean);
  } catch (error) {
    console.warn("Não foi possível carregar os serviços cadastrados", error);
    return [];
  }
};

const loadServicesForProfile = async (profile) => {
  if (!profile) {
    renderServices([]);
    return;
  }
  const inlineServices = collectInlineServices(profile);
  let services = [...inlineServices];

  const subcollectionServices = await fetchServicesSubcollection(profile);
  if (subcollectionServices.length) {
    const map = new Map(services.map((service) => [service.id, service]));
    subcollectionServices.forEach((service) => {
      if (!map.has(service.id)) {
        services.push(service);
      } else {
        map.set(service.id, service);
      }
    });
    services = Array.from(map.values());
  }

  renderServices(services);
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

const persistSession = (profile, user) => {
  const payload = {
    uid: user?.uid || profile.uid || "",
    id: profile.id,
    email: profile.email || profile.emailLowercase || user?.email || "",
    nome: profile.nome || profile.name || user?.displayName || "",
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

const lookupProfilesByEmail = async (email) => {
  const lookups = buildLookupCandidates(email);
  const matches = [];
  const seen = new Set();
  let permissionDenied = false;

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
        if (error.code === "permission-denied") {
          permissionDenied = true;
        }
        console.warn(`Falha ao buscar manicure pelo campo ${field} na coleção ${collectionName}`, error);
      }
    }
  }

  if (permissionDenied) {
    const permError = new Error("firestore-permission-denied");
    permError.code = "firestore-permission-denied";
    throw permError;
  }

  return matches;
};

const fetchProfileByUid = async (uid) => {
  if (!uid) {
    return null;
  }

  for (const collectionName of PROFILE_COLLECTIONS) {
    try {
      const snapshot = await getDoc(doc(db, collectionName, uid));
      if (snapshot.exists()) {
        return { id: snapshot.id, collection: collectionName, ...snapshot.data() };
      }
    } catch (error) {
      if (error.code === "permission-denied") {
        const permError = new Error("firestore-permission-denied");
        permError.code = "firestore-permission-denied";
        permError.cause = error;
        throw permError;
      }
      console.warn(`Falha ao buscar manicure pelo UID na coleção ${collectionName}`, error);
    }
  }

  return null;
};

const resolveProfileForUser = async (user, emailHint = "") => {
  if (!user) {
    const missing = new Error("profile-not-found");
    missing.code = "profile-not-found";
    throw missing;
  }

  const byUid = await fetchProfileByUid(user.uid);
  if (byUid) {
    return byUid;
  }

  const emailCandidates = [emailHint, user.email].filter((value, index, array) => {
    return value && array.findIndex((item) => item && item.toLowerCase() === value.toLowerCase()) === index;
  });

  for (const candidate of emailCandidates) {
    if (!candidate) continue;
    const matches = await lookupProfilesByEmail(candidate);
    if (matches.length) {
      const match = matches[0];
      return { id: match.id, collection: match.collection, ...match.data };
    }
  }

  const notFound = new Error("profile-not-found");
  notFound.code = "profile-not-found";
  throw notFound;
};

const fetchAppointments = async (status, profileId, profileCollection) => {
  if (!profileId || !profileCollection) {
    return [];
  }

  try {
    const parentRef = doc(db, profileCollection, profileId);
    const collectionCandidates = [
      appointmentCollections[status],
      ...(legacyAppointmentCollections[status] || []),
    ].filter(Boolean);

    if (!collectionCandidates.length) {
      return [];
    }

    const appointments = new Map();

    for (const collectionName of collectionCandidates) {
      const appointmentsRef = collection(parentRef, collectionName);
      const snapshot = await getDocs(appointmentsRef);
      if (snapshot.empty) {
        continue;
      }
      snapshot.docs.forEach((docSnap) => {
        appointments.set(docSnap.id, { id: docSnap.id, ...docSnap.data() });
      });
    }

    return Array.from(appointments.values());
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

const loadAppointmentsForProfile = async (profile) => {
  if (!profile?.id) {
    renderAppointments("pending", []);
    renderAppointments("confirmed", []);
    renderAppointments("cancelled", []);
    updateMetrics([], [], []);
    return { permissionIssue: false };
  }

  const keys = ["pending", "confirmed", "cancelled"];
  const profileCollection = profile.collection || PROFILE_COLLECTIONS[0];
  const results = await Promise.allSettled(keys.map((key) => fetchAppointments(key, profile.id, profileCollection)));

  let permissionIssue = false;
  const datasets = keys.map((key, index) => {
    const result = results[index];
    if (result.status === "fulfilled") {
      const value = Array.isArray(result.value) ? result.value : [];
      return value.map((entry) => ({ status: key, ...entry }));
    }

    const reason = result.reason;
    const denied =
      reason?.code === "permission-denied" ||
      reason?.message === "permission-denied" ||
      (typeof reason?.message === "string" && reason.message.includes("permission-denied"));
    if (denied) {
      permissionIssue = true;
    }

    return [];
  });

  const [pendingAppointments, confirmedAppointments, cancelledAppointments] = datasets;
  updateMetrics(pendingAppointments, confirmedAppointments, cancelledAppointments);

  const fallbackNotice = permissionIssue
    ? "Não conseguimos carregar toda a agenda agora. Atualize a página ou fale com o suporte NailNow."
    : "";
  let noticeDisplayed = false;

  keys.forEach((key, index) => {
    const data = datasets[index];
    const shouldShowNotice = Boolean(fallbackNotice) && !noticeDisplayed;
    renderAppointments(key, data, {
      notice: shouldShowNotice ? fallbackNotice : "",
    });
    if (shouldShowNotice) {
      noticeDisplayed = true;
    }
  });

  return { permissionIssue };
};

const hydrateDashboard = async (profile, fallbackEmail = "") => {
  currentProfile = profile;
  fallbackProfileEmail = fallbackEmail;

  const displayName = profile.nome || profile.name || profile.displayName || profile.email || fallbackEmail || "manicure";
  profileNameElements.forEach((element) => {
    element.textContent = displayName;
  });
  profileDisplay.textContent = displayName;
  profileEmail.textContent = profile.email || profile.emailLowercase || fallbackEmail || "—";
  profileSpecialties.textContent =
    profile.especialidades || profile.specialties || "Alongamento em fibra · Spa das mãos";
  profileArea.textContent =
    profile.atendimento || profile.area || profile.cidade || "São Paulo e região metropolitana";

  await loadServicesForProfile(profile);
  return loadAppointmentsForProfile(profile);
};

const handleAuthError = (error) => {
  const code = error.code || error.message;
  if (code === "auth/invalid-email") {
    setStatus("O e-mail informado é inválido. Verifique e tente novamente.", "error");
  } else if (code === "auth/invalid-credential" || code === "auth/wrong-password") {
    setStatus("Credenciais não conferem. Confira sua senha e tente novamente.", "error");
  } else if (code === "auth/user-not-found" || code === "profile-not-found") {
    setStatus("Não localizamos uma manicure com esse e-mail.", "error");
  } else if (code === "auth/user-disabled") {
    setStatus("Este acesso foi desativado. Fale com o suporte NailNow.", "error");
  } else if (code === "auth/too-many-requests") {
    setStatus("Muitas tentativas de acesso. Aguarde alguns instantes e tente novamente.", "error");
  } else if (code === "firestore-permission-denied" || code === "permission-denied") {
    setStatus(
      "Não foi possível acessar seus dados agora. Atualize a página ou fale com o suporte NailNow.",
      "error",
    );
  } else if (code === "auth/admin-restricted-operation") {
    setStatus(
      "O acesso seguro ao portal está temporariamente indisponível. Avise o suporte NailNow para regularizar.",
      "error",
    );
  } else {
    console.error("Erro inesperado no portal", error);
    setStatus("Não foi possível carregar o portal agora. Tente novamente em instantes ou fale com o suporte.", "error");
  }
};

const ensureDashboardForUser = async (user, emailHint = "") => {
  dashboard.hidden = false;
  setStatus("Carregando seu painel...");

  const profile = await resolveProfileForUser(user, emailHint);
  persistSession(profile, user);
  const { permissionIssue } = await hydrateDashboard(profile, emailHint || user.email || "");

  if (permissionIssue) {
    setStatus(
      "Seu acesso foi confirmado, mas não conseguimos carregar todas as informações da agenda agora.",
      "error",
    );
  } else {
    setStatus("Bem-vinda de volta!", "success");
  }
};

signOutButton.addEventListener("click", async () => {
  if (!signOutButton) {
    return;
  }
  signOutButton.disabled = true;
  setStatus("Encerrando sua sessão...");
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Não foi possível encerrar a sessão", error);
    handleAuthError(error);
    signOutButton.disabled = false;
    return;
  }

  clearSession();
  dashboard.hidden = true;
  resetDashboard();
  window.location.href = "/profissional/index.html";
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    clearSession();
    dashboard.hidden = true;
    resetDashboard();
    setStatus("");
    window.location.replace("/profissional/index.html");
    return;
  }

  try {
    const session = getStoredSession();
    const emailHint = session?.email || user.email || "";
    await ensureDashboardForUser(user, emailHint);
  } catch (error) {
    console.error("Não foi possível carregar o painel autenticado", error);
    handleAuthError(error);
    try {
      await signOut(auth);
    } catch (signOutError) {
      console.warn("Falha ao encerrar sessão após erro", signOutError);
    }
  } finally {
    if (signOutButton) {
      signOutButton.disabled = false;
    }
  }
});
