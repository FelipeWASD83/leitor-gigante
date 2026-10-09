# AGENTS.md: leitor-gigante

As regras deste projeto estão em **`CLAUDE.md`**, nesta mesma pasta. Ler antes
de mexer em qualquer coisa: lá estão a ideia que não se desfaz, o que já foi
medido e a direção visual.

Resumo do que não pode ser esquecido:

- **O arquivo nunca é lido inteiro nem vira string.** Só o trecho da tela
  (`Blob.slice` com cache pequeno). A rolagem é em bytes, com régua própria em
  canvas, porque a barra do navegador não aguenta 370 MB.
- **Toda a conta fica nos módulos sem DOM** (`layout.js`, `busca.js`,
  `regua.js`, `util.js`, `fonte.js`), com teste:
  `node --test "testes/*.test.js"`. `leitor.js`, `ui-regua.js` e `main.js` só
  desenham e ligam eventos.
- Módulos ES: abrir só pelo servidor (porta 4342, entrada `leitor-gigante` no
  `.claude/launch.json` da raiz), nunca por `file://`.
- Nada sai do navegador; não adicionar `fetch`, analytics nem fonte externa.
- Barra, leitura e barra alternam escuro, claro, escuro; um vermelho de ação só;
  cores e medidas ficam em `css/tokens.css`.
- Zoom de afastar com limite de 7 % (ele mediu onde a tela começa a lagar e
  mandou fixar): é a constante `ZOOM_MINIMO` em `js/main.js`.
  Zoom com letra menor que 10 px não é salvo no `localStorage`, para a página
  não abrir travada.
