# Resolvendo conflitos ao remover o Firebase

> ℹ️ Está iniciando uma nova integração? Consulte também o guia
> [`docs/firebase-reintegration.md`](firebase-reintegration.md) para restaurar a
> estrutura do Firebase antes de abrir o Pull Request.

Quando o projeto foi desconectado do Firebase, diversos arquivos e pastas
foram excluídos de uma vez. O GitHub costuma exibir uma lista longa de
conflitos ao tentar mesclar uma alteração desse tamanho diretamente pela
interface web.

Siga os passos abaixo para aplicar a remoção localmente e enviar uma nova
mesclagem sem conflitos:

1. Faça um clone atualizado do repositório:

   ```bash
   git clone git@github.com:<sua-conta>/nailnow-site.git
   cd nailnow-site
   ```

2. Garanta que você está na branch `work` (ou a branch que contém a
   remoção do Firebase):

   ```bash
   git checkout work
   ```

3. Traga a versão base mais recente e integre as exclusões:

   ```bash
   git fetch origin
   git rebase origin/main
   ```

   Se houver novos conflitos, mantenha sempre os arquivos vazios ou
   excluídos da branch `work` e finalize com:

   ```bash
   git add -A
   git rebase --continue
   ```

4. Envie a branch atualizada para o GitHub:

   ```bash
   git push --force-with-lease
   ```

5. Abra o Pull Request normalmente. Como os conflitos foram resolvidos
   localmente, o GitHub não bloqueará a mesclagem.

> 💡 Caso não queira usar rebase, um `git merge origin/main` também
> funciona. O importante é resolver os conflitos localmente, confirmar as
> exclusões com `git add -A` e reenviar a branch.

Seguindo o fluxo acima você consegue remover o Firebase e seus arquivos
antigos sem depender da resolução de conflitos pela interface web.
