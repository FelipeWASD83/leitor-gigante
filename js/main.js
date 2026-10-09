// Liga a página: abrir arquivo, botões, busca, "ir para", régua e teclado.

import { criarLeitor } from './leitor.js';
import { criarRegua } from './ui-regua.js';
import { FonteBlob, FonteDemo } from './fonte.js';
import { acharAdiante, acharAtras, contarAcertos, compilarConsulta } from './busca.js';
import {
  FS_PADRAO,
  formatarBytes,
  formatarNumero,
  formatarPercentual,
  formatarZoom,
  fsDeZoom,
  interpretarPosicao,
  interpretarZoom,
  zoomDeFs,
} from './util.js';

const $ = (id) => document.getElementById(id);
const el = {
  leitura: $('leitura'),
  texto: $('texto'),
  sonda: $('sonda'),
  vazio: $('vazio'),
  solte: $('solte'),
  entrada: $('entrada'),
  aviso: $('aviso'),
  arquivo: $('arquivo'),
  arquivoNome: $('arquivo-nome'),
  arquivoTam: $('arquivo-tam'),
  busca: $('busca'),
  caixa: $('caixa'),
  buscaAnt: $('busca-ant'),
  buscaProx: $('busca-prox'),
  buscaResultado: $('busca-resultado'),
  formBusca: $('form-busca'),
  formIr: $('form-ir'),
  ir: $('ir'),
  fonteMenos: $('fonte-menos'),
  fonteMais: $('fonte-mais'),
  zoom: $('zoom'),
  agrupar: $('agrupar'),
  copiar: $('copiar'),
  abrir: $('abrir'),
  abrirVazio: $('abrir-vazio'),
  demo: $('demo'),
  pos: $('pos'),
  meio: $('meio'),
  regua: $('regua'),
  reguaTela: $('regua-tela'),
  reguaDica: $('regua-dica'),
};
const controlesDoArquivo = [el.busca, el.caixa, el.buscaAnt, el.buscaProx, el.ir, el.fonteMenos, el.fonteMais, el.zoom, el.agrupar, el.copiar];

// ---------- preferências (só a letra, os grupos e o "Aa") ----------

const CHAVE = 'leitor-gigante:prefs:v1';
const prefs = { fs: FS_PADRAO, agrupar: false, ignorarCaixa: true };
try {
  Object.assign(prefs, JSON.parse(localStorage.getItem(CHAVE) ?? '{}'));
} catch {
  /* sem armazenamento: segue com o padrão */
}

// ---------- zoom ----------
// LIMITE DE AFASTAR: 7 %, o ponto onde o Felipe disse que a tela começa a lagar
// (09/10/2026). Para mudar, é só trocar o número de ZOOM_MINIMO (em %, onde
// 100 = letra de 16 px).
const ZOOM_MINIMO = 7;
const ZOOM_MAXIMO = 400;
const PASSO_ZOOM = 1.1; // cada clique em A− / A+ e cada giro da roda com Ctrl
// Letra menor que isto não é lembrada ao recarregar: com a tela cheia de
// caracteres minúsculos a página pode travar, e abrir já travada seria um beco sem saída.
const FS_MINIMO_LEMBRADO = 10;

const salvarPrefs = () => {
  try {
    const gravar = { ...prefs, fs: prefs.fs >= FS_MINIMO_LEMBRADO ? prefs.fs : FS_PADRAO };
    localStorage.setItem(CHAVE, JSON.stringify(gravar));
  } catch {
    /* sem armazenamento: tudo bem */
  }
};
prefs.fs = Number(prefs.fs) > 0 ? Number(prefs.fs) : FS_PADRAO;
if (prefs.fs < FS_MINIMO_LEMBRADO) prefs.fs = FS_PADRAO;

// ---------- estado ----------

let fonte = null;
let ultimo = { topo: 0, tamanho: 0, visiveis: 0, cols: 0, linhas: 0 };
const busca = {
  consulta: null,
  acertoAtual: null,
  sinal: null, // { cancelado } da contagem em andamento
  total: null,
  progresso: 0,
  passada: 0, // distingue buscas antigas das atuais
};

const regua = criarRegua({
  elemento: el.regua,
  tela: el.reguaTela,
  dica: el.reguaDica,
  aoMover: (frac) => leitor.irParaFracao(frac),
  textoDaDica: (frac) => {
    const byte = Math.min(Math.max(0, ultimo.tamanho - 1), Math.floor(frac * ultimo.tamanho));
    return `byte ${formatarNumero(byte + 1)} · ${formatarPercentual(frac)}`;
  },
});

const leitor = criarLeitor({
  area: el.leitura,
  texto: el.texto,
  sonda: el.sonda,
  aoMedir(s) {
    ultimo = s;
    atualizarRodape();
  },
  aoErro: (erro) => avisar(`Não consegui ler o arquivo (apagado, movido ou sem permissão?): ${erro?.message ?? erro}`, 8000),
  aoAtualizar(s) {
    ultimo = s;
    atualizarRodape();
    regua.atualizar({
      tamanho: s.tamanho,
      topo: s.tamanho ? s.topo / s.tamanho : 0,
      ext: s.tamanho ? s.visiveis / s.tamanho : 0,
    });
  },
});
leitor.definirFonte(prefs.fs);
leitor.definirAgrupar(prefs.agrupar);
el.zoom.value = formatarZoom(zoomDeFs(prefs.fs));

// ---------- mensagens ----------

let relogioAviso = 0;
function avisar(texto, ms = 3200) {
  el.aviso.textContent = texto;
  el.aviso.hidden = false;
  clearTimeout(relogioAviso);
  relogioAviso = setTimeout(() => (el.aviso.hidden = true), ms);
}

function atualizarRodape() {
  if (!fonte) {
    el.pos.textContent = 'Nenhum arquivo aberto';
    el.meio.textContent = '';
    return;
  }
  const { topo, tamanho, cols, linhas } = ultimo;
  if (tamanho === 0) {
    el.pos.textContent = 'Arquivo vazio';
    el.meio.textContent = '';
    return;
  }
  const frac = tamanho ? topo / tamanho : 0;
  el.pos.textContent = `byte ${formatarNumero(topo + 1)} de ${formatarNumero(tamanho)} · ${formatarPercentual(frac)}`;
  if (busca.sinal && !busca.sinal.cancelado && busca.total === null) {
    el.meio.textContent = `contando acertos… ${Math.round(busca.progresso * 100)} %`;
  } else {
    const ms = (v) => (v < 1 ? '<1' : formatarNumero(v));
    el.meio.textContent = `${linhas} × ${cols} · ${formatarNumero(ultimo.caracteres)} caracteres · pintura ${ms(ultimo.pinturaMs)} ms · quadro ${ms(ultimo.quadroMs)} ms`;
  }
}

// ---------- abrir ----------

async function abrirFonte(nova) {
  limparBusca();
  fonte = nova;
  el.vazio.hidden = true;
  el.arquivo.hidden = false;
  el.arquivoNome.textContent = nova.nome;
  el.arquivoNome.title = nova.nome;
  el.arquivoTam.textContent = formatarBytes(nova.size);
  document.title = `${nova.nome} · Leitor gigante`;
  for (const c of controlesDoArquivo) c.disabled = false;
  regua.definirDensidade(null);
  leitor.abrir(nova);
  el.texto.focus({ preventScroll: true });
  if (nova.size === 0) avisar('Arquivo vazio.');
  else if (await pareceBinario(nova)) avisar('Este arquivo parece binário: o que não for texto aparece como lixo ou pontinhos.', 6000);
}

async function pareceBinario(f) {
  const amostra = await f.ler(0, 8192);
  return amostra.includes(0);
}

function abrirArquivo(arquivo) {
  if (!arquivo) return;
  abrirFonte(new FonteBlob(arquivo, arquivo.name));
}

el.abrir.addEventListener('click', () => el.entrada.click());
el.abrirVazio.addEventListener('click', () => el.entrada.click());
el.entrada.addEventListener('change', () => {
  abrirArquivo(el.entrada.files[0]);
  el.entrada.value = '';
});
el.demo.addEventListener('click', () => abrirFonte(new FonteDemo()));

// arrastar e soltar em qualquer lugar da página
let arrastos = 0;
window.addEventListener('dragenter', (ev) => {
  if (![...(ev.dataTransfer?.types ?? [])].includes('Files')) return;
  ev.preventDefault();
  arrastos++;
  el.solte.hidden = false;
});
window.addEventListener('dragover', (ev) => ev.preventDefault());
window.addEventListener('dragleave', () => {
  arrastos = Math.max(0, arrastos - 1);
  if (!arrastos) el.solte.hidden = true;
});
window.addEventListener('drop', (ev) => {
  ev.preventDefault();
  arrastos = 0;
  el.solte.hidden = true;
  abrirArquivo(ev.dataTransfer?.files?.[0]);
});

// ---------- letra, grupos e copiar ----------

function definirZoom(percentual) {
  const z = Math.min(ZOOM_MAXIMO, Math.max(ZOOM_MINIMO, percentual));
  prefs.fs = fsDeZoom(z);
  leitor.definirFonte(prefs.fs);
  el.zoom.value = formatarZoom(z);
  salvarPrefs();
}
const zoomAtual = () => zoomDeFs(prefs.fs);
el.fonteMenos.addEventListener('click', () => definirZoom(zoomAtual() / PASSO_ZOOM));
el.fonteMais.addEventListener('click', () => definirZoom(zoomAtual() * PASSO_ZOOM));
el.zoom.addEventListener('keydown', (ev) => {
  if (ev.key !== 'Enter') return;
  ev.preventDefault();
  const z = interpretarZoom(el.zoom.value);
  if (z === null) {
    el.zoom.value = formatarZoom(zoomAtual());
    avisar('Zoom: digite um número maior que zero, por exemplo 50.');
  } else {
    if (z < ZOOM_MINIMO) avisar(`O zoom mínimo é ${formatarZoom(ZOOM_MINIMO)} %: abaixo disso a tela começa a lagar.`);
    definirZoom(z);
  }
  el.texto.focus({ preventScroll: true });
});
el.zoom.addEventListener('blur', () => {
  el.zoom.value = formatarZoom(zoomAtual()); // largou sem apertar Enter: volta ao valor que vale
});

// Ctrl + roda do mouse (ou pinça no touchpad) afasta e aproxima
el.leitura.addEventListener(
  'wheel',
  (ev) => {
    if (!fonte || !(ev.ctrlKey || ev.metaKey)) return;
    ev.preventDefault();
    const dy = ev.deltaMode === 1 ? ev.deltaY * 33 : ev.deltaY;
    definirZoom(zoomAtual() * Math.pow(PASSO_ZOOM, -dy / 100));
  },
  { passive: false },
);

function pintarToggle(botao, ligado) {
  botao.setAttribute('aria-pressed', String(ligado));
}
pintarToggle(el.agrupar, prefs.agrupar);
pintarToggle(el.caixa, prefs.ignorarCaixa);

el.agrupar.addEventListener('click', () => {
  prefs.agrupar = !prefs.agrupar;
  pintarToggle(el.agrupar, prefs.agrupar);
  leitor.definirAgrupar(prefs.agrupar);
  salvarPrefs();
});

el.copiar.addEventListener('click', async () => {
  const t = leitor.textoDaTela();
  try {
    await navigator.clipboard.writeText(t);
    avisar(`Copiado: ${formatarNumero(t.length)} caracteres do que está na tela.`);
  } catch {
    avisar('O navegador não deixou copiar. Selecione o texto e use Ctrl+C.');
  }
});

// ---------- ir para ----------

el.formIr.addEventListener('submit', (ev) => {
  ev.preventDefault();
  if (!fonte) return;
  const byte = interpretarPosicao(el.ir.value, fonte.size);
  if (byte === null) {
    avisar('Não entendi essa posição. Exemplos: 50 %, 184.846.550, 100M.');
    return;
  }
  leitor.irPara(byte);
  el.texto.focus({ preventScroll: true });
});

// ---------- busca ----------

function limparBusca() {
  if (busca.sinal) busca.sinal.cancelado = true;
  busca.passada++;
  Object.assign(busca, { consulta: null, acertoAtual: null, sinal: null, total: null, progresso: 0 });
  el.buscaResultado.textContent = '';
  el.buscaResultado.classList.remove('nada');
  leitor.definirConsulta(null);
  regua.definirDensidade(null);
}

function mesmaConsulta(texto) {
  const c = busca.consulta;
  return c && c.texto === texto && c.ignorarCaixa === prefs.ignorarCaixa;
}

async function contarEmSegundoPlano(consulta, passada) {
  const sinal = { cancelado: false };
  busca.sinal = sinal;
  busca.total = null;
  busca.progresso = 0;
  let r;
  try {
    r = await contarAcertos(fonte, consulta, {
      sinal,
      aoProgredir({ progresso, densidade }) {
        if (passada !== busca.passada) return;
        busca.progresso = progresso;
        regua.definirDensidade(densidade);
        atualizarRodape();
      },
    });
  } catch (erro) {
    if (passada === busca.passada) {
      busca.sinal = null;
      avisar(`A contagem de acertos parou: ${erro?.message ?? erro}`, 6000);
      atualizarRodape();
    }
    return;
  }
  if (!r || passada !== busca.passada) return;
  busca.total = r.total;
  busca.sinal = null;
  regua.definirDensidade(r.densidade);
  el.buscaResultado.textContent = `${formatarNumero(r.total)} ${r.total === 1 ? 'acerto' : 'acertos'}`;
  atualizarRodape();
}

async function buscar(sentido) {
  try {
    await buscarAgora(sentido);
  } catch (erro) {
    el.buscaResultado.textContent = '';
    avisar(`A busca falhou: ${erro?.message ?? erro}`, 6000);
  }
}

async function buscarAgora(sentido) {
  if (!fonte) return;
  const texto = el.busca.value;
  if (!texto) {
    limparBusca();
    return;
  }
  if (texto.length > 500) {
    avisar('Busca longa demais: use até 500 caracteres.');
    return;
  }
  if (!mesmaConsulta(texto)) {
    limparBusca();
    const consulta = compilarConsulta(texto, prefs.ignorarCaixa);
    if (!consulta) {
      avisar('A busca é de uma linha só: tire as quebras de linha.');
      return;
    }
    busca.consulta = consulta;
    leitor.definirConsulta(consulta);
    contarEmSegundoPlano(consulta, busca.passada);
  }
  const passada = busca.passada;
  const consulta = busca.consulta;
  el.buscaResultado.classList.remove('nada');
  if (busca.total === null) el.buscaResultado.textContent = 'procurando…';

  const sinalLocal = { cancelado: false };
  const achado =
    sentido === 'ant'
      ? await acharAtras(fonte, consulta, busca.acertoAtual ?? ultimo.topo, sinalLocal)
      : await acharAdiante(fonte, consulta, busca.acertoAtual !== null ? busca.acertoAtual + 1 : ultimo.topo, sinalLocal);
  if (passada !== busca.passada) return;

  if (!achado) {
    el.buscaResultado.textContent = 'não achei';
    el.buscaResultado.classList.add('nada');
    return;
  }
  busca.acertoAtual = achado.pos;
  leitor.definirAcertoAtual(achado.pos);
  leitor.irPara(achado.pos, Math.floor(ultimo.linhas / 3));
  if (busca.total !== null) {
    el.buscaResultado.textContent = `${formatarNumero(busca.total)} ${busca.total === 1 ? 'acerto' : 'acertos'}`;
  } else {
    el.buscaResultado.textContent = '';
  }
  if (achado.voltou) avisar(sentido === 'ant' ? 'Chegou ao começo: voltou para o último acerto.' : 'Chegou ao fim: voltou para o primeiro acerto.');
}

el.formBusca.addEventListener('submit', (ev) => {
  ev.preventDefault();
  buscar('prox');
});
el.buscaAnt.addEventListener('click', () => buscar('ant'));
el.busca.addEventListener('keydown', (ev) => {
  if (ev.key === 'Enter' && ev.shiftKey) {
    ev.preventDefault();
    buscar('ant');
  } else if (ev.key === 'Escape') {
    el.busca.value = '';
    limparBusca();
    el.texto.focus({ preventScroll: true });
  }
});
el.busca.addEventListener('input', () => {
  if (!el.busca.value) limparBusca();
});
el.caixa.addEventListener('click', () => {
  prefs.ignorarCaixa = !prefs.ignorarCaixa;
  pintarToggle(el.caixa, prefs.ignorarCaixa);
  salvarPrefs();
  if (busca.consulta && el.busca.value) buscar('prox');
});

// ---------- teclado ----------

window.addEventListener('keydown', (ev) => {
  const digitando = ev.target instanceof HTMLInputElement;
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'f' && fonte) {
    ev.preventDefault();
    el.busca.focus();
    el.busca.select();
    return;
  }
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'g' && fonte) {
    ev.preventDefault();
    el.ir.focus();
    el.ir.select();
    return;
  }
  if ((ev.ctrlKey || ev.metaKey) && ev.key === '0' && fonte) {
    ev.preventDefault();
    definirZoom(100);
    return;
  }
  if (ev.key === 'F3' && fonte && el.busca.value) {
    ev.preventDefault();
    buscar(ev.shiftKey ? 'ant' : 'prox');
    return;
  }
  if (digitando || !fonte || ev.altKey || ev.ctrlKey || ev.metaKey) return;
  const acoes = {
    ArrowDown: () => leitor.rolar(1),
    ArrowUp: () => leitor.rolar(-1),
    PageDown: () => leitor.pagina(1),
    PageUp: () => leitor.pagina(-1),
    ' ': () => leitor.pagina(ev.shiftKey ? -1 : 1),
    Home: () => leitor.inicio(),
    End: () => leitor.fim(),
  };
  const acao = acoes[ev.key];
  if (acao) {
    ev.preventDefault();
    acao();
  }
});

// ---------- gancho para testes e para quem quiser abrir um Blob por código ----------

window.leitorGigante = {
  abrirBlob: (blob, nome = 'arquivo') => abrirFonte(new FonteBlob(blob, nome)),
  abrirDemo: (bytes) => abrirFonte(new FonteDemo(bytes)),
  leitor,
  get fonte() {
    return fonte;
  },
};

atualizarRodape();
