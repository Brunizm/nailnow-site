const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

const firestore = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const APP_URL = "https://www.nailnow.app";

function buildWelcomeMessage({ name, role }) {
  const safeName = (name || (role === "profissional" ? "Profissional" : "Cliente")).trim();
  const roleLabel = role === "profissional" ? "profissional" : "cliente";
  const subject = "Bem-vinda ao NailNow 💅";
  const text = `Olá, ${safeName}! Seu cadastro foi realizado com sucesso no NailNow.`;
  const html = [
    `<p>Olá, <strong>${safeName}</strong>! 💖 Seu cadastro foi realizado com sucesso no NailNow.</p>`,
    `<p>Agora você pode acessar sua conta como ${roleLabel} em <a href="${APP_URL}">${APP_URL}</a>.</p>`,
  ].join("");

  return { subject, text, html };
}

async function enqueueWelcomeEmail({ email, name, role, sourcePath, profileId, profilePath }) {
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
    message: buildWelcomeMessage({ name, role }),
    metadata: {
      role,
      source: "cloud-function",
      profileId: profileId || null,
      profilePath: profilePath || null,
      sourcePath: sourcePath || null,
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
    const mailDocId = await enqueueWelcomeEmail({
      email,
      name,
      role,
      sourcePath: context.resource?.name,
      profileId: snap.id,
      profilePath: snap.ref.path,
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
