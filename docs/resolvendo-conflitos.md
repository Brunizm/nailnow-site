# Como resolver o conflito do logotipo

Quando você fizer merge da branch `codex/embed-logo-in-css-from-base64-ts1uo3` com `main`, o Git pode apontar o seguinte conflito no cabeçalho:

```html
<<<<<<< codex/embed-logo-in-css-from-base64-ts1uo3
<span class="brand-mark__logo" aria-hidden="true"></span>
=======
>>>>>>> main
NailNow
```

A versão final correta mantém **os dois trechos juntos** dentro do link da marca. Basta apagar os marcadores (`<<<<<<<`, `=======`, `>>>>>>>`) e deixar o HTML assim:

```html
<a href="./" class="brand-mark" aria-label="Início da NailNow">
  <span class="brand-mark__logo" aria-hidden="true"></span>
  NailNow
</a>
```

Depois de salvar o arquivo, rode `git add index.html` (e qualquer outro arquivo que tenha ficado em conflito) para marcar a resolução e continue o merge.

> 💡 Caso apareça o mesmo conflito em outros arquivos (por exemplo, `styles.css`), apague a linha inteira que contém o nome da branch — não deixe `codex/...` ou `main` isolados, pois isso quebra o CSS.
