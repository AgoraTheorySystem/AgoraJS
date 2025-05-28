// evocacoes.js

import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/9.9.3/firebase-database.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.9.3/firebase-app.js";
import firebaseConfig from '/firebase.js';

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

const ITEMS_PER_PAGE = 20;
let currentPage = 1;
let allWords = [];
let currentLematizacoes = {};
let currentSearch = "";

// ——— seleção persistente ———
// agora global, para o menu lateral poder ler!
window.selectedEvocacoes = [];

// referências ao DOM do painel de selecionados:
const selectedListEl = document.getElementById('selected-list');
const selectedCountEl = document.getElementById('selected-count');
const clearSelectedBtn = document.getElementById('clear-selected');

// limpa tudo:
clearSelectedBtn.addEventListener('click', () => {
  window.selectedEvocacoes = [];
  updateSelectedContainer();
  renderTabela(); // re-renderiza pra desmarcar checkboxes
});

// atualiza o painel de selecionados:
function updateSelectedContainer() {
  selectedListEl.innerHTML = '';
  selectedCountEl.textContent = window.selectedEvocacoes.length;
  window.selectedEvocacoes.forEach(palavra => {
    const li = document.createElement('li');
    li.className = 'selected-item';
    li.textContent = palavra;
    const btn = document.createElement('button');
    btn.className = 'remove-item-btn';
    btn.innerText = '×';
    btn.title = 'Remover';
    btn.addEventListener('click', () => {
      window.selectedEvocacoes = window.selectedEvocacoes.filter(p => p !== palavra);
      updateSelectedContainer();
      renderTabela();
    });
    li.appendChild(btn);
    selectedListEl.appendChild(li);
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const planilhaNome = urlParams.get("planilha");
  if (!planilhaNome) {
    Swal.fire({ icon: 'error', title: 'Erro!', text: "Parâmetro 'planilha' ausente na URL." });
    return;
  }

  try {
    const data = JSON.parse(localStorage.getItem(`planilha_${planilhaNome}`));
    if (!data || data.length === 0) {
      Swal.fire({ icon: 'error', title: 'Erro!', text: "Nenhum dado encontrado para esta planilha." });
      return;
    }
    currentLematizacoes = await carregarLematizacoes(planilhaNome);
    processarTabela(data);
  } catch (error) {
    console.error("Erro ao carregar a planilha:", error);
  }
});

async function carregarLematizacoes(planilhaNome) {
  const userData = sessionStorage.getItem('user');
  if (!userData) return {};
  try {
    const { uid } = JSON.parse(userData);
    const lematizacoesRef = ref(database, `/users/${uid}/lematizacoes/${planilhaNome}`);
    const snapshot = await get(lematizacoesRef);
    return snapshot.exists() ? snapshot.val() : {};
  } catch (error) {
    console.error("Erro ao carregar lematizações:", error);
    return {};
  }
}

function processarTabela(data) {
  const header = data[0];
  const rows = data.slice(1);

  const palavraContagem = {};
  for (const row of rows) {
    for (let j = 0; j < header.length; j++) {
      const coluna = header[j].toUpperCase();
      if (/^EVOC[1-9]$|^EVOC10$/.test(coluna)) {
        const palavra = (row[j] || "").trim().toUpperCase();
        if (!palavra || palavra === "VAZIO") continue;
        if (!palavraContagem[palavra]) {
          palavraContagem[palavra] = { total: 0, ego: 0, alter: 0 };
        }
        palavraContagem[palavra].total++;
        if (/^EVOC[1-5]$/.test(coluna)) {
          palavraContagem[palavra].ego++;
        } else {
          palavraContagem[palavra].alter++;
        }
      }
    }
  }

  allWords = Object.entries(palavraContagem)
    .sort((a, b) => b[1].total - a[1].total);

  renderTabela();
}

function renderTabela() {
  const termo = currentSearch;
  const lista = termo
    ? allWords.filter(([palavra]) => palavra.includes(termo))
    : allWords;

  const container = document.getElementById("tabela-evocacoes");
  container.innerHTML = "";

  const regexHighlight = new RegExp(`(${termo})`, "gi");
  const start = (currentPage - 1) * ITEMS_PER_PAGE;
  const end = start + ITEMS_PER_PAGE;
  const pageWords = lista.slice(start, end);

  const table = document.createElement("table");
  table.innerHTML = `
    <thead>
      <tr>
        <th></th>
        <th>PALAVRA</th>
        <th>QUANTIDADE TOTAL</th>
        <th>QUANTIDADE ALTER</th>
        <th>QUANTIDADE EGO</th>
        <th>Fusões</th>
      </tr>
    </thead>
    <tbody>
      ${pageWords.map(([palavra, contagem]) => {
        const palavraDestacada = termo
          ? palavra.replace(regexHighlight, `<mark>$1</mark>`)
          : palavra;
        const lema = currentLematizacoes[palavra] || "";
        return `
          <tr>
            <td><input type="checkbox"></td>
            <td>${palavraDestacada}</td>
            <td>${contagem.total}</td>
            <td>${contagem.alter}</td>
            <td>${contagem.ego}</td>
            <td>${lema}</td>
          </tr>
        `;
      }).join("")}
    </tbody>
  `;
  container.appendChild(table);

  // Sincroniza checkboxes com window.selectedEvocacoes
  table.querySelectorAll('tbody tr').forEach((tr, idx) => {
    const checkbox = tr.querySelector('input[type="checkbox"]');
    const palavra = pageWords[idx][0];

    checkbox.checked = window.selectedEvocacoes.includes(palavra);

    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        if (!window.selectedEvocacoes.includes(palavra)) {
          window.selectedEvocacoes.push(palavra);
        }
      } else {
        window.selectedEvocacoes = window.selectedEvocacoes.filter(p => p !== palavra);
      }
      updateSelectedContainer();
    });
  });

  // Atualiza o painel sempre que recarrega a tabela
  updateSelectedContainer();
  renderizarPaginacao(lista.length);
}

function renderizarPaginacao(totalItems) {
  let paginationContainer = document.getElementById("pagination");
  if (!paginationContainer) {
    paginationContainer = document.createElement("div");
    paginationContainer.id = "pagination";
    paginationContainer.classList.add("pagination");
    // Inserir logo após a tabela para melhor posição visual
    const tabela = document.getElementById("tabela-evocacoes");
    tabela.insertAdjacentElement('afterend', paginationContainer);
  }

  paginationContainer.innerHTML = "";
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  const maxPagesToShow = 3; // máximo de botões de página para mostrar

  // Função para criar botão com texto, ativo, desabilitado e listener
  function criarBotao(texto, pagina, ativo = false, desabilitado = false) {
    const btn = document.createElement("button");
    btn.innerText = texto;
    btn.className = "page-btn" + (ativo ? " active" : "");
    btn.disabled = desabilitado;
    if (!desabilitado) {
      btn.addEventListener("click", () => {
        currentPage = pagina;
        renderTabela();
        // Scroll suave para o topo da tabela após trocar página
        document.getElementById("tabela-evocacoes").scrollIntoView({ behavior: "smooth" });
      });
    }
    return btn;
  }

  // Botões especiais: primeira, anterior, próximo, última
  paginationContainer.appendChild(criarBotao("«", 1, false, currentPage === 1));
  paginationContainer.appendChild(criarBotao("‹", currentPage - 1, false, currentPage === 1));

  // Lógica para decidir quais números mostrar:
  let startPage, endPage;
  if (totalPages <= maxPagesToShow) {
    startPage = 1;
    endPage = totalPages;
  } else {
    // Mantém o atual mais 3 antes e 3 depois, dentro dos limites
    startPage = currentPage - 1;
    endPage = currentPage + 1;

    if (startPage < 1) {
      endPage += (1 - startPage);
      startPage = 1;
    }
    if (endPage > totalPages) {
      startPage -= (endPage - totalPages);
      endPage = totalPages;
    }
    if (startPage < 1) startPage = 1;
  }

  // Se startPage > 1, mostra 1 e '...'
  if (startPage > 1) {
    paginationContainer.appendChild(criarBotao("1", 1));
    const dots = document.createElement("span");
    dots.textContent = "...";
    dots.style.padding = "0 8px";
    paginationContainer.appendChild(dots);
  }

  // Números das páginas
  for (let i = startPage; i <= endPage; i++) {
    paginationContainer.appendChild(criarBotao(i, i, i === currentPage));
  }

  // Se endPage < totalPages, mostra '...' e última página
  if (endPage < totalPages) {
    const dots = document.createElement("span");
    dots.textContent = "...";
    dots.style.padding = "0 8px";
    paginationContainer.appendChild(dots);
    paginationContainer.appendChild(criarBotao(totalPages, totalPages));
  }

  // Botões próximo e último
  paginationContainer.appendChild(criarBotao("›", currentPage + 1, false, currentPage === totalPages || totalPages === 0));
  paginationContainer.appendChild(criarBotao("»", totalPages, false, currentPage === totalPages || totalPages === 0));
}

document.getElementById("busca-palavra")?.addEventListener("input", (e) => {
  currentSearch = e.target.value.trim().toUpperCase();
  currentPage = 1;
  renderTabela();
});
