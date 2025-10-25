const functions = require("firebase-functions");
const admin = require("firebase-admin");
const crypto = require("node:crypto");

admin.initializeApp();

const firestore = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const APP_URL = "https://www.nailnow.app";
const SUPPORT_SENDER = {
  email: "suporte@nailnow.app",
  name: "NailNow",
};

function buildConfirmationUrl(profilePath, token) {
  const params = new URLSearchParams({
    profile: profilePath,
    token,
  });
  return `${APP_URL}/confirmar-cadastro.html?${params.toString()}`;
}

function buildWelcomeMessage({ name, role, confirmationUrl }) {
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

async function enqueueWelcomeEmail({
  email,
  name,
  role,
  sourcePath,
  profileId,
  profilePath,
  confirmationUrl,
  confirmationToken,
}) {
  if (!email) {
    functions.logger.warn("Ignorando envio de boas-vindas: documento sem email", { role, sourcePath });
    return null;
  }

  const trimmedEmail = email.trim();
  if (!trimmedEmail) {
    functions.logger.warn("Ignorando boas-vindas: email vazio após trim", { role, sourcePath });
    return null;
  }

  const payload = {
    to: [trimmedEmail],
    from: SUPPORT_SENDER,
    message: buildWelcomeMessage({ name, role, confirmationUrl }),
    metadata: {
      role,
      source: "cloud-function",
      profileId: profileId || null,
      profilePath: profilePath || null,
      sourcePath: sourcePath || null,
      confirmationUrl,
      confirmationToken,
    },
  };

  const ref = await firestore.collection("mail").add(payload);
  functions.logger.info("Documento mail criado para boas-vindas", {
    role,
    sourcePath,
    mailDocumentId: ref.id,
  });
  return ref.id;
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

async function handleProfileCreation(snap, context, role) {
  const data = snap.data() || {};

  if (data.welcomeEmailMailId || data.welcomeEmailQueuedBy) {
    functions.logger.info("Boas-vindas já enfileiradas no momento da criação", {
      role,
      sourcePath: context.resource?.name,
      welcomeEmailMailId: data.welcomeEmailMailId,
      welcomeEmailQueuedBy: data.welcomeEmailQueuedBy,
    });
    return null;
  }

  const email = data.email || data.contatoEmail || "";
  const name = data.nome || data.name || data.displayName || "";

  try {
    const { signupConfirmation } = await persistSignupState(snap, data, role);
    data.signupConfirmation = signupConfirmation;

    const confirmationUrl = buildConfirmationUrl(snap.ref.path, signupConfirmation.token);
    const mailDocId = await enqueueWelcomeEmail({
      email,
      name,
      role,
      sourcePath: context.resource?.name,
      profileId: snap.id,
      profilePath: snap.ref.path,
      confirmationUrl,
      confirmationToken: signupConfirmation.token,
    });

    if (mailDocId) {
      await snap.ref.set(
        {
          welcomeEmailQueuedAt: FieldValue.serverTimestamp(),
          welcomeEmailQueuedBy: "cloud-function",
          welcomeEmailMailId: mailDocId,
        },
        { merge: true },
      );
    }
  } catch (error) {
    functions.logger.error("Falha ao enfileirar boas-vindas", {
      role,
      sourcePath: context.resource?.name,
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
  clientes: { role: "cliente", loginPath: "/cliente/index.html" },
  clients: { role: "cliente", loginPath: "/cliente/index.html" },
  profissionais: { role: "profissional", loginPath: "/profissional/index.html" },
  professionals: { role: "profissional", loginPath: "/profissional/index.html" },
  manicures: { role: "profissional", loginPath: "/profissional/index.html" },
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
