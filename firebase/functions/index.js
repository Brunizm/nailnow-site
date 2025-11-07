const functions = require("firebase-functions");
const admin = require("firebase-admin");
const cors = require("cors");
const crypto = require("node:crypto");

admin.initializeApp();

const firestore = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const APP_URL = "https://www.nailnow.app";
const SUPPORT_SENDER = "NailNow <suporte@nailnow.app>";

const ROLE_LOGIN_PATH = {
  cliente: "/cliente/index.html",
  profissional: "/profissional/index.html",
};

const ROLE_PORTAL_PATH = {
  cliente: "/cliente/portal.html",
  profissional: "/profissional/portal.html",
};

const QUICK_SIGNUP_COLLECTION = "signupLeads";

const QUICK_SIGNUP_ROLE_MAP = {
  cliente: "cliente",
  clientes: "cliente",
  client: "cliente",
  clients: "cliente",
  profissional: "profissional",
  profissionais: "profissional",
  professional: "profissional",
  professionals: "profissional",
  manicure: "profissional",
  manicures: "profissional",
};

function sanitizeString(value) {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value.replace(/\s+/g, " ").trim();
  }

  return String(value).trim();
}

function sanitizeEmail(value) {
  return sanitizeString(value).toLowerCase();
}

function parseCoordinate(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const normalized = sanitizeString(value).replace(",", ".");
  if (!normalized) {
    return null;
  }

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function mergeUniqueStrings(...groups) {
  const seen = new Set();
  const result = [];

  for (const group of groups) {
    if (!group) {
      continue;
    }

    const values = Array.isArray(group) ? group : [group];

    for (const value of values) {
      if (typeof value !== "string" && typeof value !== "number") {
        continue;
      }

      const normalized = sanitizeString(value);
      if (!normalized || seen.has(normalized)) {
        continue;
      }

      seen.add(normalized);
      result.push(normalized);
    }
  }

  return result;
}

function buildClientProfileData({
  uid,
  nome,
  email,
  senha,
  telefone,
  endereco,
  complemento,
  enderecoFormatado,
  placeId,
  lat,
  lng,
  aceiteTermos,
  newsletter,
  preferencias,
  existingData = {},
}) {
  const timestamp = FieldValue.serverTimestamp();
  const normalizedEmail = sanitizeEmail(email);
  const normalizedPhone = sanitizeString(telefone);
  const safeName = sanitizeString(nome);
  const safeAddress = sanitizeString(endereco);
  const safeComplement = sanitizeString(complemento);
  const safeFormattedAddress = sanitizeString(enderecoFormatado);
  const safePlaceId = sanitizeString(placeId);
  const latitude = parseCoordinate(lat);
  const longitude = parseCoordinate(lng);
  const existingStatus = existingData.status || "";
  const normalizedStatus = normalizeLower(existingStatus);
  const status =
    normalizedStatus && !["lead", "novo", "new"].includes(normalizedStatus)
      ? existingData.status
      : "pendente";
  const createdAt =
    existingData.criadoEm || existingData.createdAt || FieldValue.serverTimestamp();
  const existingEmails = Array.isArray(existingData.emails)
    ? existingData.emails.map((value) => sanitizeEmail(value)).filter(Boolean)
    : [];
  const emailHistory = Array.isArray(existingData.emailsHistorico)
    ? existingData.emailsHistorico.map((value) => sanitizeEmail(value)).filter(Boolean)
    : [];
  const allEmails = mergeUniqueStrings(existingEmails, normalizedEmail);
  const historicEmails = mergeUniqueStrings(emailHistory, normalizedEmail);
  const confirmation = existingData.signupConfirmation || {};
  const confirmationStatus = normalizeLower(confirmation.status || "");
  const confirmationStatusCode = normalizeLower(confirmation.statusCode || "");
  const pendingStatuses = new Set(["pendente", "pending", "aguardando", "awaiting"]);
  const pendingCodes = new Set(["pending", "awaiting", "waiting"]);
  const roles = mergeUniqueStrings(existingData.roles || [], "cliente");

  if (!roles.length) {
    roles.push("cliente");
  }

  const profile = {
    uid,
    role: "cliente",
    roles,
    tipo: existingData.tipo || "cliente",
    tipoConta: existingData.tipoConta || "cliente",
    categoria: existingData.categoria || "cliente",
    nome: safeName,
    displayName: safeName,
    nomeCompleto: safeName,
    name: safeName,
    email: normalizedEmail,
    emailPrincipal: normalizedEmail,
    emailLowercase: normalizedEmail,
    email_lowercase: normalizedEmail,
    emails: allEmails,
    senha,
    senhaAtualizadaEm: timestamp,
    telefone: normalizedPhone,
    telefonePrincipal: normalizedPhone,
    phone: normalizedPhone,
    phoneNumber: normalizedPhone,
    telefone_lowercase: normalizedPhone,
    endereco: safeAddress,
    endereco_text: safeAddress,
    address: safeAddress,
    address_text: safeAddress,
    complemento: safeComplement,
    enderecoComplemento: safeComplement,
    addressComplement: safeComplement,
    endereco_formatado: safeFormattedAddress,
    enderecoFormatado: safeFormattedAddress,
    formattedAddress: safeFormattedAddress,
    place_id: safePlaceId,
    placeId: safePlaceId,
    lat: latitude ?? sanitizeString(lat),
    lng: longitude ?? sanitizeString(lng),
    aceiteTermos: Boolean(aceiteTermos),
    termosAceitos: Boolean(aceiteTermos),
    aceitouTermos: Boolean(aceiteTermos),
    termosAceitosEm: timestamp,
    acceptedTerms: Boolean(aceiteTermos),
    acceptedTermsAt: timestamp,
    termos: {
      ...(existingData.termos || {}),
      aceito: Boolean(aceiteTermos),
      aceitoEm: timestamp,
    },
    newsletter: Boolean(newsletter),
    preferencias: Array.isArray(preferencias) ? preferencias : [],
    status,
    criadoEm: createdAt,
    createdAt,
    atualizadoEm: timestamp,
    updatedAt: timestamp,
    signupSource: REGISTER_CLIENT_SOURCE,
    signup: {
      ...(existingData.signup || {}),
      source: REGISTER_CLIENT_SOURCE,
      capturedAt: timestamp,
    },
    signupMetadata: {
      ...(existingData.signupMetadata || {}),
      source: REGISTER_CLIENT_SOURCE,
      capturedAt: timestamp,
    },
    lastSignupSource: REGISTER_CLIENT_SOURCE,
    profileType: "cliente",
    accountType: "cliente",
    portal: {
      ...(existingData.portal || {}),
      role: "cliente",
      loginPath: ROLE_LOGIN_PATH.cliente,
      portalPath: ROLE_PORTAL_PATH.cliente,
      updatedAt: timestamp,
    },
    contato: {
      ...(existingData.contato || {}),
      email: normalizedEmail || existingData.contato?.email || null,
      emailPrincipal:
        normalizedEmail || existingData.contato?.emailPrincipal || null,
      emailLowercase:
        normalizedEmail || existingData.contato?.emailLowercase || null,
      telefone: normalizedPhone || existingData.contato?.telefone || null,
      telefonePrincipal:
        normalizedPhone || existingData.contato?.telefonePrincipal || null,
      atualizadoEm: timestamp,
    },
    contact: {
      ...(existingData.contact || {}),
      email: normalizedEmail || existingData.contact?.email || null,
      emailPrincipal:
        normalizedEmail || existingData.contact?.emailPrincipal || null,
      emailLowercase:
        normalizedEmail || existingData.contact?.emailLowercase || null,
      phone: normalizedPhone || existingData.contact?.phone || null,
      phoneNumber:
        normalizedPhone || existingData.contact?.phoneNumber || null,
      updatedAt: timestamp,
    },
    account: {
      ...(existingData.account || {}),
      email: normalizedEmail || existingData.account?.email || null,
      emailLowercase:
        normalizedEmail || existingData.account?.emailLowercase || null,
      phone: normalizedPhone || existingData.account?.phone || null,
      role: "cliente",
      updatedAt: timestamp,
    },
    dadosContato: {
      ...(existingData.dadosContato || {}),
      email: normalizedEmail || existingData.dadosContato?.email || null,
      telefone: normalizedPhone || existingData.dadosContato?.telefone || null,
      atualizadoEm: timestamp,
    },
    dados: {
      ...(existingData.dados || {}),
      nome: safeName || existingData.dados?.nome || null,
      email: normalizedEmail || existingData.dados?.email || null,
      telefone: normalizedPhone || existingData.dados?.telefone || null,
      endereco: safeAddress || existingData.dados?.endereco || null,
      complemento: safeComplement || existingData.dados?.complemento || null,
      atualizadoEm: timestamp,
    },
    profile: {
      ...(existingData.profile || {}),
      nome: safeName || existingData.profile?.nome || null,
      name: safeName || existingData.profile?.name || null,
      displayName: safeName || existingData.profile?.displayName || null,
      email: normalizedEmail || existingData.profile?.email || null,
      telefone: normalizedPhone || existingData.profile?.telefone || null,
      phone: normalizedPhone || existingData.profile?.phone || null,
      endereco: safeAddress || existingData.profile?.endereco || null,
      address: safeAddress || existingData.profile?.address || null,
      role: "cliente",
      tipo: "cliente",
      status,
      atualizadoEm: timestamp,
    },
    addressDetails: {
      ...(existingData.addressDetails || {}),
      street: safeAddress || existingData.addressDetails?.street || null,
      formatted:
        safeFormattedAddress || existingData.addressDetails?.formatted || null,
      complement:
        safeComplement || existingData.addressDetails?.complement || null,
      placeId: safePlaceId || existingData.addressDetails?.placeId || null,
      lat: latitude ?? existingData.addressDetails?.lat ?? null,
      lng: longitude ?? existingData.addressDetails?.lng ?? null,
      updatedAt: timestamp,
    },
    addressMetadata: {
      ...(existingData.addressMetadata || {}),
      formatted:
        safeFormattedAddress || existingData.addressMetadata?.formatted || null,
      placeId: safePlaceId || existingData.addressMetadata?.placeId || null,
      updatedAt: timestamp,
    },
    login: {
      ...(existingData.login || {}),
      email: normalizedEmail || existingData.login?.email || null,
      emailLowercase:
        normalizedEmail || existingData.login?.emailLowercase || null,
      phone: normalizedPhone || existingData.login?.phone || null,
      updatedAt: timestamp,
      passwordUpdatedAt: timestamp,
      lastUpdatedBy: REGISTER_CLIENT_SOURCE,
    },
    emailsHistorico: historicEmails,
    signupConfirmation: {
      ...confirmation,
      status:
        confirmationStatus && !pendingStatuses.has(confirmationStatus)
          ? confirmation.status
          : "pendente",
      statusCode:
        confirmationStatusCode && !pendingCodes.has(confirmationStatusCode)
          ? confirmation.statusCode
          : "pending",
      role: confirmation.role || "cliente",
      autoQueueOptOut:
        confirmation.autoQueueOptOut === false ? false : true,
      preparedBy: confirmation.preparedBy || REGISTER_CLIENT_SOURCE,
      preparedAt: confirmation.preparedAt || timestamp,
    },
  };

  if (latitude !== null || longitude !== null) {
    const location = {
      lat: latitude ?? null,
      lng: longitude ?? null,
    };
    profile.location = { ...(existingData.location || {}), ...location };
    profile.localizacao = {
      ...(existingData.localizacao || {}),
      ...location,
    };
  }

  if (latitude !== null && longitude !== null) {
    const geoPoint = new admin.firestore.GeoPoint(latitude, longitude);
    profile.geo = geoPoint;
    profile.geoPoint = geoPoint;
    profile.coordenadas = geoPoint;
  }

  if (!profile.emails.length && normalizedEmail) {
    profile.emails = [normalizedEmail];
  }

  return profile;
}

function extractEmailFromData(data) {
  if (!data || typeof data !== "object") {
    return "";
  }

  const directFields = [
    "email",
    "emailLowercase",
    "email_lowercase",
    "contatoEmail",
    "contactEmail",
    "contato_email",
    "contato_emailPrincipal",
    "contato_emailLowercase",
    "contact_email",
    "contact_emailLowercase",
    "emailPrincipal",
    "primaryEmail",
    "primary_email",
  ];

  for (const field of directFields) {
    const candidate = sanitizeEmail(data[field]);
    if (candidate) {
      return candidate;
    }
  }

  const nestedFields = [
    ["contato", "email"],
    ["contato", "emailPrincipal"],
    ["contato", "emailLowercase"],
    ["contact", "email"],
    ["contact", "emailPrincipal"],
    ["contact", "emailLowercase"],
    ["profile", "email"],
    ["profile", "emailLowercase"],
    ["dados", "email"],
    ["dados", "emailPrincipal"],
    ["dados", "emailLowercase"],
    ["dadosContato", "email"],
    ["dadosContato", "emailPrincipal"],
    ["dadosContato", "emailLowercase"],
    ["login", "email"],
    ["login", "emailLowercase"],
    ["account", "email"],
    ["account", "emailLowercase"],
  ];

  for (const path of nestedFields) {
    const [parentKey, childKey] = path;
    const parent = data[parentKey];
    if (parent && typeof parent === "object") {
      const candidate = sanitizeEmail(parent[childKey]);
      if (candidate) {
        return candidate;
      }
    }
  }

  if (Array.isArray(data.emails)) {
    for (const value of data.emails) {
      const candidate = sanitizeEmail(value);
      if (candidate) {
        return candidate;
      }
    }
  }

  return "";
}

function buildConfirmationUrl(profilePath, token) {
  const params = new URLSearchParams({
    profile: profilePath,
    token,
  });
  return `${APP_URL}/confirmar-cadastro.html?${params.toString()}`;
}

function buildConfirmationMessage({ name, role, confirmationUrl }) {
  const safeName = (name || (role === "profissional" ? "Profissional" : "Cliente")).trim();
  const roleLabel = role === "profissional" ? "profissional" : "cliente";
  const subject = "Confirme seu cadastro no NailNow 💅";
  const text = [
    `Olá, ${safeName}!`,
    `Recebemos seu cadastro como ${roleLabel} no NailNow e ele está aguardando confirmação.`,
    "Para confirmar sua conta e liberar o acesso ao portal, clique no link abaixo:",
    confirmationUrl,
    "Se você não solicitou este cadastro, pode ignorar esta mensagem.",
    "Com carinho, equipe NailNow",
  ].join("\n\n");
  const html = [
    `<p>Olá, <strong>${safeName}</strong>! 💖 Recebemos seu cadastro como ${roleLabel} no NailNow e ele está aguardando confirmação.</p>`,
    `<p>Para confirmar sua conta e liberar o acesso ao portal, clique no botão abaixo:</p>`,
    `<p style="margin: 24px 0;"><a href="${confirmationUrl}" style="background-color:#f55ba2;color:#ffffff;padding:12px 20px;border-radius:999px;text-decoration:none;display:inline-block;font-weight:600;">Confirmar cadastro</a></p>`,
    `<p>Se o botão não funcionar, copie e cole o link em seu navegador:<br /><span style=\"word-break:break-all;\">${confirmationUrl}</span></p>`,
    "<p>Com carinho, equipe NailNow 💅</p>",
  ].join("");

  return { subject, text, html };
}

function buildConfirmationMailPayload({
  email,
  name,
  role,
  confirmationUrl,
  confirmationToken,
  sourcePath,
  profileId,
  profilePath,
  requestedBy,
}) {
  if (!email) {
    return null;
  }

  const trimmedEmail = email.trim();
  if (!trimmedEmail) {
    return null;
  }

  const message = buildConfirmationMessage({ name, role, confirmationUrl });
  const confirmationKey = profilePath || (profileId ? `${role || ""}:${profileId}` : null);

  return {
    to: trimmedEmail,
    from: SUPPORT_SENDER,
    message,
    metadata: {
      role,
      source: requestedBy || "cloud-function",
      profileId: profileId || null,
      profilePath: profilePath || null,
      sourcePath: sourcePath || null,
      confirmationUrl,
      confirmationToken,
      emailType: "confirmation",
      requestedBy: requestedBy || null,
      name: name || null,
      confirmationKey: confirmationKey || profilePath || null,
    },
  };
}

function resolveQuickSignupRole(rawType) {
  if (!rawType) {
    return null;
  }

  const normalized = sanitizeString(rawType).toLowerCase();
  return QUICK_SIGNUP_ROLE_MAP[normalized] || null;
}

function buildQuickSignupMailMessage({ name, role }) {
  const safeName = sanitizeString(name) || (role === "profissional" ? "Profissional" : "Cliente");
  const isProfessional = role === "profissional";
  const subject = isProfessional
    ? "Recebemos seu interesse em ser profissional NailNow"
    : "Recebemos sua solicitação de conta NailNow";
  const intro = isProfessional
    ? "Recebemos seu interesse em fazer parte do time de profissionais NailNow."
    : "Recebemos sua solicitação para criar uma conta cliente na NailNow.";
  const followup = isProfessional
    ? "Nossa equipe vai analisar os dados e entrar em contato com próximos passos e materiais de onboarding."
    : "Nossa equipe entrará em contato em breve com os próximos passos para ativar sua conta.";

  const text = [
    `Olá, ${safeName}!`,
    intro,
    followup,
    "Se precisar falar conosco, escreva para suporte@nailnow.app.",
    "Equipe NailNow",
  ].join("\n\n");

  const html = [
    `<p>Olá, <strong>${safeName}</strong>! 💖</p>`,
    `<p>${intro}</p>`,
    `<p>${followup}</p>`,
    '<p>Se precisar falar conosco, envie um e-mail para <a href="mailto:suporte@nailnow.app">suporte@nailnow.app</a>.</p>',
    "<p>Com carinho, equipe NailNow 💅</p>",
  ].join("");

  return { subject, text, html };
}

const QUICK_SIGNUP_PRIMARY_COLLECTION = {
  cliente: "clientes",
  profissional: "profissionais",
};

class QuickLeadError extends Error {
  constructor(code, message) {
    super(message || code);
    this.name = "QuickLeadError";
    this.code = code;
  }
}

function computeQuickLeadDocumentId(role, email) {
  const normalizedRole = role === "profissional" ? "profissional" : "cliente";
  const normalizedEmail = sanitizeEmail(email);

  if (!normalizedEmail) {
    throw new Error("invalid-email");
  }

  const hash = crypto.createHash("sha1").update(`${normalizedRole}:${normalizedEmail}`).digest("hex");
  return `lead_${hash}`;
}

const QUICK_LEAD_CONFIRMATION_SOURCE = "quick-lead-profile";

async function upsertQuickLeadProfile({ role, nome, email, origem, referrer }) {
  const primaryCollection = QUICK_SIGNUP_PRIMARY_COLLECTION[role] || QUICK_SIGNUP_PRIMARY_COLLECTION.cliente;
  const profileId = computeQuickLeadDocumentId(role, email);
  const profileRef = firestore.collection(primaryCollection).doc(profileId);
  const timestamp = FieldValue.serverTimestamp();
  const normalizedEmail = sanitizeEmail(email);
  const safeName = sanitizeString(nome || "");
  const leadMetadata = {
    quickLead: true,
    leadOrigin: origem || REGISTER_CLIENT_SOURCE,
    referrer: sanitizeString(referrer || ""),
    leadCapturedAt: timestamp,
    updatedAt: timestamp,
    role,
  };

  await firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(profileRef);
    const snapshotData = snapshot.exists ? snapshot.data() || {} : {};
    const updates = {
      email: normalizedEmail,
      nome: safeName || snapshotData.nome || "",
      status: snapshot.exists ? snapshotData.status || "lead" : "lead",
      ...leadMetadata,
    };

    const existingConfirmation = snapshotData.signupConfirmation || {};
    if (existingConfirmation.autoQueueOptOut !== false) {
      updates.signupConfirmation = {
        ...existingConfirmation,
        status: existingConfirmation.status || "lead",
        statusCode: existingConfirmation.statusCode || "quick-lead",
        role: existingConfirmation.role || role,
        autoQueueOptOut: true,
        preparedBy: existingConfirmation.preparedBy || QUICK_LEAD_CONFIRMATION_SOURCE,
        preparedAt: existingConfirmation.preparedAt || timestamp,
      };
    }

    if (!snapshot.exists) {
      updates.createdAt = timestamp;
    } else if (!snapshotData.createdAt) {
      updates.createdAt = timestamp;
    }

    transaction.set(profileRef, updates, { merge: true });
  });

  return profileRef;
}

const MAIL_SUCCESS_STATUSES = new Set([
  "queued",
  "queuing",
  "sending",
  "processing",
  "sent",
  "delivered",
  "success",
  "queued-via-extension",
  "accepted",
  "already-queued",
]);

const MAIL_FAILURE_STATUSES = new Set([
  "failed",
  "error",
  "invalid",
  "bounced",
  "undeliverable",
  "blocked",
  "rejected",
  "cancelled",
  "canceled",
  "suppressed",
]);

function extractMailDeliveryStatus(mailData) {
  if (!mailData || typeof mailData !== "object") {
    return "";
  }

  const delivery = mailData.delivery || {};
  const metadata = mailData.metadata || {};

  const candidates = [
    delivery.status,
    delivery.state,
    delivery.result,
    mailData.status,
    mailData.mailStatus,
    metadata.deliveryStatus,
    metadata.status,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeLower(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return "";
}

function shouldReuseExistingMailDoc(mailData) {
  const status = extractMailDeliveryStatus(mailData);

  if (!status) {
    return false;
  }

  if (MAIL_FAILURE_STATUSES.has(status)) {
    return false;
  }

  return MAIL_SUCCESS_STATUSES.has(status);
}

function sanitizeMailPayloadForFirestore(payload) {
  if (!payload || typeof payload !== "object") {
    return payload;
  }

  const normalized = { ...payload };
  const message = normalized.message;

  if (Array.isArray(normalized.to)) {
    normalized.to = normalized.to
      .map((value) => (typeof value === "string" ? value.trim() : ""))
      .filter(Boolean)
      .join(",");
  } else if (typeof normalized.to === "string") {
    normalized.to = normalized.to.trim();
  }

  if (message && typeof message === "object") {
    const { subject, text, html } = message;

    if (subject && !normalized.subject) {
      normalized.subject = subject;
    }

    if (text && !normalized.text) {
      normalized.text = text;
    }

    if (html && !normalized.html) {
      normalized.html = html;
    }
  }

  return JSON.parse(
    JSON.stringify(normalized, (key, value) => {
      if (value === undefined) {
        return null;
      }

      return value;
    }),
  );
}

async function createQuickSignupLead({ role, nome, email, origem, referrer }) {
  const normalizedEmail = sanitizeEmail(email);
  const leadId = computeQuickLeadDocumentId(role, normalizedEmail);
  const leadRef = firestore.collection(QUICK_SIGNUP_COLLECTION).doc(leadId);
  const now = FieldValue.serverTimestamp();

  const profileRef = await upsertQuickLeadProfile({ role, nome, email: normalizedEmail, origem, referrer });

  const leadSnapshot = await leadRef.get();
  const existingLead = leadSnapshot.exists ? leadSnapshot.data() || {} : {};

  const baseLeadData = {
    role,
    nome,
    email: normalizedEmail,
    origem,
    referrer: sanitizeString(referrer || ""),
    status: existingLead.status || "novo",
    profilePath: profileRef.path,
    updatedAt: now,
  };

  if (!leadSnapshot.exists) {
    baseLeadData.createdAt = now;
    baseLeadData.mailStatus = "not-requested";
  }

  await leadRef.set(baseLeadData, { merge: true });

  let mailStatus = existingLead.mailStatus || "not-requested";
  let mailId = existingLead.mailId || null;
  const normalizedMailStatus = (mailStatus || "").toLowerCase();
  const alreadyQueued = MAIL_SUCCESS_STATUSES.has(normalizedMailStatus);
  const shouldQueueLeadMail = role === "profissional";

  if (!shouldQueueLeadMail) {
    const snapshotStatus = mailStatus || "not-requested";
    await profileRef.set(
      {
        lastLeadMailStatus: snapshotStatus,
        lastLeadMailId: mailId || null,
        lastLeadMailSyncedAt: now,
      },
      { merge: true },
    );

    return {
      id: leadRef.id,
      mailStatus: snapshotStatus,
      mailId,
      profilePath: profileRef.path,
      alreadyQueued,
    };
  }

  if (alreadyQueued) {
    await profileRef.set(
      {
        lastLeadMailStatus: mailStatus,
        lastLeadMailId: mailId || null,
        lastLeadMailSyncedAt: now,
      },
      { merge: true },
    );

    return { id: leadRef.id, mailStatus, mailId, profilePath: profileRef.path, alreadyQueued: true };
  }

  try {
    const message = buildQuickSignupMailMessage({ name: nome, role });
    const mailPayload = sanitizeMailPayloadForFirestore({
      to: normalizedEmail,
      from: SUPPORT_SENDER,
      message,
      metadata: {
        role,
        emailType: "quick-signup-lead",
        source: origem || REGISTER_CLIENT_SOURCE,
        leadId: leadRef.id,
        profilePath: profileRef.path,
      },
    });
    const mailDoc = await firestore.collection("mail").add(mailPayload);

    mailId = mailDoc.id;
    mailStatus = "queued";

    const mailUpdateTime = FieldValue.serverTimestamp();

    await leadRef.set(
      {
        mailStatus,
        mailId,
        mailQueuedAt: mailUpdateTime,
        updatedAt: mailUpdateTime,
      },
      { merge: true },
    );

    await profileRef.set(
      {
        lastLeadMailStatus: mailStatus,
        lastLeadMailId: mailId,
        lastLeadMailQueuedAt: mailUpdateTime,
      },
      { merge: true },
    );
  } catch (error) {
    functions.logger.error("Falha ao enfileirar e-mail de lead", {
      email: normalizedEmail,
      role,
      error: error?.message,
    });

    mailStatus = "error";

    const mailUpdateTime = FieldValue.serverTimestamp();

    await leadRef.set(
      {
        mailStatus,
        mailError: error?.message || "unknown-error",
        mailUpdatedAt: mailUpdateTime,
        updatedAt: mailUpdateTime,
      },
      { merge: true },
    );

    await profileRef.set(
      {
        lastLeadMailStatus: mailStatus,
        lastLeadMailError: error?.message || "unknown-error",
        lastLeadMailUpdatedAt: mailUpdateTime,
      },
      { merge: true },
    );
  }

  return { id: leadRef.id, mailStatus, mailId, profilePath: profileRef.path, alreadyQueued: false };
}

function normalizeLeadSource(payloadSource, fallback) {
  const source = sanitizeString(payloadSource || "");
  if (source) {
    return source;
  }
  return sanitizeString(fallback || "");
}

function extractLeadReferrer(payload) {
  const referrer =
    payload?.referrer ||
    payload?.pageUrl ||
    payload?.page ||
    payload?.origin ||
    payload?.sourceUrl ||
    payload?.landingUrl;
  return sanitizeString(referrer || "");
}

async function registerQuickLeadFromPayload(payload, { sourceFallback, requireRole = true } = {}) {
  const nome = sanitizeString(payload?.nome || payload?.name);
  const email = sanitizeEmail(payload?.email);
  const leadRole = resolveQuickSignupRole(payload?.type || payload?.role);

  if (!leadRole) {
    if (requireRole) {
      throw new QuickLeadError("invalid-role", "Tipo de cadastro inválido.");
    }
    throw new QuickLeadError("missing-role", "Tipo de cadastro ausente.");
  }

  if (!nome || !email) {
    throw new QuickLeadError("invalid-lead", "Nome e e-mail são obrigatórios.");
  }

  try {
    const lead = await createQuickSignupLead({
      role: leadRole,
      nome,
      email,
      origem: normalizeLeadSource(payload?.origem || payload?.origin, sourceFallback),
      referrer: extractLeadReferrer(payload),
    });

    const responseMailStatus = lead.alreadyQueued ? "already-queued" : lead.mailStatus;

    return {
      ok: true,
      status: "lead",
      type: leadRole,
      leadId: lead.id,
      profilePath: lead.profilePath || null,
      alreadyQueued: Boolean(lead.alreadyQueued),
      mail: {
        status: responseMailStatus || "not-requested",
        mailId: lead.mailId || null,
      },
    };
  } catch (error) {
    if (error instanceof QuickLeadError) {
      throw error;
    }

    throw new QuickLeadError(error?.code || "internal-error", error?.message);
  }
}

function ensureSignupConfirmation(data, role) {
  const existing = data.signupConfirmation || {};
  const updates = {};
  let hasChanges = false;

  if (!existing.token) {
    updates.token = crypto.randomUUID().replace(/-/g, "");
    hasChanges = true;
  }

  const normalizedStatus = (existing.status || "").toString().toLowerCase();
  if (!normalizedStatus || normalizedStatus === "pending") {
    updates.status = "pendente";
    hasChanges = true;
  }

  if (!existing.statusCode || existing.statusCode === "pending") {
    updates.statusCode = "pending";
    hasChanges = true;
  }

  if (!existing.role) {
    updates.role = role;
    hasChanges = true;
  }

  if (!existing.issuedAt) {
    updates.issuedAt = FieldValue.serverTimestamp();
    hasChanges = true;
  }

  if (hasChanges) {
    return { ...existing, ...updates };
  }

  return existing;
}

async function persistSignupState(snap, data, role) {
  const updates = {};
  const confirmation = ensureSignupConfirmation(data, role);

  if (data.signupConfirmation !== confirmation) {
    updates.signupConfirmation = confirmation;
  }

  const currentStatus = (data.status || "").toString().trim();
  if (!currentStatus) {
    updates.status = "pendente";
  }

  if (Object.keys(updates).length) {
    await snap.ref.set(updates, { merge: true });
  }

  const finalStatus = updates.status || data.status || "pendente";
  return {
    status: finalStatus,
    signupConfirmation: {
      ...confirmation,
      status: confirmation.status || "pendente",
      statusCode: confirmation.statusCode || "pending",
      token: confirmation.token,
    },
  };
}

async function queueConfirmationForSnapshot(
  snap,
  role,
  sourcePath,
  queuedBy,
  options = {},
) {
  const { queueMail = false, force = false } = options;
  const data = snap.data() || {};
  const email = extractEmailFromData(data);
  const name = data.nome || data.name || data.displayName || "";

  try {
    const { signupConfirmation } = await persistSignupState(snap, data, role);
    data.signupConfirmation = signupConfirmation;

    const confirmationUrl = buildConfirmationUrl(snap.ref.path, signupConfirmation.token);
    const mailPayload = buildConfirmationMailPayload({
      email,
      name,
      role,
      confirmationUrl,
      confirmationToken: signupConfirmation.token,
      sourcePath,
      profileId: snap.id,
      profilePath: snap.ref.path,
      requestedBy: queuedBy,
    });

    const confirmationUpdate = {
      ...signupConfirmation,
      status: signupConfirmation.status || "pendente",
      statusCode: signupConfirmation.statusCode || "pending",
      confirmationUrl,
      preparedBy: queuedBy,
      preparedAt: FieldValue.serverTimestamp(),
      autoQueueOptOut: false,
      confirmationKey: mailPayload?.metadata?.confirmationKey || signupConfirmation.confirmationKey || null,
    };

    const existingMailId = signupConfirmation.mailId || signupConfirmation.mailDocumentId || null;
    let mailStatus = signupConfirmation.mailStatus || "not-requested";
    let mailId = existingMailId;

    if (!mailPayload) {
      confirmationUpdate.mailStatus = "missing-email";
      await snap.ref.set(
        {
          signupConfirmation: confirmationUpdate,
        },
        { merge: true },
      );
      functions.logger.warn("Confirmação preparada sem email disponível", {
        role,
        sourcePath,
        queuedBy,
      });
      return {
        status: queueMail ? "missing-email" : "prepared",
        confirmationUrl,
        mailPayload: null,
        mailStatus: "missing-email",
        mailId: null,
      };
    }

    if (queueMail) {
      const claimed = await firestore.runTransaction(async (transaction) => {
        const freshSnap = await transaction.get(snap.ref);
        const freshData = freshSnap.data() || {};
        const freshConfirmation = freshData.signupConfirmation || {};
        const freshMailId =
          freshConfirmation.mailId || freshConfirmation.mailDocumentId || null;
        const freshMailStatus = normalizeLower(
          freshConfirmation.mailStatus || "",
        );

        if (!force) {
          if (freshMailId) {
            return {
              shouldQueue: false,
              mailId: freshMailId,
              mailStatus: freshConfirmation.mailStatus || "already-queued",
              confirmation: freshConfirmation,
            };
          }

          if (["queued", "queuing", "already-queued"].includes(freshMailStatus)) {
            return {
              shouldQueue: false,
              mailId: freshMailId,
              mailStatus: freshConfirmation.mailStatus || "already-queued",
              confirmation: freshConfirmation,
            };
          }
        }

        const updatedConfirmation = {
          ...signupConfirmation,
          ...freshConfirmation,
          status: freshConfirmation.status || signupConfirmation.status || "pendente",
          statusCode:
            freshConfirmation.statusCode ||
            signupConfirmation.statusCode ||
            "pending",
          mailStatus: "queuing",
          mailQueuedBy: queuedBy,
          mailQueuedAt: FieldValue.serverTimestamp(),
        };

        transaction.set(
          snap.ref,
          {
            signupConfirmation: updatedConfirmation,
          },
          { merge: true },
        );

        return {
          shouldQueue: true,
          confirmation: updatedConfirmation,
        };
      });

      if (claimed.shouldQueue) {
        const payload = {
          ...mailPayload,
          metadata: {
            ...(mailPayload.metadata || {}),
            role,
            queuedBy,
            profilePath: snap.ref.path,
            sourcePath,
          },
        };
        const firestorePayload = sanitizeMailPayloadForFirestore(payload);

        const dedupKey = firestorePayload.metadata?.confirmationKey || null;
        let reusedExistingMail = false;

        if (!force && dedupKey) {
          const existingSnapshot = await firestore
            .collection("mail")
            .where("metadata.confirmationKey", "==", dedupKey)
            .limit(1)
            .get();

          if (!existingSnapshot.empty) {
            const existingDoc = existingSnapshot.docs[0];
            const existingData = existingDoc.data() || {};
            const existingMetadata = existingData.metadata || {};
            const existingToken = existingMetadata.confirmationToken || null;
            const existingUrl = existingMetadata.confirmationUrl || null;
            const existingStatus = extractMailDeliveryStatus(existingData);
            const canReuseExisting = shouldReuseExistingMailDoc(existingData);

            if (canReuseExisting) {
              reusedExistingMail = true;
              mailId = existingDoc.id;
              mailStatus = existingStatus || "already-queued";
              confirmationUpdate.mailId = mailId;
              confirmationUpdate.mailDocumentId = mailId;
              confirmationUpdate.mailStatus = mailStatus || "already-queued";
              confirmationUpdate.mailQueuedBy =
                signupConfirmation.mailQueuedBy || existingMetadata.queuedBy || queuedBy;
              if (signupConfirmation.mailQueuedAt) {
                confirmationUpdate.mailQueuedAt = signupConfirmation.mailQueuedAt;
              } else if (existingDoc.createTime) {
                confirmationUpdate.mailQueuedAt = existingDoc.createTime;
              }

              if (existingUrl) {
                confirmationUpdate.confirmationUrl = existingUrl;
              }

              if (existingToken && existingToken !== confirmationUpdate.token) {
                confirmationUpdate.token = existingToken;
                confirmationUpdate.confirmationUrl =
                  existingUrl || buildConfirmationUrl(snap.ref.path, existingToken);
              }

              functions.logger.info("Email de confirmação reutilizado", {
                role,
                sourcePath,
                queuedBy,
                mailId,
                status: mailStatus,
              });
            } else {
              functions.logger.warn("Email de confirmação antigo será substituído", {
                role,
                sourcePath,
                queuedBy,
                existingMailId: existingDoc.id,
                existingStatus: existingStatus || null,
              });
            }
          }
        }

        if (!reusedExistingMail) {
          const mailRef = await firestore.collection("mail").add(firestorePayload);
          mailId = mailRef.id;
          mailStatus = "queued";
          confirmationUpdate.mailId = mailId;
          confirmationUpdate.mailDocumentId = mailId;
          confirmationUpdate.mailQueuedAt = FieldValue.serverTimestamp();
          confirmationUpdate.mailQueuedBy = queuedBy;
          confirmationUpdate.mailStatus = "queued";
          functions.logger.info("Email de confirmação enfileirado", {
            role,
            sourcePath,
            queuedBy,
            mailId,
          });
        }
      } else {
        mailId = claimed.mailId || existingMailId;
        const fallbackMailStatus = mailId
          ? "already-queued"
          : signupConfirmation.mailStatus || "already-queued";
        mailStatus = claimed.mailStatus || fallbackMailStatus;
        confirmationUpdate.mailStatus = mailStatus;
        if (mailId) {
          confirmationUpdate.mailId = mailId;
          confirmationUpdate.mailDocumentId = mailId;
        }
      }
    } else {
      mailStatus = "requires-client-enqueue";
      confirmationUpdate.mailStatus = "requires-client-enqueue";
    }

    await snap.ref.set(
      {
        signupConfirmation: confirmationUpdate,
      },
      { merge: true },
    );

    functions.logger.info("Confirmação preparada", {
      role,
      sourcePath,
      queuedBy,
      mailStatus,
    });

    return {
      status: queueMail ? mailStatus : "prepared",
      confirmationUrl,
      mailPayload,
      mailStatus,
      mailId,
    };
  } catch (error) {
    functions.logger.error("Falha ao preparar confirmação", {
      role,
      sourcePath,
      queuedBy,
      error: error?.message,
    });

    await snap.ref.set(
      {
        welcomeEmailError: {
          message: error?.message || "unknown-error",
          timestamp: FieldValue.serverTimestamp(),
        },
      },
      { merge: true },
    );

    throw error;
  }
}

async function scheduleConfirmationRetry(docRef, queuedBy, error) {
  const retryUpdate = {
    signupConfirmation: {
      autoQueueOptOut: false,
      mailStatus: "requires-client-enqueue",
      mailQueuedBy: queuedBy || null,
      mailQueuedAt: null,
      mailId: null,
      mailDocumentId: null,
      lastQueueError: error?.message || "unknown-error",
      lastQueueErrorCode: error?.code || null,
      lastQueueErrorAt: FieldValue.serverTimestamp(),
    },
    welcomeEmailError: {
      message: error?.message || "unknown-error",
      code: error?.code || null,
      source: queuedBy || null,
      timestamp: FieldValue.serverTimestamp(),
    },
  };

  await docRef.set(retryUpdate, { merge: true });
}

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeLower(value) {
  return normalizeString(value).toLowerCase();
}

function getPrimaryEmail(data) {
  return extractEmailFromData(data || {});
}

function getSignupMailStatus(data) {
  const confirmation = data?.signupConfirmation || {};
  return normalizeLower(confirmation.mailStatus || "");
}

const MAIL_STATUSES_TO_RETRY = new Set([
  "not-requested",
  "requires-client-enqueue",
  "error",
  "failed",
]);

function shouldAttemptQueueOnWrite(beforeData, afterData) {
  if (!afterData) {
    return { shouldQueue: false, force: false };
  }

  const afterConfirmation = afterData.signupConfirmation || {};
  if (afterConfirmation.autoQueueOptOut === true) {
    return { shouldQueue: false, force: false };
  }

  const statusNormalized = normalizeLower(afterData.status || "");
  if (["confirmado", "confirmada", "confirmed"].includes(statusNormalized)) {
    return { shouldQueue: false, force: false };
  }

  const afterEmail = getPrimaryEmail(afterData);
  if (!afterEmail) {
    return { shouldQueue: false, force: false };
  }

  const beforeConfirmation = (beforeData && beforeData.signupConfirmation) || {};
  const afterMailStatus = getSignupMailStatus(afterData);
  const beforeMailStatus = getSignupMailStatus(beforeData || {});

  if (!beforeData) {
    return { shouldQueue: true, force: false };
  }

  if (["queued", "already-queued"].includes(afterMailStatus)) {
    return { shouldQueue: false, force: false };
  }

  const beforeEmail = getPrimaryEmail(beforeData);
  const emailChanged = afterEmail && beforeEmail !== afterEmail;

  if (!afterConfirmation.token) {
    return { shouldQueue: true, force: true };
  }

  if (afterMailStatus === "missing-email") {
    if (emailChanged) {
      return { shouldQueue: true, force: true };
    }
    return { shouldQueue: false, force: false };
  }

  if (emailChanged) {
    return { shouldQueue: true, force: true };
  }

  if (!afterMailStatus) {
    if (!beforeMailStatus) {
      if (beforeConfirmation.preparedBy === undefined && afterConfirmation.preparedBy === "firestore-trigger") {
        return { shouldQueue: false, force: false };
      }
    }
    return { shouldQueue: true, force: true };
  }

  if (MAIL_STATUSES_TO_RETRY.has(afterMailStatus)) {
    if (
      afterConfirmation.preparedBy === "firestore-trigger" &&
      beforeMailStatus === afterMailStatus &&
      beforeConfirmation.preparedBy === afterConfirmation.preparedBy
    ) {
      return { shouldQueue: false, force: false };
    }
    return { shouldQueue: true, force: true };
  }

  return { shouldQueue: false, force: false };
}

async function handleProfileWrite(change, context, role) {
  if (!change.after.exists) {
    return null;
  }

  const beforeData = change.before.exists ? change.before.data() : null;
  const afterData = change.after.data();
  const decision = shouldAttemptQueueOnWrite(beforeData, afterData);

  if (!decision.shouldQueue) {
    return null;
  }

  return queueConfirmationForSnapshot(
    change.after,
    role,
    context.resource?.name,
    "firestore-trigger",
    {
      queueMail: true,
      force: decision.force,
    },
  );
}

async function queueConfirmationByRef(docRef, role, sourcePath, queuedBy, options = {}) {
  const snap = await docRef.get();

  if (!snap.exists) {
    const error = new Error("profile-not-found");
    error.code = "profile-not-found";
    throw error;
  }

  return queueConfirmationForSnapshot(snap, role, sourcePath, queuedBy, options);
}

exports.queueClienteWelcomeEmail = functions
  .region("southamerica-east1")
  .firestore.document("clientes/{clienteId}")
  .onWrite((change, context) => handleProfileWrite(change, context, "cliente"));

exports.queueClientWelcomeEmail = functions
  .region("southamerica-east1")
  .firestore.document("clients/{clientId}")
  .onWrite((change, context) => handleProfileWrite(change, context, "cliente"));

exports.queueProfessionalWelcomeEmail = functions
  .region("southamerica-east1")
  .firestore.document("profissionais/{profissionalId}")
  .onWrite((change, context) => handleProfileWrite(change, context, "profissional"));

exports.queueManicureWelcomeEmail = functions
  .region("southamerica-east1")
  .firestore.document("manicures/{manicureId}")
  .onWrite((change, context) => handleProfileWrite(change, context, "profissional"));

exports.queueProfessionalWelcomeEmailEn = functions
  .region("southamerica-east1")
  .firestore.document("professionals/{professionalId}")
  .onWrite((change, context) => handleProfileWrite(change, context, "profissional"));

const CONFIRMATION_COLLECTIONS = {
  clientes: {
    role: "cliente",
    loginPath: ROLE_LOGIN_PATH.cliente,
    portalPath: ROLE_PORTAL_PATH.cliente,
  },
  clients: {
    role: "cliente",
    loginPath: ROLE_LOGIN_PATH.cliente,
    portalPath: ROLE_PORTAL_PATH.cliente,
  },
  profissionais: {
    role: "profissional",
    loginPath: ROLE_LOGIN_PATH.profissional,
    portalPath: ROLE_PORTAL_PATH.profissional,
  },
  professionals: {
    role: "profissional",
    loginPath: ROLE_LOGIN_PATH.profissional,
    portalPath: ROLE_PORTAL_PATH.profissional,
  },
  manicures: {
    role: "profissional",
    loginPath: ROLE_LOGIN_PATH.profissional,
    portalPath: ROLE_PORTAL_PATH.profissional,
  },
};

function parseJsonBody(req) {
  if (!req || !req.method || req.method.toUpperCase() !== "POST") {
    return {};
  }

  const body = req.body;

  if (body && typeof body === "object" && !Buffer.isBuffer(body)) {
    return body;
  }

  const rawBody = typeof body === "string" && body.trim().length
    ? body
    : req.rawBody
    ? req.rawBody.toString()
    : "";

  if (!rawBody) {
    return {};
  }

  try {
    return JSON.parse(rawBody);
  } catch (error) {
    functions.logger.warn("Falha ao converter body em JSON", error?.message);
    return {};
  }
}

function readHttpPayload(req) {
  if (!req) {
    return {};
  }

  if (req.method && req.method.toUpperCase() === "POST") {
    return parseJsonBody(req);
  }

  return req.query || {};
}

const ALLOWED_ORIGINS = new Set([
  "https://www.nailnow.app",
  "https://nailnow.app",
  "https://nailnow-7546c-e1672.web.app",
  "https://nailnow-7546c.firebaseapp.com",
  "http://localhost:5000",
  "http://127.0.0.1:5000",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

const corsHandler = cors({
  origin: (origin, callback) => {
    if (!origin) {
      callback(null, APP_URL);
      return;
    }

    if (ALLOWED_ORIGINS.has(origin)) {
      callback(null, origin);
      return;
    }

    callback(null, APP_URL);
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: [
    "Origin",
    "Content-Type",
    "Accept",
    "X-Requested-With",
    "X-Client-Data",
    "X-Firebase-AppCheck",
    "Authorization",
  ],
  optionsSuccessStatus: 204,
});

function applyCors(req, res) {
  const origin = req.headers?.origin;
  const allowedOrigin = origin && ALLOWED_ORIGINS.has(origin) ? origin : APP_URL;
  res.set("Access-Control-Allow-Origin", allowedOrigin);
  res.set("Vary", "Origin");
  res.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.set(
    "Access-Control-Allow-Headers",
    "Origin, Content-Type, Accept, X-Requested-With, X-Client-Data, X-Firebase-AppCheck, Authorization",
  );
  res.set("Access-Control-Max-Age", "3600");
}

async function buildAutoLoginAuth(profileData, mapping, documentId, profilePath) {
  if (!profileData || !mapping) {
    return null;
  }

  const candidateUids = [
    profileData.uid,
    profileData.userId,
    profileData.authUid,
    profileData.userUid,
    profileData.accountUid,
    profileData.accountId,
    profileData.firebaseUid,
    documentId,
  ]
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter((value, index, array) => value && array.indexOf(value) === index);

  for (const candidate of candidateUids) {
    try {
      const userRecord = await admin.auth().getUser(candidate);
      const customToken = await admin.auth().createCustomToken(userRecord.uid, {
        signupRole: mapping.role,
        signupConfirmed: true,
      });

      return {
        customToken,
        uid: userRecord.uid,
        email: userRecord.email || null,
      };
    } catch (error) {
      if (error?.code === "auth/user-not-found") {
        continue;
      }

      functions.logger.warn("Falha ao gerar token de login automático", {
        profilePath,
        candidateUid: candidate,
        error: error?.message,
      });
    }
  }

  const candidateEmails = [
    profileData.email,
    profileData.contatoEmail,
    profileData.loginEmail,
    profileData.contactEmail,
    profileData.ownerEmail,
  ]
    .map((value) => (typeof value === "string" ? value.trim().toLowerCase() : ""))
    .filter((value, index, array) => value && array.indexOf(value) === index);

  for (const email of candidateEmails) {
    try {
      const userRecord = await admin.auth().getUserByEmail(email);
      const customToken = await admin.auth().createCustomToken(userRecord.uid, {
        signupRole: mapping.role,
        signupConfirmed: true,
      });

      return {
        customToken,
        uid: userRecord.uid,
        email: userRecord.email || email,
      };
    } catch (error) {
      if (error?.code === "auth/user-not-found") {
        continue;
      }

      functions.logger.warn("Falha ao gerar token automático por e-mail", {
        profilePath,
        candidateEmail: email,
        error: error?.message,
      });
    }
  }

  return null;
}

exports.verifySignupConfirmation = functions
  .region("southamerica-east1")
  .https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
      const origin = req.headers?.origin;
      const allowedOrigin = origin && ALLOWED_ORIGINS.has(origin) ? origin : APP_URL;
      res.set("Access-Control-Allow-Origin", allowedOrigin);
      res.set("Vary", "Origin");
      res.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
      res.set(
        "Access-Control-Allow-Headers",
        "Origin, Content-Type, Accept, X-Requested-With, X-Client-Data, X-Firebase-AppCheck, Authorization",
      );
      res.set("Access-Control-Max-Age", "3600");

      if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
      }

      const payload = readHttpPayload(req);
      const rawProfile = typeof payload.profile === "string" ? payload.profile.trim() : "";
      const token = typeof payload.token === "string" ? payload.token.trim() : "";

      if (!rawProfile || !token) {
        res.status(400).json({ error: "missing-parameters" });
        return;
      }

      const profilePath = decodeURIComponent(rawProfile);
      const parts = profilePath.split("/");
      if (parts.length !== 2) {
        res.status(400).json({ error: "invalid-profile-path" });
        return;
      }

      const [collection, documentId] = parts;
      const mapping = CONFIRMATION_COLLECTIONS[collection];

      if (!mapping) {
        res.status(400).json({ error: "unsupported-profile" });
        return;
      }

      try {
        const docRef = firestore.collection(collection).doc(documentId);
        const snapshot = await docRef.get();

        if (!snapshot.exists) {
          res.status(404).json({ error: "profile-not-found" });
          return;
        }

        const profileData = snapshot.data() || {};
        const confirmation = profileData.signupConfirmation || {};

        if (!confirmation.token) {
          res.status(400).json({ error: "confirmation-missing" });
          return;
        }

        const storedToken = confirmation.token;
        if (storedToken !== token) {
          res.status(400).json({ error: "invalid-token" });
          return;
        }

        const normalizedStatus = (profileData.status || "").toString().toLowerCase();
        const confirmationStatus = (confirmation.status || "").toString().toLowerCase();
        const confirmationStatusCode = (confirmation.statusCode || "").toString().toLowerCase();
        const alreadyConfirmed =
          normalizedStatus === "confirmado" ||
          normalizedStatus === "confirmada" ||
          normalizedStatus === "confirmed" ||
          confirmationStatus === "confirmado" ||
          confirmationStatus === "confirmada" ||
          confirmationStatus === "confirmed" ||
          confirmationStatusCode === "confirmado" ||
          confirmationStatusCode === "confirmada" ||
          confirmationStatusCode === "confirmed";

        const portalUrl = `${APP_URL}${mapping.portalPath || mapping.loginPath}`;

        if (alreadyConfirmed) {
          const authPayload = await buildAutoLoginAuth(
            profileData,
            mapping,
            documentId,
            profilePath,
          );

          res.status(200).json({
            status: "already-confirmed",
            role: mapping.role,
            loginUrl: `${APP_URL}${mapping.loginPath}`,
            portalUrl,
            auth: authPayload,
          });
          return;
        }

        const confirmationUpdate = {
          ...confirmation,
          status: "confirmado",
          statusCode: "confirmed",
          confirmedAt: FieldValue.serverTimestamp(),
          confirmedBy: "email-link",
          tokenLastUsedAt: FieldValue.serverTimestamp(),
        };

        const updates = {
          status: "confirmado",
          statusUpdatedAt: FieldValue.serverTimestamp(),
          signupConfirmation: confirmationUpdate,
        };

        await docRef.set(updates, { merge: true });
        functions.logger.info("Cadastro confirmado", {
          profilePath,
          role: mapping.role,
        });

        const authPayload = await buildAutoLoginAuth(
          profileData,
          mapping,
          documentId,
          profilePath,
        );

        res.status(200).json({
          status: "confirmed",
          role: mapping.role,
          loginUrl: `${APP_URL}${mapping.loginPath}`,
          portalUrl,
          auth: authPayload,
        });
      } catch (error) {
        functions.logger.error("Falha ao confirmar cadastro", {
          profilePath,
          error: error?.message,
        });
        res.status(500).json({ error: "internal-error" });
      }
    });
  });

const REGISTER_CLIENT_SOURCE = "registerClientAccount";

exports.registerClientAccount = functions
  .region("southamerica-east1")
  .https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
      applyCors(req, res);

      if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
      }

      if (req.method !== "POST") {
        res.status(405).json({ error: "method-not-allowed" });
        return;
      }

      const payload = readHttpPayload(req) || {};

      const nome = sanitizeString(payload.nome || payload.name);
      const email = sanitizeEmail(payload.email);
      const senha = sanitizeString(payload.senha || payload.password);
      const telefone = sanitizeString(payload.telefone || payload.phone);
      const endereco = sanitizeString(payload.endereco || payload.endereco_text || payload.address);
      const complemento = sanitizeString(payload.complemento || payload.address_extra || "");
      const enderecoFormatado = sanitizeString(payload.endereco_formatado || payload.enderecoFormatado || "");
      const placeId = sanitizeString(payload.place_id || payload.placeId || "");
      const lat = sanitizeString(payload.lat || "");
      const lng = sanitizeString(payload.lng || "");
      const aceiteTermos = Boolean(payload.aceiteTermos ?? payload.termos ?? payload.aceitouTermos);

      const leadRole = resolveQuickSignupRole(payload.type || payload.role);
      const hasFullPayload =
        nome &&
        email &&
        senha &&
        senha.length >= 6 &&
        telefone &&
        endereco &&
        aceiteTermos;

      if (leadRole && !hasFullPayload) {
        try {
          const leadResponse = await registerQuickLeadFromPayload(payload, {
            sourceFallback: REGISTER_CLIENT_SOURCE,
          });

          res.status(200).json(leadResponse);
        } catch (error) {
          if (error instanceof QuickLeadError) {
            const statusCode = error.code === "invalid-lead" ? 400 : 422;
            res.status(statusCode).json({ error: error.code || "invalid-lead" });
            return;
          }

          functions.logger.error("Falha ao registrar lead rápido", {
            email,
            role: leadRole,
            error: error?.message,
          });
          res.status(500).json({ error: "internal-error" });
        }
        return;
      }

      if (!nome || !email || !senha || senha.length < 6 || !telefone || !endereco || !aceiteTermos) {
        res.status(400).json({ error: "invalid-payload" });
        return;
      }

      try {
        const existingQuery = await firestore
          .collection("clientes")
          .where("email", "==", email)
          .limit(1)
          .get();

        if (!existingQuery.empty) {
          const existingDoc = existingQuery.docs[0];
          const existingData = existingDoc.data() || {};
          res.status(409).json({
            error: "email-already-in-use",
            status: existingData.status || "pendente",
          });
          return;
        }

        let userRecord;
        let isNewUser = false;

        try {
          userRecord = await admin.auth().getUserByEmail(email);
        } catch (error) {
          if (error?.code === "auth/user-not-found") {
            userRecord = await admin.auth().createUser({
              email,
              password: senha,
              displayName: nome,
              emailVerified: false,
              disabled: false,
            });
            isNewUser = true;
          } else {
            throw error;
          }
        }

        if (!isNewUser) {
          await admin.auth().updateUser(userRecord.uid, {
            password: senha,
            displayName: nome,
            emailVerified: false,
            disabled: false,
          });
        }

        const docRef = firestore.collection("clientes").doc(userRecord.uid);
        const existingSnapshot = await docRef.get();
        const existingData = existingSnapshot.exists ? existingSnapshot.data() || {} : {};
        const baseData = buildClientProfileData({
          uid: userRecord.uid,
          nome,
          email,
          senha,
          telefone,
          endereco,
          complemento,
          enderecoFormatado,
          placeId,
          lat,
          lng,
          aceiteTermos,
          newsletter: payload.newsletter,
          preferencias: payload.preferencias,
          existingData,
        });

        await docRef.set(baseData, { merge: true });

        let confirmationResult = null;

        try {
          confirmationResult = await queueConfirmationByRef(
            docRef,
            "cliente",
            `registerClientAccount:${docRef.path}`,
            REGISTER_CLIENT_SOURCE,
            { queueMail: true, force: false },
          );
        } catch (queueError) {
          functions.logger.error("Falha ao enfileirar confirmação do cliente", {
            profilePath: docRef.path,
            error: queueError?.message,
            attempt: "initial",
          });

          try {
            confirmationResult = await queueConfirmationByRef(
              docRef,
              "cliente",
              `registerClientAccount:${docRef.path}`,
              REGISTER_CLIENT_SOURCE,
              { queueMail: true, force: true },
            );

            functions.logger.warn("Confirmação reenfileirada após falha inicial", {
              profilePath: docRef.path,
              mailStatus: confirmationResult?.mailStatus || null,
            });
          } catch (forcedError) {
            functions.logger.error(
              "Falha ao reenfileirar confirmação do cliente (forçado)",
              {
                profilePath: docRef.path,
                error: forcedError?.message,
              },
            );

            try {
              await scheduleConfirmationRetry(
                docRef,
                REGISTER_CLIENT_SOURCE,
                forcedError,
              );
            } catch (retryError) {
              functions.logger.error(
                "Falha ao preparar retentativa automática da confirmação",
                {
                  profilePath: docRef.path,
                  error: retryError?.message,
                },
              );
            }

            confirmationResult = {
              status: "requires-client-enqueue",
              mailStatus: "requires-client-enqueue",
              confirmationUrl: null,
              mailId: null,
              mailPayload: null,
            };
          }
        }

        const confirmationPayload = confirmationResult
          ? {
              status: confirmationResult.status,
              mailStatus: confirmationResult.mailStatus,
              confirmationUrl: confirmationResult.confirmationUrl,
              mailId: confirmationResult.mailId || null,
              mailPayload: confirmationResult.mailPayload || null,
              profilePath: confirmationResult.profilePath || docRef.path,
            }
          : {
              status: "error",
              mailStatus: "error",
              confirmationUrl: null,
              mailId: null,
              mailPayload: null,
              profilePath: docRef.path,
            };

        const normalizedMailStatus = (confirmationPayload.mailStatus || "")
          .toString()
          .toLowerCase();
        const confirmationQueued = normalizedMailStatus
          ? MAIL_SUCCESS_STATUSES.has(normalizedMailStatus)
          : false;

        res.status(200).json({
          ok: true,
          status: "pending",
          profilePath: docRef.path,
          id: userRecord.uid,
          uid: userRecord.uid,
          confirmation: confirmationPayload,
          emailSent: confirmationQueued,
          emailStatus: normalizedMailStatus || null,
        });
      } catch (error) {
        functions.logger.error("Falha ao registrar cliente", {
          email,
          error: error?.message,
        });
        res.status(500).json({ error: "internal-error" });
      }
    });
  });

exports.registerQuickLead = functions
  .region("southamerica-east1")
  .https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
      applyCors(req, res);

      if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
      }

      if (req.method !== "POST") {
        res.status(405).json({ error: "method-not-allowed" });
        return;
      }

      const payload = readHttpPayload(req) || {};

      try {
        const result = await registerQuickLeadFromPayload(payload, {
          sourceFallback: sanitizeString(payload?.source) || "quick-lead-form",
        });
        res.status(200).json(result);
      } catch (error) {
        if (error instanceof QuickLeadError) {
          const statusCode =
            error.code === "invalid-lead"
              ? 400
              : error.code === "invalid-role" || error.code === "missing-role"
                ? 422
                : 400;
          res.status(statusCode).json({ error: error.code || "invalid-lead" });
          return;
        }

        functions.logger.error("Falha inesperada ao registrar lead", {
          error: error?.message,
        });
        res.status(500).json({ error: "internal-error" });
      }
    });
  });

exports.requestSignupConfirmation = functions
  .region("southamerica-east1")
  .https.onRequest(async (req, res) => {
    applyCors(req, res);

    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    if (req.method !== "POST" && req.method !== "GET") {
      res.status(405).json({ error: "method-not-allowed" });
      return;
    }

    const payload = readHttpPayload(req);
    const rawProfile = typeof payload.profile === "string" ? payload.profile.trim() : "";
    const rawForce = payload.force;
    const forceRequest = (() => {
      if (typeof rawForce === "string") {
        const normalized = rawForce.trim().toLowerCase();
        return ["1", "true", "yes"].includes(normalized);
      }

      return Boolean(rawForce);
    })();

    if (!rawProfile) {
      res.status(400).json({ error: "missing-profile" });
      return;
    }

    const profilePath = decodeURIComponent(rawProfile);
    const parts = profilePath.split("/");

    if (parts.length !== 2) {
      res.status(400).json({ error: "invalid-profile-path" });
      return;
    }

    const [collection, documentId] = parts;
    const mapping = CONFIRMATION_COLLECTIONS[collection];

    if (!mapping) {
      res.status(400).json({ error: "unsupported-profile" });
      return;
    }

    const docRef = firestore.collection(collection).doc(documentId);

    try {
      const result = await queueConfirmationByRef(
        docRef,
        mapping.role,
        `requestSignupConfirmation:${profilePath}`,
        "requestSignupConfirmation",
        {
          queueMail: true,
          force: forceRequest,
        },
      );

      res.status(200).json({
        status: result.status,
        confirmationUrl: result.confirmationUrl,
        mailStatus: result.mailStatus,
        mailId: result.mailId || null,
        mailPayload: result.mailPayload || null,
      });
    } catch (error) {
      let queueError = error;
      let errorCode = queueError?.code || queueError?.message;

      if (!forceRequest) {
        functions.logger.error("Falha ao enfileirar confirmação via requestSignupConfirmation", {
          profilePath,
          error: queueError?.message,
          attempt: "initial",
        });

        try {
          const forcedResult = await queueConfirmationByRef(
            docRef,
            mapping.role,
            `requestSignupConfirmation:${profilePath}`,
            "requestSignupConfirmation",
            {
              queueMail: true,
              force: true,
            },
          );

          functions.logger.warn(
            "Confirmação reenfileirada via requestSignupConfirmation após falha inicial",
            {
              profilePath,
              mailStatus: forcedResult?.mailStatus || null,
            },
          );

          res.status(200).json({
            status: forcedResult.status,
            confirmationUrl: forcedResult.confirmationUrl,
            mailStatus: forcedResult.mailStatus,
            mailId: forcedResult.mailId || null,
            mailPayload: forcedResult.mailPayload || null,
          });
          return;
        } catch (forcedError) {
          functions.logger.error(
            "Falha ao reenfileirar confirmação via requestSignupConfirmation (forçado)",
            {
              profilePath,
              error: forcedError?.message,
            },
          );

          queueError = forcedError;
          errorCode = queueError?.code || queueError?.message;
        }
      }

      if (errorCode === "profile-not-found") {
        res.status(404).json({ error: "profile-not-found" });
        return;
      }

      functions.logger.error("Falha ao solicitar confirmação", {
        profilePath,
        error: queueError?.message,
      });

      res.status(500).json({ error: "internal-error" });
    }
  });
