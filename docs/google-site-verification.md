# Verificação do domínio nailnow.app no Google

Use este procedimento para concluir a validação do domínio `nailnow.app` no Google Search Console via DNS.

## Registro necessário (TXT)

Host/Name: `@` (raiz do domínio)

Tipo: `TXT`

Valor:

```txt
google-site-verification=N7GUtT1KPTYnJ5dWs6XyMJTcKWQqnv9i58BBGmnXO3Q
```

## Passo a passo

1. No Search Console, selecione o tipo de propriedade **Domínio**.
2. Faça login no seu provedor de domínio (ex.: GoDaddy, Namecheap, Registro.br, Cloudflare).
3. Abra a configuração de DNS da zona `nailnow.app`.
4. Crie **um novo** registro TXT com o valor acima na raiz (`@`).
5. Não apague os TXT já existentes (SPF, e-mail, outros serviços).
6. Salve e aguarde propagação de DNS (pode levar alguns minutos até 48h).
7. Volte ao Search Console e clique em **Verificar**.

## Diagnóstico para o erro “token não encontrado”

Se o Search Console informar que não encontrou o token, normalmente é porque o registro ainda não foi criado na raiz ou ainda não propagou.

Atualmente foram detectados apenas estes TXT no domínio:

- `v=spf1 include:spf.privateemail.com ~all`
- `v=spf1 include:spf.efwd.registrar-servers.com ~all`

Ou seja, o TXT `google-site-verification=...` ainda não está público no DNS autoritativo.

## Como conferir antes de clicar em verificar

Rode um destes comandos e confirme se o token aparece na resposta:

```bash
dig +short TXT nailnow.app
```

ou

```bash
nslookup -type=TXT nailnow.app
```

Quando o valor `google-site-verification=N7GUtT1KPTYnJ5dWs6XyMJTcKWQqnv9i58BBGmnXO3Q` aparecer, volte ao Search Console e tente novamente.

## Observações rápidas

- É normal ter múltiplos registros TXT no mesmo domínio.
- Não substitua um SPF por outro sem revisar entrega de e-mail.
- Se o provedor permitir TTL, use um TTL menor (ex.: 300) para acelerar testes iniciais.
