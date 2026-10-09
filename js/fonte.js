// De onde vêm os bytes. O arquivo nunca é lido inteiro: quem pede um intervalo
// recebe só aquele intervalo, e os blocos lidos mais recentemente ficam num
// cache pequeno (no máximo MAX_BLOCOS * BLOCO bytes na memória).

export const BLOCO = 256 * 1024;
const MAX_BLOCOS = 48; // 12 MB

export class Fonte {
  constructor(nome, tamanho) {
    this.nome = nome;
    this.size = tamanho;
    this.cache = new Map();
    this.bytesLidos = 0; // total que saiu do disco, para a medição nos testes
  }

  /** Lê [a, b) direto da origem. Cada subclasse implementa. */
  async lerBruto() {
    throw new Error('lerBruto não implementado');
  }

  async _bloco(i) {
    const guardado = this.cache.get(i);
    if (guardado) {
      this.cache.delete(i); // reinsere: o mais recente vai para o fim
      this.cache.set(i, guardado);
      return guardado;
    }
    const a = i * BLOCO;
    const b = Math.min(this.size, a + BLOCO);
    const promessa = this._lerContando(a, b);
    this.cache.set(i, promessa);
    promessa.catch(() => this.cache.delete(i));
    if (this.cache.size > MAX_BLOCOS) this.cache.delete(this.cache.keys().next().value);
    return promessa;
  }

  async _lerContando(a, b) {
    const dados = await this.lerBruto(a, b);
    this.bytesLidos += dados.length;
    return dados;
  }

  /**
   * Lê [a, b). Pedido pequeno passa pelo cache; pedido grande (as varreduras da
   * busca) vai direto, para não expulsar do cache o que está na tela.
   */
  async ler(a, b, { cache = true } = {}) {
    a = Math.max(0, Math.floor(a));
    b = Math.min(this.size, Math.floor(b));
    if (b <= a) return new Uint8Array(0);
    if (!cache || b - a > 4 * BLOCO) return this._lerContando(a, b);
    const i0 = Math.floor(a / BLOCO);
    const i1 = Math.floor((b - 1) / BLOCO);
    if (i0 === i1) {
      const bloco = await this._bloco(i0);
      return bloco.subarray(a - i0 * BLOCO, b - i0 * BLOCO);
    }
    const saida = new Uint8Array(b - a);
    for (let i = i0; i <= i1; i++) {
      const bloco = await this._bloco(i);
      const ini = i * BLOCO;
      const de = Math.max(a, ini);
      const ate = Math.min(b, ini + bloco.length);
      saida.set(bloco.subarray(de - ini, ate - ini), de - a);
    }
    return saida;
  }
}

/** Um File ou Blob do navegador. */
export class FonteBlob extends Fonte {
  constructor(blob, nome = blob.name ?? 'arquivo') {
    super(nome, blob.size);
    this.blob = blob;
  }

  async lerBruto(a, b) {
    return new Uint8Array(await this.blob.slice(a, b).arrayBuffer());
  }
}

/** Dígitos aleatórios de mentira (sempre os mesmos), numa linha só, para quem quer testar sem ter um arquivo grande. */
export class FonteDemo extends Fonte {
  constructor(tamanho = 1_000_000_000) {
    super('digitos-ficticios.txt', tamanho);
  }

  async lerBruto(a, b) {
    const saida = new Uint8Array(b - a);
    for (let p = a; p < b; p++) {
      let x = (p ^ 0x9e3779b9) >>> 0;
      x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
      x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
      x ^= x >>> 16;
      saida[p - a] = 48 + ((x >>> 0) % 10);
    }
    return saida;
  }
}
