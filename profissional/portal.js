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
  writeBatch,
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
const MAX_SERVICE_ENTRIES = 5;
const FIXED_SERVICE_NAMES = [
  "Manicure clássica",
  "Spa das mãos",
  "Blindagem",
  "Alongamento em fibra",
  "Manutenção",
];
const getFixedServiceName = (index) => FIXED_SERVICE_NAMES[index] || `Serviço ${index + 1}`;

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
const availabilityForm = document.getElementById("availability-form");
const availabilityAddressInput = document.getElementById("availability-address");
const availabilityCityInput = document.getElementById("availability-city");
const availabilityStateInput = document.getElementById("availability-state");
const availabilityRadiusInput = document.getElementById("availability-radius");
const availabilityDetectButton = document.getElementById("availability-detect");
const availabilityGeocodeButton = document.getElementById("availability-geocode");
const availabilityLocationStatus = document.getElementById("availability-location-status");
const availabilityDaysContainer = document.getElementById("availability-days");
const availabilityStartInput = document.getElementById("availability-start");
const availabilityEndInput = document.getElementById("availability-end");
const availabilityAddSlotButton = document.getElementById("availability-add-slot");
const availabilitySlotsList = document.getElementById("availability-slots");
const availabilitySlotsEmpty = document.getElementById("availability-slots-empty");
const availabilityFeedback = document.getElementById("availability-feedback");
const serviceNameInputs = Array.from({ length: MAX_SERVICE_ENTRIES }, (_, index) =>
  document.getElementById(`service-name-${index}`),
);
const servicePriceInputs = Array.from({ length: MAX_SERVICE_ENTRIES }, (_, index) =>
  document.getElementById(`service-price-${index}`),
);
const serviceDurationInputs = Array.from({ length: MAX_SERVICE_ENTRIES }, (_, index) =>
  document.getElementById(`service-duration-${index}`),
);
const serviceTitleElements = Array.from(document.querySelectorAll("[data-service-title]"));

serviceTitleElements.forEach((element, index) => {
  element.textContent = getFixedServiceName(index);
});

serviceNameInputs.forEach((input, index) => {
  if (input) {
    input.value = getFixedServiceName(index);
  }
});
let currentProfile = null;
let fallbackProfileEmail = "";
let availabilitySlots = [];
let geocodeAbortController = null;
let availabilityCoordinates = null;

const resolveServiceOrder = (service, fallback) => {
  if (!service || typeof service !== "object") {
    return fallback;
  }
  const candidates = [service.order, service.ordem, service.posicao, service.position, service.index];
  for (const candidate of candidates) {
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return candidate;
    }
  }
  return fallback;
};

const sortServicesByOrder = (items = []) => {
  return items
    .map((service, index) => ({ service, index, order: resolveServiceOrder(service, index) }))
    .sort((a, b) => a.order - b.order)
    .map((entry, index) => ({ ...entry.service, ordem: index, order: index }));
};

const getExistingServiceEntry = (index) => {
  const sources = [
    currentProfile?.servicos,
    currentProfile?.services,
    currentProfile?.pricing?.servicos,
    currentProfile?.pricing?.services,
  ];
  for (const source of sources) {
    if (Array.isArray(source) && source[index]) {
      return source[index];
    }
  }
  return null;
};

const resolveServiceOrder = (service, fallback) => {
  if (!service || typeof service !== "object") {
    return fallback;
  }
  const candidates = [service.order, service.ordem, service.posicao, service.position, service.index];
  for (const candidate of candidates) {
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return candidate;
    }
  }
  return fallback;
};

const sortServicesByOrder = (items = []) => {
  return items
    .map((service, index) => ({ service, index, order: resolveServiceOrder(service, index) }))
    .sort((a, b) => a.order - b.order)
    .map((entry, index) => ({ ...entry.service, ordem: index, order: index }));
};

const getExistingServiceEntry = (index) => {
  const sources = [
    currentProfile?.servicos,
    currentProfile?.services,
    currentProfile?.pricing?.servicos,
    currentProfile?.pricing?.services,
  ];
  for (const source of sources) {
    if (Array.isArray(source) && source[index]) {
      return source[index];
    }
  }
  return null;
};

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

const NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search";
const NOMINATIM_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse";
const NOMINATIM_EMAIL = "suporte@nailnow.app";
const WEEKDAY_OPTIONS = [
  { value: "monday", label: "Seg" },
  { value: "tuesday", label: "Ter" },
  { value: "wednesday", label: "Qua" },
  { value: "thursday", label: "Qui" },
  { value: "friday", label: "Sex" },
  { value: "saturday", label: "Sáb" },
  { value: "sunday", label: "Dom" },
];
const WEEKDAY_LABEL_LOOKUP = new Map(WEEKDAY_OPTIONS.map(({ value, label }) => [value, label]));

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
  if (availabilityForm) {
    availabilityForm.reset();
  }
  availabilitySlots = [];
  renderAvailabilitySlots();
  setAvailabilityStatus("");
  setAvailabilityFeedback("");
  availabilityCoordinates = null;
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
    } else if (typeof service.priceLabel === "string") {
      const trimmedLabel = service.priceLabel.trim();
      price.textContent = trimmedLabel || "Sob consulta";
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


const toNumberOrNull = (value) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const normalized = value.replace(/[^0-9,.-]+/g, "").replace(/,/g, ".");
    if (!normalized) {
      return null;
    }
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const normalizeWeekdayValue = (value) => {
  const normalized = (value || "").toString().toLowerCase();
  const mapping = {
    monday: "monday",
    mon: "monday",
    segunda: "monday",
    seg: "monday",
    tuesday: "tuesday",
    tue: "tuesday",
    terça: "tuesday",
    terca: "tuesday",
    ter: "tuesday",
    wednesday: "wednesday",
    wed: "wednesday",
    quarta: "wednesday",
    qua: "wednesday",
    thursday: "thursday",
    thu: "thursday",
    quinta: "thursday",
    qui: "thursday",
    friday: "friday",
    fri: "friday",
    sexta: "friday",
    sex: "friday",
    saturday: "saturday",
    sat: "saturday",
    sabado: "saturday",
    sábado: "saturday",
    sab: "saturday",
    sunday: "sunday",
    sun: "sunday",
    domingo: "sunday",
    dom: "sunday",
  };
  return mapping[normalized] || null;
};

const setAvailabilityStatus = (message, type = "") => {
  if (!availabilityLocationStatus) {
    return;
  }
  availabilityLocationStatus.textContent = message;
  availabilityLocationStatus.hidden = !message;
  availabilityLocationStatus.classList.remove("auth-status--error", "auth-status--success");
  if (type) {
    availabilityLocationStatus.classList.add(`auth-status--${type}`);
  }
};

const setAvailabilityFeedback = (message, type = "") => {
  if (!availabilityFeedback) {
    return;
  }
  availabilityFeedback.textContent = message;
  availabilityFeedback.hidden = !message;
  availabilityFeedback.classList.remove("auth-status--error", "auth-status--success");
  if (type) {
    availabilityFeedback.classList.add(`auth-status--${type}`);
  }
};

const getSelectedAvailabilityDays = () => {
  if (!availabilityDaysContainer) {
    return [];
  }
  return Array.from(availabilityDaysContainer.querySelectorAll('input[type="checkbox"]:checked')).map(
    (input) => input.value,
  );
};

const renderAvailabilitySlots = () => {
  if (!availabilitySlotsList || !availabilitySlotsEmpty) {
    return;
  }
  availabilitySlotsList.innerHTML = "";
  if (!availabilitySlots.length) {
    availabilitySlotsEmpty.hidden = false;
    return;
  }
  availabilitySlotsEmpty.hidden = true;
  availabilitySlots.forEach((slot, index) => {
    const item = document.createElement("li");
    item.className = "availability-slots__item";
    const dayLabels = (slot.days || [])
      .map((day) => WEEKDAY_LABEL_LOOKUP.get(day) || day)
      .join(", ");
    const label = document.createElement("span");
    label.className = "availability-slots__label";
    label.textContent = dayLabels || "Dias a combinar";
    const time = document.createElement("span");
    time.className = "availability-slots__time";
    time.textContent = `${slot.start} – ${slot.end}`;
    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "availability-slots__remove";
    removeButton.textContent = "Remover";
    removeButton.addEventListener("click", () => {
      availabilitySlots.splice(index, 1);
      renderAvailabilitySlots();
    });
    item.append(label, time, removeButton);
    availabilitySlotsList.appendChild(item);
  });
};

const applyAvailabilityCoordinates = (coords) => {
  if (!coords) {
    availabilityCoordinates = null;
    return;
  }
  const latCandidate =
    coords.latitude ?? coords.lat ?? coords._lat ?? coords.x ?? coords[0] ?? null;
  const lngCandidate =
    coords.longitude ?? coords.lng ?? coords._long ?? coords.lon ?? coords.y ?? coords[1] ?? null;
  const latitude = Number.parseFloat(latCandidate);
  const longitude = Number.parseFloat(lngCandidate);
  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    availabilityCoordinates = { latitude, longitude };
  } else {
    availabilityCoordinates = null;
  }
};

const populateAddressFromGeocode = (result) => {
  if (!result) {
    return;
  }
  const { coords, label, raw } = result;
  if (availabilityAddressInput && label) {
    availabilityAddressInput.value = label;
  }
  if (coords) {
    applyAvailabilityCoordinates(coords);
  }
  const address = raw?.address;
  if (!address) {
    return;
  }
  if (availabilityCityInput && !availabilityCityInput.value) {
    availabilityCityInput.value =
      address.city || address.town || address.village || address.hamlet || availabilityCityInput.value;
  }
  if (availabilityStateInput && !availabilityStateInput.value) {
    const state = address.state_code || address.state || address.region || "";
    availabilityStateInput.value = state ? state.slice(0, 2).toUpperCase() : "";
  }
};

const geocodeAddress = async (query, signal) => {
  const params = new URLSearchParams({
    format: "json",
    addressdetails: "1",
    limit: "1",
    q: query,
    email: NOMINATIM_EMAIL,
  });
  const fetchOptions = { headers: { "Accept-Language": "pt-BR" } };
  if (signal) {
    fetchOptions.signal = signal;
  }
  const response = await fetch(`${NOMINATIM_SEARCH_URL}?${params.toString()}`, fetchOptions);
  if (!response.ok) {
    const error = new Error("geocode-failed");
    error.status = response.status;
    throw error;
  }
  const payload = await response.json();
  if (!Array.isArray(payload) || !payload.length) {
    return null;
  }
  const candidate = payload[0];
  const latitude = Number.parseFloat(candidate.lat);
  const longitude = Number.parseFloat(candidate.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }
  return {
    coords: { latitude, longitude },
    label: candidate.display_name || query,
    raw: candidate,
  };
};

const reverseGeocodeCoordinates = async (coords, signal) => {
  const params = new URLSearchParams({
    format: "json",
    addressdetails: "1",
    zoom: "16",
    lat: String(coords.latitude),
    lon: String(coords.longitude),
    email: NOMINATIM_EMAIL,
  });
  const fetchOptions = { headers: { "Accept-Language": "pt-BR" } };
  if (signal) {
    fetchOptions.signal = signal;
  }
  const response = await fetch(`${NOMINATIM_REVERSE_URL}?${params.toString()}`, fetchOptions);
  if (!response.ok) {
    const error = new Error("reverse-geocode-failed");
    error.status = response.status;
    throw error;
  }
  const payload = await response.json();
  return {
    label: payload.display_name || "",
    raw: payload,
  };
};

const handleAvailabilityGeocode = async () => {
  if (!availabilityAddressInput) {
    return;
  }
  const query = availabilityAddressInput.value.trim();
  if (!query) {
    setAvailabilityStatus("Informe um endereço para buscar.", "error");
    return;
  }
  if (geocodeAbortController) {
    geocodeAbortController.abort();
  }
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  geocodeAbortController = controller;
  setAvailabilityStatus("Buscando o endereço informado...");
  try {
    const result = await geocodeAddress(query, controller ? controller.signal : undefined);
    if (!result) {
      setAvailabilityStatus("Não encontramos esse endereço. Ajuste os detalhes e tente novamente.", "error");
      return;
    }
    populateAddressFromGeocode(result);
    setAvailabilityStatus("Endereço localizado!", "success");
  } catch (error) {
    if (error.name === "AbortError") {
      return;
    }
    console.warn("Falha ao buscar endereço da profissional", error);
    setAvailabilityStatus("Não foi possível buscar o endereço agora. Tente novamente em instantes.", "error");
  } finally {
    if (geocodeAbortController === controller) {
      geocodeAbortController = null;
    }
  }
};

const handleAvailabilityDetect = () => {
  if (!navigator.geolocation) {
    setAvailabilityStatus("Seu navegador não permite detectar a localização automaticamente.", "error");
    return;
  }
  if (geocodeAbortController) {
    geocodeAbortController.abort();
    geocodeAbortController = null;
  }
  if (availabilityDetectButton) {
    availabilityDetectButton.disabled = true;
  }
  setAvailabilityStatus("Buscando sua localização atual...");
  navigator.geolocation.getCurrentPosition(
    async (position) => {
      if (availabilityDetectButton) {
        availabilityDetectButton.disabled = false;
      }
      const coords = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
      applyAvailabilityCoordinates(coords);
      const fallbackLabel = `Coordenadas aproximadas (${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)})`;
      const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
      geocodeAbortController = controller;
      try {
        const result = await reverseGeocodeCoordinates(coords, controller ? controller.signal : undefined);
        const label = result?.label || fallbackLabel;
        populateAddressFromGeocode({ coords, label, raw: result?.raw });
        setAvailabilityStatus("Localização atual definida automaticamente!", "success");
      } catch (error) {
        if (error.name === "AbortError") {
          return;
        }
        console.warn("Falha ao identificar endereço da localização atual", error);
        populateAddressFromGeocode({ coords, label: fallbackLabel });
        setAvailabilityStatus("Localização capturada! Ajuste o endereço se preferir.");
      } finally {
        if (geocodeAbortController === controller) {
          geocodeAbortController = null;
        }
      }
    },
    (error) => {
      if (availabilityDetectButton) {
        availabilityDetectButton.disabled = false;
      }
      let message = "Não foi possível obter sua localização.";
      if (error.code === error.PERMISSION_DENIED) {
        message = "Precisamos da sua permissão para usar a localização automática.";
      } else if (error.code === error.POSITION_UNAVAILABLE) {
        message = "Não conseguimos acessar o serviço de localização. Tente novamente em instantes.";
      } else if (error.code === error.TIMEOUT) {
        message = "A busca pela localização demorou demais. Tente novamente.";
      }
      setAvailabilityStatus(message, "error");
    },
    {
      enableHighAccuracy: false,
      timeout: 15000,
      maximumAge: 0,
    },
  );
};

const handleAddAvailabilitySlot = () => {
  const days = getSelectedAvailabilityDays()
    .map((value) => normalizeWeekdayValue(value))
    .filter(Boolean);
  const start = availabilityStartInput?.value || "";
  const end = availabilityEndInput?.value || "";
  if (!days.length) {
    setAvailabilityStatus("Selecione pelo menos um dia da semana.", "error");
    return;
  }
  if (!start || !end) {
    setAvailabilityStatus("Informe os horários inicial e final.", "error");
    return;
  }
  if (start >= end) {
    setAvailabilityStatus("O horário final deve ser maior que o inicial.", "error");
    return;
  }
  availabilitySlots.push({
    id: `slot-${Date.now()}-${availabilitySlots.length}`,
    days,
    start,
    end,
  });
  if (availabilityDaysContainer) {
    availabilityDaysContainer.querySelectorAll('input[type="checkbox"]').forEach((input) => {
      input.checked = false;
    });
  }
  if (availabilityStartInput) {
    availabilityStartInput.value = "";
  }
  if (availabilityEndInput) {
    availabilityEndInput.value = "";
  }
  setAvailabilityStatus("Faixa de atendimento adicionada!", "success");
  renderAvailabilitySlots();
};

const parsePriceInput = (value) => {
  const numeric = toNumberOrNull(value);
  if (numeric === null) {
    return { amount: null, label: value.trim() };
  }
  return { amount: numeric, label: formatCurrency(numeric) };
};

const setServiceDurationValue = (select, value) => {
  if (!select) {
    return;
  }
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) {
    select.value = "";
    return;
  }
  const options = Array.from(select.options || []);
  const hasOption = options.some((option) => option.value === normalized);
  if (!hasOption) {
    const option = document.createElement("option");
    option.value = normalized;
    option.textContent = normalized;
    option.dataset.customOption = "true";
    select.appendChild(option);
  }
  select.value = normalized;
};

const gatherServiceEntries = () => {
  const services = [];
  for (let index = 0; index < MAX_SERVICE_ENTRIES; index += 1) {
    const nameInput = serviceNameInputs[index];
    const priceInput = servicePriceInputs[index];
    const durationInput = serviceDurationInputs[index];
    const fixedName = getFixedServiceName(index);
    const priceRaw = priceInput?.value?.trim() || "";
    const duration = durationInput?.value?.trim() || "";
    if (!priceRaw && !duration) {
      continue;
    }
    const existing = getExistingServiceEntry(index);
    const { amount, label } = parsePriceInput(priceRaw);
    const resolvedName = fixedName;
    const resolvedDuration =
      duration || existing?.duracao || existing?.duration || existing?.tempo || existing?.time || "";
    const numericPrice = typeof amount === "number" ? amount : null;
    const priceLabelSource =
      label ||
      existing?.priceLabel ||
      existing?.precoTexto ||
      existing?.valorTexto ||
      (typeof numericPrice === "number" ? formatCurrency(numericPrice) : "");
    const normalizedPriceLabel = priceLabelSource ? priceLabelSource.trim() : "";
    const finalPriceLabel = normalizedPriceLabel || "Sob consulta";
    const id =
      existing?.id ||
      existing?.uid ||
      existing?.slug ||
      existing?.codigo ||
      (nameInput?.dataset?.serviceId ? nameInput.dataset.serviceId : `service-${index + 1}`);
    const order = index;
    const amountValue = numericPrice;
    const service = {
      id,
      ordem: order,
      order,
      nome: resolvedName,
      name: resolvedName,
      duracao: resolvedDuration,
      duration: resolvedDuration,
      price: typeof amountValue === "number" ? amountValue : null,
      preco: typeof amountValue === "number" ? amountValue : null,
      priceLabel: finalPriceLabel,
      precoTexto: finalPriceLabel,
      valorTexto: finalPriceLabel,
    };
    services.push(service);
  }
  return sortServicesByOrder(services);
};

const createServiceStoragePayload = (service, index) => {
  if (!service || typeof service !== "object") {
    return null;
  }
  const order = resolveServiceOrder(service, index);
  const name = getFixedServiceName(index);
  const duration = service.duracao || service.duration || service.tempo || service.time || "";
  const amount =
    typeof service.price === "number"
      ? service.price
      : typeof service.preco === "number"
      ? service.preco
      : null;
  const priceLabelSource =
    service.priceLabel ||
    service.precoTexto ||
    service.valorTexto ||
    (typeof amount === "number" ? formatCurrency(amount) : "");
  const normalizedPriceLabel = priceLabelSource ? priceLabelSource.trim() : "";
  const priceLabel = normalizedPriceLabel || "Sob consulta";
  return {
    id: service.id || `service-${index + 1}`,
    ordem: order,
    order,
    nome: name,
    name,
    duracao: duration,
    duration,
    preco: typeof amount === "number" ? amount : null,
    price: typeof amount === "number" ? amount : null,
    priceLabel,
    precoTexto: priceLabel,
    valorTexto: priceLabel,
  };
};

const buildAvailabilityPayload = () => {
  const address = availabilityAddressInput?.value?.trim() || "";
  const city = availabilityCityInput?.value?.trim() || "";
  const state = availabilityStateInput?.value?.trim().toUpperCase() || "";
  const radius = toNumberOrNull(availabilityRadiusInput?.value);
  const coords =
    availabilityCoordinates &&
    Number.isFinite(availabilityCoordinates.latitude) &&
    Number.isFinite(availabilityCoordinates.longitude)
      ? {
          latitude: availabilityCoordinates.latitude,
          longitude: availabilityCoordinates.longitude,
        }
      : null;

  const atendimento = {
    endereco: address,
    cidade: city,
    estado: state,
    raio: typeof radius === "number" ? radius : null,
  };
  if (coords) {
    atendimento.coordenadas = coords;
    atendimento.coordinates = coords;
  }

  const areaParts = [];
  if (address) {
    areaParts.push(address);
  }
  const cityState = [city, state].filter(Boolean).join(" - ");
  if (cityState) {
    areaParts.push(cityState);
  }
  if (typeof radius === "number") {
    areaParts.push(`Raio ${radius} km`);
  }

  const services = sortServicesByOrder(gatherServiceEntries());
  const pricingServices = services.map((service) => ({ ...service }));
  const pricingPayload = {
    ...(currentProfile?.pricing && typeof currentProfile.pricing === "object" ? currentProfile.pricing : {}),
    services: pricingServices,
    updatedAt: serverTimestamp(),
  };
  const availability = availabilitySlots.map((slot) => ({
    id: slot.id,
    dias: slot.days,
    inicio: slot.start,
    fim: slot.end,
  }));

  return {
    atendimento,
    area: areaParts.join(" • "),
    servicos: services,
    services,
    pricing: pricingPayload,
    disponibilidade: availability,
    raioAtendimento: typeof radius === "number" ? radius : null,
    updatedAt: serverTimestamp(),
  };
};

const formatCoverageArea = (profile) => {
  const source = profile?.atendimento;
  if (source && typeof source === "object") {
    const parts = [];
    if (source.endereco) {
      parts.push(source.endereco);
    }
    const cityState = [source.cidade || source.city, source.estado || source.state || source.uf]
      .filter(Boolean)
      .join(" - ");
    if (cityState) {
      parts.push(cityState);
    }
    const radiusValue = toNumberOrNull(
      source.raio ?? source.radius ?? profile?.raioAtendimento ?? profile?.raio_atendimento,
    );
    if (typeof radiusValue === "number") {
      parts.push(`Raio ${radiusValue} km`);
    }
    return parts.join(" • ") || profile.area || profile.cidade || "Cadastre sua área de atendimento";
  }
  return profile?.area || profile?.cidade || "Cadastre sua área de atendimento";
};

const populateAvailabilityForm = (profile) => {
  if (!availabilityForm) {
    return;
  }
  const atendimento = profile?.atendimento && typeof profile.atendimento === "object" ? profile.atendimento : {};
  if (availabilityAddressInput) {
    availabilityAddressInput.value = atendimento.endereco || atendimento.address || "";
  }
  if (availabilityCityInput) {
    availabilityCityInput.value = atendimento.cidade || atendimento.city || "";
  }
  if (availabilityStateInput) {
    availabilityStateInput.value = (atendimento.estado || atendimento.state || atendimento.uf || "").slice(0, 2).toUpperCase();
  }
  const radiusCandidates = [
    atendimento.raio,
    atendimento.radius,
    profile?.raioAtendimento,
    profile?.raio_atendimento,
  ];
  let resolvedRadius = "";
  for (const candidate of radiusCandidates) {
    const parsed = toNumberOrNull(candidate);
    if (parsed !== null) {
      resolvedRadius = parsed;
      break;
    }
  }
  if (availabilityRadiusInput) {
    availabilityRadiusInput.value = resolvedRadius || "";
  }
  const coordinateSource =
    atendimento.coordenadas ||
    atendimento.coordinates ||
    profile?.coordenadas ||
    profile?.coordinates ||
    null;
  applyAvailabilityCoordinates(null);
  if (coordinateSource) {
    applyAvailabilityCoordinates({
      latitude: coordinateSource.latitude ?? coordinateSource.lat ?? coordinateSource._lat,
      longitude: coordinateSource.longitude ?? coordinateSource.lng ?? coordinateSource._long,
    });
  }
  const slots = toArray(profile?.disponibilidade).map((entry, index) => {
    const days = toArray(entry?.dias || entry?.days || entry?.semana || entry?.weekdays)
      .map((value) => normalizeWeekdayValue(value))
      .filter(Boolean);
    const start = entry?.inicio || entry?.start || entry?.horaInicio || entry?.horarioInicio || "";
    const end = entry?.fim || entry?.end || entry?.horaFim || entry?.horarioFim || "";
    if (!days.length || !start || !end) {
      return null;
    }
    return {
      id: entry?.id || `slot-${index}`,
      days,
      start,
      end,
    };
  });
  availabilitySlots = slots.filter(Boolean);
  renderAvailabilitySlots();
  const services = collectInlineServices(profile).slice(0, MAX_SERVICE_ENTRIES);
  for (let index = 0; index < MAX_SERVICE_ENTRIES; index += 1) {
    const service = services[index];
    if (serviceNameInputs[index]) {
      const input = serviceNameInputs[index];
      input.value = getFixedServiceName(index);
      if (service?.id) {
        input.dataset.serviceId = service.id;
      } else if (input.dataset.serviceId) {
        delete input.dataset.serviceId;
      }
    }
    if (servicePriceInputs[index]) {
      if (typeof service?.price === "number") {
        servicePriceInputs[index].value = service.price.toFixed(2).replace(".", ",");
      } else if (service?.priceLabel) {
        const label = typeof service.priceLabel === "string" ? service.priceLabel.trim() : service.priceLabel;
        servicePriceInputs[index].value = label || "";
      } else {
        servicePriceInputs[index].value = "";
      }
    }
    const durationValue = service?.duration || service?.duracao || "";
    setServiceDurationValue(serviceDurationInputs[index], durationValue);
  }
  setAvailabilityStatus("");
  setAvailabilityFeedback("");
};

const handleAvailabilitySubmit = async (event) => {
  event.preventDefault();
  if (!currentProfile?.id) {
    setAvailabilityFeedback("Sua sessão expirou. Faça login novamente.", "error");
    return;
  }
  const payload = buildAvailabilityPayload();
  const submitButton = availabilityForm?.querySelector('[type="submit"]');
  if (submitButton) {
    submitButton.disabled = true;
  }
  setAvailabilityFeedback("Salvando suas informações...");
  try {
    const collectionName = currentProfile.collection || PROFILE_COLLECTIONS[0];
    const profileRef = doc(db, collectionName, currentProfile.id);
    await setDoc(profileRef, payload, { merge: true });
    await syncServicesSubcollection({ ...currentProfile, collection: collectionName }, payload.servicos);

    const pricingBase =
      payload.pricing && typeof payload.pricing === "object"
        ? Object.fromEntries(
            Object.entries(payload.pricing).filter(([key]) => key !== "updatedAt"),
          )
        : {};
    const pricingState = {
      ...(currentProfile?.pricing && typeof currentProfile.pricing === "object" ? currentProfile.pricing : {}),
      ...pricingBase,
      services: payload.servicos,
    };

    currentProfile = {
      ...currentProfile,
      atendimento: { ...(currentProfile.atendimento || {}), ...payload.atendimento },
      disponibilidade: payload.disponibilidade,
      servicos: payload.servicos,
      services: payload.services || payload.servicos,
      pricing: pricingState,
      area: payload.area || currentProfile.area,
      raioAtendimento: payload.raioAtendimento ?? currentProfile.raioAtendimento,
    };
    setAvailabilityFeedback("Dados atualizados com sucesso!", "success");
    profileArea.textContent = formatCoverageArea(currentProfile);
    const inlineServices = collectInlineServices(currentProfile);
    if (inlineServices.length) {
      profileSpecialties.textContent = inlineServices
        .slice(0, 3)
        .map((service) => service.name)
        .join(" · ");
    }
    await loadServicesForProfile(currentProfile);
  } catch (error) {
    console.error("Não foi possível salvar a disponibilidade", error);
    if (error.code === "permission-denied") {
      setAvailabilityFeedback(
        "Seu acesso não tem permissão para atualizar esses dados. Avise o suporte NailNow.",
        "error",
      );
    } else {
      setAvailabilityFeedback("Não foi possível salvar agora. Tente novamente em instantes.", "error");
    }
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
    }
  }
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
      order: index,
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
    const orderCandidates = [entry.ordem, entry.order, entry.posicao, entry.position, entry.index];
    let order = index;
    for (const candidate of orderCandidates) {
      if (typeof candidate === "number" && Number.isFinite(candidate)) {
        order = candidate;
        break;
      }
    }
    const normalizedLabel = typeof priceLabel === "string" ? priceLabel.trim() : "";
    const finalPriceLabel = normalizedLabel || (typeof numericPrice === "number" ? formatCurrency(numericPrice) : "Sob consulta");
    return {
      id,
      name,
      price: typeof numericPrice === "number" ? numericPrice : null,
      priceLabel: finalPriceLabel,
      duration,
      order,
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

const syncServicesSubcollection = async (profile, services) => {
  if (!profile?.id) {
    return;
  }
  const collectionName = profile.collection || PROFILE_COLLECTIONS[0];
  const professionalRef = doc(db, collectionName, profile.id);
  const servicesCollectionRef = collection(professionalRef, "servicos");

  try {
    const desired = new Map();
    const batch = writeBatch(db);
    let hasOperations = false;

    (services || []).forEach((service, index) => {
      const payload = createServiceStoragePayload(service, index);
      if (!payload) {
        return;
      }
      const serviceId = payload.id || `service-${index + 1}`;
      desired.set(serviceId, payload);
      const serviceRef = doc(servicesCollectionRef, serviceId);
      batch.set(serviceRef, { ...payload, updatedAt: serverTimestamp() }, { merge: true });
      hasOperations = true;
    });

    const snapshot = await getDocs(servicesCollectionRef);
    snapshot.forEach((docSnap) => {
      if (!desired.has(docSnap.id)) {
        batch.delete(docSnap.ref);
        hasOperations = true;
      }
    });

    if (hasOperations) {
      await batch.commit();
    }
  } catch (error) {
    console.warn("Não foi possível sincronizar os serviços cadastrados", error);
    throw error;
  }
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
    const services = snapshot.docs
      .map((docSnap, index) => {
        const normalized = normalizeServiceEntry({ id: docSnap.id, ...docSnap.data() }, index);
        return normalized;
      })
      .filter(Boolean);
    return sortServicesByOrder(services);
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

  services = sortServicesByOrder(services);
  renderServices(services);

  if (profile && typeof profile === "object") {
    profile.servicos = services;
    profile.services = services;
    profile.pricing = { ...(profile.pricing || {}), services };
  }
  if (currentProfile && profile && currentProfile.id === profile.id) {
    currentProfile.servicos = services;
    currentProfile.services = services;
    currentProfile.pricing = { ...(currentProfile.pricing || {}), services };
  }
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
  const inlineServices = collectInlineServices(profile);
  if (inlineServices.length) {
    profileSpecialties.textContent = inlineServices
      .slice(0, 3)
      .map((service) => service.name)
      .join(" · ");
  } else {
    profileSpecialties.textContent =
      profile.especialidades || profile.specialties || "Cadastre seus serviços principais";
  }
  profileArea.textContent = formatCoverageArea(profile);

  populateAvailabilityForm(profile);
  await loadServicesForProfile(profile);
  return loadAppointmentsForProfile(profile);
};

availabilityAddSlotButton?.addEventListener("click", handleAddAvailabilitySlot);
availabilityForm?.addEventListener("submit", handleAvailabilitySubmit);
availabilityDetectButton?.addEventListener("click", handleAvailabilityDetect);
availabilityGeocodeButton?.addEventListener("click", handleAvailabilityGeocode);
availabilityAddressInput?.addEventListener("input", () => {
  setAvailabilityStatus("");
  applyAvailabilityCoordinates(null);
});
availabilityCityInput?.addEventListener("input", () => {
  setAvailabilityStatus("");
  applyAvailabilityCoordinates(null);
});
availabilityStateInput?.addEventListener("input", () => {
  setAvailabilityStatus("");
  applyAvailabilityCoordinates(null);
});
availabilityRadiusInput?.addEventListener("input", () => setAvailabilityStatus(""));
availabilityStartInput?.addEventListener("input", () => setAvailabilityStatus(""));
availabilityEndInput?.addEventListener("input", () => setAvailabilityStatus(""));

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
