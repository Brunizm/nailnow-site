# Funções Firebase para confirmação de cadastro

Este pacote contém Cloud Functions que gerenciam o estado de confirmação de contas e preparam as mensagens que serão disparadas pela extensão **Trigger Email from Firestore**.

> 📘 **Primeira configuração**: antes de publicar as funções, siga o passo a passo em [`docs/firebase-integration.md`](../../docs/firebase-integration.md) para ativar os métodos de login, criar o banco Firestore em modo de produção e conectar o projeto ao GitHub.

## Como funciona

- Monitora criações **e atualizações** nas coleções `clientes`, `clients`, `profissionais`, `professionals` e `manicures` para garantir que todo perfil comece como `pendente` e receba um `signupConfirmation.token` único.
- Caso o documento seja alterado posteriormente (por exemplo, e-mail corrigido ou cadastro recriado), o gatilho reavalia o estado e reenfileira automaticamente o e-mail de confirmação quando necessário.
- A função HTTPS `requestSignupConfirmation` reutiliza a mesma lógica dos gatilhos Firestore, gera (ou reaproveita) o token e **enfileira automaticamente** o documento na coleção `mail`, retornando o `confirmationUrl` e o identificador do e-mail.
- Os formulários da NailNow apenas solicitam a confirmação após salvar o cadastro; não é mais necessário (nem recomendado) criar documentos `mail` diretamente pelo navegador.
- A extensão Trigger Email from Firestore envia a mensagem de confirmação assim que o documento `mail` criado pela função é processado.
- Quando a usuária acessa o link do e-mail, a função HTTPS `verifySignupConfirmation` valida o token e altera o status do perfil para `confirmado`. A confirmação é exibida na página `confirmar-cadastro.html`, dispensando um segundo e-mail.

> 💡 Se precisar reenviar o e-mail manualmente, basta chamar o endpoint `requestSignupConfirmation` novamente; ele criará outro documento na coleção `mail` e atualizará o histórico de confirmação.

## Passo a passo para deploy

1. Instale as dependências (apenas na primeira vez ou quando `package.json` mudar):

   ```bash
   cd firebase/functions
   npm install
   ```

2. Confirme que o remetente configurado na extensão está verificado no SendGrid:

   - Acesse [Sender Authentication](https://app.sendgrid.com/settings/sender_auth) com a mesma conta usada para gerar a API key.
   - Se estiver fazendo a autenticação de domínio (recomendado), clique em **Authenticate Your Domain** e copie os registros `CNAME`/`TXT` exibidos.
     Esses registros precisam ser criados **no painel de DNS do provedor do seu domínio** (por exemplo: Registro.br, GoDaddy, Cloudflare, HostGator). No painel do provedor, adicione cada registro exatamente como o SendGrid mostra (tipo, host e valor).
     Após salvar, aguarde a propagação e volte ao SendGrid para clicar em **Verify** — o status deve mudar para **Verified**.
   - Como alternativa, você pode cadastrar um **Single Sender** diretamente no SendGrid. Esse fluxo envia um e-mail de confirmação para o endereço informado; só depois de confirmar o link o remetente fica verificado.
   - A extensão só consegue enviar mensagens depois que o status do remetente estiver como **Verified**; caso contrário, o log do Firebase exibirá o erro `The from address does not match a verified Sender Identity`.

3. Configure a API key e o remetente do SendGrid para que as funções consigam
   enviar os e-mails diretamente. Rode o comando abaixo substituindo os valores
   pelos dados reais do projeto (adicione os IDs dos templates apenas se já
   estiverem disponíveis). O código agora reconhece diferentes variações de
   nomes (`sendgrid.key`, `sendgrid.api_key`, `sendgrid.apiKey`, `SENDGRID_API_KEY`,
   `SENDGRID_KEY`, `SENDGRID_APIKEY`, etc.), portanto utilize o padrão que já
   estiver salvo no projeto:

   ```bash
   cd firebase/functions
   firebase functions:config:set \
     sendgrid.key="<sua-chave>" \
     sendgrid.sender="NailNow <suporte@nailnow.app>" \
     sendgrid.template_client="<id-template-cliente>" \
     sendgrid.template_professional="<id-template-profissional>" \
     sendgrid.template_professional_signup="<id-template-cadastro>"
   ```

   Para confirmar que os valores foram aplicados corretamente, execute
   `firebase functions:config:get sendgrid` e verifique se a chave exibida
   corresponde à informada (o Firebase mascara parte do valor na saída por
   segurança).

4. Faça o deploy das funções:

   ```bash
   firebase deploy --only functions
   ```

   Não é necessário configurar secrets — a extensão Trigger Email from Firestore já possui as credenciais do SendGrid, desde que o remetente esteja verificado.

## Testando

1. Cadastre um cliente (ou profissional) pelo site de homologação/produção.
2. No Firestore, confirme que o perfil foi criado com `status: "pendente"` e um objeto `signupConfirmation` contendo `token`.
3. Ainda no Firestore, abra a coleção `mail` e verifique se existe um documento recém-criado com `metadata.emailType = "confirmation"` e `metadata.profilePath` apontando para o cadastro.
   - Se o campo `delivery.status` aparecer como `"skipped"`, significa que a integração do SendGrid não está ativa (API key ou remetente ausente). Rode `firebase functions:config:get sendgrid` e atualize os valores com `firebase functions:config:set` antes de reenviar o cadastro.
   - Caso não exista, use o endpoint manual para reenfileirar o e-mail:

     ```bash
     curl -X POST \
       -H "Content-Type: application/json" \
       -d '{"profile": "clientes/<ID>"}' \
       https://southamerica-east1-<seu-projeto>.cloudfunctions.net/requestSignupConfirmation
     ```

     A resposta informará o `confirmationUrl`, o `status` (`queued`, `already-queued`, `missing-email`, etc.) e o `mailId` criado automaticamente.
4. Abra o link de confirmação (`confirmationUrl`) em uma aba anônima. A função `verifySignupConfirmation` mudará o status para `confirmado`.
5. Para acompanhar logs em tempo real, execute:

   ```bash
   firebase functions:log --only queueClienteWelcomeEmail,queueProfessionalWelcomeEmail,verifySignupConfirmation,requestSignupConfirmation
   ```

## Como confirmar que o gatilho foi executado

1. **Coleção `mail` no Firestore**
   - Abra *Firestore Database → Coleções de dados* e selecione `mail`.
   - Cada vez que a função roda, aparece um documento com os campos `to`, `from`, `message` e `metadata`.
   - Enquanto a extensão processa o documento, o campo `delivery.status` fica como `processing`. Quando o e-mail é aceito pelo SendGrid ele muda para `sent` ou `success`.

2. **Histórico da extensão Trigger Email from Firestore**
   - Acesse *Extensões → Trigger Email from Firestore → Executions*.
   - Ali você vê cada execução da extensão e eventuais erros (por exemplo, remetente não verificado ou template ausente).

  3. **Logs das Cloud Functions**
     - Ainda em *Firebase → Functions*, abra os logs da função (`queueClienteWelcomeEmail`, `queueProfessionalWelcomeEmail` etc.).
     - Procure mensagens como `Confirmação preparada` acompanhadas do `profilePath`; isso confirma que o token e o payload foram gerados com sucesso.

4. **Linha de comando (opcional)**
   - Se preferir, rode:

     ```bash
     firebase functions:log --only queueClienteWelcomeEmail,queueProfessionalWelcomeEmail
     ```

   - O terminal mostrará cada execução e qualquer erro lançado.

## Estrutura

- `index.js` — definição das Cloud Functions, utilitários para montar os e-mails de confirmação e endpoint HTTPS de confirmação de cadastro.
- `templates/confirmacao.html` — referência de template HTML que pode ser copiada para o SendGrid caso queira criar um template transacional.
- `firebase.json` (na raiz do repositório) — aponta o diretório `firebase/functions` como origem do deploy.
