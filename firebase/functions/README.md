# Funções Firebase para notificações por e-mail

Este pacote contém a primeira versão das Cloud Functions responsáveis por disparar
os e-mails transacionais do portal NailNow sempre que um atendimento muda de
status dentro do Firestore.

## Visão geral

- Observa as subcoleções `solicitacoes`, `confirmados` e `cancelados` em
  `profissionais/{professionalId}`.
- Sempre que um documento é criado ou muda de status (`pending`/`pendente`,
  `confirmed`/`confirmado(a)` ou `cancelled`/`cancelado(a)`), envia um e-mail tanto
  para a manicure quanto para a cliente.
- O conteúdo utiliza templates transacionais do SendGrid. Caso nenhum template
  seja configurado, a função envia um fallback em texto puro com as principais
  informações do atendimento.

## Configuração

1. Instale as dependências na pasta `firebase/functions`:

   ```bash
   cd firebase/functions
   npm install
   ```

2. Cadastre as credenciais como secrets (recomendado a partir do Firebase Functions v2):

   ```bash
   firebase functions:secrets:set SENDGRID_API_KEY
   firebase functions:secrets:set SENDGRID_SENDER --data-file sender.txt
   firebase functions:secrets:set SENDGRID_TEMPLATE_CLIENT --data-file template_client.txt
   firebase functions:secrets:set SENDGRID_TEMPLATE_PROFESSIONAL --data-file template_professional.txt
   ```

   > Os arquivos `sender.txt`, `template_client.txt` e `template_professional.txt` devem conter apenas o valor correspondente.

   Se preferir utilizar variáveis de ambiente locais no momento do deploy, exporte-as antes de rodar o comando:

   ```bash
   export SENDGRID_API_KEY="<API_KEY>"
   export SENDGRID_SENDER="contato@nailnow.app"
   export SENDGRID_TEMPLATE_CLIENT="d-xxxxxxxx"
   export SENDGRID_TEMPLATE_PROFESSIONAL="d-yyyyyyyy"
   ```

3. Faça o deploy das funções (os secrets são montados automaticamente graças à configuração da função):

   ```bash
   firebase deploy --only functions
   ```

## Estrutura

- `src/index.js` — definição das Cloud Functions observando o Firestore (função `onProfessionalRequestChange`).
- `src/mail/sendEmail.js` — wrapper de envio com SendGrid.

Com isso, manicure e cliente passam a receber notificações assim que uma
solicitação é criada, confirmada ou cancelada.
