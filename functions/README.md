# Deploying the NailNow Cloud Functions

The Firebase console currently shows the onboarding prompts because no functions
are deployed. Follow the steps below to restore the backend using the code in
this repository.

## 1. Install the Firebase CLI locally

```bash
npm install --global firebase-tools
```

If you cannot install global dependencies, run the bundled scripts from inside
the `functions` directory instead:

```bash
cd functions
npm install
npm run login
```

## 2. Authenticate and select the project

Log in with the account that owns the `nailnow-site` project. All of the
package scripts live inside the `functions` workspace, so make sure you are in
that folder (or use `npm --prefix functions run …` from the repository root)
before running them:

```bash
cd functions
npm run login
```

When the browser opens, approve access and select the Firebase project when
prompted.

## 3. Configure the SendGrid integration

Set the SendGrid API key and sender details so the confirmation e-mails can be
delivered. The command reads the values from environment variables, keeping
secrets out of source control:

```bash
cd functions
SENDGRID_API_KEY="<sua-chave>" \
SENDGRID_SENDER="NailNow <suporte@nailnow.app>" \
SENDGRID_TEMPLATE_CLIENT="<id-template-cliente>" \
SENDGRID_TEMPLATE_PROFESSIONAL="<id-template-profissional>" \
SENDGRID_TEMPLATE_PROFESSIONAL_SIGNUP="<id-template-cadastro>" \
npm run setup:config
```

You can confirm the values with `firebase functions:config:get`.

> ℹ️ If you only need to update a single value (for example, rotating the
> `sendgrid.key`), you can also run the Firebase CLI command directly:
>
> ```bash
> cd functions
> firebase functions:config:set sendgrid.key="<sua-chave>"
> ```
>
> Substitute `<sua-chave>` with the real SendGrid API key provided for the
> project. Repeat the command for any other keys you want to update.

## 4. Deploy the functions

Once the configuration is in place, deploy everything with a single command
from inside the `functions` directory:

```bash
cd functions
npm run deploy
```

The Firebase console will refresh automatically and list the deployed
endpoints (such as `registerClientAccount`, `registerProfessionalAccount` and
`requestSignupConfirmation`).

## 5. Seed the Firestore collections (opcional)

The application stores data in the `clientes`, `profissionais` e `mail`.
Collections are created automatically when the first document is written, but
you can add an empty placeholder document manually from the Firestore console
if you want to visualize them immediately.

## 6. Teste o fluxo completo de cadastro

1. Inicie um servidor estático na raiz do repositório para abrir o site
   localmente. Qualquer servidor funciona (`python -m http.server`, `npx serve`,
   etc.); por exemplo:
   ```bash
   npx serve
   ```
2. Acesse `http://localhost:3000/profissional/cadastro.html` (ou o endereço
   exibido no terminal) e preencha o formulário com um e-mail de teste que ainda
   não exista no Firestore.
3. Após o envio, confirme que um novo documento foi criado na coleção
   `profissionais` com `status: "pending"` e que a coleção `mail` recebeu um
   registro com `delivery.status: "sent"`. Esses dois sinais confirmam que a
   função escreveu os dados e disparou o e-mail de confirmação via SendGrid.
   - Se o campo aparecer como `delivery.status: "skipped"`, a função não
     enviou o e-mail porque a chave ou o remetente do SendGrid não estão
     configurados. Rode `firebase functions:config:get sendgrid` para validar os
     valores e repita o deploy após corrigir a integração.
4. Verifique a caixa de entrada do e-mail informado ou o dashboard do SendGrid
   para validar a entrega. Ao clicar no link do e-mail, o status do perfil muda
   de `pending` para `confirmed`.

Repita o mesmo fluxo em `http://localhost:3000/cliente/cadastro.html` para
garantir que o cadastro de clientes também esteja operando.
