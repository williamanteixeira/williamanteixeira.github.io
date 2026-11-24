// ============================================================
// EFEITOS DOS CARDS DA SECTION "TECNOLOGIAS"
//  Inovação 1 - Brilho que segue o mouse
//  Inovação 4 - Entrada escalonada (um card após o outro) no scroll
// O visual fica no css/style.css; aqui só controlamos QUANDO e ONDE.
// ============================================================

// Preferências do visitante
const reduzirMovimento = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
).matches;
// "hover: hover" + "pointer: fine" = dispositivo com mouse (não touch)
const temMouse = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

// ------------------------------------------------------------
// INOVAÇÃO 1 - BRILHO QUE SEGUE O MOUSE
// Um único "ouvinte" no container (delegação de eventos).
// Vantagem: funciona até para cards criados depois pelo JS
// (importante para o passo 6 - cards gerados por JSON).
// ------------------------------------------------------------
function ativarBrilhoNosCards(container) {
  if (!container || !temMouse) return;

  container.addEventListener("pointermove", (evento) => {
    // Descobre em qual card o mouse está (ou null se estiver no espaço entre eles)
    const card = evento.target.closest(".itens_tecnologia");
    if (!card) return;

    // Posição do card na tela
    const area = card.getBoundingClientRect();

    // Posição do mouse DENTRO do card = posição na tela - início do card
    card.style.setProperty("--mouse-x", `${evento.clientX - area.left}px`);
    card.style.setProperty("--mouse-y", `${evento.clientY - area.top}px`);
  });
}

// ------------------------------------------------------------
// INOVAÇÃO 4 - ENTRADA ESCALONADA NO SCROLL
// O IntersectionObserver avisa quando um elemento entra na tela,
// sem precisar ficar ouvindo o evento "scroll" o tempo todo.
// ------------------------------------------------------------
function revelarCardsAoRolar(cards) {
  // Respeita quem pediu menos animação e navegadores muito antigos
  if (reduzirMovimento || !("IntersectionObserver" in window)) return;

  const ATRASO_ENTRE_CARDS = 150; // ms entre um card e o próximo

  // 1) Esconde os cards (estado inicial definido no CSS)
  cards.forEach((card) => card.classList.add("aguardando-revelar"));

  // 2) Observa quando cada card entra na tela
  const observador = new IntersectionObserver(
    (entradas) => {
      // Só os cards que ACABARAM de entrar na tela, nesta "leva"
      const visiveis = entradas.filter((entrada) => entrada.isIntersecting);

      visiveis.forEach((entrada, posicao) => {
        const card = entrada.target;

        // 1º card da leva: 0ms, 2º: 150ms, 3º: 300ms... (efeito escalonado)
        card.style.transitionDelay = `${posicao * ATRASO_ENTRE_CARDS}ms`;
        card.classList.remove("aguardando-revelar");

        // Depois que aparecer, tira o atraso para o hover não ficar "lento"
        card.addEventListener(
          "transitionend",
          () => (card.style.transitionDelay = ""),
          { once: true },
        );

        // Já apareceu: não precisa mais observar este card
        observador.unobserve(card);
      });
    },
    {
      threshold: 0.2, // dispara quando 20% do card estiver visível
      rootMargin: "0px 0px -10% 0px", // ...e um pouco acima do rodapé da tela
    },
  );

  cards.forEach((card) => observador.observe(card));
}

// ------------------------------------------------------------
// INICIALIZAÇÃO
// ------------------------------------------------------------
const containerTecnologias = document.querySelector(".atributos_tecnologias");

ativarBrilhoNosCards(containerTecnologias);
revelarCardsAoRolar(document.querySelectorAll(".itens_tecnologia"));
