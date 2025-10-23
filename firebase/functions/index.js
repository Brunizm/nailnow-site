const functions = require("firebase-functions");
const admin = require("firebase-admin");
const sgMail = require("@sendgrid/mail");
const { defineSecret } = require("firebase-functions/params");

// Inicializa Firebase Admin (necessário para Functions)
admin.initializeApp();

// Secrets (vamos cadastrar no PASSO 2, no Console do Firebase)
const SENDGRID_API_KEY = defineSecret("SENDGRID_API_KEY");
const SENDGRID_FROM = defineSecret("SENDGRID_FROM");
const TEMPLATE_CLIENT = defineSecret("TEMPLATE_CLIENT");
const TEMPLATE_PRO = defineSecret("TEMPLATE_PRO");

// Função utilitária para enviar email com ou sem template
async function sendEmail(opts) {
  const from = opts.from ?? SENDGRID_FROM.value();
  const templateId = opts.templateId;
  sgMail.setApiKey(SENDGRID_API_KEY.value());

  if (templateId) {
    await sgMail.send({
      to: opts.to,
      from,
      templateId,
      dynamicTemplateData: opts.dynamicTemplateData ?? {}
    });
  } else {
    await sgMail.send({
      to: opts.to,
      from,
      subject: opts.subjectFallback ?? "Bem-vindo(a)!",
      text: "Cadastro concluído. Obrigado por se registrar no NailKnow!"
    });
  }
}

/**
 * Dispara quando um CLIENTE é criado no Firestore
 * Coleção: clients/{clientId}
 */
exports.onClientCreated = functions
  .region("southamerica-east1")
  .runWith({ secrets: ["SENDGRID_API_KEY", "SENDGRID_FROM", "TEMPLATE_CLIENT"] })
  .firestore.document("clients/{clientId}")
  .onCreate(async (snap) => {
    const data = snap.data() || {};
    if (!data.email) {
      console.warn("Documento de cliente sem email.");
      return;
    }
    await sendEmail({
      to: data.email,
      templateId: TEMPLATE_CLIENT.value(),
      subjectFallback: "Bem-vindo(a) ao NailKnow!",
      dynamicTemplateData: {
        name: data.name ?? "Cliente",
        appUrl: "https://nailknow.app",
        role: "cliente"
      }
    });
  });

/**
 * Dispara quando uma PROFISSIONAL/MANICURE é criada no Firestore
 * Coleção: professionals/{proId}
 * (se você usa 'manicures/{id}', troque o caminho abaixo)
 */
exports.onProfessionalCreated = functions
  .region("southamerica-east1")
  .runWith({ secrets: ["SENDGRID_API_KEY", "SENDGRID_FROM", "TEMPLATE_PRO"] })
  .firestore.document("professionals/{proId}")
  .onCreate(async (snap) => {
    const data = snap.data() || {};
    if (!data.email) {
      console.warn("Documento de profissional sem email.");
      return;
    }
    await sendEmail({
      to: data.email,
      templateId: TEMPLATE_PRO.value(),
      subjectFallback: "Bem-vinda ao NailKnow!",
      dynamicTemplateData: {
        name: data.name ?? "Profissional",
        appUrl: "https://nailknow.app",
        role: "profissional"
      }
    });
  });
