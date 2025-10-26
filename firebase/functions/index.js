const functions = require("firebase-functions");
const admin = require("firebase-admin");
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
    `<p style="margin: 24px 0;"><a href="${confirmationUrl}" style="background-color:#7c3aed;color:#ffffff;padding:12px 20px;border-radius:999px;text-decoration:none;display:inline-block;font-weight:600;">Confirmar cadastro</a></p>`,
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

  if (!existing.status) {
    updates.status = "pending";
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
      const shouldQueueMail = force || !existingMailId;
      if (shouldQueueMail) {
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
        mailStatus = "already-queued";
        confirmationUpdate.mailStatus = "already-queued";
        confirmationUpdate.mailId = existingMailId;
        confirmationUpdate.mailDocumentId = existingMailId;
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

async function handleProfileCreation(snap, context, role) {
  return queueConfirmationForSnapshot(snap, role, context.resource?.name, "firestore-trigger", {
    queueMail: true,
    force: false,
  });
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
  .onCreate((snap, context) => handleProfileCreation(snap, context, "cliente"));

exports.queueClientWelcomeEmail = functions
  .region("southamerica-east1")
  .firestore.document("clients/{clientId}")
  .onCreate((snap, context) => handleProfileCreation(snap, context, "cliente"));

exports.queueProfessionalWelcomeEmail = functions
  .region("southamerica-east1")
  .firestore.document("profissionais/{profissionalId}")
  .onCreate((snap, context) => handleProfileCreation(snap, context, "profissional"));

exports.queueManicureWelcomeEmail = functions
  .region("southamerica-east1")
  .firestore.document("manicures/{manicureId}")
  .onCreate((snap, context) => handleProfileCreation(snap, context, "profissional"));

exports.queueProfessionalWelcomeEmailEn = functions
  .region("southamerica-east1")
  .firestore.document("professionals/{professionalId}")
  .onCreate((snap, context) => handleProfileCreation(snap, context, "profissional"));

const CONFIRMATION_COLLECTIONS = {
  clientes: { role: "cliente", loginPath: ROLE_LOGIN_PATH.cliente },
  clients: { role: "cliente", loginPath: ROLE_LOGIN_PATH.cliente },
  profissionais: { role: "profissional", loginPath: ROLE_LOGIN_PATH.profissional },
  professionals: { role: "profissional", loginPath: ROLE_LOGIN_PATH.profissional },
  manicures: { role: "profissional", loginPath: ROLE_LOGIN_PATH.profissional },
};

exports.verifySignupConfirmation = functions
  .region("southamerica-east1")
  .https.onRequest(async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    const payload = req.method === "POST" ? req.body || {} : req.query || {};
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
      const alreadyConfirmed =
        normalizedStatus === "confirmado" ||
        normalizedStatus === "confirmada" ||
        normalizedStatus === "confirmed" ||
        confirmationStatus === "confirmed";

      if (alreadyConfirmed) {
        res.status(200).json({
          status: "already-confirmed",
          role: mapping.role,
          loginUrl: `${APP_URL}${mapping.loginPath}`,
        });
        return;
      }

      const confirmationUpdate = {
        ...confirmation,
        status: "confirmed",
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

      res.status(200).json({
        status: "confirmed",
        role: mapping.role,
        loginUrl: `${APP_URL}${mapping.loginPath}`,
      });
    } catch (error) {
      functions.logger.error("Falha ao confirmar cadastro", {
        profilePath,
        error: error?.message,
      });
      res.status(500).json({ error: "internal-error" });
    }
  });

exports.requestSignupConfirmation = functions
  .region("southamerica-east1")
  .https.onRequest(async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    if (req.method !== "POST" && req.method !== "GET") {
      res.status(405).json({ error: "method-not-allowed" });
      return;
    }

    const payload = req.method === "POST" ? req.body || {} : req.query || {};
    const rawProfile = typeof payload.profile === "string" ? payload.profile.trim() : "";

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
          force: req.method === "POST",
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
