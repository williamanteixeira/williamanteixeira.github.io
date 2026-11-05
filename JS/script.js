// INCLUINDO O HEADER NAS PAGINAS ONDE A DIV COM O ID "HEADER" ESTIVER PRESENTE
fetch("../components/header.html")
  .then((response) => response.text())
  .then((data) => {
    document.getElementById("header").innerHTML = data;
  });
