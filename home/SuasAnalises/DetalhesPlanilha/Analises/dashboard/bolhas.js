import { gerarBolhasSocioeconomica } from './bolha_socioeconomica.js';
import { gerarBolhasConectividade } from './bolha_conectividade.js';

window.gerarBolhas = async function(parametros) {
  const existing = document.getElementById("bolhasContainer");
  if (existing) existing.remove();

  const planilhasContainer = document.getElementById("planilhasContainer");
  const bolhasContainer = document.createElement("div");
  bolhasContainer.id = "bolhasContainer";
  bolhasContainer.style.marginTop = "2rem";
  planilhasContainer.insertAdjacentElement("afterend", bolhasContainer);

  const urlParams = new URLSearchParams(window.location.search);
  const planilhaNome = urlParams.get("planilha");
  const raw = localStorage.getItem(`planilha_${planilhaNome}`);
  if (!raw) {
    bolhasContainer.innerHTML += "<p>Erro: planilha não encontrada no localStorage.</p>";
    return;
  }

  const data = JSON.parse(raw);
  const headers = data[0];
  const rows = data.slice(1);

  if (parametros.analise === "Conectividade") {
    gerarBolhasConectividade(parametros, headers, rows, bolhasContainer);
  } else {
    gerarBolhasSocioeconomica(parametros, headers, rows);
  }
};