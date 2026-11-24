"""
Apresentação automatizada do portfólio com Python + Selenium.

Um "robô" abre o site em um navegador real e o percorre como uma pessoa faria:
rola a página, passa o mouse nos cards, pausa o carrossel e mostra legendas
explicando cada parte. A ideia é gravar a tela enquanto ele roda e usar o vídeo
no botão "Apresentação" do site.

Uso:
    python automacao/apresentacao.py                 # sobe um servidor local e apresenta
    python automacao/apresentacao.py --velocidade 1.5
    python automacao/apresentacao.py --url https://will623.github.io/curriculo/
    python automacao/apresentacao.py --headless      # sem janela (teste rápido)
"""

from __future__ import annotations

import argparse
import functools
import logging
import threading
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from selenium import webdriver
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.common.by import By
from selenium.webdriver.remote.webdriver import WebDriver
from selenium.webdriver.remote.webelement import WebElement
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

RAIZ_DO_SITE = Path(__file__).resolve().parent.parent
log = logging.getLogger("apresentacao")


# ----------------------------------------------------------------------
# Servidor local
# O site usa caminhos absolutos (/Imagens/...), que não funcionam abrindo o
# arquivo direto (file://). Por isso subimos um servidor HTTP simples, em uma
# thread separada, servindo a pasta do projeto.
# ----------------------------------------------------------------------
class _HandlerSilencioso(SimpleHTTPRequestHandler):
    def log_message(self, *args) -> None:  # não polui o terminal com cada requisição
        pass


def iniciar_servidor(porta: int) -> ThreadingHTTPServer:
    handler = functools.partial(_HandlerSilencioso, directory=str(RAIZ_DO_SITE))
    servidor = ThreadingHTTPServer(("127.0.0.1", porta), handler)
    threading.Thread(target=servidor.serve_forever, daemon=True).start()
    log.info("Servidor local em http://127.0.0.1:%d", porta)
    return servidor


# ----------------------------------------------------------------------
# Elementos visuais injetados na página (só durante a apresentação)
# - legenda: caixa no rodapé dizendo o que o robô está fazendo
# - cursor:  bolinha que segue o mouse do Selenium (o cursor real não aparece
#            na gravação, porque o Selenium dispara eventos, não move o mouse)
# ----------------------------------------------------------------------
JS_PREPARAR_PAGINA = """
const css = document.createElement('style');
css.textContent = `
  #robo-legenda {
    position: fixed; left: 50%; bottom: 3rem; transform: translateX(-50%);
    z-index: 2147483647; max-width: 70rem; padding: 1.4rem 2.4rem;
    font: 600 1.8rem/1.4 Arial, sans-serif; color: #e8eef7; text-align: center;
    background: rgba(11, 18, 32, .9); border: 1px solid rgba(96, 165, 250, .4);
    border-radius: 1.2rem; box-shadow: 0 1rem 3rem rgba(0, 0, 0, .5);
    transition: opacity .3s;
  }
  #robo-legenda::before { content: '🤖 Python  '; color: #a3e635; }
  #robo-cursor {
    position: fixed; left: 0; top: 0; z-index: 2147483647; pointer-events: none;
    width: 2.2rem; height: 2.2rem; margin: -1.1rem 0 0 -1.1rem; border-radius: 50%;
    background: rgba(96, 165, 250, .55); border: 2px solid #fff;
    transition: transform .12s linear;
  }
  .robo-destaque {
    outline: 3px solid #a3e635 !important; outline-offset: .8rem;
    border-radius: 1rem; transition: outline-color .3s;
  }`;
document.head.append(css);

const legenda = document.createElement('div');
legenda.id = 'robo-legenda';
document.body.append(legenda);

const cursor = document.createElement('div');
cursor.id = 'robo-cursor';
document.body.append(cursor);
document.addEventListener('mousemove', (e) => {
  cursor.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
});
"""


class Apresentador:
    """Agrupa as ações "humanas" que o robô sabe fazer na página."""

    def __init__(self, driver: WebDriver, velocidade: float = 1.0) -> None:
        self.driver = driver
        self.velocidade = velocidade
        self.espera = WebDriverWait(driver, timeout=10)
        # duration = tempo de cada movimento do mouse, em ms (movimento suave)
        self.mouse = ActionChains(driver, duration=int(700 / velocidade))

    # --- utilitários -------------------------------------------------
    def pausa(self, segundos: float) -> None:
        time.sleep(segundos / self.velocidade)

    def achar(self, seletor: str) -> WebElement:
        """Espera o elemento existir e estar visível (em vez de um sleep fixo)."""
        return self.espera.until(
            EC.visibility_of_element_located((By.CSS_SELECTOR, seletor))
        )

    # --- ações --------------------------------------------------------
    def legenda(self, texto: str, leitura: float = 2.5) -> None:
        log.info(texto)
        self.driver.execute_script(
            "document.getElementById('robo-legenda').textContent = arguments[0];",
            texto,
        )
        self.pausa(leitura)

    def rolar_ate(self, elemento: WebElement) -> None:
        self.driver.execute_script(
            "arguments[0].scrollIntoView({behavior: 'smooth', block: 'center'});",
            elemento,
        )
        self.pausa(1.2)  # tempo da rolagem suave terminar

    def passar_mouse(self, elemento: WebElement, demora: float = 1.0) -> None:
        self.mouse.move_to_element(elemento).perform()
        self.pausa(demora)

    def destacar(self, elemento: WebElement, ligado: bool = True) -> None:
        metodo = "add" if ligado else "remove"
        self.driver.execute_script(
            f"arguments[0].classList.{metodo}('robo-destaque');", elemento
        )

    # --- o roteiro ----------------------------------------------------
    def apresentar(self, url: str) -> None:
        self.driver.get(url)
        self.achar("main")
        self.driver.execute_script(JS_PREPARAR_PAGINA)
        self.pausa(1)

        self.legenda("Olá! Sou um robô escrito em Python com Selenium.")
        self.legenda("Vou navegar por este portfólio como uma pessoa faria.")

        nome = self.achar(".hello_text h1")
        self.destacar(nome)
        self.legenda("Este é o William: desenvolvedor web e analista de sistemas.")
        self.destacar(nome, ligado=False)

        card = self.achar(".card-codigo")
        self.passar_mouse(card)
        self.destacar(card)
        self.legenda("Aqui ele se apresenta em código, como um objeto JavaScript.")
        self.destacar(card, ligado=False)

        cards = self.driver.find_elements(By.CSS_SELECTOR, ".itens_tecnologia")
        self.rolar_ate(cards[0])
        self.legenda(f"Agora, as {len(cards)} áreas em que ele atua:", leitura=1.5)
        for card in cards:
            titulo = card.find_element(By.TAG_NAME, "h3").text
            self.passar_mouse(card, demora=0.4)
            self.legenda(f"{titulo}: repare no brilho que segue o mouse.", leitura=1.8)

        faixa = self.achar(".l-tec")
        self.rolar_ate(faixa)
        self.legenda("Este carrossel infinito roda no compositor do navegador...")
        self.passar_mouse(faixa, demora=0.3)
        self.legenda("...e pausa quando o mouse passa por cima, para facilitar a leitura.")

        conexoes = self.achar(".conexoes")
        self.rolar_ate(conexoes)
        self.legenda("Por aqui você encontra e-mail, GitHub e LinkedIn.")

        self.driver.execute_script("window.scrollTo({top: 0, behavior: 'smooth'});")
        self.pausa(1.5)
        botao_cv = self.achar(".btn_cv")
        self.passar_mouse(botao_cv, demora=0.3)
        self.destacar(botao_cv)
        self.legenda("Gostou? Baixe o currículo completo por aqui.", leitura=3)
        self.destacar(botao_cv, ligado=False)

        self.legenda("Fim! Meu código está em automacao/apresentacao.py.", leitura=3)


# ----------------------------------------------------------------------
# Linha de comando
# ----------------------------------------------------------------------
def criar_navegador(headless: bool) -> WebDriver:
    opcoes = webdriver.ChromeOptions()
    opcoes.add_argument("--window-size=1920,1080")
    opcoes.add_argument("--hide-scrollbars")
    # esconde a faixa "Chrome está sendo controlado por um software automatizado"
    opcoes.add_experimental_option("excludeSwitches", ["enable-automation"])
    if headless:
        opcoes.add_argument("--headless=new")
    # O Selenium 4.6+ baixa o chromedriver certo sozinho (Selenium Manager)
    return webdriver.Chrome(options=opcoes)


def main() -> None:
    parser = argparse.ArgumentParser(description="Apresentação automatizada do portfólio.")
    parser.add_argument("--url", help="endereço do site (padrão: servidor local)")
    parser.add_argument("--porta", type=int, default=8765)
    parser.add_argument("--velocidade", type=float, default=1.0,
                        help="multiplicador de velocidade (2 = duas vezes mais rápido)")
    parser.add_argument("--headless", action="store_true", help="roda sem abrir janela")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(message)s",
                        datefmt="%H:%M:%S")

    servidor = None
    url = args.url
    if url is None:
        servidor = iniciar_servidor(args.porta)
        url = f"http://127.0.0.1:{args.porta}/index.html"

    driver = criar_navegador(args.headless)
    try:
        Apresentador(driver, args.velocidade).apresentar(url)
    finally:  # fecha tudo mesmo se der erro no meio
        driver.quit()
        if servidor:
            servidor.shutdown()


if __name__ == "__main__":
    main()
