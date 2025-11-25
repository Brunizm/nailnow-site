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
  apiKey: "AIzaSyCFLccZ3khmT8uqoye6n6kfbqMFRzeXybE",
  authDomain: "nailnow-7546c.firebaseapp.com",
  projectId: "nailnow-7546c",
  storageBucket: "nailnow-7546c.firebasestorage.app",
  messagingSenderId: "413820353687",
  appId: "1:413820353687:web:ad92108dbea59f7749fdd2",
  measurementId: "G-2YEGPEG0E1",
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
const metricCancelled = document.getElementById("metric-cancelled");
const badgePending = document.getElementById("badge-pending");
const badgeConfirmed = document.getElementById("badge-confirmed");
const badgeCancelled = document.getElementById("badge-cancelled");
const pendingList = document.getElementById("pending-list");
const confirmedList = document.getElementById("confirmed-list");
const cancelledList = document.getElementById("cancelled-list");
const professionalSearchInput = document.getElementById("professional-search");
const professionalResults = document.getElementById("professional-results");
const professionalResultsEmpty = document.getElementById("professional-results-empty");
const searchLocationInput = document.getElementById("search-location");
const searchLocationNumberInput = document.getElementById("search-location-number");
const searchLocationComplementInput = document.getElementById("search-location-complement");
const detectLocationButton = document.getElementById("detect-location");
const searchLocationStatus = document.getElementById("search-location-status");
const searchRadiusSelect = document.getElementById("search-radius");
const searchServiceSelect = document.getElementById("search-service");
const requestForm = document.getElementById("service-request-form");
const requestFormEmpty = document.getElementById("request-form-empty");
const requestFields = document.querySelectorAll("[data-request-field]");
const requestProfessionalInput = document.getElementById("request-professional");
const requestServiceSelect = document.getElementById("request-service");
const requestPriceInput = document.getElementById("request-price");
const requestDateInput = document.getElementById("request-date");
const requestTimeInput = document.getElementById("request-time");
const requestDatePickerButton = document.getElementById("request-date-picker");
const requestLocationInput = document.getElementById("request-location");
const requestLocationNumberInput = document.getElementById("request-location-number");
const requestLocationComplementInput = document.getElementById("request-location-complement");
const requestNotesInput = document.getElementById("request-notes");
const requestSubmitButton = document.getElementById("submit-request");
const requestFeedback = document.getElementById("request-feedback");
const requestServiceOptions = document.getElementById("request-service-options");
const requestServiceEmpty = document.getElementById("request-service-empty");
const searchChipLocation = document.getElementById("search-chip-location");
const searchChipService = document.getElementById("search-chip-service");
const searchChipDate = document.getElementById("search-chip-date");
const searchProgress = document.getElementById("search-progress");
const isGoogleMapsAvailable = () => Boolean(window.google?.maps);
let currentProfile = null;
let fallbackProfileEmail = "";
let professionalsCatalog = [];
let filteredProfessionals = [];
let selectedProfessional = null;
let selectedService = null;
let customerLocation = { coords: null, label: "" };
let activeRadiusKm = 10;
let activeServiceFilter = "";
let currentSearchTerm = "";
let currentSearchTokens = [];
let geocodeAbortController = null;
let mapsGeocoder = null;
const MAX_SERVICE_OPTIONS = 5;

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
const dateChipFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });
const timeChipFormatter = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });

const TIME_SLOT_START_HOUR = 7;
const TIME_SLOT_END_HOUR = 22;
const TIME_SLOT_INTERVAL_MINUTES = 30;

const formatTimeSlot = (hour, minute) => {
  return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
};

const ensureRequestTimeOptions = () => {
  if (!requestTimeInput || requestTimeInput.tagName !== "SELECT") {
    return;
  }

  const hasSlots = requestTimeInput.querySelector("option[data-slot='time']");
  if (hasSlots) {
    return;
  }

  let placeholderOption = requestTimeInput.querySelector("option[value='']");
  if (!placeholderOption) {
    placeholderOption = document.createElement("option");
    placeholderOption.value = "";
    requestTimeInput.prepend(placeholderOption);
  }
  placeholderOption.textContent = "Selecione um horário";
  placeholderOption.dataset.placeholder = "true";
  placeholderOption.disabled = true;

  const fragment = document.createDocumentFragment();
  for (let hour = TIME_SLOT_START_HOUR; hour <= TIME_SLOT_END_HOUR; hour += 1) {
    for (let minute = 0; minute < 60; minute += TIME_SLOT_INTERVAL_MINUTES) {
      if (hour === TIME_SLOT_END_HOUR && minute > 0) {
        break;
      }
      const option = document.createElement("option");
      const value = formatTimeSlot(hour, minute);
      option.value = value;
      option.textContent = value;
      option.dataset.slot = "time";
      fragment.appendChild(option);
    }
  }

  requestTimeInput.appendChild(fragment);
};

const resetRequestTimeSelect = () => {
  if (!requestTimeInput || requestTimeInput.tagName !== "SELECT") {
    return;
  }
  const placeholderOption = requestTimeInput.querySelector("option[data-placeholder='true']");
  if (placeholderOption) {
    placeholderOption.selected = true;
    requestTimeInput.value = "";
  } else {
    requestTimeInput.selectedIndex = 0;
  }
};

ensureRequestTimeOptions();
resetRequestTimeSelect();

const openRequestDatePicker = () => {
  if (!requestDateInput) {
    return;
  }
  if (typeof requestDateInput.showPicker === "function") {
    requestDateInput.showPicker();
  } else {
    requestDateInput.focus();
    requestDateInput.click();
  }
};

if (searchRadiusSelect) {
  const initialRadius = Number.parseFloat(searchRadiusSelect.value || "10");
  if (Number.isFinite(initialRadius)) {
    activeRadiusKm = initialRadius;
  }
}

const POSTAL_CODE_REGEX = /\b\d{5}-?\d{3}\b/g;
const NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search";
const NOMINATIM_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse";
const NOMINATIM_EMAIL = "suporte@nailnow.app";

const ensureMapsGeocoder = () => {
  if (mapsGeocoder) {
    return mapsGeocoder;
  }
  if (!isGoogleMapsAvailable()) {
    return null;
  }
  mapsGeocoder = new google.maps.Geocoder();
  return mapsGeocoder;
};

const runGoogleGeocode = (request) => {
  const geocoder = ensureMapsGeocoder();
  if (!geocoder) {
    return null;
  }

  return new Promise((resolve, reject) => {
    geocoder.geocode(request, (results, status) => {
      if (status === "OK" && Array.isArray(results)) {
        resolve(results);
        return;
      }
      if (status === "ZERO_RESULTS") {
        resolve([]);
        return;
      }
      reject(new Error(`google-geocode-${status || "error"}`));
    });
  });
};

const normalizeGoogleGeocodeResult = (result, fallbackLabel = "") => {
  if (!result || typeof result !== "object") {
    return null;
  }
  const location = result.geometry?.location;
  if (!location || typeof location.lat !== "function" || typeof location.lng !== "function") {
    return null;
  }
  const latitude = location.lat();
  const longitude = location.lng();
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return {
    coords: { latitude, longitude },
    label: result.formatted_address || fallbackLabel,
    raw: result,
  };
};

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

const toFiniteNumber = (value) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const normalized = value.replace(/[^0-9,.-]+/g, " ").trim().replace(/,/g, ".");
    if (!normalized) {
      return null;
    }
    const tokens = normalized.split(/\s+/).filter((token) => /^-?\d+(?:\.\d+)?$/.test(token));
    const target = tokens.length ? tokens[0] : normalized;
    const parsed = Number.parseFloat(target);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const parseCoordinateString = (value) => {
  if (typeof value !== "string") {
    return null;
  }
  const matches = value.match(/-?\d{1,3}(?:\.\d+)?/g);
  if (!matches || matches.length < 2) {
    return null;
  }
  const hasDecimal = matches.some((match) => match.includes("."));
  if (!hasDecimal) {
    return null;
  }
  const latitude = Number.parseFloat(matches[0]);
  const longitude = Number.parseFloat(matches[1]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }
  return { latitude, longitude };
};

const extractCoordinatePair = (value) => {
  if (!value) {
    return null;
  }
  if (typeof value === "string") {
    return parseCoordinateString(value);
  }
  if (Array.isArray(value) && value.length >= 2) {
    const latitude = toFiniteNumber(value[0]);
    const longitude = toFiniteNumber(value[1]);
    if (latitude !== null && longitude !== null) {
      return { latitude, longitude };
    }
  }
  if (typeof value === "object") {
    const latitude =
      toFiniteNumber(value.latitude ?? value.lat ?? value.Latitude ?? value.Lat ?? value._lat ?? value.x ?? value.X) ??
      null;
    const longitude =
      toFiniteNumber(value.longitude ?? value.lng ?? value.lon ?? value.Longitude ?? value.Long ?? value._long ?? value.y ?? value.Y) ??
      null;
    if (latitude !== null && longitude !== null) {
      return { latitude, longitude };
    }
    if (typeof value.toJSON === "function") {
      return extractCoordinatePair(value.toJSON());
    }
  }
  return null;
};

const coordinateCandidateKeys = [
  "coordenadas",
  "coordinates",
  "coordenadasAtendimento",
  "localizacao",
  "localization",
  "location",
  "posicao",
  "position",
  "geo",
  "geopoint",
  "geolocation",
  "centro",
  "center",
  "centroAtendimento",
  "ponto",
  "pontoAtendimento",
  "address",
  "endereco",
  "atendimento",
  "area",
];

const extractCoordinates = (source, depth = 0, visited = new Set()) => {
  if (!source || depth > 4) {
    return null;
  }
  const direct = extractCoordinatePair(source);
  if (direct) {
    return direct;
  }
  if (typeof source !== "object") {
    return null;
  }
  for (const key of coordinateCandidateKeys) {
    if (!Object.prototype.hasOwnProperty.call(source, key)) {
      continue;
    }
    const value = source[key];
    if (!value || visited.has(value)) {
      continue;
    }
    visited.add(value);
    const nested = extractCoordinates(value, depth + 1, visited);
    if (nested) {
      return nested;
    }
  }
  return null;
};

const parseRadiusValue = (value) => {
  const numeric = toFiniteNumber(value);
  if (numeric === null) {
    return null;
  }
  if (numeric > 500) {
    return numeric / 1000;
  }
  return numeric;
};

const formatDistance = (distanceKm) => {
  if (!Number.isFinite(distanceKm)) {
    return "";
  }
  if (distanceKm < 1) {
    const meters = Math.round(distanceKm * 1000);
    if (meters < 100) {
      return `${meters} m`;
    }
    const rounded = Math.round(meters / 10) * 10;
    return `${rounded} m`;
  }
  if (distanceKm < 10) {
    return `${distanceKm.toFixed(1).replace(".", ",")} km`;
  }
  return `${Math.round(distanceKm)} km`;
};

const haversineDistanceKm = (origin, target) => {
  if (!origin || !target) {
    return null;
  }
  const { latitude: lat1, longitude: lon1 } = origin;
  const { latitude: lat2, longitude: lon2 } = target;
  if ([lat1, lon1, lat2, lon2].some((value) => !Number.isFinite(value))) {
    return null;
  }
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const deltaLat = toRadians(lat2 - lat1);
  const deltaLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
};

const updateProfessionalDistances = () => {
  professionalsCatalog.forEach((professional) => {
    if (customerLocation.coords && professional.coordinates) {
      const distance = haversineDistanceKm(customerLocation.coords, professional.coordinates);
      professional.distanceKm = Number.isFinite(distance) ? distance : null;
    } else {
      professional.distanceKm = null;
    }
    if (typeof professional.coverageRadiusKm === "number" && Number.isFinite(professional.distanceKm)) {
      professional.isOutsideCoverage = professional.distanceKm > professional.coverageRadiusKm + 0.1;
    } else {
      professional.isOutsideCoverage = false;
    }
  });
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

const getPublicProfessionalLabel = (professional) => {
  const displayName = getProfessionalDisplayName(professional);
  if (!displayName) {
    return "Manicure NailNow";
  }
  if (displayName.includes("@")) {
    return "Manicure NailNow";
  }
  const tokens = displayName.split(/\s+/).filter(Boolean);
  if (!tokens.length) {
    return "Manicure NailNow";
  }
  if (tokens.length === 1) {
    return tokens[0];
  }
  const [first, second] = tokens;
  const initial = second ? `${second.charAt(0).toUpperCase()}.` : "";
  return `${first} ${initial}`.trim();
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

const setLocationStatus = (message, type = "") => {
  if (!searchLocationStatus) {
    return;
  }
  searchLocationStatus.textContent = message;
  searchLocationStatus.hidden = !message;
  searchLocationStatus.classList.remove("auth-status--error", "auth-status--success");
  if (type) {
    searchLocationStatus.classList.add(`auth-status--${type}`);
  }
};

const setSearchLoading = (loading) => {
  if (!searchProgress) {
    return;
  }
  searchProgress.hidden = !loading;
};

const markRequestFieldModified = (field) => {
  if (!field) {
    return;
  }
  if ((field.value || "").trim()) {
    field.dataset.userModified = "true";
  } else {
    delete field.dataset.userModified;
  }
};

const syncRequestLocationFromSearch = () => {
  if (requestLocationInput && !requestLocationInput.dataset.userModified) {
    const existing = requestLocationInput.value || "";
    const sourceValue =
      (searchLocationInput?.value && searchLocationInput.value) ||
      customerLocation.label ||
      existing;
    requestLocationInput.value = sourceValue;
  }
  if (requestLocationNumberInput && !requestLocationNumberInput.dataset.userModified) {
    const existing = requestLocationNumberInput.value || "";
    const numberValue = searchLocationNumberInput?.value || existing;
    requestLocationNumberInput.value = numberValue;
  }
  if (requestLocationComplementInput && !requestLocationComplementInput.dataset.userModified) {
    const existing = requestLocationComplementInput.value || "";
    const complementValue = searchLocationComplementInput?.value || existing;
    requestLocationComplementInput.value = complementValue;
  }
};

const buildFullLocationLabel = (street, number, complement) => {
  const parts = [];
  const base = (street || "").trim();
  const numberPart = (number || "").trim();
  const complementPart = (complement || "").trim();
  if (base) {
    parts.push(base);
  }
  if (numberPart) {
    parts.push(`nº ${numberPart}`);
  }
  if (complementPart) {
    parts.push(complementPart);
  }
  return parts.join(", ");
};

const formatDateChipValue = () => {
  if (!requestDateInput?.value) {
    return "";
  }
  const base = `${requestDateInput.value}T${requestTimeInput?.value || "12:00"}`;
  const date = new Date(base);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const dateLabel = dateChipFormatter.format(date);
  if (!requestTimeInput?.value) {
    return dateLabel;
  }
  const timeLabel = timeChipFormatter.format(date).replace(":", "h");
  return `${dateLabel} · ${timeLabel}`;
};

const updateSearchChips = () => {
  if (searchChipLocation) {
    const locationLabel =
      (searchLocationInput?.value && searchLocationInput.value.trim()) ||
      customerLocation.label ||
      currentProfile?.endereco ||
      "";
    searchChipLocation.textContent = locationLabel || "Defina o endereço";
    searchChipLocation.classList.toggle("request-toolbar__chip--muted", !locationLabel);
  }

  if (searchChipService) {
    let serviceLabel = "Todos os serviços";
    if (selectedService?.name) {
      serviceLabel = selectedService.name;
    } else if (activeServiceFilter && searchServiceSelect) {
      const selectedOption = searchServiceSelect.selectedOptions?.[0];
      serviceLabel = selectedOption?.textContent?.trim() || serviceLabel;
    }
    searchChipService.textContent = serviceLabel;
    searchChipService.classList.toggle(
      "request-toolbar__chip--muted",
      !(selectedService?.name || activeServiceFilter),
    );
  }

  if (searchChipDate) {
    const dateLabel = formatDateChipValue();
    if (dateLabel) {
      searchChipDate.textContent = dateLabel;
      searchChipDate.classList.remove("request-toolbar__chip--muted");
    } else {
      searchChipDate.textContent = "Data flexível";
      searchChipDate.classList.add("request-toolbar__chip--muted");
    }
  }
};

const syncServiceRadios = (serviceIndex) => {
  if (!requestServiceOptions) {
    return;
  }
  const radios = requestServiceOptions.querySelectorAll('input[type="radio"]');
  radios.forEach((input) => {
    const index = Number.parseInt(input.dataset.serviceIndex || "-1", 10);
    input.checked = index === serviceIndex;
  });
};

const updateSelectedServiceDetails = (professional = selectedProfessional) => {
  if (requestPriceInput) {
    if (selectedService?.priceLabel) {
      requestPriceInput.value = selectedService.priceLabel;
    } else if (typeof selectedService?.price === "number") {
      requestPriceInput.value = formatCurrency(selectedService.price);
    } else if (selectedService?.name) {
      requestPriceInput.value = "Sob consulta";
    } else {
      requestPriceInput.value = "";
    }
  }

  if (requestServiceEmpty) {
    const hasServices = Array.isArray(professional?.servicos) && professional.servicos.length > 0;
    requestServiceEmpty.hidden = hasServices;
  }

  updateRequestSubmitState();
};

const applySelectedService = (serviceIndex, professional = selectedProfessional) => {
  if (!professional || !Array.isArray(professional.servicos) || !professional.servicos.length) {
    selectedService = null;
    syncServiceRadios(-1);
    updateSelectedServiceDetails(professional);
    return -1;
  }

  const services = professional.servicos;
  const normalizedIndex = serviceIndex >= 0 && serviceIndex < services.length ? serviceIndex : 0;
  selectedService = services[normalizedIndex];

  if (requestServiceSelect) {
    const matchingOption = requestServiceSelect.querySelector(
      `option[data-service-index="${normalizedIndex}"]`,
    );
    if (matchingOption) {
      requestServiceSelect.value = matchingOption.value;
    }
  }

  syncServiceRadios(normalizedIndex);
  updateSelectedServiceDetails(professional);
  return normalizedIndex;
};

const renderRequestServiceOptions = (professional, preferredIndex = 0) => {
  if (!requestServiceOptions) {
    return;
  }

  requestServiceOptions.innerHTML = "";

  if (!professional || !Array.isArray(professional.servicos) || !professional.servicos.length) {
    requestServiceOptions.hidden = true;
    if (requestServiceEmpty) {
      requestServiceEmpty.hidden = false;
    }
    if (requestServiceSelect) {
      requestServiceSelect.classList.remove("sr-only");
    }
    return;
  }

  const entries = professional.servicos
    .map((service, index) => ({ service, index }))
    .slice(0, MAX_SERVICE_OPTIONS);

  if (!entries.length) {
    requestServiceOptions.hidden = true;
    if (requestServiceSelect) {
      requestServiceSelect.classList.remove("sr-only");
    }
    return;
  }

  const highlight = entries.find((entry) => entry.index === preferredIndex) || entries[0];

  requestServiceOptions.hidden = false;
  if (requestServiceEmpty) {
    requestServiceEmpty.hidden = true;
  }

  entries.forEach(({ service, index }) => {
    const optionId = `service-option-${professional.id || "prof"}-${index}`;
    const wrapper = document.createElement("label");
    wrapper.className = "service-option";

    const input = document.createElement("input");
    input.type = "radio";
    input.name = "request-service-option";
    input.value = service.id || `service-${index}`;
    input.dataset.serviceIndex = String(index);
    input.id = optionId;
    if (highlight && highlight.index === index) {
      input.checked = true;
    }
    input.addEventListener("change", () => {
      if (input.checked) {
        applySelectedService(index, professional);
      }
    });

    const content = document.createElement("span");
    content.className = "service-option__content";
    const priceLabel =
      service.priceLabel ||
      (typeof service.price === "number" ? formatCurrency(service.price) : "Sob consulta");
    content.innerHTML = `<strong>${service.name}</strong><small>${priceLabel}</small>`;

    wrapper.appendChild(input);
    wrapper.appendChild(content);
    requestServiceOptions.appendChild(wrapper);
  });

  if (professional.servicos.length > entries.length) {
    const notice = document.createElement("p");
    notice.className = "service-options__notice";
    notice.textContent = "Precisa de outro serviço? Utilize a lista completa abaixo.";
    requestServiceOptions.appendChild(notice);
    if (requestServiceSelect) {
      requestServiceSelect.classList.remove("sr-only");
    }
  } else if (requestServiceSelect) {
    requestServiceSelect.classList.add("sr-only");
  }

  if (highlight) {
    syncServiceRadios(highlight.index);
  }
};

const resetDashboard = () => {
  pendingList.innerHTML = "";
  confirmedList.innerHTML = "";
  cancelledList.innerHTML = "";
  updateMetrics([], [], []);
  currentProfile = null;
  fallbackProfileEmail = "";
  profileNameElements.forEach((element) => {
    element.textContent = "cliente";
  });
  if (profileDisplay) {
    profileDisplay.textContent = "—";
  }
  if (profileEmail) {
    profileEmail.textContent = "—";
  }
  if (profilePhone) {
    profilePhone.textContent = "—";
  }
  if (profileAddress) {
    profileAddress.textContent = "—";
  }
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
  if (requestServiceOptions) {
    requestServiceOptions.innerHTML = "";
    requestServiceOptions.hidden = true;
  }
  if (requestServiceEmpty) {
    requestServiceEmpty.hidden = true;
  }
  if (requestSubmitButton) {
    requestSubmitButton.disabled = true;
  }
  selectedProfessional = null;
  selectedService = null;
  professionalsCatalog = [];
  filteredProfessionals = [];
  customerLocation = { coords: null, label: "" };
  currentSearchTerm = "";
  activeServiceFilter = "";
  if (searchRadiusSelect) {
    const radiusValue = Number.parseFloat(searchRadiusSelect.value || "10");
    activeRadiusKm = Number.isFinite(radiusValue) ? radiusValue : 10;
  }
  if (searchLocationInput) {
    searchLocationInput.value = "";
  }
  if (searchServiceSelect) {
    searchServiceSelect.value = "";
  }
  setLocationStatus("");
  updateSearchChips();
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

const normalizeServiceName = (name) => {
  if (typeof name !== "string") {
    return "";
  }
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
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
  const professionalLabel = appointment.professional
    ? getPublicProfessionalLabel({ nome: appointment.professional })
    : "Profissional NailNow";
  heading.innerHTML = `
    <div>
      <p class="schedule-card__service">${appointment.service || "Serviço NailNow"}</p>
      <h3 class="schedule-card__client">${professionalLabel}</h3>
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
      pending: "Nenhuma solicitação pendente no momento.",
      confirmed: "Nenhuma solicitação confirmada ainda.",
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
  const coordinates = extractCoordinates(data);
  const coverageCandidates = [
    data.raioAtendimento,
    data.raio_atendimento,
    data.raio,
    data.radius,
    data.maxDistance,
    data.distanciaMaxima,
    data.distancia_maxima,
    data.cobertura?.raio,
    data.cobertura?.radius,
    data.cobertura?.distancia,
    data.area?.raio,
    data.area?.radius,
    data.atendimento?.raio,
    data.atendimento?.radius,
  ];
  let coverageRadiusKm = null;
  for (const candidate of coverageCandidates) {
    const parsed = parseRadiusValue(candidate);
    if (parsed !== null && parsed > 0) {
      coverageRadiusKm = parsed;
      break;
    }
  }

  return {
    id,
    nome: getProfessionalDisplayName(data),
    area,
    rating,
    servicos: services,
    collection: collectionName,
    email: data.email || data.emailLowercase || data.contato?.email || "",
    telefone: data.telefone || data.phone || data.celular || "",
    coordinates,
    coverageRadiusKm,
    raw: data,
  };
};

const renderProfessionalResults = (items = []) => {
  if (!professionalResults || !professionalResultsEmpty) {
    return;
  }
  professionalResults.innerHTML = "";

  if (!items.length) {
    if (customerLocation.coords) {
      professionalResultsEmpty.textContent =
        "Não encontramos manicures dentro desse raio agora. Ajuste a distância ou tente outro serviço.";
    } else if (currentSearchTerm) {
      professionalResultsEmpty.textContent =
        "Nenhuma manicure corresponde aos termos informados. Revise a busca ou informe outro endereço.";
    } else {
      professionalResultsEmpty.textContent =
        "Informe seu endereço e ajuste os filtros acima para encontrar manicures próximas a você.";
    }
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
    title.textContent = getPublicProfessionalLabel(professional);
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

    if (Number.isFinite(professional.distanceKm)) {
      const distance = document.createElement("p");
      distance.className = "request-card__distance";
      distance.textContent = `A ${formatDistance(professional.distanceKm)} de você`;
      card.appendChild(distance);
    } else if (customerLocation.coords) {
      const distance = document.createElement("p");
      distance.className = "request-card__distance request-card__distance--muted";
      distance.textContent = "Distância indisponível";
      card.appendChild(distance);
    }

    const servicesHint = document.createElement("p");
    servicesHint.className = "request-card__hint";
    const hasMatchingService = Boolean(
      activeServiceFilter && professional.servicos?.some((service) => normalizeServiceName(service.name) === activeServiceFilter),
    );
    if (selectedProfessional && selectedProfessional.id === professional.id) {
      servicesHint.textContent = "Confira os serviços e finalize sua solicitação ao lado.";
    } else if (professional.isOutsideCoverage) {
      servicesHint.textContent = "Fora do raio informado pela manicure — confirme a disponibilidade ao selecionar.";
    } else if (hasMatchingService) {
      servicesHint.textContent = "Oferece o serviço escolhido.";
    } else if (professional.servicos && professional.servicos.length) {
      const count = professional.servicos.length;
      servicesHint.textContent =
        count === 1
          ? "1 serviço disponível após selecionar"
          : `${count} serviços disponíveis após selecionar`;
    } else {
      servicesHint.textContent = "Serviços e valores confirmados após a seleção.";
    }

    card.appendChild(servicesHint);

    if (professional.servicos && professional.servicos.length) {
      const servicesList = document.createElement("ul");
      servicesList.className = "request-card__services";
      professional.servicos.slice(0, 3).forEach((service) => {
        const item = document.createElement("li");
        item.className = "request-card__service";
        if (activeServiceFilter && normalizeServiceName(service.name) === activeServiceFilter) {
          item.classList.add("request-card__service--highlight");
        }
        const priceLabel =
          service.priceLabel ||
          (typeof service.price === "number" ? formatCurrency(service.price) : "Sob consulta");
        item.innerHTML = `<span>${service.name}</span><span>${priceLabel}</span>`;
        servicesList.appendChild(item);
      });
      card.appendChild(servicesList);
    }

    if (typeof professional.coverageRadiusKm === "number" && !professional.isOutsideCoverage) {
      const coverageNote = document.createElement("p");
      coverageNote.className = "request-card__hint";
      coverageNote.textContent = `Atende até ${formatDistance(professional.coverageRadiusKm)} a partir do ponto informado.`;
      card.appendChild(coverageNote);
    }

    const selectButton = document.createElement("button");
    selectButton.type = "button";
    selectButton.className = "request-card__select";
    selectButton.textContent = "Selecionar manicure";
    selectButton.addEventListener("click", () => {
      selectProfessional(professional);
    });
    card.appendChild(selectButton);

    professionalResults.appendChild(card);
  });
};

const updateRequestSubmitState = () => {
  if (requestSubmitButton) {
    const hasSchedule = Boolean(requestDateInput?.value && requestTimeInput?.value);
    const hasSelection = Boolean(selectedProfessional && selectedService);
    requestSubmitButton.disabled = !(hasSchedule && hasSelection);
  }
  updateSearchChips();
};

const populateRequestForm = (professional) => {
  if (!requestForm || !requestProfessionalInput) {
    return;
  }

  if (!professional) {
    requestFields.forEach((field) => {
      field.hidden = true;
    });
    if (requestFormEmpty) {
      requestFormEmpty.hidden = false;
    }
    if (requestProfessionalInput) {
      requestProfessionalInput.value = "";
    }
    if (requestServiceSelect) {
      requestServiceSelect.innerHTML = "";
      requestServiceSelect.disabled = true;
      requestServiceSelect.classList.remove("sr-only");
    }
    if (requestServiceOptions) {
      requestServiceOptions.innerHTML = "";
      requestServiceOptions.hidden = true;
    }
    if (requestServiceEmpty) {
      requestServiceEmpty.hidden = true;
    }
    if (requestPriceInput) {
      requestPriceInput.value = "";
    }
    if (requestDateInput) {
      requestDateInput.value = "";
    }
    if (requestLocationInput) {
      requestLocationInput.value = "";
      delete requestLocationInput.dataset.userModified;
    }
    if (requestLocationNumberInput) {
      requestLocationNumberInput.value = "";
      delete requestLocationNumberInput.dataset.userModified;
    }
    if (requestLocationComplementInput) {
      requestLocationComplementInput.value = "";
      delete requestLocationComplementInput.dataset.userModified;
    }
    resetRequestTimeSelect();
    selectedService = null;
    setRequestFeedback("");
    updateSelectedServiceDetails();
    return;
  }

  if (requestFormEmpty) {
    requestFormEmpty.hidden = true;
  }

  requestFields.forEach((field) => {
    field.hidden = false;
  });

  const areaLabel = professional.area ? ` — ${professional.area}` : "";
  requestProfessionalInput.value = `${getPublicProfessionalLabel(professional)}${areaLabel}`;

  if (requestServiceSelect) {
    requestServiceSelect.innerHTML = "";
    if (professional.servicos && professional.servicos.length) {
      const preferredIndex = (() => {
        if (!activeServiceFilter) {
          return 0;
        }
        const matchIndex = professional.servicos.findIndex(
          (service) => normalizeServiceName(service.name) === activeServiceFilter,
        );
        return matchIndex >= 0 ? matchIndex : 0;
      })();

      professional.servicos.forEach((service, index) => {
        const option = document.createElement("option");
        option.value = service.id || `service-${index}`;
        const priceLabel =
          service.priceLabel || (typeof service.price === "number" ? formatCurrency(service.price) : "Sob consulta");
        option.textContent = `${service.name} — ${priceLabel}`;
        option.dataset.serviceIndex = String(index);
        requestServiceSelect.appendChild(option);
      });
      requestServiceSelect.disabled = false;
      const appliedIndex = applySelectedService(preferredIndex, professional);
      requestServiceSelect.selectedIndex = appliedIndex >= 0 ? appliedIndex : 0;
      renderRequestServiceOptions(professional, appliedIndex >= 0 ? appliedIndex : 0);
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
      renderRequestServiceOptions(professional, 0);
      updateSelectedServiceDetails(professional);
    }
  } else {
    renderRequestServiceOptions(professional, 0);
  }

  if (requestLocationInput && !requestLocationInput.value) {
    if (currentProfile?.endereco) {
      requestLocationInput.value = currentProfile.endereco;
    } else if (customerLocation.label) {
      requestLocationInput.value = customerLocation.label;
    }
  }

  if (requestLocationNumberInput && !requestLocationNumberInput.value && searchLocationNumberInput?.value) {
    requestLocationNumberInput.value = searchLocationNumberInput.value;
  }
  if (
    requestLocationComplementInput &&
    !requestLocationComplementInput.value &&
    searchLocationComplementInput?.value
  ) {
    requestLocationComplementInput.value = searchLocationComplementInput.value;
  }

  syncRequestLocationFromSearch();

  setRequestFeedback("");
  updateRequestSubmitState();
};

const selectProfessional = (professional) => {
  selectedProfessional = professional;
  if (!professional) {
    populateRequestForm(null);
    renderProfessionalResults(filteredProfessionals);
    return;
  }
  if (professional.servicos && professional.servicos.length) {
    const preferredIndex = activeServiceFilter
      ? professional.servicos.findIndex((service) => normalizeServiceName(service.name) === activeServiceFilter)
      : 0;
    selectedService =
      professional.servicos[preferredIndex >= 0 ? preferredIndex : 0] || professional.servicos[0] || null;
  } else {
    selectedService = null;
  }
  renderProfessionalResults(filteredProfessionals);
  populateRequestForm(professional);
};

const filterProfessionals = (term) => {
  if (!term) {
    currentSearchTerm = "";
    currentSearchTokens = [];
  } else {
    const normalized = term.toLowerCase().trim();
    currentSearchTerm = normalized;
    currentSearchTokens = normalized.split(/\s+/).filter(Boolean);
  }
  applyProfessionalFilters();
};

const applyProfessionalFilters = () => {
  let list = [...professionalsCatalog];

  if (currentSearchTokens.length) {
    list = list.filter((professional) => {
      const keywords = [
        professional.nome,
        professional.area,
        ...(professional.servicos || []).map((service) => service.name),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return currentSearchTokens.every((token) => keywords.includes(token));
    });
  }

  if (activeServiceFilter) {
    list = list.filter((professional) =>
      professional.servicos?.some((service) => normalizeServiceName(service.name) === activeServiceFilter),
    );
  }

  if (customerLocation.coords) {
    updateProfessionalDistances();
    if (Number.isFinite(activeRadiusKm)) {
      list = list.filter((professional) => Number.isFinite(professional.distanceKm) && professional.distanceKm <= activeRadiusKm + 0.05);
    }
  } else {
    professionalsCatalog.forEach((professional) => {
      professional.distanceKm = null;
      professional.isOutsideCoverage = false;
    });
  }

  list.sort((a, b) => {
    const distanceA = Number.isFinite(a.distanceKm) ? a.distanceKm : null;
    const distanceB = Number.isFinite(b.distanceKm) ? b.distanceKm : null;
    if (distanceA !== null && distanceB !== null) {
      return distanceA - distanceB;
    }
    if (distanceA !== null) {
      return -1;
    }
    if (distanceB !== null) {
      return 1;
    }
    const nameA = getProfessionalDisplayName(a).toLowerCase();
    const nameB = getProfessionalDisplayName(b).toLowerCase();
    return nameA.localeCompare(nameB, "pt-BR");
  });

  filteredProfessionals = list;

  const selectionStillVisible =
    selectedProfessional && list.some((professional) => professional.id === selectedProfessional.id);
  if (!selectionStillVisible && selectedProfessional) {
    selectedProfessional = null;
    selectedService = null;
    populateRequestForm(null);
  }

  renderProfessionalResults(list);
  updateRequestSubmitState();
};

const setCustomerLocation = (coords, label = "", options = {}) => {
  if (!coords || !Number.isFinite(coords.latitude) || !Number.isFinite(coords.longitude)) {
    customerLocation = { coords: null, label: "" };
    if (!options.preserveInput && searchLocationInput) {
      searchLocationInput.value = "";
    }
    updateProfessionalDistances();
    applyProfessionalFilters();
    updateSearchChips();
    syncRequestLocationFromSearch();
    return;
  }

  const normalized = {
    latitude: Number(coords.latitude),
    longitude: Number(coords.longitude),
  };

  customerLocation = {
    coords: normalized,
    label: label || customerLocation.label || "",
  };

  if (!options.preserveInput && searchLocationInput && label) {
    searchLocationInput.value = label;
  }

  updateProfessionalDistances();
  applyProfessionalFilters();
  updateSearchChips();
  syncRequestLocationFromSearch();
};

const populateServiceFilterOptions = (catalog = []) => {
  if (!searchServiceSelect) {
    return;
  }

  const serviceMap = new Map();

  catalog.forEach((professional) => {
    (professional.servicos || []).forEach((service) => {
      const normalizedName = normalizeServiceName(service.name);
      if (!normalizedName) {
        return;
      }
      const existing = serviceMap.get(normalizedName) || { name: service.name, count: 0 };
      existing.count += 1;
      if (!existing.name || existing.name.length < service.name.length) {
        existing.name = service.name;
      }
      serviceMap.set(normalizedName, existing);
    });
  });

  const entries = Array.from(serviceMap.entries()).sort((a, b) => {
    const nameA = a[1].name.toLowerCase();
    const nameB = b[1].name.toLowerCase();
    return nameA.localeCompare(nameB, "pt-BR");
  });

  searchServiceSelect.innerHTML = "";
  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = "Todos os serviços";
  searchServiceSelect.appendChild(defaultOption);

  entries.forEach(([value, info]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = info.count > 1 ? `${info.name} (${info.count})` : info.name;
    searchServiceSelect.appendChild(option);
  });

  if (activeServiceFilter && !serviceMap.has(activeServiceFilter)) {
    activeServiceFilter = "";
  }

  searchServiceSelect.value = activeServiceFilter || "";
};

const geocodeAddress = async (query, signal) => {
  try {
    const googleResults = await runGoogleGeocode({ address: query, region: "BR", language: "pt-BR" });
    if (googleResults && googleResults.length) {
      const normalized = normalizeGoogleGeocodeResult(googleResults[0], query);
      if (normalized) {
        return normalized;
      }
    }
  } catch (error) {
    console.warn("Falha ao geocodificar endereço via Google Maps", error);
  }

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
  try {
    const googleResults = await runGoogleGeocode({
      location: { lat: coords.latitude, lng: coords.longitude },
      region: "BR",
      language: "pt-BR",
    });
    if (googleResults && googleResults.length) {
      const normalized = normalizeGoogleGeocodeResult(googleResults[0]);
      if (normalized) {
        return normalized;
      }
    }
  } catch (error) {
    console.warn("Falha ao buscar endereço no Google Maps", error);
  }

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

const geocodeAndApplyLocation = async (query, options = {}) => {
  const trimmed = (query || "").trim();
  if (!trimmed) {
    setCustomerLocation(null);
    setLocationStatus("Informe um endereço para localizar manicures próximas.");
    return;
  }

  if (geocodeAbortController && typeof geocodeAbortController.abort === "function") {
    geocodeAbortController.abort();
  }

  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  geocodeAbortController = controller;

  if (!options.silent) {
    setLocationStatus("Buscando o endereço informado...");
    setSearchLoading(true);
  }

  try {
    const result = await geocodeAddress(trimmed, controller ? controller.signal : undefined);
    if (!result) {
      if (!options.silent) {
        setLocationStatus("Não encontramos esse endereço. Ajuste os detalhes e tente novamente.", "error");
      }
      return;
    }
    setCustomerLocation(result.coords, result.label, { preserveInput: options.preserveInput });
    if (!options.silent) {
      setLocationStatus("Endereço localizado! Ajustamos a lista de manicures para você.", "success");
    }
  } catch (error) {
    if (error.name === "AbortError") {
      return;
    }
    console.warn("Falha ao geocodificar endereço", error);
    if (!options.silent) {
      setLocationStatus("Não foi possível buscar o endereço agora. Tente novamente em instantes.", "error");
    }
  } finally {
    if (geocodeAbortController === controller) {
      geocodeAbortController = null;
    }
    if (!options.silent) {
      setSearchLoading(false);
    }
  }
};

const handleManualLocationLookup = () => {
  if (!searchLocationInput) {
    return;
  }
  geocodeAndApplyLocation(searchLocationInput.value);
};

const handleDetectLocation = () => {
  if (!navigator.geolocation) {
    setLocationStatus("Seu navegador não permite detectar a localização automaticamente.", "error");
    return;
  }

  if (geocodeAbortController) {
    geocodeAbortController.abort();
    geocodeAbortController = null;
  }

  if (detectLocationButton) {
    detectLocationButton.disabled = true;
  }
  setLocationStatus("Buscando sua localização atual...");
  setSearchLoading(true);

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      if (detectLocationButton) {
        detectLocationButton.disabled = false;
      }

      const coords = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };

      const fallbackLabel = `Coordenadas aproximadas (${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)})`;
      setCustomerLocation(coords, fallbackLabel, { preserveInput: true });

      const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
      geocodeAbortController = controller;

      try {
        const result = await reverseGeocodeCoordinates(coords, controller ? controller.signal : undefined);
        const label = result?.label || fallbackLabel;
        setCustomerLocation(coords, label);
        setLocationStatus("Localização atual definida automaticamente!", "success");
      } catch (error) {
        if (error.name === "AbortError") {
          return;
        }
        console.warn("Falha ao identificar endereço da localização atual", error);
        setCustomerLocation(coords, fallbackLabel);
        setLocationStatus("Localização capturada! Ajuste o endereço se preferir.");
      } finally {
        if (geocodeAbortController === controller) {
          geocodeAbortController = null;
        }
        setSearchLoading(false);
      }
    },
    (error) => {
      if (detectLocationButton) {
        detectLocationButton.disabled = false;
      }
      let message = "Não foi possível obter sua localização.";
      if (error.code === error.PERMISSION_DENIED) {
        message = "Precisamos da sua permissão para usar a localização automática.";
      } else if (error.code === error.POSITION_UNAVAILABLE) {
        message = "Não conseguimos acessar o serviço de localização. Tente novamente em instantes.";
      } else if (error.code === error.TIMEOUT) {
        message = "A busca pela localização demorou demais. Tente novamente.";
      }
      setLocationStatus(message, "error");
      setSearchLoading(false);
    },
    {
      enableHighAccuracy: false,
      timeout: 15000,
      maximumAge: 0,
    },
  );
};

const attemptPrefillLocationFromProfile = async (profile) => {
  if (!profile || customerLocation.coords) {
    return;
  }

  const existingCoords = extractCoordinates(profile);
  const profileLabel = profile.endereco || profile.address || profile.endereco_formatado || "Localização cadastrada";

  if (existingCoords && Number.isFinite(existingCoords.latitude) && Number.isFinite(existingCoords.longitude)) {
    setCustomerLocation(existingCoords, profileLabel);
    setLocationStatus("Usamos o endereço do seu cadastro para calcular as distâncias.", "success");
    return;
  }

  const addressCandidate = (profile.endereco || profile.address || profile.endereco_formatado || "").trim();
  if (addressCandidate.length < 6) {
    return;
  }

  if (searchLocationInput && !searchLocationInput.value) {
    searchLocationInput.value = addressCandidate;
  }

  await geocodeAndApplyLocation(addressCandidate, { silent: true });
  if (customerLocation.coords) {
    setLocationStatus("Encontramos manicures próximas ao endereço do seu cadastro!", "success");
  } else {
    setLocationStatus("Ajuste o endereço acima para encontrar manicures próximas.");
  }
};

const loadProfessionalsCatalog = async () => {
  if (!professionalResults) {
    return;
  }

  setRequestFeedback("");
  setSearchLoading(true);

  let catalog = [];
  try {
    const professionalsRef = collection(db, "profissionais");
    const snapshot = await getDocs(query(professionalsRef, limit(24)));
    if (!snapshot.empty) {
      catalog = snapshot.docs.map((docSnap) => normalizeProfessionalProfile(docSnap)).filter(Boolean);
    }
  } catch (error) {
    console.warn("Não foi possível carregar o catálogo de manicures", error);
    if (error.code === "permission-denied") {
      setRequestFeedback(
        "Não foi possível listar as manicures agora. Avise o suporte NailNow para liberar o acesso.",
        "error",
      );
    }
  } finally {
    setSearchLoading(false);
  }

  catalog.sort((a, b) => {
    const nameA = getProfessionalDisplayName(a).toLowerCase();
    const nameB = getProfessionalDisplayName(b).toLowerCase();
    return nameA.localeCompare(nameB, "pt-BR");
  });

  professionalsCatalog = catalog;
  populateServiceFilterOptions(professionalsCatalog);
  updateProfessionalDistances();

  if (selectedProfessional) {
    const updatedSelection = professionalsCatalog.find((professional) => professional.id === selectedProfessional.id);
    if (updatedSelection) {
      selectedProfessional = updatedSelection;
      populateRequestForm(updatedSelection);
    } else {
      selectedProfessional = null;
      selectedService = null;
      populateRequestForm(null);
    }
  } else {
    populateRequestForm(null);
  }

  applyProfessionalFilters();
};

const handleServiceSelectionChange = () => {
  if (!requestServiceSelect || !selectedProfessional) {
    return;
  }
  const selectedOption = requestServiceSelect.selectedOptions?.[0];
  const index = selectedOption ? Number.parseInt(selectedOption.dataset.serviceIndex || "-1", 10) : -1;
  applySelectedService(index, selectedProfessional);
};

const buildRequestPayload = (
  requestId,
  location,
  notes,
  locationStreet,
  locationNumber,
  locationComplement,
) => {
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
    locationStreet: locationStreet || location,
    locationNumber: locationNumber || "",
    locationComplement: locationComplement || "",
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

  const locationStreet = (
    requestLocationInput?.value ||
    searchLocationInput?.value ||
    customerLocation.label ||
    currentProfile?.endereco ||
    ""
  ).trim();
  const locationNumber = (
    requestLocationNumberInput?.value ||
    searchLocationNumberInput?.value ||
    ""
  ).trim();
  const locationComplement = (
    requestLocationComplementInput?.value ||
    searchLocationComplementInput?.value ||
    ""
  ).trim();
  const location = buildFullLocationLabel(locationStreet, locationNumber, locationComplement) || locationStreet;
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

    const payload = buildRequestPayload(
      requestId,
      location,
      notes,
      locationStreet,
      locationNumber,
      locationComplement,
    );

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
      resetRequestTimeSelect();
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

searchLocationInput?.addEventListener("input", () => {
  syncRequestLocationFromSearch();
});
searchLocationInput?.addEventListener("change", handleManualLocationLookup);
searchLocationInput?.addEventListener("search", handleManualLocationLookup);
searchLocationInput?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    handleManualLocationLookup();
  }
});

const handleSearchExtrasInput = () => {
  syncRequestLocationFromSearch();
};

searchLocationNumberInput?.addEventListener("input", handleSearchExtrasInput);
searchLocationComplementInput?.addEventListener("input", handleSearchExtrasInput);

detectLocationButton?.addEventListener("click", handleDetectLocation);

searchRadiusSelect?.addEventListener("change", (event) => {
  const nextRadius = Number.parseFloat(event.target.value);
  if (Number.isFinite(nextRadius)) {
    activeRadiusKm = nextRadius;
  }
  applyProfessionalFilters();
});

searchServiceSelect?.addEventListener("change", (event) => {
  const value = event.target.value;
  activeServiceFilter = value ? value : "";
  if (
    selectedProfessional &&
    activeServiceFilter &&
    !selectedProfessional.servicos?.some((service) => normalizeServiceName(service.name) === activeServiceFilter)
  ) {
    selectProfessional(null);
  } else if (selectedProfessional) {
    if (activeServiceFilter) {
      const matchIndex = selectedProfessional.servicos?.findIndex(
        (service) => normalizeServiceName(service.name) === activeServiceFilter,
      );
      if (typeof matchIndex === "number" && matchIndex >= 0) {
        selectedService = selectedProfessional.servicos?.[matchIndex] || selectedService;
      }
    }
    populateRequestForm(selectedProfessional);
  }
  applyProfessionalFilters();
});

requestServiceSelect?.addEventListener("change", handleServiceSelectionChange);
requestDateInput?.addEventListener("change", updateRequestSubmitState);
requestTimeInput?.addEventListener("change", updateRequestSubmitState);
requestDatePickerButton?.addEventListener("click", (event) => {
  event.preventDefault();
  openRequestDatePicker();
});
requestLocationInput?.addEventListener("input", (event) => {
  markRequestFieldModified(event.target);
  setRequestFeedback("");
});
requestLocationNumberInput?.addEventListener("input", (event) => {
  markRequestFieldModified(event.target);
  setRequestFeedback("");
});
requestLocationComplementInput?.addEventListener("input", (event) => {
  markRequestFieldModified(event.target);
  setRequestFeedback("");
});
requestNotesInput?.addEventListener("input", () => setRequestFeedback(""));
requestForm?.addEventListener("submit", handleRequestSubmission);

syncRequestLocationFromSearch();
updateSearchChips();

const updateMetrics = (pending, confirmed, cancelled) => {
  metricPending.textContent = pending.length;
  badgePending.textContent = pending.length;
  metricConfirmed.textContent = confirmed.length;
  badgeConfirmed.textContent = confirmed.length;
  metricCancelled.textContent = cancelled.length;
  badgeCancelled.textContent = cancelled.length;
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
      (typeof reason?.message === "string" && reason.message.includes("permission-denied"));
    if (denied) {
      permissionIssue = true;
    }

    return [];
  });

  const [pendingAppointments, confirmedAppointments, cancelledAppointments] = datasets;
  updateMetrics(pendingAppointments, confirmedAppointments, cancelledAppointments);

  const fallbackNotice = permissionIssue
    ? "Não conseguimos carregar sua agenda completa agora. Avise o suporte NailNow para liberar o acesso."
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

  return sortServicesByOrder(services);
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
  if (profileDisplay) {
    profileDisplay.textContent = displayName;
  }
  if (profileEmail) {
    profileEmail.textContent = emailForDisplay || "—";
  }
  if (profilePhone) {
    profilePhone.textContent = phoneForDisplay || "Atualize seu telefone";
  }
  if (profileAddress) {
    profileAddress.textContent = addressForDisplay || "Atualize seu endereço preferido";
  }
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
  await attemptPrefillLocationFromProfile(currentProfile);
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
    window.location.replace("/cliente/index.html?loggedOut=1");
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
