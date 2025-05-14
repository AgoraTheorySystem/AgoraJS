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
    document.body.appendChild(paginationContainer);
  }

  paginationContainer.innerHTML = "";
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

  for (let i = 1; i <= totalPages; i++) {
    const btn = document.createElement("button");
    btn.innerText = i;
    btn.className = "page-btn" + (i === currentPage ? " active" : "");
    btn.addEventListener("click", () => {
      currentPage = i;
      renderTabela();
    });
    paginationContainer.appendChild(btn);
  }
}

document.getElementById("busca-palavra")?.addEventListener("input", (e) => {
  currentSearch = e.target.value.trim().toUpperCase();
  currentPage = 1;
  renderTabela();
});
