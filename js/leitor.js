// A tela de leitura. Sabe desenhar o pedaço do arquivo que cabe na janela e
// andar por ele; não sabe nada de botões, busca ou régua (isso é do main.js).
//
// Tudo é medido em bytes do arquivo. `topo` é o byte onde começa a primeira
// linha visível. Rolar para baixo = pedir ao layout onde começa a n-ésima
// linha depois; rolar para cima = pedir onde começava a n-ésima antes. O resto
// do arquivo nem é lido.

import { layoutAdiante, voltar, ehContinuacao } from './layout.js';
import { acertosNaTela } from './busca.js';

const MARGEM_PARA_TRAS = 64 * 1024; // quanto procurar o começo da linha ao subir
const MAX_PASSO = 2000; // linhas por pedido de rolagem
const UTF8 = new TextDecoder('utf-8', { ignoreBOM: true });
const CODIFICADOR = new TextEncoder();
const SO_ASCII = /^[\x00-\x7f]*$/;
const CONTROLES = /[\u0000-\u0008\u000b-\u001f\u007f]/g;

export function criarLeitor({ area, texto, sonda, aoAtualizar, aoMedir, aoErro }) {
  const e = {
    fonte: null,
    topo: 0,
    cols: 80,
    linhas: 20,
    lh: 24,
    cw: 9.6,
    agrupar: false,
    consulta: null,
    acertoAtual: null,
    maxTopo: 0,
    maxChave: '',
    textoTela: '',
    visiveis: 0,
    pinturaMs: 0,
    quadroMs: 0,
  };
  let geracao = 0;
  let medidasSujas = true;
  let pendenteLinhas = 0;
  let alvoAbs = null;
  let precisaDesenhar = false;
  let rodando = false;

  // ---------- medidas ----------

  function medir() {
    const cs = getComputedStyle(texto);
    const largura = texto.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const altura = texto.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    const r = sonda.getBoundingClientRect();
    e.cw = r.width / 100;
    e.lh = r.height;
    if (e.agrupar) {
      const grupo = 11 * e.cw; // 10 caracteres + 1ch de espaço
      e.cols = Math.max(10, Math.floor((largura - 1) / grupo) * 10);
    } else {
      e.cols = Math.max(8, Math.floor((largura - 1) / e.cw));
    }
    e.linhas = Math.max(1, Math.floor(altura / e.lh));
    medidasSujas = false;
  }

  /**
   * Lê a partir de `topo` o bastante para `linhas` linhas. Começa supondo 1 byte
   * por caractere (texto comum) e dobra a leitura se faltar (UTF-8 de até 4 bytes).
   * Com a letra bem pequena a tela tem milhões de caracteres: ler 4x por garantia
   * custaria centenas de MB à toa.
   */
  async function montarAdiante(f, topo, linhas) {
    let folga = 1.05;
    for (;;) {
      const fim = Math.min(f.size, topo + Math.ceil(linhas * (e.cols + 2) * folga) + 16);
      const buf = await f.ler(topo, fim);
      const r = layoutAdiante(buf, topo, e.cols, linhas, fim >= f.size);
      if (r.linhas.length >= linhas || fim >= f.size || folga >= 4) return { buf, r };
      folga *= 2;
    }
  }

  /** Posição `n` linhas antes de `topo` (mesma ideia: lê pouco e dobra se faltar). */
  async function montarAtras(f, topo, n, opcoes) {
    let folga = 1.05;
    for (;;) {
      const base = Math.max(0, topo - Math.ceil((n + 2) * (e.cols + 2) * folga) - MARGEM_PARA_TRAS);
      const buf = await f.ler(base, topo);
      const r = voltar(buf, base, buf.length, e.cols, n, opcoes);
      if (r.passos >= n || base === 0 || folga >= 4) return base + r.pos;
      folga *= 2;
    }
  }

  async function garantirMaxTopo(f) {
    const chave = `${e.cols}x${e.linhas}`;
    if (chave === e.maxChave) return;
    e.maxTopo = await montarAtras(f, f.size, e.linhas, { fimDoArquivo: true });
    e.maxChave = chave;
  }

  /** Se `p` caiu no meio de um caractere UTF-8, avança até o começo do próximo. */
  async function alinhar(f, p) {
    p = Math.max(0, Math.min(f.size, Math.floor(p)));
    if (p >= f.size) return f.size;
    const b = await f.ler(p, Math.min(f.size, p + 4));
    let i = 0;
    while (i < b.length && ehContinuacao(b[i])) i++;
    return p + i;
  }

  /** Onde fica o topo `n` linhas depois (n > 0) ou antes (n < 0) de `topo`. */
  async function deslocar(f, topo, n) {
    const teto = Math.max(MAX_PASSO, e.linhas * 2); // uma página sempre cabe, mesmo com a letra minúscula
    n = Math.max(-teto, Math.min(teto, n));
    if (n > 0) {
      const { r } = await montarAdiante(f, topo, n + 1);
      return r.linhas.length > n ? r.linhas[n].ini : e.maxTopo;
    }
    if (n < 0) return montarAtras(f, topo, -n);
    return topo;
  }

  // ---------- desenho ----------

  function pedir() {
    precisaDesenhar = true;
    if (!rodando) rodar();
  }

  async function rodar() {
    rodando = true;
    try {
      while (precisaDesenhar) {
        precisaDesenhar = false;
        try {
          await desenharAgora();
        } catch (erro) {
          aoErro?.(erro); // arquivo apagado, movido ou sem permissão no meio da leitura
        }
      }
    } finally {
      rodando = false;
    }
  }

  async function desenharAgora() {
    const f = e.fonte;
    if (!f) return;
    const g = geracao;
    if (medidasSujas) medir();
    await garantirMaxTopo(f);
    if (g !== geracao) return;

    if (alvoAbs !== null) {
      const alvo = alvoAbs;
      alvoAbs = null;
      e.topo = await alinhar(f, alvo);
    }
    if (pendenteLinhas !== 0) {
      const n = pendenteLinhas;
      pendenteLinhas = 0;
      // sem limitar a maxTopo antes: um acerto perto do fim sobe a partir dele,
      // e só depois o topo é trazido para o último trecho que dá para mostrar
      e.topo = await deslocar(f, e.topo, n);
    }
    if (g !== geracao) return;
    e.topo = Math.max(0, Math.min(e.topo, e.maxTopo));

    const { buf, r } = await montarAdiante(f, e.topo, e.linhas);
    if (g !== geracao) return;
    e.visiveis = Math.max(0, r.proximo - e.topo);
    const t0 = performance.now();
    pintar(r, buf);
    void texto.offsetHeight; // força o layout agora, para contar o que a letra pequena pesa
    e.pinturaMs = performance.now() - t0;
    aoAtualizar?.(estado());
    medirQuadro(t0);
  }

  /**
   * Quanto o navegador levou de verdade para mostrar a tela (layout e pintura
   * do DOM, que é onde a letra pequena pesa): do fim da montagem até logo depois
   * do quadro. Não trava o desenho: se a aba estiver escondida, só não mede.
   */
  function medirQuadro(t0) {
    const g = geracao;
    requestAnimationFrame(() =>
      setTimeout(() => {
        if (g !== geracao) return;
        e.quadroMs = performance.now() - t0;
        aoMedir?.(estado());
      }, 0),
    );
  }

  function pintar(r, buf) {
    const textos = r.linhas.map((l) =>
      UTF8.decode(buf.subarray(l.ini - e.topo, l.fim - e.topo))
        .replace(CONTROLES, '·')
        .replace(/\t/g, ' '),
    );

    // O texto da tela "como se fosse contínuo": linhas quebradas por falta de
    // coluna se emendam, só o \n de verdade vira quebra. Serve para achar
    // o que cruza a quebra e para o botão de copiar.
    let fluxo = '';
    const iniFluxo = [];
    textos.forEach((t, i) => {
      iniFluxo.push(fluxo.length);
      fluxo += t + (r.linhas[i].quebra && i < textos.length - 1 ? '\n' : '');
    });
    e.textoTela = fluxo;

    let marcas = null;
    if (e.consulta) {
      const inicios = acertosNaTela(fluxo, e.consulta);
      if (inicios.length) {
        marcas = new Uint8Array(fluxo.length);
        const n = e.consulta.exibicao.length;
        for (const i of inicios) marcas.fill(1, i, i + n);
        if (e.acertoAtual !== null) {
          for (const i of inicios) {
            if (byteDoIndice(r, textos, iniFluxo, i) === e.acertoAtual) marcas.fill(2, i, i + n);
          }
        }
      }
    }

    const frag = document.createDocumentFragment();
    textos.forEach((t, i) => {
      const div = document.createElement('div');
      div.className = 'l';
      const fl = marcas ? marcas.subarray(iniFluxo[i], iniFluxo[i] + t.length) : null;
      if (e.agrupar) {
        for (let a = 0; a < t.length; a += 10) {
          const s = document.createElement('span');
          s.className = 'g';
          preencher(s, t, a, Math.min(t.length, a + 10), fl);
          div.append(s);
        }
      } else {
        preencher(div, t, 0, t.length, fl);
      }
      frag.append(div);
    });
    texto.replaceChildren(frag);
  }

  /** Byte do arquivo onde está o caractere `idx` do fluxo da tela. */
  function byteDoIndice(r, textos, iniFluxo, idx) {
    let k = iniFluxo.length - 1;
    while (k > 0 && iniFluxo[k] > idx) k--;
    const t = textos[k];
    const rel = idx - iniFluxo[k];
    const antes = t.slice(0, rel);
    return r.linhas[k].ini + (SO_ASCII.test(antes) ? antes.length : CODIFICADOR.encode(antes).length);
  }

  function preencher(pai, t, a, b, fl) {
    if (!fl) {
      pai.append(t.slice(a, b));
      return;
    }
    let i = a;
    while (i < b) {
      const v = fl[i];
      let j = i + 1;
      while (j < b && fl[j] === v) j++;
      const s = t.slice(i, j);
      if (v) {
        const m = document.createElement('mark');
        if (v === 2) m.className = 'atual';
        m.textContent = s;
        pai.append(m);
      } else {
        pai.append(s);
      }
      i = j;
    }
  }

  function estado() {
    const tamanho = e.fonte?.size ?? 0;
    return {
      topo: e.topo,
      tamanho,
      visiveis: e.visiveis,
      cols: e.cols,
      linhas: e.linhas,
      maxTopo: e.maxTopo,
      caracteres: e.linhas * e.cols,
      pinturaMs: e.pinturaMs,
      quadroMs: e.quadroMs,
    };
  }

  // ---------- entrada: roda do mouse e toque ----------

  let acumulado = 0;
  area.addEventListener(
    'wheel',
    (ev) => {
      if (!e.fonte || ev.ctrlKey || ev.metaKey) return; // Ctrl + roda é zoom: main.js
      ev.preventDefault();
      const dy = ev.shiftKey && Math.abs(ev.deltaX) > Math.abs(ev.deltaY) ? ev.deltaX : ev.deltaY;
      let linhas = ev.deltaMode === 1 ? dy : ev.deltaMode === 2 ? dy * e.linhas : dy / e.lh;
      if (ev.altKey) linhas *= 200;
      else if (ev.shiftKey) linhas *= 20;
      acumulado += linhas;
      const inteiro = Math.trunc(acumulado);
      if (inteiro) {
        acumulado -= inteiro;
        api.rolar(inteiro);
      }
    },
    { passive: false },
  );

  let toque = null;
  texto.addEventListener('pointerdown', (ev) => {
    if (ev.pointerType === 'mouse' || !e.fonte) return;
    toque = { y: ev.clientY, acc: 0 };
    try {
      texto.setPointerCapture(ev.pointerId);
    } catch {
      /* sem captura, o arrasto só acompanha dentro da área do texto */
    }
  });
  texto.addEventListener('pointermove', (ev) => {
    if (!toque) return;
    toque.acc += (toque.y - ev.clientY) / e.lh;
    toque.y = ev.clientY;
    const inteiro = Math.trunc(toque.acc);
    if (inteiro) {
      toque.acc -= inteiro;
      api.rolar(inteiro);
    }
  });
  const largarToque = () => {
    toque = null;
  };
  texto.addEventListener('pointerup', largarToque);
  texto.addEventListener('pointercancel', largarToque);

  new ResizeObserver(() => {
    medidasSujas = true;
    if (e.fonte) pedir();
  }).observe(texto);

  // ---------- o que o main.js usa ----------

  const api = {
    abrir(fonte) {
      geracao++;
      e.fonte = fonte;
      e.topo = 0;
      e.consulta = null;
      e.acertoAtual = null;
      e.maxChave = '';
      e.textoTela = '';
      pendenteLinhas = 0;
      alvoAbs = null;
      medidasSujas = true;
      if (fonte) pedir();
      else texto.replaceChildren();
    },
    rolar(linhas) {
      if (!e.fonte || !linhas) return;
      pendenteLinhas += linhas;
      pedir();
    },
    /** Vai para um byte do arquivo; `contexto` deixa essa quantidade de linhas acima dele. */
    irPara(byte, contexto = 0) {
      if (!e.fonte) return;
      alvoAbs = byte;
      pendenteLinhas = -contexto;
      pedir();
    },
    irParaFracao(frac) {
      if (!e.fonte) return;
      api.irPara(Math.min(frac, 1) * e.fonte.size);
    },
    pagina(sentido) {
      api.rolar(sentido * Math.max(1, e.linhas - 1));
    },
    inicio() {
      api.irPara(0);
    },
    fim() {
      api.irPara(Number.POSITIVE_INFINITY);
    },
    definirFonte(px) {
      document.documentElement.style.setProperty('--fs', `${px}px`);
      medidasSujas = true;
      e.maxChave = '';
      if (e.fonte) pedir();
    },
    definirAgrupar(ligado) {
      e.agrupar = ligado;
      medidasSujas = true;
      e.maxChave = '';
      if (e.fonte) pedir();
    },
    definirConsulta(c) {
      e.consulta = c;
      e.acertoAtual = null;
      if (e.fonte) pedir();
    },
    definirAcertoAtual(byte) {
      e.acertoAtual = byte;
      if (e.fonte) pedir();
    },
    redesenhar() {
      if (e.fonte) pedir();
    },
    textoDaTela: () => e.textoTela,
    estado,
  };
  return api;
}
