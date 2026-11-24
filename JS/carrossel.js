(function () {
  const faixa = document.querySelector(".l-tec"); // a janela
  if (!faixa) return; // página sem carrossel? sai.
  const trilho = faixa.querySelector(".Lista-tec"); // o que se move
  const itensOriginais = [...trilho.children]; // os 10 <li> do HTML

  function duplicarItens() {
    itensOriginais.forEach((item) => {
      const copia = item.cloneNode(true); // copia o <li> com o texto
      copia.setAttribute("aria-hidden", "true"); // leitor de tela ignora a cópia
      trilho.append(copia); // coloca no final do trilho
    });
  }

  let larguraCiclo = 0;

  function medirCiclo() {
    const primeiroOriginal = trilho.children[0];
    const primeiraCopia = trilho.children[itensOriginais.length]; // 11º item
    larguraCiclo = primeiraCopia.offsetLeft - primeiroOriginal.offsetLeft;
  }

  // Garante itens suficientes: o trilho precisa ter 1 ciclo + 1 faixa inteira
  // de largura. Roda no início E sempre que a tela mudar de tamanho.
  function preencherTrilho() {
    medirCiclo();
    while (trilho.offsetWidth < larguraCiclo + faixa.offsetWidth) {
      duplicarItens();
    }
  }

  duplicarItens(); // no mínimo uma cópia (o medirCiclo precisa do 11º item)
  preencherTrilho();

  // ------------------------------------------------------------
  // A ANIMAÇÃO (Web Animations API)
  // Em vez de mover o trilho "na mão" a cada quadro, descrevemos o movimento
  // uma vez e o navegador o executa no COMPOSITOR, uma thread separada.
  // Assim, se a thread principal engasgar (circuito de fundo, coleta de
  // lixo do JS etc.), o carrossel continua liso.
  // ------------------------------------------------------------
  const VELOCIDADE = 60; // pixels por segundo (ajuste a gosto)
  let animacao = null;

  function montarAnimacao() {
    const duracao = (larguraCiclo / VELOCIDADE) * 1000; // ms para andar 1 ciclo

    // Se já existe uma animação (ex.: a tela mudou de tamanho), guarda
    // em que ponto do ciclo ela estava (0 a 1) e se estava tocando.
    let progresso = 0;
    let estavaTocando = false;
    if (animacao) {
      const duracaoAntiga = animacao.effect.getTiming().duration;
      progresso = (animacao.currentTime % duracaoAntiga) / duracaoAntiga;
      estavaTocando = animacao.playState === "running";
      animacao.cancel();
    }

    animacao = trilho.animate(
      [
        { transform: "translateX(0)" }, // início do ciclo
        { transform: `translateX(${-larguraCiclo}px)` }, // fim do ciclo
      ],
      {
        duration: duracao,
        iterations: Infinity, // repete para sempre
        easing: "linear", // velocidade constante, sem acelerar/frear
      },
    );

    // Continua do mesmo ponto em que estava (ou do início, na 1ª vez)
    animacao.currentTime = progresso * duracao;
    if (!estavaTocando) animacao.pause(); // quem decide tocar é o atualizar()
  }

  montarAnimacao();

  function iniciar() {
    animacao.play(); // se já estiver tocando, não faz nada
  }

  function parar() {
    animacao.pause(); // congela exatamente onde está
  }

  const reduzirMovimento = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  let estaNaTela = false;
  let mouseEmCima = false;

  // UMA função decide se anda ou para, olhando TODAS as condições
  function atualizar() {
    const deveAnimar =
      estaNaTela && !mouseEmCima && !document.hidden && !reduzirMovimento;

    if (deveAnimar) iniciar();
    else parar();
  }

  // 1) Faixa entrou/saiu da tela
  const observador = new IntersectionObserver((entradas) => {
    estaNaTela = entradas[0].isIntersecting;
    atualizar();
  });
  observador.observe(faixa);

  // 2) Pausa no hover (deixa o visitante ler)
  faixa.addEventListener("mouseenter", () => {
    mouseEmCima = true;
    atualizar();
  });
  faixa.addEventListener("mouseleave", () => {
    mouseEmCima = false;
    atualizar();
  });

  // 3) Trocou de aba
  document.addEventListener("visibilitychange", atualizar);

  // 4) Tela mudou de tamanho (maximizar, abrir/fechar DevTools, girar o celular)
  //    ou a fonte terminou de carregar: mede de novo e cria cópias se faltar.
  //    Se o tamanho do ciclo mudou, refaz a animação SEM voltar ao início.
  function recalcular() {
    const cicloAnterior = larguraCiclo;
    preencherTrilho();
    if (larguraCiclo !== cicloAnterior) montarAnimacao();
  }

  window.addEventListener("resize", recalcular);
  document.fonts.ready.then(recalcular);
})();
