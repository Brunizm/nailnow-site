import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { initializeApp } from 'firebase-admin/app';
import { Timestamp } from 'firebase-admin/firestore';
import sendEmail, { settings as mailSettings } from './mail/sendEmail.js';

initializeApp();

const getStatusMetadata = (status) => {
  const normalized = (status || '').toString().toLowerCase();
  switch (normalized) {
    case 'pending':
      return {
        subjectProfessional: 'Nova solicitação recebida',
        subjectClient: 'Recebemos a sua solicitação',
      };
    case 'confirmed':
      return {
        subjectProfessional: 'Você confirmou um atendimento',
        subjectClient: 'Seu atendimento foi confirmado',
      };
    case 'cancelled':
      return {
        subjectProfessional: 'Atendimento cancelado',
        subjectClient: 'Atualização da sua solicitação',
      };
    default:
      return null;
  }
};

const resolveStatusLabel = (status) => {
  const normalized = (status || '').toString().toLowerCase();
  if (normalized === 'pending') return 'Pendente';
  if (normalized === 'confirmed') return 'Confirmado';
  if (normalized === 'cancelled' || normalized === 'canceled') return 'Cancelado';
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

const buildEmailPayloads = (appointment, metadata, context) => {
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
      templateId: mailSettings.templateProfessional,
      dynamicTemplateData: dynamicData,
      text: plainTextProfessional,
      html: undefined,
    },
    {
      to: appointment.clientEmail,
      subject: metadata.subjectClient,
      templateId: mailSettings.templateClient,
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

export const onProfessionalRequestCreated = onDocumentCreated(
  'profissionais/{professionalId}/{collectionId}/{requestId}',
  async (event) => {
    if (!shouldNotify(event)) {
      return;
    }

    const rawData = event.data?.data();
    if (!rawData) {
      return;
    }

    const appointment = normalizeAppointment({ ...rawData, id: event.params.requestId });
    const metadata = getStatusMetadata(appointment.status);

    if (!metadata) {
      console.log('[mail] Status ignorado', appointment.status);
      return;
    }

    const payloads = buildEmailPayloads(appointment, metadata, event);
    await Promise.all(payloads.map((payload) => sendEmail(payload)));
  }
);
