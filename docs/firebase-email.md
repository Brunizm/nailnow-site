# Integração de notificações por e-mail com Firebase

Esta referência resume como disparar e-mails transacionais a partir das mudanças registradas pelo portal NailNow nas coleções do Firestore.

## 1. Estrutura de dados observada

As solicitações são gravadas em subcoleções com os seguintes caminhos:

- `profissionais/{profissionalId}/solicitacoes/{solicitacaoId}` (status `pending`)
- `profissionais/{profissionalId}/confirmados/{solicitacaoId}` (status `confirmed`)
- `profissionais/{profissionalId}/cancelados/{solicitacaoId}` (status `cancelled`)
- `clientes/{clienteId}/solicitacoes/{solicitacaoId}` (status `pending`)
- `clientes/{clienteId}/confirmados/{solicitacaoId}` (status `confirmed`)
- `clientes/{clienteId}/cancelados/{solicitacaoId}` (status `cancelled`)

Cada documento contém, entre outros campos, `professionalEmail`, `clientEmail`, `status`, `service`, `date`, `time`, `location` e `note`.

## 2. Escolha do mecanismo de envio

Você pode optar por:

1. **Firebase Extensions — Trigger Email**
   - Instale a extensão `firestore-send-email` pelo Console Firebase.
   - Configure os templates padrão (`pending`, `confirmed`, `cancelled`).
   - Crie regras para escrever em `mail/{docId}` sempre que uma solicitação mudar de status (ver seção 3).

2. **Cloud Functions personalizadas**
   - Configure uma função `onDocumentCreated`/`onDocumentUpdated` para cada subcoleção relevante.
   - Use o provedor de envio de e-mails preferido (por exemplo, SendGrid, Amazon SES ou Gmail SMTP) dentro da função.

## 3. Disparando os e-mails

Exemplo em Cloud Functions usando Node.js v18:

```js
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import sendEmail from './mail/sendEmail.js'; // wrapper para o provedor escolhido

initializeApp();

const buildPayload = (data) => ({
  professionalEmail: data.professionalEmail,
  clientEmail: data.clientEmail,
  status: data.status,
  service: data.service,
  date: data.date,
  time: data.time,
  location: data.location,
  note: data.note,
});

export const onRequestWrite = onDocumentWritten(
  'profissionais/{profissionalId}/{collectionId}/{requestId}',
  async (event) => {
    const data = event.data?.after?.data();
    if (!data) return;

    const payload = buildPayload(data);

    switch (payload.status) {
      case 'pending':
        await sendEmail(payload.professionalEmail, 'Nova solicitação', payload);
        await sendEmail(payload.clientEmail, 'Solicitação recebida', payload);
        break;
      case 'confirmed':
        await sendEmail(payload.professionalEmail, 'Solicitação confirmada', payload);
        await sendEmail(payload.clientEmail, 'Seu atendimento foi confirmado', payload);
        break;
      case 'cancelled':
        await sendEmail(payload.professionalEmail, 'Solicitação cancelada', payload);
        await sendEmail(payload.clientEmail, 'Atualização da sua solicitação', payload);
        break;
      default:
        break;
    }
  }
);
```

> Dica: para evitar e-mails duplicados, use `event.params.collectionId` para diferenciar se a mudança ocorreu em `solicitacoes`, `confirmados` ou `cancelados`, e ignore transições que não criem um novo documento.

## 4. Conteúdo do e-mail (CTA integrado ao portal)

Inclua no template links diretos para o portal:

- Cliente: `https://www.nailnow.app/cliente/portal.html?solicitacao={requestId}`
- Manicure: `https://www.nailnow.app/profissional/portal.html?solicitacao={requestId}`

Dessa forma, o botão (CTA) leva a usuária diretamente para a página autenticada correspondente, mantendo o fluxo dentro do portal.

## 5. Segurança

- Garanta que somente Cloud Functions (ou a extensão) possuam permissão para escrever na coleção `mail/`.
- Revise as regras do Firestore para evitar que clientes escrevam diretamente em `confirmados` ou `cancelados`.
- Registre logs estruturados nas funções para facilitar auditoria e reenvio manual, se necessário.

Com essa estrutura, as notificações por e-mail se mantêm sincronizadas com os status exibidos no portal e preservam o fluxo rápido de acompanhamento desejado.
