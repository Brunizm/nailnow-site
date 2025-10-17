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

const SESSION_KEY = "nailnowClienteSession";
const PROFILE_COLLECTIONS = ["clientes"];

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const statusEl = document.getElementById("dashboard-status");
const dashboard = document.getElementById("dashboard");
const signOutButton = document.getElementById("sign-out");
const profileNameElements = document.querySelectorAll("[data-profile-name]");
const profileDisplay = document.getElementById("profile-display");
const profileEmail = document.getElementById("profile-email");
const profilePhone = document.getElementById("profile-phone");
const profileAddress = document.getElementById("profile-address");
const metricPending = document.getElementById("metric-pending");
const metricConfirmed = document.getElementById("metric-confirmed");
const metricPast = document.getElementById("metric-past");
const badgePending = document.getElementById("badge-pending");
const badgeConfirmed = document.getElementById("badge-confirmed");
const badgePast = document.getElementById("badge-past");
const pendingList = document.getElementById("pending-list");
const confirmedList = document.getElementById("confirmed-list");
const pastList = document.getElementById("past-list");
const professionalSearchInput = document.getElementById("professional-search");
const professionalResults = document.getElementById("professional-results");
const professionalResultsEmpty = document.getElementById("professional-results-empty");
const requestForm = document.getElementById("service-request-form");
const requestFormEmpty = document.getElementById("request-form-empty");
const requestFields = document.querySelectorAll("[data-request-field]");
const requestProfessionalInput = document.getElementById("request-professional");
const requestServiceSelect = document.getElementById("request-service");
const requestPriceInput = document.getElementById("request-price");
const requestDateInput = document.getElementById("request-date");
const requestTimeInput = document.getElementById("request-time");
const requestLocationInput = document.getElementById("request-location");
const requestNotesInput = document.getElementById("request-notes");
const requestSubmitButton = document.getElementById("submit-request");
const requestFeedback = document.getElementById("request-feedback");
let currentProfile = null;
let fallbackProfileEmail = "";
let professionalsCatalog = [];
let filteredProfessionals = [];
let selectedProfessional = null;
let selectedService = null;

const POSTAL_CODE_REGEX = /\b\d{5}-?\d{3}\b/g;

const stripPostalCode = (value = "") => {
  if (typeof value !== "string") {
    return "";
  }

  let sanitized = value.replace(POSTAL_CODE_REGEX, "");
  sanitized = sanitized.replace(/[,•·-]\s*(?=([,•·-]|$))/g, "");
  sanitized = sanitized.replace(/\s{2,}/g, " ");
  sanitized = sanitized.replace(/^[,•·-]\s*/, "");
  sanitized = sanitized.replace(/\s*[,•·-]\s*$/, "");
  return sanitized.trim();
};

const sanitizeAreaParts = (parts = []) => {
  return parts
    .map((part) => stripPostalCode(part))
    .map((part) => part.replace(/\s{2,}/g, " ").trim())
    .filter(Boolean);
};

const defaultAppointmentData = {
  pending: [
    {
      id: "SOL-4021",
      service: "Esmaltação em gel",
      professional: "Mariana Costa",
      date: "2025-05-12",
      time: "19:30",
      location: "Seu endereço cadastrado",
      price: "R$ 120,00",
      note: "Aguarde a confirmação da profissional escolhida.",
    },
  ],
  confirmed: [
    {
      id: "AGEN-3110",
      service: "Spa das mãos + pedicure",
      professional: "Bianca Ramos",
      date: "2025-05-15",
      time: "10:00",
      location: "Condomínio Jardins, São Paulo",
      price: "R$ 189,00",
      note: "A profissional levará todos os materiais esterilizados.",
    },
  ],
  past: [
    {
      id: "HIST-2980",
      service: "Blindagem + esmaltação",
      professional: "Ana Paula",
      date: "2025-04-28",
      time: "15:00",
      location: "Brooklin, São Paulo",
      price: "R$ 165,00",
      note: "Avaliação enviada com 5 estrelas.",
    },
  ],
};

const defaultProfessionalCatalog = [
  {
    id: "sample-mariana",
    nome: "Mariana Costa",
    area: "Pinheiros, São Paulo",
    servicos: [
      { id: "svc-1", name: "Esmaltação em gel", price: 120, priceLabel: "R$ 120,00", duration: "1h15" },
      { id: "svc-2", name: "Spa das mãos", price: 150, priceLabel: "R$ 150,00", duration: "1h30" },
      { id: "svc-3", name: "Blindagem", price: 180, priceLabel: "R$ 180,00", duration: "1h45" },
    ],
    rating: "4,9", 
    __isFallback: true,
  },
  {
    id: "sample-bianca",
    nome: "Bianca Ramos",
    area: "Moema, São Paulo",
    servicos: [
      { id: "svc-4", name: "Pedicure + spa relaxante", price: 130, priceLabel: "R$ 130,00", duration: "1h20" },
      { id: "svc-5", name: "Alongamento em fibra", price: 210, priceLabel: "R$ 210,00", duration: "2h" },
    ],
    rating: "5,0",
    __isFallback: true,
  },
];

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

const setRequestFeedback = (message, type = "") => {
  if (!requestFeedback) {
    return;
  }
  requestFeedback.textContent = message;
  requestFeedback.classList.remove("auth-status--error", "auth-status--success");
  requestFeedback.hidden = !message;
  if (type) {
    requestFeedback.classList.add(`auth-status--${type}`);
  }
};

const resetDashboard = () => {
  pendingList.innerHTML = "";
  confirmedList.innerHTML = "";
  pastList.innerHTML = "";
  updateMetrics([], [], []);
  currentProfile = null;
  fallbackProfileEmail = "";
  profileNameElements.forEach((element) => {
    element.textContent = "cliente";
  });
  profileDisplay.textContent = "—";
  profileEmail.textContent = "—";
  profilePhone.textContent = "—";
  profileAddress.textContent = "—";
  if (professionalResults) {
    professionalResults.innerHTML = "";
  }
  if (professionalResultsEmpty) {
    professionalResultsEmpty.hidden = true;
  }
  if (requestFeedback) {
    requestFeedback.textContent = "";
    requestFeedback.hidden = true;
    requestFeedback.classList.remove("auth-status--error", "auth-status--success");
  }
  if (requestForm) {
    requestForm.reset();
  }
  requestFields.forEach((field) => {
    field.hidden = true;
  });
  if (requestSubmitButton) {
    requestSubmitButton.disabled = true;
  }
  selectedProfessional = null;
  selectedService = null;
  professionalsCatalog = [];
  filteredProfessionals = [];
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
      <p class="schedule-card__service">${appointment.service || "Serviço NailNow"}</p>
      <h3 class="schedule-card__client">${appointment.professional || "Profissional NailNow"}</h3>
    </div>
    <span class="schedule-card__id">${appointment.id || "—"}</span>
  `;
  wrapper.appendChild(heading);

  const details = document.createElement("div");
  details.className = "schedule-card__details";

  const eventDate = parseDateValue(appointment.date, appointment.time);
  const formattedDate = eventDate ? dateFormatter.format(eventDate) : appointment.date || "—";
  const formattedTime = eventDate ? timeFormatter.format(eventDate) : appointment.time || "—";

  const location = appointment.location || appointment.address || "Defina o endereço combinado";

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
        <dd>${location}</dd>
      </div>
      <div>
        <dt>Valor</dt>
        <dd>${formatCurrency(appointment.price)}</dd>
      </div>
    </dl>
  `;

  if (appointment.note || appointment.observacao) {
    const note = document.createElement("p");
    note.className = "schedule-card__note";
    note.textContent = appointment.note || appointment.observacao;
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

const getProfessionalDisplayName = (professional) => {
  return (
    professional?.nome ||
    professional?.name ||
    professional?.displayName ||
    professional?.fantasia ||
    professional?.razaoSocial ||
    "Manicure NailNow"
  );
};

const normalizeProfessionalProfile = (snapshot) => {
  if (!snapshot) {
    return null;
  }
  const data = typeof snapshot.data === "function" ? snapshot.data() : snapshot;
  const id = snapshot.id || data.id;
  if (!id) {
    return null;
  }

  const services = collectProfessionalServices(data);
  const neighborhood = data.bairro || data.neighborhood;
  const city = data.cidade || data.city;
  const state = data.estado || data.state || data.uf;
  const areaSource = data.atendimento || data.area || data.regiao || "";
  const areaParts = sanitizeAreaParts([neighborhood, city, state]);
  const fallbackArea = stripPostalCode(areaSource);
  const area = areaParts.length ? areaParts.join(" · ") : fallbackArea;
  const ratingRaw = data.avaliacao || data.rating || data.nota || data.mediaAvaliacoes;
  const rating = typeof ratingRaw === "number" ? ratingRaw.toFixed(1) : ratingRaw;
  const collectionName = snapshot.ref?.parent?.id || data.collection || "profissionais";

  return {
    id,
    nome: getProfessionalDisplayName(data),
    area,
    rating,
    servicos: services,
    collection: collectionName,
    email: data.email || data.emailLowercase || data.contato?.email || "",
    telefone: data.telefone || data.phone || data.celular || "",
    raw: data,
    __isFallback: Boolean(data.__isFallback),
  };
};

const renderProfessionalResults = (items = []) => {
  if (!professionalResults || !professionalResultsEmpty) {
    return;
  }
  professionalResults.innerHTML = "";

  if (!items.length) {
    professionalResultsEmpty.hidden = false;
    return;
  }

  professionalResultsEmpty.hidden = true;

  items.forEach((professional) => {
    const card = document.createElement("article");
    card.className = "request-card";
    if (selectedProfessional && selectedProfessional.id === professional.id) {
      card.classList.add("request-card--selected");
    }

    const title = document.createElement("h4");
    title.className = "request-card__title";
    title.textContent = getProfessionalDisplayName(professional);
    card.appendChild(title);

    const meta = document.createElement("p");
    meta.className = "request-card__meta";
    const metaParts = [];
    if (professional.area) {
      metaParts.push(professional.area);
    }
    if (professional.rating) {
      metaParts.push(`${professional.rating} ★`);
    }
    meta.textContent = metaParts.join(" • ") || "Área a combinar";
    card.appendChild(meta);

    const servicesListEl = document.createElement("ul");
    servicesListEl.className = "request-card__services";

    if (professional.servicos && professional.servicos.length) {
      professional.servicos.slice(0, 3).forEach((service) => {
        const item = document.createElement("li");
        item.className = "request-card__service";
        const name = document.createElement("span");
        name.textContent = service.name;
        const price = document.createElement("span");
        price.textContent = service.priceLabel || (typeof service.price === "number" ? formatCurrency(service.price) : "Sob consulta");
        item.appendChild(name);
        item.appendChild(price);
        servicesListEl.appendChild(item);
      });
    } else {
      const placeholder = document.createElement("li");
      placeholder.className = "request-card__service";
      placeholder.textContent = "A profissional confirmará os valores com você.";
      servicesListEl.appendChild(placeholder);
    }

    card.appendChild(servicesListEl);

    const selectButton = document.createElement("button");
    selectButton.type = "button";
    selectButton.className = "request-card__select";
    if (professional.__isFallback) {
      selectButton.textContent = "Exemplo";
      selectButton.disabled = true;
      selectButton.title = "Faça login com sua conta para solicitar manicures reais.";
    } else {
      selectButton.textContent = "Selecionar manicure";
      selectButton.addEventListener("click", () => {
        selectProfessional(professional);
      });
    }
    card.appendChild(selectButton);

    professionalResults.appendChild(card);
  });
};

const updateRequestSubmitState = () => {
  if (!requestSubmitButton) {
    return;
  }
  const hasSchedule = Boolean(requestDateInput?.value && requestTimeInput?.value);
  const hasSelection = Boolean(selectedProfessional && selectedService);
  requestSubmitButton.disabled = !(hasSchedule && hasSelection);
};

const populateRequestForm = (professional) => {
  if (!requestForm || !requestProfessionalInput) {
    return;
  }

  if (requestFormEmpty) {
    requestFormEmpty.hidden = true;
  }

  requestFields.forEach((field) => {
    field.hidden = false;
  });

  const areaLabel = professional.area ? ` — ${professional.area}` : "";
  requestProfessionalInput.value = `${getProfessionalDisplayName(professional)}${areaLabel}`;

  if (requestServiceSelect) {
    requestServiceSelect.innerHTML = "";
    if (professional.servicos && professional.servicos.length) {
      professional.servicos.forEach((service, index) => {
        const option = document.createElement("option");
        option.value = service.id || `service-${index}`;
        option.textContent = `${service.name} — ${service.priceLabel || (typeof service.price === "number" ? formatCurrency(service.price) : "Sob consulta")}`;
        option.dataset.serviceIndex = String(index);
        requestServiceSelect.appendChild(option);
      });
      requestServiceSelect.disabled = false;
      requestServiceSelect.selectedIndex = 0;
      selectedService = professional.servicos[0];
    } else {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "Serviços serão combinados diretamente com a manicure";
      requestServiceSelect.appendChild(option);
      requestServiceSelect.disabled = true;
      selectedService = {
        id: "manual-service",
        name: "Serviço NailNow",
        price: null,
        priceLabel: "Sob consulta",
        duration: "",
      };
    }
  }

  if (requestPriceInput) {
    if (selectedService?.priceLabel) {
      requestPriceInput.value = selectedService.priceLabel;
    } else if (typeof selectedService?.price === "number") {
      requestPriceInput.value = formatCurrency(selectedService.price);
    } else {
      requestPriceInput.value = "Sob consulta";
    }
  }

  if (requestLocationInput && !requestLocationInput.value && currentProfile?.endereco) {
    requestLocationInput.value = currentProfile.endereco;
  }

  setRequestFeedback("");
  updateRequestSubmitState();
};

const selectProfessional = (professional) => {
  selectedProfessional = professional;
  selectedService = professional.servicos?.[0] || null;
  renderProfessionalResults(filteredProfessionals);
  populateRequestForm(professional);
};

const filterProfessionals = (term) => {
  if (!term) {
    filteredProfessionals = [...professionalsCatalog];
  } else {
    const normalized = term.trim().toLowerCase();
    filteredProfessionals = professionalsCatalog.filter((professional) => {
      const keywords = [
        professional.nome,
        professional.area,
        ...(professional.servicos || []).map((service) => service.name),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return keywords.includes(normalized);
    });
  }
  renderProfessionalResults(filteredProfessionals);
};

const loadProfessionalsCatalog = async () => {
  if (!professionalResults) {
    return;
  }

  setRequestFeedback("");

  let catalog = [];
  try {
    const professionalsRef = collection(db, "profissionais");
    const snapshot = await getDocs(query(professionalsRef, limit(24)));
    if (snapshot.empty) {
      catalog = defaultProfessionalCatalog;
    } else {
      catalog = snapshot.docs
        .map((docSnap) => normalizeProfessionalProfile(docSnap))
        .filter(Boolean)
        .map((item) => ({ ...item, __isFallback: false }));
    }
  } catch (error) {
    console.warn("Não foi possível carregar o catálogo de manicures", error);
    if (error.code === "permission-denied") {
      setRequestFeedback(
        "Não foi possível listar as manicures agora. Avise o suporte NailNow para liberar o acesso.",
        "error",
      );
    }
    catalog = defaultProfessionalCatalog;
  }

  catalog.sort((a, b) => {
    const nameA = getProfessionalDisplayName(a).toLowerCase();
    const nameB = getProfessionalDisplayName(b).toLowerCase();
    return nameA.localeCompare(nameB, "pt-BR");
  });

  professionalsCatalog = catalog;
  if (!catalog.some((professional) => professional.id === selectedProfessional?.id)) {
    selectedProfessional = null;
    selectedService = null;
    requestFields.forEach((field) => {
      field.hidden = true;
    });
    if (requestFormEmpty) {
      requestFormEmpty.hidden = false;
    }
    if (requestProfessionalInput) {
      requestProfessionalInput.value = "";
    }
    if (requestPriceInput) {
      requestPriceInput.value = "";
    }
  }
  filteredProfessionals = [...catalog];
  renderProfessionalResults(filteredProfessionals);
  updateRequestSubmitState();
};

const handleServiceSelectionChange = () => {
  if (!requestServiceSelect || !selectedProfessional) {
    return;
  }
  const selectedOption = requestServiceSelect.selectedOptions?.[0];
  const index = selectedOption ? Number.parseInt(selectedOption.dataset.serviceIndex || "-1", 10) : -1;
  if (!Number.isNaN(index) && selectedProfessional.servicos?.[index]) {
    selectedService = selectedProfessional.servicos[index];
  }

  if (requestPriceInput) {
    if (selectedService?.priceLabel) {
      requestPriceInput.value = selectedService.priceLabel;
    } else if (typeof selectedService?.price === "number") {
      requestPriceInput.value = formatCurrency(selectedService.price);
    } else {
      requestPriceInput.value = "Sob consulta";
    }
  }

  updateRequestSubmitState();
};

const buildRequestPayload = (requestId, location, notes) => {
  const professionalCollection = selectedProfessional.collection || "profissionais";
  const clientCollection = currentProfile.collection || PROFILE_COLLECTIONS[0];
  const priceLabel =
    selectedService?.priceLabel ||
    (typeof selectedService?.price === "number" ? formatCurrency(selectedService.price) : "Sob consulta");

  return {
    id: requestId,
    status: "pending",
    service: selectedService?.name || "Serviço NailNow",
    serviceId: selectedService?.id || "",
    price: typeof selectedService?.price === "number" ? selectedService.price : null,
    priceLabel,
    professional: getProfessionalDisplayName(selectedProfessional),
    professionalId: selectedProfessional.id,
    professionalCollection,
    professionalEmail: selectedProfessional.email || "",
    client: currentProfile.nome || currentProfile.name || currentProfile.email || "Cliente NailNow",
    clientId: currentProfile.id,
    clientCollection,
    clientEmail: currentProfile.email || fallbackProfileEmail || "",
    date: requestDateInput.value,
    time: requestTimeInput.value,
    location,
    note: notes,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
};

const handleRequestSubmission = async (event) => {
  event.preventDefault();
  if (!currentProfile?.id) {
    setRequestFeedback("Sua sessão expirou. Faça login novamente.", "error");
    return;
  }
  if (!selectedProfessional || !selectedService) {
    setRequestFeedback("Selecione uma manicure e um serviço antes de enviar.", "error");
    return;
  }
  if (!requestDateInput?.value || !requestTimeInput?.value) {
    setRequestFeedback("Informe a data e o horário desejados.", "error");
    return;
  }

  const location = (requestLocationInput?.value || currentProfile?.endereco || "").trim();
  const notes = (requestNotesInput?.value || "").trim();

  if (requestSubmitButton) {
    requestSubmitButton.disabled = true;
  }
  setRequestFeedback("Enviando sua solicitação...");

  try {
    const professionalCollection = selectedProfessional.collection || "profissionais";
    const professionalRef = doc(db, professionalCollection, selectedProfessional.id);
    const professionalPendingRef = doc(collection(professionalRef, appointmentCollections.pending));
    const requestId = professionalPendingRef.id;

    const clientCollection = currentProfile.collection || PROFILE_COLLECTIONS[0];
    const clientRef = doc(db, clientCollection, currentProfile.id);
    const clientPendingRef = doc(collection(clientRef, appointmentCollections.pending), requestId);

    const payload = buildRequestPayload(requestId, location, notes);

    await Promise.all([
      setDoc(professionalPendingRef, payload),
      setDoc(clientPendingRef, payload),
    ]);

    setRequestFeedback("Solicitação enviada! A manicure responderá pelo portal.", "success");

    if (requestDateInput) {
      requestDateInput.value = "";
    }
    if (requestTimeInput) {
      requestTimeInput.value = "";
    }
    if (requestNotesInput) {
      requestNotesInput.value = "";
    }

    updateRequestSubmitState();
    await loadAppointmentsForProfile(currentProfile);
  } catch (error) {
    console.error("Não foi possível registrar a solicitação", error);
    if (error.code === "permission-denied") {
      setRequestFeedback(
        "Seu acesso não tem permissão para enviar solicitações agora. Avise o suporte NailNow.",
        "error",
      );
    } else {
      setRequestFeedback("Não foi possível enviar sua solicitação. Tente novamente em instantes.", "error");
    }
  } finally {
    if (requestSubmitButton) {
      requestSubmitButton.disabled = false;
    }
  }
};

professionalSearchInput?.addEventListener("input", (event) => {
  filterProfessionals(event.target.value);
});

requestServiceSelect?.addEventListener("change", handleServiceSelectionChange);
requestDateInput?.addEventListener("change", updateRequestSubmitState);
requestTimeInput?.addEventListener("change", updateRequestSubmitState);
requestLocationInput?.addEventListener("input", () => setRequestFeedback(""));
requestNotesInput?.addEventListener("input", () => setRequestFeedback(""));
requestForm?.addEventListener("submit", handleRequestSubmission);

const updateMetrics = (pending, confirmed, past) => {
  metricPending.textContent = pending.length;
  badgePending.textContent = pending.length;
  metricConfirmed.textContent = confirmed.length;
  badgeConfirmed.textContent = confirmed.length;
  metricPast.textContent = past.length;
  badgePast.textContent = past.length;
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
    ? "Não conseguimos carregar sua agenda completa agora. Mostramos um exemplo enquanto sincronizamos seus dados."
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

const collectProfessionalServices = (profile) => {
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
    telefone: profile.telefone || profile.phone || profile.celular || "",
    endereco: profile.endereco || profile.address || profile.endereco_formatado || "",
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
        const clienteQuery = query(collection(db, collectionName), where(field, "==", value), limit(1));
        const snapshot = await getDocs(clienteQuery);
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
        console.warn(`Falha ao buscar cliente pelo campo ${field} na coleção ${collectionName}`, error);
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
      console.warn(`Falha ao buscar cliente pelo UID na coleção ${collectionName}`, error);
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

const updateProfileDisplay = (profile, fallbackEmail = "") => {
  if (!profile) {
    return;
  }

  const emailForDisplay =
    profile.email || profile.emailLowercase || fallbackEmail || fallbackProfileEmail || "";
  const displayName = profile.nome || profile.name || emailForDisplay || "cliente";
  const phoneForDisplay = profile.telefone || profile.celular || profile.phone || "";
  const addressForDisplay = profile.endereco || profile.address || profile.endereco_formatado || "";

  profileNameElements.forEach((element) => {
    element.textContent = displayName;
  });
  profileDisplay.textContent = displayName;
  profileEmail.textContent = emailForDisplay || "—";
  profilePhone.textContent = phoneForDisplay || "Atualize seu telefone";
  profileAddress.textContent = addressForDisplay || "Atualize seu endereço preferido";
};

const hydrateDashboard = async (profile, fallbackEmail = "") => {
  fallbackProfileEmail = fallbackEmail || profile.email || profile.emailLowercase || fallbackProfileEmail || "";
  currentProfile = {
    ...profile,
    collection: profile.collection || PROFILE_COLLECTIONS[0],
  };
  if (!currentProfile.email && fallbackProfileEmail) {
    currentProfile.email = fallbackProfileEmail;
  }

  updateProfileDisplay(currentProfile, fallbackEmail);
  await loadProfessionalsCatalog();
  return loadAppointmentsForProfile(currentProfile);
};

const handleAuthError = (error) => {
  const code = error.code || error.message;
  if (code === "auth/invalid-email") {
    setStatus("O e-mail informado é inválido. Verifique e tente novamente.", "error");
  } else if (code === "auth/invalid-credential" || code === "auth/wrong-password") {
    setStatus("Credenciais não conferem. Confira sua senha e tente novamente.", "error");
  } else if (code === "auth/user-not-found" || code === "profile-not-found") {
    setStatus("Não localizamos uma cliente com esse e-mail.", "error");
  } else if (code === "auth/user-disabled") {
    setStatus("Este acesso foi desativado. Fale com o suporte NailNow.", "error");
  } else if (code === "auth/too-many-requests") {
    setStatus("Muitas tentativas de acesso. Aguarde alguns instantes e tente novamente.", "error");
  } else if (code === "firestore-permission-denied" || code === "permission-denied") {
    setStatus(
      "Não foi possível acessar seus dados agora. Atualize a página ou fale com o suporte NailNow.",
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

signOutButton?.addEventListener("click", async () => {
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
  window.location.href = "/cliente/index.html";
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    clearSession();
    dashboard.hidden = true;
    resetDashboard();
    setStatus("");
    window.location.replace("/cliente/index.html");
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
