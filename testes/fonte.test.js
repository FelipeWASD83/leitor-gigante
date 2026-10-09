import test from 'node:test';
import assert from 'node:assert/strict';
import { FonteBlob, FonteDemo, BLOCO } from '../js/fonte.js';

test('lê um intervalo no meio, atravessando blocos, sem trazer o arquivo inteiro', async () => {
  const dados = new Uint8Array(BLOCO * 20);
  for (let i = 0; i < dados.length; i++) dados[i] = i % 251;
  const f = new FonteBlob(new Blob([dados]), 'x.bin');
  const a = BLOCO * 3 - 10;
  const lido = await f.ler(a, a + 30);
  assert.equal(lido.length, 30);
  for (let i = 0; i < 30; i++) assert.equal(lido[i], (a + i) % 251);
  assert.ok(f.bytesLidos <= BLOCO * 2, `leu ${f.bytesLidos} bytes de um arquivo de ${dados.length}`);
});

test('o cache repete a leitura sem ir ao disco de novo', async () => {
  const f = new FonteBlob(new Blob([new Uint8Array(BLOCO * 3)]), 'x.bin');
  await f.ler(10, 100);
  const antes = f.bytesLidos;
  await f.ler(20, 90);
  assert.equal(f.bytesLidos, antes);
});

test('o cache tem teto: ler o arquivo todo aos poucos não guarda tudo', async () => {
  const f = new FonteBlob(new Blob([new Uint8Array(BLOCO * 100)]), 'x.bin');
  for (let i = 0; i < 100; i++) await f.ler(i * BLOCO, i * BLOCO + 10);
  assert.ok(f.cache.size <= 48);
});

test('intervalo fora do arquivo é cortado', async () => {
  const f = new FonteBlob(new Blob([new Uint8Array(100)]), 'x.bin');
  assert.equal((await f.ler(90, 500)).length, 10);
  assert.equal((await f.ler(500, 600)).length, 0);
  assert.equal((await f.ler(-5, 3)).length, 3);
});

test('a fonte de demonstração é sempre a mesma e só tem dígitos', async () => {
  const f = new FonteDemo(5000);
  const a = await f.ler(1000, 1100);
  const b = await new FonteDemo(5000).ler(1000, 1100);
  assert.deepEqual(a, b);
  assert.ok(a.every((x) => x >= 48 && x <= 57));
  assert.equal(f.size, 5000);
});
