// Busca em arquivo grande, por blocos. Sem DOM.
//
// O arquivo é varrido em fatias de 8 MB (com `tamanho da consulta - 1` bytes de
// sobra, para achar o que cai na emenda entre duas fatias). Cada fatia vira uma
// string "byte a byte" (windows-1252, 1 byte = 1 caractere), onde indexOf do
// motor do navegador faz o trabalho pesado. A consulta passa pela mesma
// conversão, então bate com o que está no arquivo mesmo com acento.

export const FATIA = 8 * 1024 * 1024;
const BYTE_A_BYTE = new TextDecoder('windows-1252');
const UTF8 = new TextEncoder();

/** Só A-Z vira minúscula (acento fica como está). */
export const minusculas = (s) => s.replace(/[A-Z]+/g, (m) => m.toLowerCase());

/**
 * Prepara a busca. `texto` é o que a pessoa digitou (uma linha só).
 * `bytes` é o tamanho da consulta no arquivo; `latim` é a mesma consulta na
 * escala byte a byte; `exibicao` é para achar e pintar na tela.
 */
export function compilarConsulta(texto, ignorarCaixa) {
  if (!texto || /[\r\n]/.test(texto)) return null;
  const codificado = UTF8.encode(texto);
  let latim = BYTE_A_BYTE.decode(codificado);
  let exibicao = texto;
  if (ignorarCaixa) {
    latim = minusculas(latim);
    exibicao = minusculas(exibicao);
  }
  return { texto, ignorarCaixa, bytes: codificado.length, latim, exibicao };
}

const fatiaComoTexto = (bytes, c) => {
  const s = BYTE_A_BYTE.decode(bytes);
  return c.ignorarCaixa ? minusculas(s) : s;
};

/**
 * Primeiro acerto que começa em `de` ou depois. Se não achar até o fim, volta
 * ao começo (devolve voltou: true). null se não existe no arquivo.
 */
export async function acharAdiante(fonte, c, de, sinal = {}) {
  const tam = fonte.size;
  const sobra = c.bytes - 1;
  de = Math.max(0, Math.min(de, tam));
  for (let fase = 0; fase < 2; fase++) {
    const inicio = fase === 0 ? de : 0;
    const fimBusca = fase === 0 ? tam : de; // o acerto tem que COMEÇAR em [inicio, fimBusca)
    for (let off = inicio; off < fimBusca; off += FATIA) {
      if (sinal.cancelado) return null;
      const corpo = Math.min(FATIA, fimBusca - off);
      const s = fatiaComoTexto(await fonte.ler(off, Math.min(tam, off + corpo + sobra), { cache: false }), c);
      const i = s.indexOf(c.latim);
      if (i >= 0 && i < corpo) return { pos: off + i, voltou: fase === 1 };
    }
  }
  return null;
}

/**
 * Último acerto que começa antes de `ate`. Se não achar, volta pelo fim
 * (voltou: true).
 */
export async function acharAtras(fonte, c, ate, sinal = {}) {
  const tam = fonte.size;
  const sobra = c.bytes - 1;
  ate = Math.max(0, Math.min(ate, tam));
  for (let fase = 0; fase < 2; fase++) {
    const teto = fase === 0 ? ate : tam; // acertos devem começar antes de `teto`
    const piso = fase === 0 ? 0 : ate;
    for (let hi = teto; hi > piso; hi -= FATIA) {
      if (sinal.cancelado) return null;
      const lo = Math.max(piso, hi - FATIA);
      const fim = Math.min(tam, hi + sobra);
      const s = fatiaComoTexto(await fonte.ler(lo, fim, { cache: false }), c);
      const i = s.lastIndexOf(c.latim, hi - 1 - lo);
      if (i >= 0) return { pos: lo + i, voltou: fase === 1 };
    }
  }
  return null;
}

/**
 * Conta todas as ocorrências (cada posição inicial conta, então "00" em "000"
 * dá 2) e monta a densidade pela régua: `buckets` faixas do arquivo com a
 * contagem de cada uma. Devolve { total } ou null se for cancelada.
 */
export async function contarAcertos(fonte, c, { buckets = 2048, sinal = {}, aoProgredir } = {}) {
  const tam = fonte.size;
  const sobra = c.bytes - 1;
  const densidade = new Uint32Array(buckets);
  let total = 0;
  for (let off = 0; off < tam; off += FATIA) {
    if (sinal.cancelado) return null;
    const fim = Math.min(tam, off + FATIA + sobra);
    const s = fatiaComoTexto(await fonte.ler(off, fim, { cache: false }), c);
    let i = s.indexOf(c.latim);
    while (i >= 0 && i < FATIA) {
      total++;
      densidade[Math.min(buckets - 1, Math.floor(((off + i) / tam) * buckets))]++;
      i = s.indexOf(c.latim, i + 1);
    }
    aoProgredir?.({ total, densidade, progresso: Math.min(1, (off + FATIA) / tam) });
  }
  return { total, densidade };
}

/** Posições (índices na string) onde `c` aparece em `texto`, para pintar a tela. */
export function acertosNaTela(texto, c) {
  const alvo = c.ignorarCaixa ? minusculas(texto) : texto;
  const achados = [];
  const n = c.exibicao.length;
  if (!n) return achados;
  let i = alvo.indexOf(c.exibicao);
  while (i >= 0) {
    achados.push(i);
    i = alvo.indexOf(c.exibicao, i + 1);
  }
  return achados;
}
