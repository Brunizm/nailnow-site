# Verificação do domínio nailnow.app no Google

Use este procedimento para concluir a validação do domínio `nailnow.app` no Google Search Console via DNS.

## Registro necessário (TXT)

Host/Name: `@` (ou deixe em branco, dependendo do provedor)

Tipo: `TXT`

Valor:

```txt
google-site-verification=N7GUtT1KPTYnJ5dWs6XyMJTcKWQqnv9i58BBGmnXO3Q
```

## Passo a passo

1. No Search Console, selecione o tipo de propriedade **Domínio**.
2. Clique em **Saiba mais** se quiser ver detalhes do método de validação.
3. Faça login no seu provedor de domínio (ex.: GoDaddy, Namecheap, Registro.br, Cloudflare).
4. Abra a configuração de DNS da zona `nailnow.app`.
5. Crie (ou atualize) um registro TXT com o valor acima.
6. Salve e aguarde propagação de DNS (pode levar alguns minutos até 48h).
7. Volte ao Search Console e clique em **Verificar**.

## Observações rápidas

- Se já existir um TXT de verificação do Google, você pode manter vários registros TXT no domínio.
- Não remova registros TXT usados por outros serviços (SPF, verificação de e-mail etc.).
