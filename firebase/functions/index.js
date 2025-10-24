const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

const firestore = admin.firestore();
const { FieldValue } = admin.firestore;

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

async function enqueueWelcomeEmail({ email, name, role, sourcePath }) {
  if (!email) {
    functions.logger.warn("Ignorando envio de boas-vindas: documento sem email", { role, sourcePath });
    return null;
  }

  const trimmedEmail = email.trim();
  const payload = {
    to: trimmedEmail,
    message: buildWelcomeMessage({ name, role }),
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
  const email = data.email || data.contatoEmail || "";
  const name = data.nome || data.name || data.displayName || "";

  const mailDocId = await enqueueWelcomeEmail({
    email,
    name,
    role,
    sourcePath: context.resource?.name,
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
