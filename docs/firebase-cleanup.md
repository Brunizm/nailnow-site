# Limpeza de cadastros de profissionais no Firebase

O portal da manicure usa agora apenas a coleção `profissionais` do Firestore. Essa configuração está declarada na constante `PROFILE_COLLECTIONS`
dos arquivos `profissional/index.html` e `profissional/portal.js`. Com isso, toda autenticação e leitura de dados passa somente por essa coleção.

Para excluir cadastros duplicados ou desativar um perfil manualmente:

1. Acesse o [Console Firebase](https://console.firebase.google.com/) e abra o projeto `nailnow-7546c`.
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

## Atualizar o status das profissionais

O campo `status` permanece disponível para indicar se uma profissional está aprovada, pendente ou inativa, mas **não** bloqueia mais o acesso ao portal.
O login será concluído desde que o e-mail e a senha estejam corretos.

Ainda assim, recomendamos manter o status atualizado para organização interna e comunicação com a equipe de suporte. Se for necessário restringir o acesso de alguém,
remova ou atualize manualmente a senha do cadastro em `profissionais` em vez de confiar apenas nesse campo.
