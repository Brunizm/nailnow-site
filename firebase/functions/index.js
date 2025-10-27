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

  return {
    to: [trimmedEmail],
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
    },
  };
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
  const email = data.email || data.contatoEmail || "";
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

        const mailRef = await firestore.collection("mail").add(payload);
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

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeLower(value) {
  return normalizeString(value).toLowerCase();
}

function getPrimaryEmail(data) {
  const raw = normalizeString(data.email || data.contatoEmail || "");
  return raw.toLowerCase();
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

  const statusNormalized = normalizeLower(afterData.status || "");
  if (["confirmado", "confirmada", "confirmed"].includes(statusNormalized)) {
    return { shouldQueue: false, force: false };
  }

  const afterEmail = getPrimaryEmail(afterData);
  if (!afterEmail) {
    return { shouldQueue: false, force: false };
  }

  const afterConfirmation = afterData.signupConfirmation || {};
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
  "https://nailnow-site.web.app",
  "https://nailnow-site.firebaseapp.com",
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
  const allowedOrigin = origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://www.nailnow.app";
  res.set("Access-Control-Allow-Origin", allowedOrigin);
  res.set("Vary", "Origin");
  res.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.set(
    "Access-Control-Allow-Headers",
    "Origin, Content-Type, Accept, X-Requested-With, X-Client-Data, X-Firebase-AppCheck",
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

    try {
      const docRef = firestore.collection(collection).doc(documentId);
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
      const errorCode = error?.code || error?.message;

      if (errorCode === "profile-not-found") {
        res.status(404).json({ error: "profile-not-found" });
        return;
      }

      functions.logger.error("Falha ao solicitar confirmação", {
        profilePath,
        error: error?.message,
      });

      res.status(500).json({ error: "internal-error" });
    }
  });
