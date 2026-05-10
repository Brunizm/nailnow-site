// functions/index.js

const { onRequest } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const functionsV1 = require("firebase-functions");
const sgMail = require("@sendgrid/mail");

// config global
setGlobalOptions({
  region: "southamerica-east1",
  memory: "256MiB",
  maxInstances: 10,
});

// firebase admin
admin.initializeApp();
const db = admin.firestore();

// pequena função pra pegar a chave do sendgrid sem quebrar o container
function setupSendgrid() {
  const cfg = functionsV1.config();
  const key = cfg?.sendgrid?.key || process.env.SENDGRID_API_KEY;
  if (!key) {
    console.warn("⚠️ SendGrid key not found in functions config or env.");
    return false;
  }
  sgMail.setApiKey(key);
  return true;
}

// ===============================
// ping
// ===============================
exports.ping = onRequest({ cors: true }, (req, res) => {
  return res.status(200).json({ ok: true, ping: "pong" });
});

// ===============================
// cadastro do cliente
// ===============================
exports.registerClientAccount = onRequest({ cors: true }, async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "POST_only" });
    }

    const body = req.body || {};

    logger.info("dados recebidos", body);

    const name = body.name ?? body.nome ?? body.nomeCompleto ?? "";
    const email = body.email ?? body.mail ?? "";
    const phone = body.phone ?? body.telefone ?? null;
    const address = body.address ?? body.endereco ?? null;
    const complement = body.complement ?? body.complemento ?? null;

    if (!name || !email) {
      return res.status(400).json({
        ok: false,
        error: "name_and_email_required",
      });
    }

    const doc = {
      name,
      email,
      phone,
      address,
      complement,
      status: "pending",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      source: "web-register",
    };

    const ref = await db.collection("clientes").add(doc);

    // doc pra extensão / outro fluxo de envio
    await db.collection("mail").add({
      to: email,
      template: {
        name: "signup-confirmation-client",
        data: {
          name,
          confirmationUrl: `https://www.nailnow.app/confirmar-cadastro.html?profile=${ref.id}&token=${ref.id}`,
        },
      },
    });

    return res.status(200).json({
      ok: true,
      id: ref.id,
      emailSent: true,
    });
  } catch (err) {
    logger.error("erro registerClientAccount", err);
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

// ===============================
// trigger de envio de email via firestore
// ===============================
exports.sendEmailOnCreate = onDocumentCreated(
  "emails/{emailId}",
  async (event) => {
    const data = event.data?.data();
    if (!data) {
      console.log("documento sem dados em emails/");
      return;
    }

    // garante que o sendgrid está configurado
    const ok = setupSendgrid();
    if (!ok) {
      console.error("SendGrid não configurado, não foi possível enviar.");
      return;
    }

    const msg = {
      to: data.to,
      from: "seuemail@seudominio.com", // altere para o remetente verificado
      subject: data.subject || "Mensagem NailNow",
      text: data.text || "",
      html: data.html || "",
    };

    try {
      await sgMail.send(msg);
      console.log("📧 email enviado para", data.to);
    } catch (err) {
      console.error("❌ erro ao enviar email", err);
    }
  }
);

