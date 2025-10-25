# Funções Firebase para fila de e-mails

Este pacote contém Cloud Functions responsáveis por criar automaticamente os documentos na coleção `mail` do Firestore.
Esses documentos acionam a extensão **Trigger Email from Firestore**, que então envia os e-mails de boas-vindas via SendGrid.

## Como funciona

- Monitora criações nas coleções `clientes`, `clients`, `profissionais`, `professionals` e `manicures`.
- Quando um novo cadastro aparece, gera uma mensagem de boas-vindas com assunto, texto e HTML em português.
- Grava o documento na coleção `mail` com o formato esperado pela extensão instalada (`to` como array, `from` com `name`/`email` e `message` contendo `subject`, `text` e `html`).
- Marca o cadastro original com `welcomeEmailQueuedAt`, `welcomeEmailQueuedBy` e o `welcomeEmailMailId` criado.
- Se o documento já possuir `welcomeEmailMailId`/`welcomeEmailQueuedBy` (por exemplo, porque o formulário web conseguiu criar o documento em `mail`), a função apenas registra o evento e evita duplicar o envio.

> 💡 Os formulários web da NailNow já tentam gravar diretamente na coleção `mail`.
> As funções atuam como garantia extra para que o e-mail seja enfileirado mesmo quando as regras de segurança bloquearem a gravação pelo navegador.

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

- `index.js` — definição das Cloud Functions e utilitários para montar a mensagem de boas-vindas (incluindo o CTA “Confirmar cadastro”).
- `templates/confirmacao.html` — referência de template HTML que pode ser copiada para o SendGrid caso queira criar um template transacional.
- `firebase.json` (na raiz do repositório) — aponta o diretório `firebase/functions` como origem do deploy.

Depois do deploy, os cadastros criados pelos formulários da NailNow já terão o e-mail disparado automaticamente sem ações manuais.
