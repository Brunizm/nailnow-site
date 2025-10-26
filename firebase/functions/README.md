# Funções Firebase para fila de e-mails

Este pacote contém Cloud Functions responsáveis por criar automaticamente os documentos na coleção `mail` do Firestore.
Esses documentos acionam a extensão **Trigger Email from Firestore**, que então envia os e-mails de confirmação e boas-vindas via SendGrid.

## Como funciona

- Monitora criações nas coleções `clientes`, `clients`, `profissionais`, `professionals` e `manicures`.
- Quando um novo cadastro aparece, gera a mensagem de **confirmação de cadastro** com CTA para validar a conta e grava o documento na coleção `mail`.
- Marca o cadastro original com `welcomeEmailQueuedAt`, `welcomeEmailQueuedBy` e o `welcomeEmailMailId` criado (aproveitando os mesmos campos já utilizados nos formulários web para evitar duplicidade).
- Assim que a usuária acessa o link de confirmação, a função HTTPS `verifySignupConfirmation` altera o status do perfil para `confirmado` e cria um segundo documento em `mail` com o e-mail de **boas-vindas/liberação de acesso**.
- Cada mensagem criada segue o formato exigido pela extensão (`to` como array, `from` como string no formato `Nome <email>` e `message` contendo `subject`, `text` e `html`).
- O perfil confirmado recebe os campos `postConfirmationEmailMailId`, `postConfirmationEmailQueuedAt` e `postConfirmationEmailQueuedBy` (ou `postConfirmationEmailError` em caso de falha), facilitando auditoria.
- Se o documento já possuir `welcomeEmailMailId`/`welcomeEmailQueuedBy` (por exemplo, porque o formulário web conseguiu criar o documento em `mail`), a função apenas registra o evento e evita duplicar o envio.

> 💡 Os formulários web da NailNow chamam o endpoint HTTPS `requestSignupConfirmation` logo após salvar o cadastro.
> Esse endpoint dispara a mesma lógica das funções `onCreate`, garantindo que o documento seja criado na coleção `mail` mesmo se o gatilho de Firestore ainda não tiver sido atualizado no ambiente de produção.

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

3. Faça o deploy das funções:

   ```bash
   firebase deploy --only functions
   ```

   Não é necessário configurar secrets — a extensão Trigger Email from Firestore já possui as credenciais do SendGrid, desde que o remetente esteja verificado.

## Testando

1. Crie manualmente um documento na coleção `clientes` (ou `profissionais`) com os campos mínimos:

   ```json
   {
     "nome": "Bruna Teste",
     "email": "bruna@example.com"
   }
   ```

   Em poucos segundos a função `queueClienteWelcomeEmail` criará um documento em `mail` contendo o e-mail de confirmação.

   Se preferir acionar manualmente o mesmo fluxo que o formulário usa, faça uma requisição HTTP para a função `requestSignupConfirmation`:

   ```bash
   curl -X POST \
     -H "Content-Type: application/json" \
     -d '{"profile": "clientes/<ID>"}' \
     https://southamerica-east1-<seu-projeto>.cloudfunctions.net/requestSignupConfirmation
   ```

   Substitua `<seu-projeto>` e `<ID>` pelos valores reais. A resposta indicará se o documento foi enfileirado (`queued`), reaproveitado (`already-queued`) ou se ocorreu algum erro.

2. Copie o `signupConfirmation.token` salvo no documento do cliente e acesse:

   ```text
   https://southamerica-east1-<seu-projeto>.cloudfunctions.net/verifySignupConfirmation?profile=clientes/<ID>&token=<TOKEN>
   ```

   (Troque `<seu-projeto>`, `<ID>` e `<TOKEN>` pelos valores reais.)

   O endpoint mudará o status para `confirmado` e criará automaticamente um novo documento em `mail` com o e-mail de boas-vindas/liberação de acesso.

3. A extensão enviará as duas mensagens e marcará cada documento `mail` como `delivered`/`sent` (pode levar até 1 minuto por mensagem).

4. Para acompanhar os envios em tempo real, execute:

   ```bash
   firebase functions:log --only queueClienteWelcomeEmail,queueProfessionalWelcomeEmail,verifySignupConfirmation
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
   - Procure mensagens como `Documento mail criado para boas-vindas` com o ID gerado; isso confirma que o gatilho disparou.

4. **Linha de comando (opcional)**
   - Se preferir, rode:

     ```bash
     firebase functions:log --only queueClienteWelcomeEmail,queueProfessionalWelcomeEmail
     ```

   - O terminal mostrará cada execução e qualquer erro lançado.

## Estrutura

- `index.js` — definição das Cloud Functions, utilitários para montar os e-mails de confirmação e boas-vindas e endpoint HTTPS de confirmação de cadastro.
- `templates/confirmacao.html` — referência de template HTML que pode ser copiada para o SendGrid caso queira criar um template transacional.
- `firebase.json` (na raiz do repositório) — aponta o diretório `firebase/functions` como origem do deploy.

Depois do deploy, os cadastros criados pelos formulários da NailNow já terão o e-mail disparado automaticamente sem ações manuais.
