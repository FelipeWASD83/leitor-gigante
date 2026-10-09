// Layout de linhas por colunas sobre bytes UTF-8. Sem DOM, para testar no Node.
//
// Ideia central: o arquivo nunca vira string inteira. Quem chama passa só um
// pedaço de bytes (o que cabe na tela, ou um pouco antes dela) e este módulo diz
// onde cada linha da tela começa e termina, em bytes do ARQUIVO.
//
// Regras de quebra: a linha vai até `cols` caracteres ou até um \n (\r\n conta
// como um fim de linha só). Linha de exatamente `cols` caracteres engole o \n
// que vem logo depois, para não nascer uma linha vazia sobrando.

const LF = 10;
const CR = 13;

/** Byte do meio de um caractere UTF-8 (10xxxxxx). */
export const ehContinuacao = (b) => (b & 0xc0) === 0x80;

/** Quantos caracteres existem em bytes[a, b). */
export function contarCaracteres(bytes, a, b) {
  let n = 0;
  for (let i = a; i < b; i++) if (!ehContinuacao(bytes[i])) n++;
  return n;
}

/** Posição em bytes, a partir de `a`, depois de avançar `n` caracteres. */
export function avancarCaracteres(bytes, a, n) {
  let i = a;
  for (let c = 0; c < n && i < bytes.length; c++) {
    i++;
    while (i < bytes.length && ehContinuacao(bytes[i])) i++;
  }
  return i;
}

/** Posição em bytes depois de recuar `n` caracteres a partir de `pos` (sem passar de `limite`). */
export function recuarCaracteres(bytes, pos, n, limite = 0) {
  let i = pos;
  for (let c = 0; c < n && i > limite; c++) {
    i--;
    while (i > limite && ehContinuacao(bytes[i])) i--;
  }
  return i;
}

/**
 * Monta até `maxLinhas` linhas a partir do começo de `bytes`.
 *
 * `base` é a posição de bytes[0] dentro do arquivo. `fimDoArquivo` diz se o
 * último byte de `bytes` é o último do arquivo: sem isso, uma linha que bate
 * no fim do pedaço não pode ser fechada (o resto dela está além do que veio).
 *
 * Devolve linhas { ini, fim, prox, quebra } em bytes do arquivo: o texto é
 * [ini, fim), `prox` é onde a linha seguinte começa e `quebra` diz se a linha
 * terminou num \n de verdade (e não por falta de coluna).
 */
export function layoutAdiante(bytes, base, cols, maxLinhas, fimDoArquivo) {
  const linhas = [];
  const len = bytes.length;
  let i = 0;
  while (linhas.length < maxLinhas && i < len) {
    const ini = i;
    let j = i;
    let chars = 0;
    let fim = -1;
    let prox = -1;
    let quebra = false;
    while (j < len && chars < cols) {
      if (bytes[j] === LF) {
        fim = j;
        prox = j + 1;
        quebra = true;
        break;
      }
      j++;
      while (j < len && ehContinuacao(bytes[j])) j++;
      chars++;
    }
    if (prox < 0) {
      if (j >= len) {
        // acabou o pedaço antes de fechar a linha
        if (!fimDoArquivo) break;
        fim = j;
        prox = j;
      } else if (bytes[j] === LF) {
        fim = j;
        prox = j + 1;
        quebra = true;
      } else if (bytes[j] === CR && j + 1 >= len && !fimDoArquivo) {
        break; // não dá para saber se vem \n depois deste \r
      } else if (bytes[j] === CR && bytes[j + 1] === LF) {
        fim = j;
        prox = j + 2;
        quebra = true;
      } else {
        fim = j;
        prox = j;
      }
    }
    if (quebra && fim > ini && bytes[fim - 1] === CR) fim--;
    linhas.push({ ini: base + ini, fim: base + fim, prox: base + prox, quebra });
    i = prox;
  }
  return { linhas, proximo: base + i };
}

/**
 * Um passo para trás: onde começa a linha que vem antes de `pos`.
 * Devolve -1 se `pos` já é o começo do pedaço.
 *
 * Se logo antes de `pos` há um \n (ou o fim do arquivo), a linha anterior é a
 * última "fatia" da linha de verdade, e a fase das fatias se conta desde o
 * começo dela. Se o começo da linha de verdade não está no pedaço (linha
 * gigante), a fase é a de `pos`: recua `cols` caracteres.
 */
function passoAtras(bytes, base, pos, cols, fimDoArquivo) {
  if (pos <= 0) return -1;
  const len = bytes.length;
  let fimTexto = -1;
  if (bytes[pos - 1] === LF) {
    fimTexto = pos - 1;
    if (fimTexto > 0 && bytes[fimTexto - 1] === CR) fimTexto--;
  } else if (fimDoArquivo && pos === len) {
    fimTexto = pos;
  }

  if (fimTexto >= 0) {
    const lf = fimTexto > 0 ? bytes.lastIndexOf(LF, fimTexto - 1) : -1;
    let ls = -1;
    if (lf >= 0) ls = lf + 1;
    else if (base === 0) ls = 0;
    if (ls >= 0) {
      const L = contarCaracteres(bytes, ls, fimTexto);
      if (L === 0) return ls;
      return avancarCaracteres(bytes, ls, Math.floor((L - 1) / cols) * cols);
    }
    return recuarCaracteres(bytes, fimTexto, cols, 0);
  }

  let ini = recuarCaracteres(bytes, pos, cols, 0);
  const nl = bytes.lastIndexOf(LF, pos - 1);
  if (nl >= ini) ini = nl + 1;
  return ini;
}

/**
 * Sobe até `n` linhas a partir de `pos` (posição dentro de `bytes`).
 * Devolve { pos, passos }: onde parou e quantas linhas subiu de fato.
 */
export function voltar(bytes, base, pos, cols, n, { fimDoArquivo = false } = {}) {
  let passos = 0;
  while (passos < n) {
    const p = passoAtras(bytes, base, pos, cols, fimDoArquivo);
    if (p < 0) break;
    pos = p;
    passos++;
  }
  return { pos, passos };
}
