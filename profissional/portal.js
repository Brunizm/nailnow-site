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
const metricPast = document.getElementById("metric-past");
const badgePending = document.getElementById("badge-pending");
const badgeConfirmed = document.getElementById("badge-confirmed");
const badgePast = document.getElementById("badge-past");
const pendingList = document.getElementById("pending-list");
const confirmedList = document.getElementById("confirmed-list");
const pastList = document.getElementById("past-list");
let currentProfile = null;
let fallbackProfileEmail = "";

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
  pastList.innerHTML = "";
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
  heading.innerHTML = `
    <div>
      <p class="schedule-card__service">${
        appointment.service || appointment.servico || appointment.serviceName || "Serviço NailNow"
      }</p>
      <h3 class="schedule-card__client">${
        appointment.client || appointment.cliente || appointment.clientName || "Cliente NailNow"
      }</h3>
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
  const historyRef = doc(clientRef, appointmentCollections.past, appointment.id);

  const basePayload = {
    ...appointment,
    status: decision === "accept" ? "confirmed" : "rejected",
    decision: decision === "accept" ? "accepted" : "rejected",
    decisionAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    if (decision === "accept") {
      await Promise.all([
        setDoc(confirmedRef, basePayload),
        deleteDoc(pendingRef).catch(() => {}),
      ]);
    } else {
      await Promise.all([
        setDoc(historyRef, basePayload),
        deleteDoc(pendingRef).catch(() => {}),
        deleteDoc(confirmedRef).catch(() => {}),
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
  if (!currentProfile?.id || appointment.__isFallback) {
    return;
  }

  toggleActionButtons(actionsContainer, true);
  setStatus(decision === "accept" ? "Confirmando atendimento..." : "Atualizando solicitação...");

  const collectionName = currentProfile.collection || PROFILE_COLLECTIONS[0];
  const professionalRef = doc(db, collectionName, currentProfile.id);
  const pendingRef = doc(professionalRef, appointmentCollections.pending, appointment.id);

  const payload = {
    ...appointment,
    status: decision === "accept" ? "confirmed" : "rejected",
    decision: decision === "accept" ? "accepted" : "rejected",
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
        mirrorDecisionToClient(appointment, decision),
      ]);
      setStatus("Solicitação confirmada!", "success");
    } else {
      const historyRef = doc(professionalRef, appointmentCollections.past, appointment.id);
      await Promise.all([
        setDoc(historyRef, payload),
        deleteDoc(pendingRef).catch(() => {}),
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

const loadAppointmentsForProfile = async (profile) => {
  if (!profile?.id) {
    renderAppointments("pending", []);
    renderAppointments("confirmed", []);
    renderAppointments("past", []);
    updateMetrics([], [], []);
    return { permissionIssue: false };
  }

  const keys = ["pending", "confirmed", "past"];
  const profileCollection = profile.collection || PROFILE_COLLECTIONS[0];
  const results = await Promise.allSettled(keys.map((key) => fetchAppointments(key, profile.id, profileCollection)));

  let permissionIssue = false;
  const usedFallback = {};
  const datasets = keys.map((key, index) => {
    const result = results[index];
    if (result.status === "fulfilled") {
      const value = Array.isArray(result.value) ? result.value : [];
      if (value.length) {
        return value.map((entry) => ({ status: key, ...entry }));
      }
    } else if (result.reason?.message === "permission-denied") {
      permissionIssue = true;
    }
    usedFallback[key] = true;
    return defaultAppointmentData[key].map((entry) => ({ status: key, __isFallback: true, ...entry }));
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
