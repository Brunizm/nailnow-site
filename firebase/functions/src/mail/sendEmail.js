import sgMail from '@sendgrid/mail';
import { config as functionsConfig } from 'firebase-functions';

const loadConfig = () => {
  let config = {};
  try {
    config = functionsConfig();
  } catch (error) {
    // Ignora quando executado fora do ambiente do Firebase Functions.
  }

  const sendgridConfig = config?.sendgrid || {};

  return {
    apiKey: process.env.SENDGRID_API_KEY || sendgridConfig.key || '',
    sender: process.env.SENDGRID_SENDER || sendgridConfig.sender || 'contato@nailnow.app',
    templateClient:
      process.env.SENDGRID_TEMPLATE_CLIENT || sendgridConfig.template_client || '',
    templateProfessional:
      process.env.SENDGRID_TEMPLATE_PROFESSIONAL || sendgridConfig.template_professional || '',
  };
};

export const settings = loadConfig();
const apiKey = settings.apiKey;
const defaultSender = settings.sender;

if (apiKey) {
  sgMail.setApiKey(apiKey);
}

const withFallback = async (action) => {
  if (!apiKey) {
    console.warn('[mail] SENDGRID_API_KEY não configurada; o e-mail não será enviado.');
    return;
  }

  try {
    await action();
  } catch (error) {
    console.error('[mail] Falha ao enviar e-mail', error);
    throw error;
  }
};

export const sendEmail = async ({ to, subject, templateId, dynamicTemplateData, text, html }) => {
  if (!to) {
    console.warn('[mail] Destinatário ausente; ignorando envio.');
    return;
  }

  const message = {
    to,
    from: defaultSender,
    subject,
    text,
    html,
    templateId,
    dynamicTemplateData,
  };

  if (!templateId) {
    delete message.templateId;
    delete message.dynamicTemplateData;
  }

  if (!text && !html && !templateId) {
    console.warn('[mail] Nenhum conteúdo definido para o e-mail; ignorando envio.');
    return;
  }

  await withFallback(async () => {
    await sgMail.send(message);
  });
};

export default sendEmail;
