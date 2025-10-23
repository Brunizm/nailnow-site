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
- Dispara um e-mail de confirmação para a profissional assim que um novo perfil é
  criado na coleção `profissionais`.
- O conteúdo utiliza templates transacionais do SendGrid. Caso nenhum template
  seja configurado, a função envia um fallback em texto puro com as principais
  informações do atendimento.

## Configuração

1. Instale as dependências na pasta `firebase/functions`:

   ```bash
   cd firebase/functions
   npm install
   ```

2. Cadastre as credenciais como secrets (recomendado a partir do Firebase Functions v2). Este é o único passo manual necessário para que os e-mails usem o remetente e os templates corretos:

   ```bash
   firebase functions:secrets:set SENDGRID_API_KEY
   firebase functions:secrets:set SENDGRID_SENDER --data-file sender.txt
   firebase functions:secrets:set SENDGRID_TEMPLATE_CLIENT --data-file template_client.txt
   firebase functions:secrets:set SENDGRID_TEMPLATE_PROFESSIONAL --data-file template_professional.txt
   firebase functions:secrets:set SENDGRID_TEMPLATE_PROFESSIONAL_SIGNUP --data-file template_professional_signup.txt
   ```

   > Os arquivos `sender.txt`, `template_client.txt` e `template_professional.txt` devem conter apenas o valor correspondente.

   Se preferir utilizar variáveis de ambiente locais no momento do deploy, exporte-as antes de rodar o comando:

   ```bash
   export SENDGRID_API_KEY="<API_KEY>"
   export SENDGRID_SENDER="contato@nailnow.app"
   export SENDGRID_TEMPLATE_CLIENT="d-xxxxxxxx"
   export SENDGRID_TEMPLATE_PROFESSIONAL="d-yyyyyyyy"
   export SENDGRID_TEMPLATE_PROFESSIONAL_SIGNUP="d-zzzzzzzz"
   ```

3. Faça o deploy das funções (os secrets são montados automaticamente graças à configuração da função). Depois desse passo, nenhum envio precisa ser disparado manualmente — as funções ficam escutando o Firestore continuamente:

   ```bash
   firebase deploy --only functions
   ```

## Estrutura

- `src/index.js` — definição das Cloud Functions observando o Firestore (funções
  `onProfessionalRequestChange` e `onProfessionalProfileCreated`).
- `src/mail/sendEmail.js` — wrapper de envio com SendGrid.

Com isso, manicure e cliente passam a receber notificações assim que uma
solicitação é criada, confirmada ou cancelada.

## Dúvidas frequentes

### Preciso enviar os e-mails manualmente?

Não. Depois que os segredos do SendGrid estiverem configurados e o deploy das
funções for realizado, os disparos acontecem automaticamente:

- Assim que um documento é criado ou atualizado nas subcoleções de agenda,
  a função `onProfessionalRequestChange` envia os e-mails para manicure e
  cliente.
- Quando um novo documento é adicionado à coleção `profissionais`, a função
  `onProfessionalProfileCreated` envia o e-mail de boas-vindas.

Para testar, crie um documento de exemplo diretamente pelo console do
Firestore. Em seguida, acompanhe os logs em tempo real com:

```bash
firebase functions:log --only onProfessionalRequestChange,onProfessionalProfileCreated
```

Os logs exibem qual e-mail foi gerado e apontam a causa caso algum destinatário
ou credencial esteja ausente.

### Em resumo, o que eu preciso fazer manualmente?

1. Instalar as dependências de `firebase/functions` na primeira vez (ou quando
   houver novas bibliotecas).
2. Cadastrar/atualizar os secrets do SendGrid sempre que o remetente ou os
   templates mudarem.
3. Executar `firebase deploy --only functions` quando houver alterações nas
   funções.

Todo o restante — escutar o Firestore, gerar os dados do e-mail e enviá-lo para
manicures, clientes e profissionais recém-cadastrados — é automático.
