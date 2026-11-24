// Abre/fecha a janela com o vídeo da apresentação automatizada (Python + Selenium).
// Usa o elemento <dialog> nativo: ele já traz o fundo escuro (::backdrop),
// fecha com Esc e prende o foco do teclado dentro da janela.
(function () {
  const botao = document.getElementById("btn-apresentacao");
  const modal = document.getElementById("modal-apresentacao");
  if (!botao || !modal) return;

  const video = modal.querySelector("video");
  const fechar = modal.querySelector(".modal-apresentacao__fechar");

  botao.addEventListener("click", () => {
    modal.showModal();
    video.play().catch(() => {}); // se o navegador bloquear o autoplay, o usuário dá play
  });

  fechar.addEventListener("click", () => modal.close());

  // clicar no fundo escuro (fora da caixa) também fecha
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.close();
  });

  // ao fechar (botão, Esc ou fundo), o vídeo para e volta ao início
  modal.addEventListener("close", () => {
    video.pause();
    video.currentTime = 0;
  });
})();
