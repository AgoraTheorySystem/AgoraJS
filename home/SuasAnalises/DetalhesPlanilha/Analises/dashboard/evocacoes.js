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
let currentSortColumn = null;
let currentSortDirection = "desc";

// Filtro de fusões
window.filtroFusoes = false;
window.selectedEvocacoes = [];

const selectedListEl = document.getElementById('selected-list');
const selectedCountEl = document.getElementById('selected-count');
const clearSelectedBtn = document.getElementById('clear-selected');

clearSelectedBtn.addEventListener('click', () => {
  window.selectedEvocacoes = [];
  updateSelectedContainer();
  renderTabela();
});

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

  allWords = Object.entries(palavraContagem);
  renderTabela();
}

function renderTabela() {
  const termo = currentSearch;
  let lista = termo
    ? allWords.filter(([palavra]) => palavra.includes(termo))
    : [...allWords];

  if (window.filtroFusoes) {
    lista = lista.filter(([palavra]) => {
      const lema = currentLematizacoes[palavra];
      return Array.isArray(lema) && lema.length > 0;
    });
  }

  if (currentSortColumn) {
    lista.sort(([palavraA, contA], [palavraB, contB]) => {
      let valA = currentSortColumn === "palavra" ? palavraA : contA[currentSortColumn];
      let valB = currentSortColumn === "palavra" ? palavraB : contB[currentSortColumn];
      if (typeof valA === "string") {
        valA = valA.toUpperCase();
        valB = valB.toUpperCase();
      }
      if (valA < valB) return currentSortDirection === "asc" ? -1 : 1;
      if (valA > valB) return currentSortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }

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
        <th><input type="checkbox" id="select-all-checkbox" /></th>
        <th data-col="palavra" class="sortable">PALAVRA</th>
        <th data-col="total" class="sortable">QUANTIDADE TOTAL</th>
        <th data-col="alter" class="sortable">QUANTIDADE ALTER</th>
        <th data-col="ego" class="sortable">QUANTIDADE EGO</th>
        <th>Fusões</th>
      </tr>
    </thead>
    <tbody>
      ${pageWords.map(([palavra, contagem]) => {
        const palavraDestacada = termo ? palavra.replace(regexHighlight, `<mark>$1</mark>`) : palavra;
        const lema = currentLematizacoes[palavra] || "";
        return `
          <tr>
            <td><input type="checkbox"></td>
            <td>${palavraDestacada}</td>
            <td>${contagem.total}</td>
            <td>${contagem.alter}</td>
            <td>${contagem.ego}</td>
            <td>${Array.isArray(lema) ? lema.join(", ") : lema}</td>
          </tr>
        `;
      }).join("")}
    </tbody>
  `;
  container.appendChild(table);

  // Checkbox "Selecionar todas"
  const selectAllCheckbox = table.querySelector('#select-all-checkbox');
  if (selectAllCheckbox) {
    const todasPalavrasVisiveis = pageWords.map(([palavra]) => palavra);
    const todasSelecionadas = todasPalavrasVisiveis.every(p => window.selectedEvocacoes.includes(p));
    const algumaSelecionada = todasPalavrasVisiveis.some(p => window.selectedEvocacoes.includes(p));

    selectAllCheckbox.checked = todasSelecionadas;
    selectAllCheckbox.indeterminate = !todasSelecionadas && algumaSelecionada;

    selectAllCheckbox.addEventListener('change', () => {
      if (selectAllCheckbox.checked) {
        todasPalavrasVisiveis.forEach(p => {
          if (!window.selectedEvocacoes.includes(p)) {
            window.selectedEvocacoes.push(p);
          }
        });
      } else {
        window.selectedEvocacoes = window.selectedEvocacoes.filter(p => !todasPalavrasVisiveis.includes(p));
      }
      updateSelectedContainer();
      renderTabela();
    });
  }

  // Ordenação
  table.querySelectorAll(".sortable").forEach(th => {
    const col = th.getAttribute("data-col");
    th.style.cursor = "pointer";
    th.classList.remove("active-asc", "active-desc");
    if (col === currentSortColumn) {
      th.classList.add(currentSortDirection === "asc" ? "active-asc" : "active-desc");
    }
    th.addEventListener("click", () => {
      if (currentSortColumn === col) {
        currentSortDirection = currentSortDirection === "asc" ? "desc" : "asc";
      } else {
        currentSortColumn = col;
        currentSortDirection = "asc";
      }
      renderTabela();
    });
  });

  // Checkboxes individuais
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

  updateSelectedContainer();
  renderizarPaginacao(lista.length);
}

function renderizarPaginacao(totalItems) {
  let paginationContainer = document.getElementById("pagination");
  if (!paginationContainer) {
    paginationContainer = document.createElement("div");
    paginationContainer.id = "pagination";
    paginationContainer.classList.add("pagination");
    const tabela = document.getElementById("tabela-evocacoes");
    tabela.insertAdjacentElement('afterend', paginationContainer);
  }

  paginationContainer.innerHTML = "";
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  const maxPagesToShow = 3;

  function criarBotao(texto, pagina, ativo = false, desabilitado = false) {
    const btn = document.createElement("button");
    btn.innerText = texto;
    btn.className = "page-btn" + (ativo ? " active" : "");
    btn.disabled = desabilitado;
    if (!desabilitado) {
      btn.addEventListener("click", () => {
        currentPage = pagina;
        renderTabela();
        document.getElementById("tabela-evocacoes").scrollIntoView({ behavior: "smooth" });
      });
    }
    return btn;
  }

  paginationContainer.appendChild(criarBotao("«", 1, false, currentPage === 1));
  paginationContainer.appendChild(criarBotao("‹", currentPage - 1, false, currentPage === 1));

  let startPage = Math.max(1, currentPage - 1);
  let endPage = Math.min(totalPages, currentPage + 1);
  if (startPage > 1) {
    paginationContainer.appendChild(criarBotao("1", 1));
    paginationContainer.appendChild(document.createTextNode("..."));
  }
  for (let i = startPage; i <= endPage; i++) {
    paginationContainer.appendChild(criarBotao(i, i, i === currentPage));
  }
  if (endPage < totalPages) {
    paginationContainer.appendChild(document.createTextNode("..."));
    paginationContainer.appendChild(criarBotao(totalPages, totalPages));
  }

  paginationContainer.appendChild(criarBotao("›", currentPage + 1, false, currentPage === totalPages));
  paginationContainer.appendChild(criarBotao("»", totalPages, false, currentPage === totalPages));
}

document.getElementById("busca-palavra")?.addEventListener("input", (e) => {
  currentSearch = e.target.value.trim().toUpperCase();
  currentPage = 1;
  renderTabela();
});

window.addEventListener("atualizarTabelaEvocacoes", () => {
  renderTabela();
});
