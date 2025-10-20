import sgMail from '@sendgrid/mail';
import { config as functionsConfig } from 'firebase-functions';

const readFunctionsConfig = () => {
  try {
    return functionsConfig();
  } catch (error) {
    // Ignora quando executado fora do ambiente do Firebase Functions.
    return {};
  }
};

const mergeSettings = (overrides = {}) => {
  const sendgridConfig = readFunctionsConfig()?.sendgrid || {};

  return {
    apiKey: overrides.apiKey ?? process.env.SENDGRID_API_KEY ?? sendgridConfig.key ?? '',
    sender:
      overrides.sender ??
      process.env.SENDGRID_SENDER ??
      sendgridConfig.sender ??
      'contato@nailnow.app',
    templateClient:
      overrides.templateClient ??
      process.env.SENDGRID_TEMPLATE_CLIENT ??
      sendgridConfig.template_client ??
      '',
    templateProfessional:
      overrides.templateProfessional ??
      process.env.SENDGRID_TEMPLATE_PROFESSIONAL ??
      sendgridConfig.template_professional ??
      '',
  };
};

export const resolveSettings = (overrides = {}) => mergeSettings(overrides);

const withFallback = async (settings, action) => {
  if (!settings.apiKey) {
    console.warn('[mail] SENDGRID_API_KEY não configurada; o e-mail não será enviado.');
    return;
  }

  sgMail.setApiKey(settings.apiKey);

  try {
    await action();
  } catch (error) {
    console.error('[mail] Falha ao enviar e-mail', error);
    throw error;
  }
};

export const sendEmail = async (
  { to, subject, templateId, dynamicTemplateData, text, html, from },
  settingsOrOverrides = {}
) => {
  if (!to) {
    console.warn('[mail] Destinatário ausente; ignorando envio.');
    return;
  }

  const settings =
    typeof settingsOrOverrides.apiKey === 'string'
      ? settingsOrOverrides
      : resolveSettings(settingsOrOverrides);

  const message = {
    to,
    from: from || settings.sender,
    subject,
    text,
    html,
    templateId,
    dynamicTemplateData,
  };

  if (!message.templateId) {
    delete message.templateId;
    delete message.dynamicTemplateData;
  }

  if (!message.text && !message.html && !message.templateId) {
    console.warn('[mail] Nenhum conteúdo definido para o e-mail; ignorando envio.');
    return;
  }

  await withFallback(settings, async () => {
    await sgMail.send(message);
  });
};

export default sendEmail;
