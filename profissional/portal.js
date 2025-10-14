import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  browserLocalPersistence,
  getAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.warn("Não foi possível aplicar a persistência local no momento", error);
});

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

const fetchProfileForUser = async (user) => {
  if (!user) {
    throw new Error("missing-user");
  }

  const directRef = doc(db, "manicures", user.uid);
  try {
    const snapshot = await getDoc(directRef);
    if (snapshot.exists()) {
      return { id: directRef.id, ...snapshot.data() };
    }
  } catch (error) {
    if (error.code === "permission-denied") {
      const permissionError = new Error("permission-denied");
      permissionError.cause = error;
      throw permissionError;
    }
    console.warn("Falha ao buscar perfil pelo UID", error);
  }

  const lookups = buildLookupCandidates(user.email);
  for (const { field, value } of lookups) {
    try {
      const manicureQuery = query(collection(db, "manicures"), where(field, "==", value), limit(1));
      const snapshot = await getDocs(manicureQuery);
      if (!snapshot.empty) {
        const document = snapshot.docs[0];
        return { id: document.id, ...document.data() };
      }
    } catch (error) {
      if (error.code === "permission-denied") {
        const permissionError = new Error("permission-denied");
        permissionError.cause = error;
        throw permissionError;
      }
      console.warn(`Falha ao buscar perfil pelo campo ${field}`, error);
    }
  }

  return {
    id: user.uid,
    email: user.email ?? "",
    nome: user.displayName ?? "",
  };
};

const fetchAppointments = async (status, profileId) => {
  if (!profileId) {
    return [];
  }

  try {
    const parentRef = doc(db, "manicures", profileId);
    const collectionName = appointmentCollections[status];
    if (!collectionName) {
      return [];
    }
    const appointmentsRef = collection(parentRef, collectionName);
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

const hydrateDashboard = async (user) => {
  setStatus("Carregando seu painel...");
  const profile = await fetchProfileForUser(user);

  const displayName =
    profile.nome || profile.name || profile.displayName || user.displayName || user.email || "manicure";
  profileNameElements.forEach((element) => {
    element.textContent = displayName;
  });
  profileDisplay.textContent = displayName;
  profileEmail.textContent = profile.email || profile.emailLowercase || user.email || "—";
  profileSpecialties.textContent =
    profile.especialidades || profile.specialties || "Alongamento em fibra · Spa das mãos";
  profileArea.textContent =
    profile.atendimento || profile.area || profile.cidade || "São Paulo e região metropolitana";

  const keys = ["pending", "confirmed", "past"];
  const results = await Promise.allSettled(keys.map((key) => fetchAppointments(key, profile.id)));

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
  if (code === "auth/user-not-found" || code === "auth/invalid-credential") {
    setStatus("Não localizamos uma manicure com esse e-mail.", "error");
  } else if (code === "auth/wrong-password") {
    setStatus("Credenciais não conferem. Confira sua senha e tente novamente.", "error");
  } else if (code === "auth/invalid-email") {
    setStatus("Informe um e-mail válido para continuar.", "error");
  } else if (code === "auth/too-many-requests") {
    setStatus(
      "Detectamos muitas tentativas. Aguarde alguns instantes antes de tentar novamente.",
      "error",
    );
  } else if (code === "auth/network-request-failed") {
    setStatus("Sem conexão no momento. Verifique sua internet e tente novamente.", "error");
  } else {
    console.error("Erro inesperado no login", error);
    setStatus(
      "Não foi possível entrar no momento. Tente novamente em instantes ou fale com o suporte.",
      "error",
    );
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
    await signInWithEmailAndPassword(auth, email, password);
    loginForm.reset();
  } catch (error) {
    handleAuthError(error);
  } finally {
    setLoading(false);
  }
});

resetButton.addEventListener("click", async () => {
  const email = loginForm.email.value.trim();
  if (!email) {
    setStatus("Informe seu e-mail para receber o link de redefinição.", "error");
    return;
  }

  try {
    await sendPasswordResetEmail(auth, email);
    setStatus("Enviamos um e-mail com as instruções para redefinir sua senha.", "success");
  } catch (error) {
    const code = error.code || error.message;
    if (code === "auth/user-not-found") {
      setStatus("Não localizamos uma manicure com esse e-mail.", "error");
    } else if (code === "auth/invalid-email") {
      setStatus("Informe um e-mail válido para continuar.", "error");
    } else {
      console.error("Erro ao enviar redefinição de senha", error);
      setStatus("Não foi possível iniciar a redefinição agora. Tente novamente em instantes.", "error");
    }
  }
});

signOutButton.addEventListener("click", async () => {
  try {
    await firebaseSignOut(auth);
    setStatus("Você saiu do portal com segurança.", "success");
    renderAppointments("pending", []);
    renderAppointments("confirmed", []);
    renderAppointments("past", []);
    updateMetrics([], [], []);
  } catch (error) {
    console.error("Erro ao sair do portal", error);
    setStatus("Não foi possível encerrar a sessão agora. Tente novamente.", "error");
  }
});

onAuthStateChanged(auth, async (user) => {
  if (user) {
    toggleView(true);
    try {
      await hydrateDashboard(user);
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
  } else {
    toggleView(false);
    setStatus("");
  }
});
