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

Log in with the account that owns the `nailnow-site` project:

```bash
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

## 4. Deploy the functions

Once the configuration is in place, deploy everything with a single command:

```bash
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
