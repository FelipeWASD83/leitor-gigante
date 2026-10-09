// Formatação e interpretação de números. Sem DOM.

const NF = new Intl.NumberFormat('pt-BR');
const NF1 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const formatarNumero = (n) => NF.format(Math.round(n));

/** Tamanho como o Explorador do Windows mostra (base 1024, rótulo KB/MB/GB). */
export function formatarBytes(n) {
  if (n < 1024) return `${NF.format(n)} bytes`;
  const un = ['KB', 'MB', 'GB', 'TB'];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < un.length - 1) {
    v /= 1024;
    i++;
  }
  return `${NF1.format(v)} ${un[i]}`;
}

export function formatarPercentual(frac) {
  const p = Math.max(0, Math.min(1, frac)) * 100;
  const casas = p === 0 || p === 100 ? 0 : p < 10 || p > 90 ? 2 : 1;
  return `${p.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })} %`;
}

/**
 * Lê o que a pessoa digita no "ir para" e devolve o byte (começando em 0), ou null.
 *   "50%"  "12,5 %"           porcentagem do arquivo
 *   "184.846.550"  "1 000"    posição em bytes, contando de 1
 *   "100M"  "2,5G"  "300k"    com sufixo (k = mil, M = milhão, G = bilhão)
 */
export function interpretarPosicao(entrada, tamanho) {
  const t = String(entrada ?? '')
    .trim()
    .toLowerCase();
  if (!t) return null;

  let m = t.match(/^(\d+(?:[.,]\d+)?)\s*%$/);
  if (m) {
    const p = parseFloat(m[1].replace(',', '.'));
    if (!(p >= 0 && p <= 100)) return null;
    return Math.min(Math.max(0, tamanho - 1), Math.floor((p / 100) * tamanho));
  }

  m = t.match(/^(\d+(?:[.,]\d+)?)\s*([kmg])$/);
  if (m) {
    const mult = { k: 1e3, m: 1e6, g: 1e9 }[m[2]];
    const v = Math.round(parseFloat(m[1].replace(',', '.')) * mult);
    return Math.min(Math.max(0, tamanho - 1), Math.max(0, v - 1));
  }

  m = t.match(/^\d[\d.,_ ]*$/);
  if (m) {
    const v = Number(t.replace(/[.,_ ]/g, ''));
    if (!Number.isFinite(v)) return null;
    return Math.min(Math.max(0, tamanho - 1), Math.max(0, v - 1));
  }
  return null;
}
