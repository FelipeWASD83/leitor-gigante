import test from 'node:test';
import assert from 'node:assert/strict';
import { interpretarPosicao, formatarBytes, formatarPercentual } from '../js/util.js';
import { compacto, gerarMarcas, fracaoDeY } from '../js/regua.js';

const T = 369_693_100;

test('ir para: porcentagem', () => {
  assert.equal(interpretarPosicao('50%', T), 184_846_550);
  assert.equal(interpretarPosicao('12,5 %', 1000), 125);
  assert.equal(interpretarPosicao('100%', 1000), 999);
  assert.equal(interpretarPosicao('101%', 1000), null);
});

test('ir para: posição com separadores e sufixos (contando de 1)', () => {
  assert.equal(interpretarPosicao('1', T), 0);
  assert.equal(interpretarPosicao('184.846.550', T), 184_846_549);
  assert.equal(interpretarPosicao('184 846 550', T), 184_846_549);
  assert.equal(interpretarPosicao('100M', T), 99_999_999);
  assert.equal(interpretarPosicao('2,5k', T), 2499);
  assert.equal(interpretarPosicao('9G', T), T - 1); // passou do fim: vai para o último byte
});

test('ir para: lixo vira null', () => {
  assert.equal(interpretarPosicao('', T), null);
  assert.equal(interpretarPosicao('abc', T), null);
  assert.equal(interpretarPosicao('12 reais', T), null);
});

test('formatarBytes no padrão do Explorador', () => {
  assert.equal(formatarBytes(512), '512 bytes');
  assert.equal(formatarBytes(369_693_100), '352,6 MB');
  assert.equal(formatarBytes(1_000_000_000), '953,7 MB');
});

test('formatarPercentual', () => {
  assert.equal(formatarPercentual(0), '0 %');
  assert.equal(formatarPercentual(0.5), '50,0 %');
  assert.equal(formatarPercentual(0.0001), '0,01 %');
  assert.equal(formatarPercentual(1), '100 %');
});

test('compacto', () => {
  assert.equal(compacto(950), '950');
  assert.equal(compacto(12_000), '12 mil');
  assert.equal(compacto(36_969_310), '37 M');
  assert.equal(compacto(369_693_100), '370 M');
  assert.equal(compacto(1_200_000_000), '1,2 G');
});

test('gerarMarcas: rótulo só nas grandes e passo depende da altura', () => {
  const a = gerarMarcas(1000, 800);
  assert.equal(a.length, 101);
  assert.equal(a.filter((m) => m.nivel === 2).length, 11);
  assert.equal(a[10].rotulo, '100');
  assert.equal(a[1].rotulo, '');
  const b = gerarMarcas(1000, 300);
  assert.equal(b.length, 21);
});

test('fracaoDeY fica entre 0 e 1', () => {
  assert.equal(fracaoDeY(-5, 10, 100), 0);
  assert.equal(fracaoDeY(60, 10, 100), 0.5);
  assert.equal(fracaoDeY(500, 10, 100), 1);
});
