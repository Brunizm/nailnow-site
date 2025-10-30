# Fluxograma do site NailNow

O diagrama abaixo resume os principais caminhos de navegação e integrações que o visitante percorre ao utilizar o site NailNow.

```mermaid
flowchart TD
  A[Visitante acessa NailNow] --> B{Precisa de serviço ou quer oferecer?}
  B -->|Cliente| C[Seção Cliente]
  B -->|Profissional| H[Seção Profissional]

  subgraph Cliente
    C --> C1[CTA "Criar conta"]
    C1 --> C2[Formulário completo em cliente/cadastro.html]
    C2 --> C3{Validações locais}
    C3 -->|Campos obrigatórios ok| C4[Envio POST para registerClientAccount]
    C4 --> C5{Resposta da Cloud Function}
    C5 -->|Sucesso| C6[Mensagem de confirmação + fila de e-mail]
    C6 --> C7[Link para confirmar cadastro]
    C7 --> C8[confirmar-cadastro.html]
    C8 --> C9{Token gerado com e-mail ou leadID}
    C9 -->|Válido| C10[Redireciona para portal da cliente com login automático]
    C5 -->|Falha| CF[Alerta de erro + instruções de correção]
  end

  subgraph Profissional
    H --> H1[CTA "Quero ser manicure"]
    H1 --> H2[Formulário completo em profissional/cadastro.html]
    H2 --> H3{Validações locais}
    H3 -->|Ok| H4[Autenticação Firebase Auth]
    H4 --> H5[Persistência em Firestore (coleção profissionais)]
    H5 --> H6[Solicita confirmação em requestSignupConfirmation]
    H6 --> H7[Notificação por e-mail]
    H7 --> H8[Usuário abre confirmar-cadastro.html]
    H8 --> H9{Token personalizado recebido}
    H9 -->|Válido| H10[Redireciona para portal profissional autenticado]
    H3 -->|Falha| HF[Feedback com erros do formulário]
    H4 -->|Erro Auth| HE[Exibe mensagem e orienta tentar novamente]
  end

  subgraph Suporte e Conteúdo
    A --> S1[Páginas institucionais (serviços, FAQ, depoimentos)]
    S1 --> S2[CTAs retornam para fluxos de cadastro]
  end
```

## Detalhes importantes

- **Validações locais**: cada formulário garante campos obrigatórios, tamanho mínimo de senha, aceite de termos e dados de endereço formatados antes de enviar ao backend.  
- **Integração com Cloud Functions**: o endpoint `registerClientAccount` recebe os dados do cliente, cria o lead no Firestore e agenda o envio de confirmação. Profissionais utilizam `requestSignupConfirmation` após criar a conta via Firebase Auth.  
- **Confirmação de cadastro**: ao clicar no e-mail, o usuário é direcionado para `confirmar-cadastro.html`, que tenta logar automaticamente no portal correspondente usando o token gerado pela função.  
- **Páginas institucionais** mantêm o visitante informado e redirecionam para os fluxos de cadastro adequados.

Este fluxograma pode ser aberto em ferramentas compatíveis com Mermaid (por exemplo, VS Code com extensão Mermaid, Obsidian ou o próprio GitHub) para visualização gráfica.
