// Contas da régua lateral. Sem DOM.

const NF1 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

/** 950, 12 mil, 369,7 M, 1,2 G: curto o bastante para caber ao lado da régua. */
export function compacto(n) {
  if (n < 1000) return String(Math.round(n));
  const faixas = [
    [1e9, 'G'],
    [1e6, 'M'],
    [1e3, 'mil'],
  ];
  for (const [f, rotulo] of faixas) {
    if (n >= f) {
      const v = n / f;
      return `${v >= 100 ? Math.round(v) : NF1.format(v)} ${rotulo}`;
    }
  }
  return String(Math.round(n));
}

/**
 * Marcas da régua: uma grande a cada 10 % (com rótulo) e uma pequena a cada
 * 1 % quando há espaço (a cada 5 % se estiver apertado).
 * `altura` é a altura útil da régua em pixels.
 */
export function gerarMarcas(tamanho, altura) {
  const marcas = [];
  const passoPequeno = altura / 100 >= 5 ? 1 : 5;
  for (let p = 0; p <= 100; p += passoPequeno) {
    const grande = p % 10 === 0;
    marcas.push({
      frac: p / 100,
      nivel: grande ? 2 : 1,
      rotulo: grande ? compacto((tamanho * p) / 100) : '',
    });
  }
  return marcas;
}

export const limitar = (v, a, b) => Math.max(a, Math.min(b, v));

/** Posição vertical (0 a 1) a partir de um y em pixels dentro da área útil. */
export const fracaoDeY = (y, topo, altura) => limitar((y - topo) / altura, 0, 1);
