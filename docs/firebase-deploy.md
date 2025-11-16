# Firebase: redeploying endpoints when signup fails

Se os endpoints de cadastro voltarem a retornar `failed to fetch` (todas as URLs de Cloud Function falham), siga esta ordem para garantir que a função com CORS liberado esteja ativa.

## 1) Preparar o ambiente
- Instale a CLI do Firebase (se ainda não estiver instalada): `npm install -g firebase-tools`
- Autentique-se: `firebase login`
- Selecione o projeto correto (o site de hosting aponta para `nailnow-7546c-e1672`): `firebase use --add nailnow-7546c-e1672`

## 2) Atualizar variáveis de configuração (se necessário)
Os endpoints de cadastro dependem de variáveis do bloco `sendgrid` para envio de e-mails. Caso tenha alterado credenciais ou templates, aplique-as antes do deploy:

```bash
firebase functions:config:set \
  sendgrid.key="<API_KEY>" \
  sendgrid.sender="NailNow <suporte@nailnow.app>" \
  sendgrid.template_client="<TEMPLATE_CLIENTE>" \
  sendgrid.template_professional="<TEMPLATE_PROFISSIONAL>" \
  sendgrid.template_professional_signup="<TEMPLATE_PROF_SIGNUP>"
```

Verifique o que está salvo: `firebase functions:config:get sendgrid`

## 3) Deploy dos endpoints de cadastro
Os handlers de cadastro estão na região `southamerica-east1` e usam CORS flexível para subdomínios `*.nailnow.app` ou `localhost` (veja `resolveAllowedOrigin` e `applyCors` em `functions/index.js`). Execute o deploy para aplicar as regras atualizadas:

```bash
firebase deploy --only functions:registerClientAccount,functions:registerProfessionalAccount --region southamerica-east1
```

Se quiser tudo de uma vez: `firebase deploy --only functions --region southamerica-east1`

## 4) Validar após o deploy
- No console do Firebase > Cloud Functions, confirme que ambas as funções mostram a região `southamerica-east1` e a data/hora atual de publicação.
- Abra a aba Logs e verifique se as respostas de `OPTIONS` e `POST` estão chegando sem erros de CORS.
- Faça um cadastro de teste a partir de `https://www.nailnow.app/cliente/cadastro.html` e confirme que o documento é criado em `clientes` no Firestore.
