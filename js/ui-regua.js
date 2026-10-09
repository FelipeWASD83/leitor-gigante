// A régua lateral: desenha as marcas do arquivo inteiro, o trecho que está na
// tela (barra vermelha) e onde a busca achou (faixas vermelhas). Arrastar ou
// clicar nela leva para aquele ponto do arquivo. Só desenha e liga eventos; as
// contas ficam em regua.js.

import { gerarMarcas, fracaoDeY } from './regua.js';

const MARGEM = 14; // folga em cima e embaixo da área útil
const TRILHO_DA_DIREITA = 18; // distância do trilho até a borda direita

export function criarRegua({ elemento, tela, dica, aoMover, textoDaDica }) {
  const ctx = tela.getContext('2d');
  const e = { tamanho: 0, topo: 0, ext: 0, densidade: null, hover: null, w: 0, h: 0, dpr: 1 };
  let arrastando = false;

  const css = (nome) => getComputedStyle(document.documentElement).getPropertyValue(nome).trim();

  function medir() {
    const r = tela.getBoundingClientRect();
    e.w = r.width;
    e.h = r.height;
    e.dpr = window.devicePixelRatio || 1;
    tela.width = Math.max(1, Math.round(r.width * e.dpr));
    tela.height = Math.max(1, Math.round(r.height * e.dpr));
    desenhar();
  }

  function desenhar() {
    const { w, h } = e;
    const tinta3 = css('--tinta-3');
    const linha = css('--linha-forte');
    const acao = css('--acao');
    const tinta = css('--tinta');
    const alt = Math.max(1, h - 2 * MARGEM);
    const xT = w - TRILHO_DA_DIREITA;
    const y = (frac) => Math.round(MARGEM + frac * alt) + 0.5;

    ctx.setTransform(e.dpr, 0, 0, e.dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    ctx.lineWidth = 1;
    ctx.strokeStyle = linha;
    ctx.beginPath();
    ctx.moveTo(xT + 0.5, MARGEM);
    ctx.lineTo(xT + 0.5, MARGEM + alt);
    ctx.stroke();

    const marcas = gerarMarcas(e.tamanho, alt);
    const pulo = alt / 11 < 26 ? 2 : 1;
    const estreita = w < 80; // celular: rótulo menor e sem espaço, para não ser cortado
    ctx.font = `${estreita ? 10 : 11}px ${css('--fonte-mono')}`;
    ctx.textAlign = 'right';
    let n = 0;
    for (const m of marcas) {
      const yy = y(m.frac);
      const comprimento = m.nivel === 2 ? 10 : 4;
      ctx.strokeStyle = m.nivel === 2 ? tinta3 : linha;
      ctx.beginPath();
      ctx.moveTo(xT - comprimento, yy);
      ctx.lineTo(xT, yy);
      ctx.stroke();
      if (m.rotulo && e.tamanho > 0) {
        if (n % pulo === 0) {
          ctx.fillStyle = tinta3;
          ctx.textBaseline = m.frac === 0 ? 'top' : m.frac === 1 ? 'bottom' : 'middle';
          ctx.fillText(estreita ? m.rotulo.replace(' ', '') : m.rotulo, xT - (estreita ? 13 : 16), yy);
        }
        n++;
      }
    }

    if (e.densidade) {
      const d = e.densidade;
      let maior = 0;
      for (let i = 0; i < d.length; i++) if (d[i] > maior) maior = d[i];
      if (maior > 0) {
        ctx.fillStyle = acao;
        const passo = alt / d.length;
        for (let i = 0; i < d.length; i++) {
          if (!d[i]) continue;
          // linear, para um trecho com muito mais acertos que o resto se destacar
          ctx.globalAlpha = 0.2 + 0.7 * (d[i] / maior);
          ctx.fillRect(xT + 5, MARGEM + i * passo, 5, Math.max(1.5, passo));
        }
        ctx.globalAlpha = 1;
      }
    }

    if (e.tamanho > 0) {
      const y0 = MARGEM + e.topo * alt;
      const hh = Math.max(5, e.ext * alt);
      const yc = y0 + hh / 2;
      ctx.fillStyle = acao;
      ctx.beginPath();
      ctx.roundRect(xT - 2, y0, 5, hh, 2.5);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(xT - 22, yc - 5);
      ctx.lineTo(xT - 22, yc + 5);
      ctx.lineTo(xT - 14, yc);
      ctx.closePath();
      ctx.fill();
    }

    if (e.hover !== null && e.tamanho > 0) {
      ctx.strokeStyle = tinta;
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.moveTo(xT - 22, y(e.hover));
      ctx.lineTo(w - 4, y(e.hover));
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  function fracaoDoEvento(ev) {
    const r = tela.getBoundingClientRect();
    return fracaoDeY(ev.clientY - r.top, MARGEM, Math.max(1, r.height - 2 * MARGEM));
  }

  function mostrarDica(ev) {
    if (!e.tamanho) return;
    const frac = fracaoDoEvento(ev);
    e.hover = frac;
    const r = tela.getBoundingClientRect();
    dica.textContent = textoDaDica(frac);
    dica.hidden = false;
    dica.style.top = `${Math.round(MARGEM + frac * (r.height - 2 * MARGEM))}px`;
    desenhar();
  }

  function esconderDica() {
    e.hover = null;
    dica.hidden = true;
    desenhar();
  }

  elemento.addEventListener('pointerdown', (ev) => {
    if (!e.tamanho || ev.button > 0) return;
    arrastando = true;
    elemento.setPointerCapture(ev.pointerId);
    mostrarDica(ev);
    aoMover(fracaoDoEvento(ev));
    ev.preventDefault();
  });
  elemento.addEventListener('pointermove', (ev) => {
    mostrarDica(ev);
    if (arrastando) aoMover(fracaoDoEvento(ev));
  });
  const soltar = () => {
    arrastando = false;
  };
  elemento.addEventListener('pointerup', soltar);
  elemento.addEventListener('pointercancel', soltar);
  elemento.addEventListener('pointerleave', () => {
    if (!arrastando) esconderDica();
  });
  elemento.addEventListener('lostpointercapture', () => {
    arrastando = false;
    esconderDica();
  });

  new ResizeObserver(medir).observe(tela);
  medir();

  return {
    /** topo e ext são frações (0 a 1) do arquivo: onde começa e quanto cabe na tela. */
    atualizar({ tamanho, topo, ext }) {
      e.tamanho = tamanho;
      e.topo = topo;
      e.ext = ext;
      elemento.setAttribute('aria-valuenow', String(Math.round(topo * 100)));
      desenhar();
    },
    definirDensidade(d) {
      e.densidade = d;
      desenhar();
    },
    redesenhar: desenhar,
  };
}
