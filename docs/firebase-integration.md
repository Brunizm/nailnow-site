# Integração do novo projeto Firebase com o repositório GitHub

Este guia consolida os passos para colocar o projeto `nailnow-7546c` em funcionamento com o site hospedado neste repositório, incluindo a configuração dos provedores de login, a criação do banco Firestore em modo de produção e o vínculo com os deploys automáticos via GitHub.

## 1. Pré-requisitos

1. Acesse o [Console Firebase](https://console.firebase.google.com/) com a conta que administra o projeto `nailnow-7546c`.
2. Garanta que o Firebase CLI está instalado localmente (`npm install -g firebase-tools`) e que o login foi feito com `firebase login`.
3. No repositório local, confirme que o arquivo `firebase.json` aponta para o site `nailnow-7546c-e1672` e que o arquivo `firestore.rules` contém as regras padrão de bloqueio total.

## 2. Habilitar os provedores de login

1. No Console Firebase, abra **Authentication → Métodos de login**.
2. Ative os seguintes provedores:
   - **E-mail/senha** (obrigatório para os cadastros do site).
   - **Google** (opcional para futuras integrações sociais, já pré-ativado conforme o print do console).
   - **Telefone** (caso deseje confirmação adicional por SMS).
3. Salve cada provedor após informar os dados obrigatórios (por exemplo, domínio de suporte para e-mail/senha).
4. Não habilite o login anônimo — o site já lida com essa restrição e exibe instruções amigáveis quando o Firestore bloqueia acessos diretos.

> 💡 Sempre que um método de login for ativado ou desativado, execute um `firebase deploy --only hosting` para publicar o frontend atualizado (os arquivos locais já estão preparados para lidar com os provedores citados).

## 3. Criar o banco de dados Firestore em modo de produção

1. Ainda no console, navegue até **Firestore Database → Criar banco de dados**.
2. Escolha o modo **Produção** e defina a localização `southamerica-east1 (São Paulo)`.
3. Mantenha o ID sugerido (`nailnow`) e avance até a tela de regras.
4. Substitua o conteúdo pelo trecho a seguir (o mesmo que está versionado em `firestore.rules`):

   ```
   rules_version = '2';

   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if false;
       }
     }
   }
   ```

5. Confirme a criação do banco. Todas as leituras e gravações serão bloqueadas até que regras específicas sejam publicadas.
6. Para manter o ambiente alinhado ao repositório, rode localmente:

   ```bash
   firebase deploy --only firestore:rules
   ```

   Assim você garante que qualquer ajuste futuro nas regras seja versionado e publicado pelo CLI.

## 4. Vincular o Hosting ao GitHub

1. No menu **Hosting**, selecione o site `nailnow-7546c-e1672`.
2. Clique em **Vincular ao GitHub** (ou **Manage GitHub integration** se já houver um vínculo anterior) e autorize o acesso ao repositório `nailnow-site`.
3. Escolha a branch principal (`work`, se for a utilizada em produção) e habilite o deploy automático para o canal **live**.
4. Confirme que o workflow criado no GitHub Actions inclui as etapas de `firebase deploy --only hosting` e `firebase deploy --only functions` quando arquivos relevantes mudarem.
5. Caso prefira manter o deploy manual, deixe o workflow desativado e utilize localmente:

   ```bash
   firebase deploy --only hosting,functions
   ```

6. Depois do primeiro deploy, verifique se o domínio customizado `https://www.nailnow.app` continua conectado e emitindo certificados válidos.

## 5. Próximos passos no Firestore

- Crie as coleções necessárias (`clientes`, `profissionais`, `mail`) diretamente pelo console ou via scripts após definir regras específicas para leitura e escrita.
- Atualize as regras no arquivo `firestore.rules` antes de liberar acesso público. Enquanto as regras permanecerem como `allow read, write: if false`, somente as Cloud Functions com privilégio de administrador conseguirão modificar os dados.
- Use o arquivo `functions/index.js` como base para expor endpoints HTTPS que continuem processando cadastros e confirmações mesmo com o Firestore bloqueado para o frontend.

Seguindo esse fluxo, o novo projeto Firebase ficará alinhado ao código versionado e poderá ser publicado ou restaurado rapidamente em qualquer ambiente.
