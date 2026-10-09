import test from 'node:test';
import assert from 'node:assert/strict';
import { acharAdiante, acharAtras, contarAcertos, compilarConsulta, acertosNaTela, FATIA } from '../js/busca.js';
import { FonteBlob } from '../js/fonte.js';

const fonteDe = (s) => new FonteBlob(new Blob([s]), 'teste.txt');

test('compilarConsulta recusa vazio e quebra de linha', () => {
  assert.equal(compilarConsulta('', false), null);
  assert.equal(compilarConsulta('a\nb', false), null);
  assert.equal(compilarConsulta('abc', false).bytes, 3);
  assert.equal(compilarConsulta('é', false).bytes, 2);
});

test('acharAdiante acha o primeiro a partir de um ponto e dá a volta', async () => {
  const f = fonteDe('xx12yy12zz');
  const c = compilarConsulta('12', false);
  assert.deepEqual(await acharAdiante(f, c, 0), { pos: 2, voltou: false });
  assert.deepEqual(await acharAdiante(f, c, 3), { pos: 6, voltou: false });
  assert.deepEqual(await acharAdiante(f, c, 7), { pos: 2, voltou: true });
  assert.equal(await acharAdiante(f, compilarConsulta('99', false), 0), null);
});

test('acharAtras acha o último antes de um ponto e dá a volta', async () => {
  const f = fonteDe('xx12yy12zz');
  const c = compilarConsulta('12', false);
  assert.deepEqual(await acharAtras(f, c, 10), { pos: 6, voltou: false });
  assert.deepEqual(await acharAtras(f, c, 6), { pos: 2, voltou: false });
  assert.deepEqual(await acharAtras(f, c, 2), { pos: 6, voltou: true });
});

test('ignorar maiúsculas vale só para A-Z', async () => {
  const f = fonteDe('Ola OLA ola');
  assert.equal((await acharAdiante(f, compilarConsulta('OLA', false), 0)).pos, 4);
  assert.equal((await acharAdiante(f, compilarConsulta('OLA', true), 0)).pos, 0);
});

test('acha texto com acento (UTF-8)', async () => {
  const f = fonteDe('coração de ouro');
  const c = compilarConsulta('ção', false);
  assert.equal((await acharAdiante(f, c, 0)).pos, 4); // "cora" tem 4 bytes
});

test('acha o que cai na emenda entre duas fatias de 8 MB', async () => {
  const lixo = '0'.repeat(FATIA - 3);
  const f = fonteDe(`${lixo}1234567${'0'.repeat(100)}`);
  const c = compilarConsulta('1234567', false);
  assert.equal((await acharAdiante(f, c, 0)).pos, FATIA - 3);
  assert.equal((await acharAtras(f, c, FATIA + 50)).pos, FATIA - 3);
  const n = await contarAcertos(f, c);
  assert.equal(n.total, 1);
});

test('contarAcertos conta cada posição inicial e monta a densidade', async () => {
  const f = fonteDe('000'.padEnd(100, '1'));
  const r = await contarAcertos(f, compilarConsulta('00', false), { buckets: 10 });
  assert.equal(r.total, 2);
  assert.equal(r.densidade.reduce((a, b) => a + b, 0), 2);
  assert.equal(r.densidade[0], 2);
});

test('contarAcertos pode ser cancelada', async () => {
  const f = fonteDe('a'.repeat(100));
  const sinal = { cancelado: true };
  assert.equal(await contarAcertos(f, compilarConsulta('a', false), { sinal }), null);
});

test('acertosNaTela devolve as posições na string da tela', () => {
  const c = compilarConsulta('ab', true);
  assert.deepEqual(acertosNaTela('xxABxxabx', c), [2, 6]);
  assert.deepEqual(acertosNaTela('xxABxxabx', compilarConsulta('ab', false)), [6]);
});
