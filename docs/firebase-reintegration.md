# Reativando a integração com o Firebase

Quando a integração anterior foi removida, o repositório deixou de rastrear os
arquivos do Firebase para evitar conflitos. Se você está iniciando um novo
projeto na sua conta do Firebase, siga os passos abaixo para restaurar a
estrutura e evitar os conflitos exibidos pelo GitHub.

## 1. Atualize seu clone local

1. Abra um terminal e garanta que você tem a versão mais recente do código:

   ```bash
   git checkout work
   git pull
   ```

2. Remova qualquer pasta `firebase/` ou `functions/` que tenha sido gerada por
   tentativas anteriores (elas estavam ignoradas e podem estar incompletas):

   ```bash
   rm -rf firebase functions
   ```

## 2. Recrie o projeto do Firebase

1. Instale o Firebase CLI se ainda não tiver feito:

   ```bash
   npm install -g firebase-tools
   ```

2. Faça login e inicialize o projeto apontando para sua nova conta:

   ```bash
   firebase login
   firebase use --add
   ```

   > 💡 Use o mesmo ID de projeto que você quer utilizar em produção.

3. Dentro do diretório do repositório execute:

   ```bash
   firebase init hosting functions
   ```

   Escolha **JavaScript** como linguagem das Functions e habilite o ESLint
   padrão. Ao final confirme para instalar as dependências.

4. A inicialização criará novamente as pastas `firebase/` ou `functions/`
   dependendo da configuração escolhida. Como o `.gitignore` foi atualizado, os
   arquivos voltarão a ser rastreados normalmente.

## 3. Aplique a estrutura antiga (opcional)

Se você ainda tem uma cópia do backend antigo ou deseja reaproveitar partes
específicas (como templates de e-mail ou modelos de dados), copie os arquivos
para dentro da nova pasta `functions/` antes de fazer o commit.

Caso contrário, adapte os templates gerados pelo Firebase CLI conforme a nova
necessidade do projeto.

## 4. Verifique o estado do Git

Após a inicialização, execute:

```bash
git status
```

Você deverá ver os novos arquivos adicionados em `firebase/` e/ou `functions/`
prontos para commit. Caso ainda apareçam conflitos no GitHub, certifique-se de
que eles foram resolvidos localmente antes de reenviar a branch:

```bash
git add -A
git commit
git push --force-with-lease
```

## 5. Configure integrações externas

* **SendGrid:** rode `firebase functions:config:set sendgrid.key="<sua-chave>"`
  e quaisquer outras variáveis necessárias antes de fazer o deploy.
* **Firestore:** recrie as coleções `clientes`, `profissionais` e qualquer
  outra coleção exigida pelo novo backend.

Com esses passos você terá um novo workspace do Firebase totalmente conectado a
este repositório, pronto para receber o código da nova integração.
