// ============================================================
// CIRCUITO ELETRÔNICO ANIMADO DE FUNDO
// Desenha trilhas de placa de circuito dentro da div#circuit-background
// (index.html) e faz pulsos de luz percorrerem as trilhas.
// ============================================================

(function () {
  const container = document.getElementById("circuit-background");
  if (!container) return;

  // ---------- Configurações (ajuste aqui o visual) ----------
  const CONFIG = {
    grade: 30, // distância entre os pontos da grade (px)
    densidadeTrilhas: 0.07, // quantidade de trilhas em relação ao tamanho da tela
    passosMin: 4, // tamanho mínimo de uma trilha (em pontos da grade)
    passosMax: 18, // tamanho máximo de uma trilha
    chanceCurva: 0.25, // chance da trilha fazer uma curva de 45° a cada passo

    corTrilha: "rgba(50, 56, 70, 0.13)",
    corPad: "rgba(37, 99, 235, 0.22)",
    corChipBorda: "rgba(37, 99, 235, 0.2)",
    corChipFundo: "rgba(17, 26, 43, 0.55)",
    corFundo: "#0b1220", // mesma cor do body (preenche o centro dos pads)
    corLuz: "96, 165, 250", // #8bbbf6 em RGB (cor dos pulsos)

    maxPulsos: 6, // pulsos simultâneos na tela
    intervaloMin: 350, // tempo mínimo entre o surgimento de pulsos (ms)
    intervaloMax: 1100, // tempo máximo entre o surgimento de pulsos (ms)
    velocidadeMin: 90, // velocidade do pulso (px por segundo)
    velocidadeMax: 170,
    tamanhoCauda: 70, // comprimento do rastro de luz (px)
  };

  // 8 direções: 4 retas e 4 diagonais (padrão de trilha de placa)
  const DIRECOES = [
    [1, 0],
    [1, 1],
    [0, 1],
    [-1, 1],
    [-1, 0],
    [-1, -1],
    [0, -1],
    [1, -1],
  ];

  const reduzirMovimento = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  container.appendChild(canvas);

  // Camada estática (trilhas e chips) desenhada uma vez e copiada a cada quadro
  const camadaEstatica = document.createElement("canvas");
  const ctxEstatico = camadaEstatica.getContext("2d");

  let largura = 0;
  let altura = 0;
  let trilhas = [];
  let pulsos = [];
  let flashes = [];
  let proximoPulso = 0;
  let ultimoTempo = 0;
  let animacaoId = null;

  function aleatorio(min, max) {
    return min + Math.random() * (max - min);
  }

  // ============================================================
  // GERAÇÃO DO CIRCUITO
  // ============================================================

  function gerarCircuito() {
    const g = CONFIG.grade;
    const colunas = Math.ceil(largura / g) + 1;
    const linhas = Math.ceil(altura / g) + 1;
    const ocupado = new Uint8Array(colunas * linhas);
    const diagonais = new Set(); // evita que duas diagonais se cruzem no mesmo quadrado
    const chips = [];
    trilhas = [];

    const indice = (x, y) => y * colunas + x;
    const dentro = (x, y) => x >= 0 && y >= 0 && x < colunas && y < linhas;

    // ---------- Chips (retângulos com pinos) ----------
    const totalChips = Math.max(1, Math.floor((largura * altura) / 450000));
    for (let i = 0; i < totalChips; i++) {
      const w = Math.floor(aleatorio(3, 6));
      const h = Math.floor(aleatorio(2, 4));
      const cx = Math.floor(aleatorio(2, colunas - w - 2));
      const cy = Math.floor(aleatorio(3, linhas - h - 3));
      if (cx < 0 || cy < 0) continue;

      let livre = true;
      for (let y = cy - 1; y <= cy + h + 1 && livre; y++) {
        for (let x = cx - 1; x <= cx + w + 1; x++) {
          if (!dentro(x, y) || ocupado[indice(x, y)]) {
            livre = false;
            break;
          }
        }
      }
      if (!livre) continue;

      for (let y = cy; y <= cy + h; y++) {
        for (let x = cx; x <= cx + w; x++) ocupado[indice(x, y)] = 1;
      }
      chips.push({ x: cx, y: cy, w, h });
    }

    // ---------- Trilhas ----------
    function criarTrilha(inicioX, inicioY, direcaoInicial) {
      if (!dentro(inicioX, inicioY) || ocupado[indice(inicioX, inicioY)])
        return;

      const caminho = [[inicioX, inicioY]];
      const usados = new Set([indice(inicioX, inicioY)]);
      const diagonaisUsadas = [];
      let dir = direcaoInicial;
      const passos = Math.floor(aleatorio(CONFIG.passosMin, CONFIG.passosMax));
      let x = inicioX;
      let y = inicioY;

      for (let p = 0; p < passos; p++) {
        if (p > 1 && Math.random() < CONFIG.chanceCurva) {
          dir = (dir + (Math.random() < 0.5 ? 1 : 7)) % 8;
        }
        const [dx, dy] = DIRECOES[dir];
        const nx = x + dx;
        const ny = y + dy;
        if (!dentro(nx, ny)) break;
        const id = indice(nx, ny);
        if (ocupado[id] || usados.has(id)) break;

        if (dx !== 0 && dy !== 0) {
          const chave = Math.min(x, nx) + "," + Math.min(y, ny);
          if (diagonais.has(chave)) break;
          diagonaisUsadas.push(chave);
        }

        usados.add(id);
        caminho.push([nx, ny]);
        x = nx;
        y = ny;
      }

      if (caminho.length < 3) return;

      usados.forEach((id) => (ocupado[id] = 1));
      diagonaisUsadas.forEach((chave) => diagonais.add(chave));

      // Converte para pixels e calcula o comprimento acumulado (usado pelos pulsos)
      const pontos = caminho.map(([px, py]) => ({ x: px * g, y: py * g }));
      const distancias = [0];
      for (let i = 1; i < pontos.length; i++) {
        distancias.push(
          distancias[i - 1] +
            Math.hypot(
              pontos[i].x - pontos[i - 1].x,
              pontos[i].y - pontos[i - 1].y,
            ),
        );
      }
      trilhas.push({
        pontos,
        distancias,
        comprimento: distancias[distancias.length - 1],
      });
    }

    // Trilhas saindo dos pinos dos chips (para cima e para baixo)
    chips.forEach((chip) => {
      for (let x = chip.x + 1; x < chip.x + chip.w; x++) {
        if (Math.random() < 0.75) criarTrilha(x, chip.y - 1, 6);
        if (Math.random() < 0.75) criarTrilha(x, chip.y + chip.h + 1, 2);
      }
    });

    // Trilhas soltas pela tela (preferência por direções retas)
    const tentativas = Math.floor(colunas * linhas * CONFIG.densidadeTrilhas);
    for (let i = 0; i < tentativas; i++) {
      const dir =
        Math.random() < 0.7
          ? Math.floor(Math.random() * 4) * 2
          : Math.floor(Math.random() * 4) * 2 + 1;
      criarTrilha(
        Math.floor(Math.random() * colunas),
        Math.floor(Math.random() * linhas),
        dir,
      );
    }

    desenharCamadaEstatica(chips);
  }

  // ============================================================
  // DESENHO
  // ============================================================

  function desenharCamadaEstatica(chips) {
    const c = ctxEstatico;
    const g = CONFIG.grade;
    c.clearRect(0, 0, largura, altura);
    c.lineCap = "round";
    c.lineJoin = "round";

    // Trilhas
    c.strokeStyle = CONFIG.corTrilha;
    c.lineWidth = 1.5;
    trilhas.forEach((t) => {
      c.beginPath();
      c.moveTo(t.pontos[0].x, t.pontos[0].y);
      for (let i = 1; i < t.pontos.length; i++)
        c.lineTo(t.pontos[i].x, t.pontos[i].y);
      c.stroke();
    });

    // Pads (anéis nas pontas das trilhas)
    c.lineWidth = 1.5;
    trilhas.forEach((t) => {
      [t.pontos[0], t.pontos[t.pontos.length - 1]].forEach((p) => {
        c.beginPath();
        c.arc(p.x, p.y, 3.2, 0, Math.PI * 2);
        c.fillStyle = CONFIG.corFundo;
        c.fill();
        c.strokeStyle = CONFIG.corPad;
        c.stroke();
      });
    });

    // Chips
    chips.forEach((chip) => {
      const x = chip.x * g;
      const y = chip.y * g;
      const w = chip.w * g;
      const h = chip.h * g;

      c.fillStyle = CONFIG.corChipFundo;
      c.strokeStyle = CONFIG.corChipBorda;
      c.lineWidth = 1.5;
      c.beginPath();
      if (c.roundRect) c.roundRect(x, y, w, h, 4);
      else c.rect(x, y, w, h);
      c.fill();
      c.stroke();

      // Pinos ligando o chip às trilhas
      c.strokeStyle = CONFIG.corTrilha;
      for (let px = 1; px < chip.w; px++) {
        c.beginPath();
        c.moveTo(x + px * g, y);
        c.lineTo(x + px * g, y - g);
        c.moveTo(x + px * g, y + h);
        c.lineTo(x + px * g, y + h + g);
        c.stroke();
      }

      // Marca de orientação do chip
      c.beginPath();
      c.arc(x + 8, y + 8, 2.5, 0, Math.PI * 2);
      c.fillStyle = CONFIG.corChipBorda;
      c.fill();
    });
  }

  // Retorna a posição (x, y) a uma certa distância do início da trilha
  function pontoNaDistancia(trilha, d) {
    const { pontos, distancias } = trilha;
    if (d <= 0) return pontos[0];
    if (d >= trilha.comprimento) return pontos[pontos.length - 1];
    let i = 1;
    while (distancias[i] < d) i++;
    const a = pontos[i - 1];
    const b = pontos[i];
    const t = (d - distancias[i - 1]) / (distancias[i] - distancias[i - 1]);
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  }

  function criarPulso() {
    if (!trilhas.length) return;
    const trilha = trilhas[Math.floor(Math.random() * trilhas.length)];
    pulsos.push({
      trilha,
      posicao: 0,
      velocidade: aleatorio(CONFIG.velocidadeMin, CONFIG.velocidadeMax),
      invertido: Math.random() < 0.5, // percorre a trilha em qualquer sentido
    });
  }

  function desenharPulso(p) {
    const t = p.trilha;
    const cauda = CONFIG.tamanhoCauda;
    const segmentos = 14;
    const converter = (d) =>
      pontoNaDistancia(t, p.invertido ? t.comprimento - d : d);

    // Rastro: pequenos segmentos com opacidade crescente até a cabeça do pulso
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    let anterior = converter(p.posicao - cauda);
    for (let i = 1; i <= segmentos; i++) {
      const atual = converter(p.posicao - cauda + (cauda * i) / segmentos);
      ctx.strokeStyle = `rgba(${CONFIG.corLuz}, ${(i / segmentos) * 0.55})`;
      ctx.beginPath();
      ctx.moveTo(anterior.x, anterior.y);
      ctx.lineTo(atual.x, atual.y);
      ctx.stroke();
      anterior = atual;
    }

    // Cabeça brilhante
    const cabeca = converter(p.posicao);
    ctx.shadowColor = `rgb(${CONFIG.corLuz})`;
    ctx.shadowBlur = 10;
    ctx.fillStyle = `rgba(${CONFIG.corLuz}, 0.9)`;
    ctx.beginPath();
    ctx.arc(cabeca.x, cabeca.y, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // Pequeno brilho no pad quando o pulso chega ao fim da trilha
  function desenharFlash(f) {
    const alpha = f.vida * 0.6;
    ctx.shadowColor = `rgb(${CONFIG.corLuz})`;
    ctx.shadowBlur = 12;
    ctx.strokeStyle = `rgba(${CONFIG.corLuz}, ${alpha})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(f.x, f.y, 3.2 + (1 - f.vida) * 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // ============================================================
  // ANIMAÇÃO
  // ============================================================

  function quadro(tempo) {
    const dt = Math.min((tempo - ultimoTempo) / 1000, 0.05); // limita saltos grandes
    ultimoTempo = tempo;

    if (tempo >= proximoPulso && pulsos.length < CONFIG.maxPulsos) {
      criarPulso();
      proximoPulso =
        tempo + aleatorio(CONFIG.intervaloMin, CONFIG.intervaloMax);
    }

    ctx.clearRect(0, 0, largura, altura);
    ctx.drawImage(camadaEstatica, 0, 0, largura, altura);

    pulsos = pulsos.filter((p) => {
      p.posicao += p.velocidade * dt;
      if (p.posicao - CONFIG.tamanhoCauda >= p.trilha.comprimento) return false;
      if (p.posicao >= p.trilha.comprimento && !p.chegou) {
        p.chegou = true;
        const fim = pontoNaDistancia(
          p.trilha,
          p.invertido ? 0 : p.trilha.comprimento,
        );
        flashes.push({ x: fim.x, y: fim.y, vida: 1 });
      }
      desenharPulso(p);
      return true;
    });

    flashes = flashes.filter((f) => {
      f.vida -= dt * 1.8;
      if (f.vida <= 0) return false;
      desenharFlash(f);
      return true;
    });

    animacaoId = requestAnimationFrame(quadro);
  }

  function iniciarAnimacao() {
    if (reduzirMovimento || animacaoId !== null) return;
    ultimoTempo = performance.now();
    animacaoId = requestAnimationFrame(quadro);
  }

  function pararAnimacao() {
    if (animacaoId !== null) cancelAnimationFrame(animacaoId);
    animacaoId = null;
  }

  // ============================================================
  // TAMANHO DA TELA
  // ============================================================

  function ajustarTamanho() {
    const dpr = window.devicePixelRatio || 1;
    largura = window.innerWidth;
    altura = window.innerHeight;

    [canvas, camadaEstatica].forEach((c) => {
      c.width = Math.round(largura * dpr);
      c.height = Math.round(altura * dpr);
    });
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctxEstatico.setTransform(dpr, 0, 0, dpr, 0, 0);

    pulsos = [];
    flashes = [];
    gerarCircuito();

    // Sem animação: mostra apenas o circuito parado
    ctx.clearRect(0, 0, largura, altura);
    ctx.drawImage(camadaEstatica, 0, 0, largura, altura);
  }

  let temporizadorResize = null;
  window.addEventListener("resize", () => {
    clearTimeout(temporizadorResize);
    temporizadorResize = setTimeout(() => {
      // No celular a barra de endereço muda a altura; só recria se mudar bastante
      if (
        window.innerWidth !== largura ||
        Math.abs(window.innerHeight - altura) > 120
      ) {
        ajustarTamanho();
      }
    }, 200);
  });

  // Pausa quando o usuário sai da aba e retoma quando volta
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pararAnimacao();
    else iniciarAnimacao();
  });

  ajustarTamanho();
  iniciarAnimacao();
})();
