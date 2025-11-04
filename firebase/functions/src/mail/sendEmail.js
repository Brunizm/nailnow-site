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

const SENDGRID_API_KEY_ENV_VARS = [
  'SENDGRID_API_KEY',
  'SENDGRID_KEY',
  'SENDGRID_APIKEY',
  'SENDGRID_TOKEN',
  'SENDGRID_SECRET',
];

const SENDGRID_SENDER_ENV_VARS = [
  'SENDGRID_SENDER',
  'SENDGRID_FROM',
  'SENDGRID_SENDER_EMAIL',
  'SENDGRID_FROM_EMAIL',
];

const SENDGRID_TEMPLATE_CLIENT_ENV_VARS = ['SENDGRID_TEMPLATE_CLIENT'];
const SENDGRID_TEMPLATE_PROFESSIONAL_ENV_VARS = ['SENDGRID_TEMPLATE_PROFESSIONAL'];
const SENDGRID_TEMPLATE_PROFESSIONAL_SIGNUP_ENV_VARS = [
  'SENDGRID_TEMPLATE_PROFESSIONAL_SIGNUP',
];

const SENDGRID_API_KEY_CONFIG_KEYS = [
  'key',
  'api_key',
  'apikey',
  'apiKey',
  'API_KEY',
  'ApiKey',
  'token',
  'secret',
];

const SENDGRID_SENDER_CONFIG_KEYS = [
  'sender',
  'from',
  'email',
  'sender_email',
  'from_email',
];

const SENDGRID_TEMPLATE_CLIENT_CONFIG_KEYS = [
  'template_client',
  'templateClient',
  'templateClientId',
];

const SENDGRID_TEMPLATE_PROFESSIONAL_CONFIG_KEYS = [
  'template_professional',
  'templateProfessional',
  'templateProfessionalId',
];

const SENDGRID_TEMPLATE_PROFESSIONAL_SIGNUP_CONFIG_KEYS = [
  'template_professional_signup',
  'templateProfessionalSignup',
  'templateProfessionalSignupId',
];

const pickFirstString = (values, fallback = '') => {
  for (const value of values) {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) {
        return trimmed;
      }
    }
  }
  return fallback;
};

const mergeSettings = (overrides = {}) => {
  const sendgridConfig = readFunctionsConfig()?.sendgrid || {};

  const apiKeyCandidates = [
    overrides.apiKey,
    ...SENDGRID_API_KEY_ENV_VARS.map((key) => process.env[key]),
    ...SENDGRID_API_KEY_CONFIG_KEYS.map((key) => sendgridConfig[key]),
  ];

  const senderCandidates = [
    overrides.sender,
    ...SENDGRID_SENDER_ENV_VARS.map((key) => process.env[key]),
    ...SENDGRID_SENDER_CONFIG_KEYS.map((key) => sendgridConfig[key]),
    'NailNow <suporte@nailnow.app>',
  ];

  const templateClientCandidates = [
    overrides.templateClient,
    ...SENDGRID_TEMPLATE_CLIENT_ENV_VARS.map((key) => process.env[key]),
    ...SENDGRID_TEMPLATE_CLIENT_CONFIG_KEYS.map((key) => sendgridConfig[key]),
  ];

  const templateProfessionalCandidates = [
    overrides.templateProfessional,
    ...SENDGRID_TEMPLATE_PROFESSIONAL_ENV_VARS.map((key) => process.env[key]),
    ...SENDGRID_TEMPLATE_PROFESSIONAL_CONFIG_KEYS.map((key) => sendgridConfig[key]),
  ];

  const templateProfessionalSignupCandidates = [
    overrides.templateProfessionalSignup,
    ...SENDGRID_TEMPLATE_PROFESSIONAL_SIGNUP_ENV_VARS.map((key) => process.env[key]),
    ...SENDGRID_TEMPLATE_PROFESSIONAL_SIGNUP_CONFIG_KEYS.map((key) => sendgridConfig[key]),
  ];

  return {
    apiKey: pickFirstString(apiKeyCandidates),
    sender: pickFirstString(senderCandidates, 'NailNow <suporte@nailnow.app>'),
    templateClient: pickFirstString(templateClientCandidates),
    templateProfessional: pickFirstString(templateProfessionalCandidates),
    templateProfessionalSignup: pickFirstString(templateProfessionalSignupCandidates),
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
