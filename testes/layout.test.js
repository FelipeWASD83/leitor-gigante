import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutAdiante, voltar } from '../js/layout.js';

const enc = new TextEncoder();
const dec = new TextDecoder();
const bytesDe = (s) => enc.encode(s);
const textos = (bytes, r) => r.linhas.map((l) => dec.decode(bytes.subarray(l.ini, l.fim)));

test('quebra por colunas numa linha só, sem \\n', () => {
  const b = bytesDe('0123456789ABCDEFGHIJ');
  const r = layoutAdiante(b, 0, 8, 10, true);
  assert.deepEqual(textos(b, r), ['01234567', '89ABCDEF', 'GHIJ']);
  assert.equal(r.proximo, b.length);
});

test('respeita \\n e \\r\\n', () => {
  const b = bytesDe('ab\ncd\r\nef');
  const r = layoutAdiante(b, 0, 10, 10, true);
  assert.deepEqual(textos(b, r), ['ab', 'cd', 'ef']);
  assert.equal(r.linhas[0].quebra, true);
  assert.equal(r.linhas[2].quebra, false);
});

test('linha com exatamente cols caracteres engole o \\n e não deixa linha vazia', () => {
  const b = bytesDe('abcd\nefgh\n');
  const r = layoutAdiante(b, 0, 4, 10, true);
  assert.deepEqual(textos(b, r), ['abcd', 'efgh']);
});

test('linha vazia no meio vira linha vazia', () => {
  const b = bytesDe('a\n\nb');
  const r = layoutAdiante(b, 0, 10, 10, true);
  assert.deepEqual(textos(b, r), ['a', '', 'b']);
});

test('conta caracteres, não bytes, em UTF-8', () => {
  const b = bytesDe('ééééé');
  const r = layoutAdiante(b, 0, 2, 10, true);
  assert.deepEqual(textos(b, r), ['éé', 'éé', 'é']);
});

test('sem fim do arquivo, linha que bate no fim do pedaço não é fechada', () => {
  const b = bytesDe('abcdefgh');
  const r = layoutAdiante(b, 0, 4, 10, false);
  // "abcd" bate nos 4 caracteres mas o byte seguinte existe e não é \n: fecha;
  // "efgh" bate no fim do pedaço: não dá para saber se vem \n depois
  assert.deepEqual(textos(b, r), ['abcd']);
});

test('respeita base: posições são do arquivo, não do pedaço', () => {
  const b = bytesDe('xyz\nw');
  const r = layoutAdiante(b, 1000, 10, 10, true);
  assert.equal(r.linhas[0].ini, 1000);
  assert.equal(r.linhas[1].ini, 1004);
  assert.equal(r.linhas[1].fim, 1005);
});

test('maxLinhas limita e proximo aponta para a linha seguinte', () => {
  const b = bytesDe('1\n2\n3\n4\n');
  const r = layoutAdiante(b, 0, 10, 2, true);
  assert.equal(r.linhas.length, 2);
  assert.equal(r.proximo, 4);
});

// --- propriedade: voltar() desfaz o layoutAdiante, linha por linha -----------------

function aleatorio(semente) {
  let x = semente >>> 0;
  return () => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return x / 4294967296;
  };
}

function textoSorteado(rnd, tamanho) {
  const alfabeto = ['a', 'b', 'c', '7', ' ', 'é', 'ç', '日', '😀', '\n', '\n', '\r\n'];
  let s = '';
  while (s.length < tamanho) {
    // às vezes uma sequência longa sem quebra, para testar linha gigante
    const rajada = rnd() < 0.08 ? 40 + Math.floor(rnd() * 200) : 1;
    const c = alfabeto[Math.floor(rnd() * alfabeto.length)];
    s += c === '\n' || c === '\r\n' ? c : c.repeat(rajada);
  }
  return s;
}

test('voltar desfaz o layout adiante (texto sorteado, vários cols)', () => {
  for (let semente = 1; semente <= 60; semente++) {
    const rnd = aleatorio(semente);
    const b = bytesDe(textoSorteado(rnd, 50 + Math.floor(rnd() * 600)));
    for (const cols of [1, 2, 3, 5, 8, 13, 40]) {
      const r = layoutAdiante(b, 0, cols, 100000, true);
      for (let k = 1; k < r.linhas.length; k++) {
        const { pos, passos } = voltar(b, 0, r.linhas[k].ini, cols, 1, { fimDoArquivo: true });
        assert.equal(passos, 1);
        assert.equal(
          pos,
          r.linhas[k - 1].ini,
          `semente ${semente} cols ${cols} linha ${k}: voltou para ${pos}, devia ser ${r.linhas[k - 1].ini}`,
        );
      }
    }
  }
});

test('voltar a partir do fim do arquivo cai no começo da última linha', () => {
  for (let semente = 100; semente < 140; semente++) {
    const rnd = aleatorio(semente);
    const b = bytesDe(textoSorteado(rnd, 30 + Math.floor(rnd() * 300)));
    for (const cols of [3, 7, 20]) {
      const r = layoutAdiante(b, 0, cols, 100000, true);
      const ultima = r.linhas[r.linhas.length - 1];
      const { pos } = voltar(b, 0, b.length, cols, 1, { fimDoArquivo: true });
      assert.equal(pos, ultima.ini, `semente ${semente} cols ${cols}`);
    }
  }
});

test('voltar várias linhas de uma vez = repetir o passo', () => {
  const b = bytesDe('abcdefghij\nklm\n\nnopqrstuvwxyz\nA');
  const r = layoutAdiante(b, 0, 4, 1000, true);
  const k = r.linhas.length - 1;
  const { pos, passos } = voltar(b, 0, r.linhas[k].ini, 4, k, { fimDoArquivo: true });
  assert.equal(passos, k);
  assert.equal(pos, 0);
});

test('voltar no começo do arquivo não anda', () => {
  const b = bytesDe('abc');
  assert.deepEqual(voltar(b, 0, 0, 2, 5), { pos: 0, passos: 0 });
});

test('linha gigante sem \\n no meio do arquivo: recua cols a cada passo', () => {
  // pedaço que começa no meio de uma linha enorme (base > 0): a fase é a de pos
  const b = bytesDe('0'.repeat(1000));
  const { pos, passos } = voltar(b, 5000, 500, 10, 3);
  assert.equal(passos, 3);
  assert.equal(pos, 470);
});

test('ida e volta com a linha do exemplo do 9^9^9 (um arquivo de uma linha só)', () => {
  const b = bytesDe('4281247731757470480369871159305635213390554822414435');
  const cols = 7;
  const r = layoutAdiante(b, 0, cols, 1000, true);
  assert.equal(r.linhas.length, Math.ceil(b.length / cols));
  const k = r.linhas.length - 1;
  const { pos } = voltar(b, 0, r.linhas[k].ini, cols, k, { fimDoArquivo: true });
  assert.equal(pos, 0);
});
