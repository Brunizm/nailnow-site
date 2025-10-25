import { onDocumentCreated, onDocumentWritten } from 'firebase-functions/v2/firestore';
import { initializeApp } from 'firebase-admin/app';
import { Timestamp } from 'firebase-admin/firestore';
import { defineSecret } from 'firebase-functions/params';
import sendEmail, { resolveSettings } from './mail/sendEmail.js';

initializeApp();

const SENDGRID_API_KEY = defineSecret('SENDGRID_API_KEY');
const SENDGRID_SENDER = defineSecret('SENDGRID_SENDER');
const SENDGRID_TEMPLATE_CLIENT = defineSecret('SENDGRID_TEMPLATE_CLIENT');
const SENDGRID_TEMPLATE_PROFESSIONAL = defineSecret('SENDGRID_TEMPLATE_PROFESSIONAL');
const SENDGRID_TEMPLATE_PROFESSIONAL_SIGNUP = defineSecret(
  'SENDGRID_TEMPLATE_PROFESSIONAL_SIGNUP'
);

const normalizeStatus = (status) => (status || '').toString().toLowerCase();

const hasStatus = (status, ...candidates) =>
  candidates.some((candidate) => normalizeStatus(status) === candidate);

const getStatusMetadata = (status) => {
  if (hasStatus(status, 'pending', 'pendente')) {
    return {
      subjectProfessional: 'Nova solicitação recebida',
      subjectClient: 'Recebemos a sua solicitação',
    };
  }

  if (hasStatus(status, 'confirmed', 'confirmado', 'confirmada')) {
    return {
      subjectProfessional: 'Você confirmou um atendimento',
      subjectClient: 'Seu atendimento foi confirmado',
    };
  }

  if (hasStatus(status, 'cancelled', 'canceled', 'cancelado', 'cancelada', 'rejected')) {
    return {
      subjectProfessional: 'Atendimento cancelado',
      subjectClient: 'Atualização da sua solicitação',
    };
  }

  return null;
};

const resolveStatusLabel = (status) => {
  if (hasStatus(status, 'pending', 'pendente')) return 'Pendente';
  if (hasStatus(status, 'confirmed', 'confirmado', 'confirmada')) return 'Confirmado';
  if (hasStatus(status, 'cancelled', 'canceled', 'cancelado', 'cancelada', 'rejected')) return 'Cancelado';
  return 'Atualizado';
};

const normalizeAppointment = (data = {}) => {
  const formatTimestamp = (value) => {
    if (!value) return null;
    if (value instanceof Timestamp) {
      return value.toDate().toISOString();
    }
    if (typeof value?.toDate === 'function') {
      try {
        return value.toDate().toISOString();
      } catch (error) {
        console.warn('[mail] Falha ao converter timestamp', error);
      }
    }
    if (typeof value === 'string' || typeof value === 'number') {
      return value;
    }
    return null;
  };

  return {
    id: data.id || data.requestId || data.uid || null,
    professionalName: data.professionalName || data.professionalDisplayName || 'Manicure NailNow',
    professionalEmail: data.professionalEmail,
    professionalPhone: data.professionalPhone || null,
    clientName: data.clientName || data.clientDisplayName || 'Cliente NailNow',
    clientEmail: data.clientEmail,
    clientPhone: data.clientPhone || null,
    status: data.status,
    service: data.service || data.serviceName || data.serviceLabel || 'Serviço NailNow',
    price: data.price || data.servicePrice || null,
    date: data.date || null,
    time: data.time || null,
    location: data.location || data.address || null,
    note: data.note || data.notes || null,
    createdAt: formatTimestamp(data.createdAt),
    updatedAt: formatTimestamp(data.updatedAt),
  };
};

const buildEmailPayloads = (appointment, metadata, context, mailSettings) => {
  const { params } = context;
  const requestId = appointment.id || params.requestId;
  const baseUrl = 'https://www.nailnow.app';
  const queryString = requestId ? `?solicitacao=${encodeURIComponent(requestId)}` : '';

  const professionalCta = `${baseUrl}/profissional/portal.html${queryString}`;
  const clientCta = `${baseUrl}/cliente/portal.html${queryString}`;

  const plainTextClient = `Olá, ${appointment.clientName || 'cliente'}!

Status: ${resolveStatusLabel(appointment.status)}
Serviço: ${appointment.service || '—'}
Data: ${appointment.date || '—'}
Horário: ${appointment.time || '—'}
Local: ${appointment.location || '—'}

Para mais detalhes, acesse ${clientCta}`;

  const plainTextProfessional = `Olá, ${appointment.professionalName || 'manicure'}!

Status: ${resolveStatusLabel(appointment.status)}
Serviço: ${appointment.service || '—'}
Data: ${appointment.date || '—'}
Horário: ${appointment.time || '—'}
Local: ${appointment.location || '—'}

Gerencie a agenda em ${professionalCta}`;

  const dynamicData = {
    requestId,
    professionalName: appointment.professionalName,
    clientName: appointment.clientName,
    statusLabel: resolveStatusLabel(appointment.status),
    service: appointment.service,
    price: appointment.price,
    date: appointment.date,
    time: appointment.time,
    location: appointment.location,
    note: appointment.note,
    status: appointment.status,
    professionalCta,
    clientCta,
  };

  return [
    {
      to: appointment.professionalEmail,
      subject: metadata.subjectProfessional,
      templateId: mailSettings?.templateProfessional,
      dynamicTemplateData: dynamicData,
      text: plainTextProfessional,
      html: undefined,
    },
    {
      to: appointment.clientEmail,
      subject: metadata.subjectClient,
      templateId: mailSettings?.templateClient,
      dynamicTemplateData: dynamicData,
      text: plainTextClient,
      html: undefined,
    },
  ].filter((payload) => Boolean(payload.to));
};

const shouldNotify = (context) => {
  const { collectionId } = context.params;
  if (!collectionId) return false;
  const normalized = collectionId.toLowerCase();
  return ['solicitacoes', 'confirmados', 'cancelados'].includes(normalized);
};

const readSecret = (secret) => {
  if (!secret) return undefined;
  try {
    return secret.value();
  } catch (error) {
    return undefined;
  }
};

const readMailSettings = () =>
  resolveSettings({
    apiKey: readSecret(SENDGRID_API_KEY),
    sender: readSecret(SENDGRID_SENDER),
    templateClient: readSecret(SENDGRID_TEMPLATE_CLIENT),
    templateProfessional: readSecret(SENDGRID_TEMPLATE_PROFESSIONAL),
    templateProfessionalSignup: readSecret(SENDGRID_TEMPLATE_PROFESSIONAL_SIGNUP),
  });

const normalizeProfessionalProfile = (data = {}, professionalId = null) => ({
  id: professionalId || data.uid || null,
  name:
    data.nome ||
    data.name ||
    data.displayName ||
    data.fullName ||
    data.professionalName ||
    'Profissional NailNow',
  email: data.email || data.professionalEmail || null,
  phone: data.telefone || data.phone || data.professionalPhone || null,
  city: data.cidade || data.city || null,
  status: data.status || null,
});

const buildProfessionalSignupEmail = (professional, mailSettings) => {
  if (!professional.email) {
    console.warn('[mail] Cadastro de profissional sem e-mail; notificações ignoradas.');
    return null;
  }

  const statusLabel = resolveStatusLabel(professional.status);
  const portalUrl = 'https://www.nailnow.app/profissional/login.html';

  const text = `Olá, ${professional.name}!

Recebemos o seu cadastro na NailNow e já estamos revisando suas informações.

Status do cadastro: ${statusLabel}
Cidade de atendimento: ${professional.city || 'Não informado'}

Assim que sua conta for liberada, acesse o portal em ${portalUrl} para acompanhar solicitações, confirmar horários e atualizar seu perfil.

Equipe NailNow`;

  return {
    to: professional.email,
    subject: 'Recebemos seu cadastro na NailNow',
    templateId: mailSettings?.templateProfessionalSignup,
    dynamicTemplateData: {
      professionalName: professional.name,
      statusLabel,
      city: professional.city,
      portalUrl,
    },
    text,
    html: undefined,
  };
};

export const onProfessionalRequestChange = onDocumentWritten(
  {
    document: 'profissionais/{professionalId}/{collectionId}/{requestId}',
    secrets: [
      SENDGRID_API_KEY,
      SENDGRID_SENDER,
      SENDGRID_TEMPLATE_CLIENT,
      SENDGRID_TEMPLATE_PROFESSIONAL,
      SENDGRID_TEMPLATE_PROFESSIONAL_SIGNUP,
    ],
  },
  async (event) => {
    if (!shouldNotify(event)) {
      return;
    }

    const rawData = event.data?.after?.data();
    if (!rawData) {
      return;
    }

    const previousStatus = event.data?.before?.data()?.status;

    const appointment = normalizeAppointment({ ...rawData, id: event.params.requestId });
    const metadata = getStatusMetadata(appointment.status);

    if (!metadata) {
      console.log('[mail] Status ignorado', appointment.status);
      return;
    }

    if (previousStatus && previousStatus === appointment.status) {
      console.log('[mail] Atualização ignorada — status não mudou', appointment.status);
      return;
    }

    const mailSettings = readMailSettings();

    const payloads = buildEmailPayloads(appointment, metadata, event, mailSettings);

    if (!payloads.length) {
      console.log('[mail] Nenhum destinatário válido encontrado para a atualização de atendimento.');
      return;
    }

    console.log(
      '[mail] Enviando notificações de atendimento',
      {
        requestId: appointment.id,
        professionalEmail: payloads.find((payload) => payload.to === appointment.professionalEmail)?.to || null,
        clientEmail: payloads.find((payload) => payload.to === appointment.clientEmail)?.to || null,
        status: appointment.status,
      }
    );

    await Promise.all(payloads.map((payload) => sendEmail(payload, mailSettings)));
  }
);

export const onProfessionalProfileCreated = onDocumentCreated(
  {
    document: 'profissionais/{professionalId}',
    secrets: [
      SENDGRID_API_KEY,
      SENDGRID_SENDER,
      SENDGRID_TEMPLATE_CLIENT,
      SENDGRID_TEMPLATE_PROFESSIONAL,
      SENDGRID_TEMPLATE_PROFESSIONAL_SIGNUP,
    ],
  },
  async (event) => {
    const data = event.data?.data();
    if (!data) {
      return;
    }

    const professional = normalizeProfessionalProfile(data, event.params.professionalId);
    const mailSettings = readMailSettings();
    const payload = buildProfessionalSignupEmail(professional, mailSettings);
    if (!payload) {
      return;
    }

    console.log('[mail] Enviando e-mail de boas-vindas para profissional', {
      professionalId: professional.id,
      email: professional.email,
      status: professional.status,
    });

    await sendEmail(payload, mailSettings);
  }
);
