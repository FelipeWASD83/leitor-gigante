# CLAUDE.md: leitor-gigante

Leitor de arquivo de texto de qualquer tamanho, no navegador, sem travar.
Criado em 09/10/2026 porque o Bloco de Notas do Windows engasgou ao abrir o
`.txt` de 370 MB do 9^9^9 (uma linha de 369.693.100 dígitos). Pedido do Felipe
("um site com o único objetivo de exibir documentos desse tamanho sem
crashar"), com plano aprovado antes de codar.

O `CLAUDE.md` da raiz vale aqui também. Este arquivo só acrescenta o que é
deste projeto. O `README.md` explica o uso.

---

## 1. O que ele é, e o que ele não é

**É:** um leitor. Abre um arquivo escolhido por ele, mostra só o trecho que cabe
na tela, anda pelo arquivo (roda, teclado, toque, régua, "ir para") e busca no
arquivo inteiro.

**Não é, e não deve virar sem ele pedir:** editor, salvador de arquivo,
visualizador de binário/hex, servidor, conta, qualquer coisa que mande dado
para fora. **Nada sai do navegador** (a CSP do `index.html` e o fato de o
código não ter nenhum `fetch` sustentam isso).

---

## 2. A ideia que não se desfaz

**O arquivo nunca é lido inteiro nem vira string.** Tudo gira em torno disto:

- `fonte.js` lê só o intervalo pedido (`Blob.slice`) e guarda no máximo 48
  blocos de 256 KB. Pedido grande (varredura da busca) vai direto, sem cache.
- Tudo é medido em **bytes do arquivo**. `topo` é o byte onde começa a primeira
  linha visível. Rolar não é mexer em pixel: é perguntar ao layout onde começa
  a n-ésima linha depois ou antes.
- A barra de rolagem do navegador **não serve**: ela não passa de uns 33
  milhões de px, e esse arquivo daria 70 milhões. Por isso a régua é própria
  (canvas) e mapeia bytes.
- A quebra de linha é por colunas (a largura da tela dividida pela largura de
  um caractere medida na hora), respeitando `\n` e `\r\n`. Linha de exatamente
  `cols` caracteres engole o `\n` seguinte para não nascer linha vazia.
- Subir (`voltar` em `layout.js`) conta a fase das fatias desde o começo da
  linha de verdade quando ele está num pedaço lido (até 64 KB para trás). Em
  linha gigante sem `\n` à vista, a fase é a de onde se está (recua `cols`
  caracteres). Por isso, no 9^9^9, o último trecho termina exatamente no fim
  do arquivo. Isto é intencional.

Se uma mudança leva a ler o arquivo todo ou a montar uma string do tamanho
dele, está errada.

---

## 3. Arquivos

| Arquivo | O que tem |
|---|---|
| `js/layout.js` | **Toda** a conta de quebra de linha e de "subir uma linha", sem DOM, com teste (inclusive teste sorteado: voltar desfaz o layout adiante) |
| `js/fonte.js` | De onde vêm os bytes: `FonteBlob` (File/Blob), `FonteDemo` (1 GB de dígitos fictícios, sempre iguais) e o cache de blocos |
| `js/busca.js` | Busca por fatias de 8 MB (com sobra na emenda), próximo, anterior, contagem total e densidade para a régua. Sem DOM, com teste |
| `js/regua.js`, `js/util.js` | Contas da régua (marcas, rótulos compactos) e "ir para", formatação em pt-BR. Sem DOM, com teste |
| `js/leitor.js` | A tela de leitura: mede, pede o layout, pinta as linhas, destaca os acertos, trata roda e toque, mede o tempo de pintura. Não conhece botão nem busca. A leitura supõe 1 byte por caractere e dobra se faltar (UTF-8): com a letra minúscula a tela tem milhões de caracteres e ler 4x por garantia custava centenas de MB |
| `js/ui-regua.js` | A régua em canvas: marcas, faixa vermelha do trecho visível, faixas dos acertos, dica |
| `js/main.js` | Liga tudo: abrir, arrastar e soltar, busca, "ir para", letra, grupos, copiar, teclado. Expõe `window.leitorGigante.abrirBlob(blob, nome)` para teste |
| `css/tokens.css` | Cores, letras, espaços e tempos |
| `testes/*.test.js` | `node --test "testes/*.test.js"` (39 testes em 09/10/2026) |

Módulos ES: **não abre por `file://`**. Preview `leitor-gigante` no
`.claude/launch.json` da raiz, porta **4342** (`abrir.bat` no uso). Regra nova
de cálculo vai nos módulos sem DOM, com teste, nunca no `leitor.js`/`main.js`.

---

## 4. Medido (09/10/2026, no navegador do app, arquivo real de 369.693.100 bytes)

- Abrir: o arquivo aparece em menos de meio segundo; **memória JS ~3 MB**;
  lido do disco: ~0,6 MB só para mostrar a primeira tela.
- Busca no arquivo inteiro (contagem): 0,7 a 1,2 s para 370 MB. As contagens
  de 5 consultas bateram **exatamente** com as do Python (`7777777` = 41,
  `00000000` = 4, `31415` = 3.755, os 20 últimos dígitos = 1, `123456789` = 0).
- Rolagem: 300 eventos de roda seguidos sem engasgo; subir e descer 137 e 1000
  linhas volta exatamente ao mesmo byte em 4 pontos do arquivo.
- Telas medidas: 1440×900, 3440×1440 (351 colunas, usa a largura toda),
  1080×1920 e 375×812. Sem rolagem horizontal. Fundos medidos: barra 0,009,
  leitura 0,913, rodapé 0,009 (luminância relativa), alternando.

**Não verificado:** o seletor de arquivo do sistema (só a rota de arrastar e
soltar com `File` sintético e `fetch` para `Blob`; a leitura real usa a mesma
`Blob.slice`), toque real em celular (usei eventos de ponteiro sintéticos),
Firefox e Safari, arquivos acima de ~2 GB (o `Blob.slice` aceita, mas não
testei), `Alt`+roda no Windows (pode ser capturado pelo sistema).

---

## 5. Direção visual: "papel, tinta e régua"

Escolhida por mim (ele só pediu o site; estética não foi definida). Consideradas:
**A. Linear claro** (escolhida: barras escuras, leitura em papel frio, um
vermelho de tinta), **B. terminal escuro** (fundo preto, texto verde ou âmbar,
óbvio demais para "ler dígitos") e **C. editorial** (serifa grande, margens
largas: bonito, mas lê pior número comprido).

Referência: `produto-linear-hero.png` (verbete Linear, seção Produto). O que
foi puxado, no máximo três decisões:

1. **Frase de duas cores** na tela vazia: a primeira oração em tinta, o resto
   da mesma frase em cinza (mesma fonte, tamanho e peso, 300).
2. **Rótulos em mono minúsculo** para metadados (a linha "arraste um arquivo",
   o rodapé, os rótulos da régua); mono só aí e no texto lido.
3. **Quase-preto no lugar de preto** (`#15171c`) e escala de cinzas de 3 níveis.

**Elemento que só existe aqui:** a régua lateral (marcas a cada 1 % e rótulos
a cada 10 % em bytes, barra vermelha do que está na tela, faixas vermelhas
onde a busca achou, dica com o byte exato).

Regras visuais que valem aqui: um vermelho de ação só (`--acao`); barra, leitura
e barra alternam escuro, claro, escuro (rodapé conta como bloco): trocar o tom
de algum deles obriga a rever os vizinhos e medir a luminância; fontes do
sistema (peso zero), mono = Cascadia Mono/Consolas.

---

## 6. Como testar sem abrir arquivo grande à mão

- `node --test "testes/*.test.js"` cobre a lógica.
- No navegador: botão **Testar com 1 GB fictício**, ou pelo console
  `window.leitorGigante.abrirDemo(bytes)` / `.abrirBlob(new Blob([...]), 'x.txt')`.
- Para o arquivo real de 370 MB sem o seletor do sistema: um servidor de teste
  que sirva a pasta do projeto **e** o arquivo na mesma origem, e no console
  `await window.leitorGigante.abrirBlob(await (await fetch('/arquivo.txt')).blob(), 'x')`.
  A CSP libera `connect-src 'self'` por causa disso; o código do projeto não
  faz `fetch` nenhum.

---

## 7. Zoom e o limite de 7 % (pedido dele em 09/10/2026)

Ele pediu para remover o limite de afastar e ter um contador para achar onde
começa a lagar. Mediu e mandou **colocar o limite em 7 %**: é o `ZOOM_MINIMO`.
Antes disso o limite era 10 px de letra (62,5 %), e entre os dois ficou sem
limite só durante a medição.

- **Onde mexer:** `ZOOM_MINIMO` no começo de `js/main.js` (em %, 100 = letra de
  16 px; hoje **7**, ou seja, letra de 1,12 px). `ZOOM_MAXIMO` (400) e
  `PASSO_ZOOM` (1,1 por clique ou giro de roda) ficam ao lado. Digitar menos
  que o mínimo no contador trava no mínimo e mostra um aviso.
- **Contador:** campo `#zoom` no topo (digita e dá Enter), A−/A+, Ctrl+roda e
  Ctrl+0. O rodapé mostra linhas x colunas, caracteres na tela, `pintura`
  (montar o DOM + forçar o layout, medido sempre) e `quadro` (até o navegador
  mostrar o quadro: só mede com a aba visível).
- **Armadilha evitada:** letra menor que 10 px **não** é lembrada ao recarregar
  (`FS_MINIMO_LEMBRADO`). Sem isso, um zoom que trava a página ficaria salvo e
  a página abriria travada todas as vezes.
- **Rolagem em tela gigante:** o teto de linhas por pedido é `max(2000, 2 x
  linhas da tela)`, para uma página inteira sempre caber.

### Medido (arquivo `letras_aleatorias_369693100.txt`, janela 1440 x 900 emulada)

| Zoom | Caracteres na tela | Pintura (layout) |
|---|---|---|
| 100 % | 4.140 | 1 ms |
| 25 % | 68 mil | 3 ms |
| 12 % | 297 mil | 10 ms |
| 5 % | 1,7 milhão | 46 ms |
| 2,5 % | 6,9 milhões | 93 ms |
| 1,8 % | 13,4 milhões | 193 ms |
| 0,8 % | 72,8 milhões | 1.826 ms (travada, mas a aba segue viva) |

**Isto é só o custo de layout no navegador de teste, sem os pixels e numa
janela menor que a dele.** Em 3440 x 1440 há 2,4 vezes mais caracteres no mesmo
zoom. O ponto de lag de verdade é o que ele vai medir no monitor dele.
