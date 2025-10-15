# Limpeza de cadastros de profissionais no Firebase

O portal da manicure usa agora apenas a coleção `profissionais` do Firestore. Essa configuração está declarada na constante `PROFILE_COLLECTIONS`
dos arquivos `profissional/index.html` e `profissional/portal.js`. Com isso, toda autenticação e leitura de dados passa somente por essa coleção.

Para excluir cadastros duplicados ou desativar um perfil manualmente:

1. Acesse o [Console Firebase](https://console.firebase.google.com/) e abra o projeto `nailnow-site`.
2. Entre em *Firestore Database*.
3. Dentro da coleção `profissionais`, selecione o documento que deseja excluir.
4. Clique em **Excluir documento** e confirme a remoção.

Caso precise migrar cadastros antigos da coleção `manicures`:

1. Exporte ou copie os documentos desejados de `manicures` para `profissionais`, garantindo que as chaves (inclusive senha) sejam mantidas.
2. Publique o site novamente somente se for alterar a constante `PROFILE_COLLECTIONS` para incluir `manicures` temporariamente:

   ```js
   const PROFILE_COLLECTIONS = ["profissionais", "manicures"];
   ```

3. Assim que concluir a migração e remover `manicures`, volte a constante para `["profissionais"]` para evitar buscas desnecessárias.

> Observação: enquanto apenas `profissionais` permanecer em `PROFILE_COLLECTIONS`, nenhuma remoção adicional é necessária no Firestore para evitar
> duplicidade — basta manter o cadastro desejado ativo nessa coleção.

## Aprovar novas profissionais

Os logins exibem uma mensagem de bloqueio sempre que o campo `status` da manicure estiver com valores como `pendente`, `aguardando` ou `em análise`.
Para liberar o acesso ao portal:

1. Localize o documento da profissional na coleção `profissionais`.
2. Edite o campo `status` e defina como `aprovado`, `confirmado` ou `ativo` (qualquer uma dessas grafias libera o acesso).
3. Clique em **Publicar** para salvar a alteração.

Assim que o status for atualizado, a manicure conseguirá entrar no portal com o mesmo e-mail e senha cadastrados. Caso prefira restringir o acesso,
retorne o status para `pendente` — a interface exibirá a mensagem de aprovação pendente e impedirá o login até que seja liberado novamente.
