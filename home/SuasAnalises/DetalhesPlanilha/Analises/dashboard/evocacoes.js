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

document.addEventListener("DOMContentLoaded", async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const planilhaNome = urlParams.get("planilha");

  if (!planilhaNome) {
    Swal.fire({
      icon: 'error',
      title: 'Erro!',
      text: "Parâmetro 'planilha' ausente na URL."
    });
    return;
  }

  try {
    const data = JSON.parse(localStorage.getItem(`planilha_${planilhaNome}`));
    if (!data || data.length === 0) {
      console.error("Nenhum dado encontrado no LocalStorage.");
      return;
    }

    const lematizacoes = await carregarLematizacoes(planilhaNome);
    currentLematizacoes = lematizacoes;
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
    if (snapshot.exists()) {
      return snapshot.val();
    } else {
      return {};
    }
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
        } else if (/^EVOC[6-9]$|^EVOC10$/.test(coluna)) {
          palavraContagem[palavra].alter++;
        }
      }
    }
  }

  allWords = Object.entries(palavraContagem)
    .sort((a, b) => b[1].total - a[1].total);

  renderizarTabela();
}

function renderizarTabela() {
  const container = document.getElementById("tabela-evocacoes");
  if (!container) return;
  container.innerHTML = "";

  const start = (currentPage - 1) * ITEMS_PER_PAGE;
  const end = start + ITEMS_PER_PAGE;
  const pageWords = allWords.slice(start, end);

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
        const lema = currentLematizacoes[palavra] ? currentLematizacoes[palavra].join(", ") : "";
        return `
          <tr>
            <td><input type="checkbox"></td>
            <td>${palavra}</td>
            <td>${contagem.total}</td>
            <td>${contagem.alter}</td>
            <td>${contagem.ego}</td>
            <td>${lema}</td>
          </tr>
        `;
      }).join('')}
    </tbody>
  `;

  container.appendChild(table);

  renderizarPaginacao();
}

function renderizarPaginacao() {
  let paginationContainer = document.getElementById('pagination');
  if (!paginationContainer) {
    paginationContainer = document.createElement('div');
    paginationContainer.id = 'pagination';
    paginationContainer.classList.add('pagination');
    document.body.appendChild(paginationContainer);
  }
  paginationContainer.innerHTML = "";

  const totalPages = Math.ceil(allWords.length / ITEMS_PER_PAGE);

  for (let i = 1; i <= totalPages; i++) {
    const btn = document.createElement('button');
    btn.innerText = i;
    btn.className = "page-btn" + (i === currentPage ? " active" : "");
    btn.addEventListener('click', () => {
      currentPage = i;
      renderizarTabela();
    });
    paginationContainer.appendChild(btn);
  }
}
