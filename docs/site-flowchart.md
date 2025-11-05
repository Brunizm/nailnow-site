# Fluxograma do site NailNow

O diagrama abaixo resume os principais caminhos de navegação e as interações atuais do visitante com o site NailNow após a remoção da infraestrutura Firebase.

```mermaid
flowchart TD
  A[Visitante acessa NailNow] --> B{Precisa de serviço ou quer oferecer?}
  B -->|Cliente| C[Seção Cliente]
  B -->|Profissional| H[Seção Profissional]

  subgraph Cliente
    C --> C1[CTA "Criar conta"]
    C1 --> C2[Formulário em cliente/cadastro.html]
    C2 --> C3{Validações locais}
    C3 -->|Campos obrigatórios ok| C4[Mensagem de migração exibida]
    C4 --> C5[Visitante direcionado ao suporte (WhatsApp/E-mail)]
    C3 -->|Campos ausentes| CF[Feedback em tela]
  end

  subgraph Profissional
    H --> H1[CTA "Quero ser manicure"]
    H1 --> H2[Formulário em profissional/cadastro.html]
    H2 --> H3{Validações locais}
    H3 -->|Ok| H4[Mensagem de migração exibida]
    H4 --> H5[Orientação para contato com suporte]
    H3 -->|Falha| HF[Feedback com erros do formulário]
  end

  subgraph Confirmação
    H4 --> K[confirmar-cadastro.html]
    C4 --> K
    K --> K1[Informativo: confirmações automáticas desativadas]
  end

  subgraph Suporte e Conteúdo
    A --> S1[Páginas institucionais (serviços, FAQ, depoimentos)]
    S1 --> S2[CTAs retornam para formulários ou contato direto]
  end
```

## Detalhes importantes

- **Validações locais**: os formulários verificam campos obrigatórios, tamanho mínimo de senha e aceite de termos antes de exibir a mensagem de migração.
- **Processo manual**: após o envio, o visitante recebe instruções para concluir o cadastro diretamente com a equipe de suporte, sem integrações automáticas.
- **Confirmação desativada**: a página `confirmar-cadastro.html` agora apenas informa que o fluxo automático está desativado até que uma nova plataforma seja configurada.
- **Páginas institucionais** continuam disponíveis e direcionam o visitante para os pontos de contato corretos.

Este fluxograma pode ser aberto em ferramentas compatíveis com Mermaid (por exemplo, VS Code com extensão Mermaid, Obsidian ou o próprio GitHub) para visualização gráfica.
