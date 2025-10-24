# Funções Firebase para fila de e-mails

Este pacote contém Cloud Functions responsáveis por criar automaticamente os documentos na coleção `mail` do Firestore.
Esses documentos acionam a extensão **Trigger Email from Firestore**, que então envia os e-mails de boas-vindas via SendGrid.

## Como funciona

- Monitora criações nas coleções `clientes`, `clients`, `profissionais`, `professionals` e `manicures`.
- Quando um novo cadastro aparece, gera uma mensagem de boas-vindas com assunto, texto e HTML em português.
- Grava o documento na coleção `mail` com o formato esperado pela extensão instalada (`to` como array e `message` contendo `subject`, `text` e `html`).
- Marca o cadastro original com `welcomeEmailQueuedAt`, `welcomeEmailQueuedBy` e o `welcomeEmailMailId` criado.

> 💡 Se o front-end conseguir gravar diretamente na coleção `mail`, a extensão continuará funcionando. As funções servem como
> garantia extra para que o e-mail seja enfileirado mesmo quando as regras de segurança bloquearem a gravação pelo navegador.

## Passo a passo para deploy

1. Instale as dependências (apenas na primeira vez ou quando `package.json` mudar):

   ```bash
   cd firebase/functions
   npm install
   ```

2. Faça o deploy das funções:

   ```bash
   firebase deploy --only functions
   ```

   Não é necessário configurar secrets — a extensão Trigger Email from Firestore já possui as credenciais do SendGrid.

## Testando

- Crie manualmente um documento na coleção `clientes` (ou `profissionais`) com os campos mínimos:

  ```json
  {
    "nome": "Bruna Teste",
    "email": "bruna@example.com"
  }
  ```

- A função `queueClienteWelcomeEmail` criará um documento em `mail` em poucos segundos.
- A extensão enviará o e-mail e marcará o documento `mail` como `delivered` (pode levar até 1 minuto).
- Consulte os logs em tempo real para acompanhar cada envio:

  ```bash
  firebase functions:log --only queueClienteWelcomeEmail,queueProfessionalWelcomeEmail
  ```

## Estrutura

- `index.js` — definição das Cloud Functions e utilitários para montar a mensagem de boas-vindas.
- `firebase.json` (na raiz do repositório) — aponta o diretório `firebase/functions` como origem do deploy.

Depois do deploy, os cadastros criados pelos formulários da NailNow já terão o e-mail disparado automaticamente sem ações manuais.
