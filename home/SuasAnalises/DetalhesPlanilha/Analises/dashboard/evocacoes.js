import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/9.9.3/firebase-database.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.9.3/firebase-app.js";
import firebaseConfig from '/firebase.js';
import { verificarEProcessarPlanilha } from "./atualizacao.js";

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

const ITEMS_PER_PAGE = 20;

// --- LÓGICA DE PERSISTÊNCIA: Lê a página inicial e filtros da URL ---
const urlParams = new URLSearchParams(window.location.search);
let currentPage = parseInt(urlParams.get("page")) || 1; 

let allWords = [];
let currentLematizacoes = {};
let currentSearch = "";
let currentSortColumn = "total";
let currentSortDirection = "desc";

const DB_NAME = 'agoraDB';
const STORE_NAME = 'planilhas';

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

async function getItem(key) {
    const db = await openDB();
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(key);

    return new Promise((resolve, reject) => {
        request.onsuccess = (event) => {
            resolve(event.target.result ? event.target.result.value : null);
        };
        request.onerror = (event) => {
            reject(event.target.error);
        };
    });
}

function updateUrlPage(page) {
    const url = new URL(window.location);
    url.searchParams.set('page', page);
    window.history.replaceState({}, '', url);
}

window.selectedEvocacoes = [];

const selectedListEl = document.getElementById('selected-list');
const selectedCountEl = document.getElementById('selected-count');
const clearSelectedBtn = document.getElementById('clear-selected');

if (clearSelectedBtn) {
    clearSelectedBtn.addEventListener('click', () => {
      window.selectedEvocacoes = [];
      updateSelectedContainer();
      renderTabela();
    });
}

function updateSelectedContainer() {
  if (!selectedListEl) return;
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
  await verificarEProcessarPlanilha();

  const planilhaNome = urlParams.get("planilha");
  if (!planilhaNome) {
    Swal.fire({ 
        icon: 'error', 
        title: await window.getTranslation('swal_error_title'), 
        text: await window.getTranslation('dashboard_sheet_param_missing') 
    });
    return;
  }

  try {
    const data = await getItem(`planilha_${planilhaNome}`);
    if (!data || data.length === 0) {
      Swal.fire({ 
          icon: 'error', 
          title: await window.getTranslation('swal_error_title'), 
          text: await window.getTranslation('evocations_no_data_found')
        });
      return;
    }
    currentLematizacoes = await getItem(`lemas_${planilhaNome}`) || {};
    await processarTabela(data);
  } catch (error) {
    console.error("Erro ao carregar dados locais:", error);
    Swal.fire({ 
        icon: 'error', 
        title: await window.getTranslation('swal_error_title'), 
        text: await window.getTranslation('evocations_data_load_error')
    });
  }
});

async function processarTabela(data) {
  const header = data[0];
  const rows = data.slice(1);

  const palavraContagem = {};
  for (const row of rows) {
    for (let j = 0; j < header.length; j++) {
      const coluna = header[j].toUpperCase();
      if (/^EVOC[1-9]$|^EVOC10$/.test(coluna)) {
        const palavra = String(row[j] || "").trim().toUpperCase();
        if (!palavra || palavra === "VAZIO") continue;
        if (!palavraContagem[palavra]) {
          palavraContagem[palavra] = { total: 0, ego: 0, alter: 0, positividade: '', categoria: '' };
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

  const finalContagem = { ...palavraContagem };
  Object.entries(currentLematizacoes).forEach(([palavra, lema]) => {
      const isNewFormat = lema && typeof lema === 'object' && !Array.isArray(lema) && lema.origem;
      if (isNewFormat) {
          finalContagem[palavra] = {
              total: lema.total !== undefined ? lema.total : (finalContagem[palavra]?.total || 0),
              ego: lema.ego !== undefined ? lema.ego : (finalContagem[palavra]?.ego || 0),
              alter: lema.alter !== undefined ? lema.alter : (finalContagem[palavra]?.alter || 0),
              positividade: lema.positividade !== undefined ? lema.positividade : (finalContagem[palavra]?.positividade || ''),
              categoria: lema.categoria !== undefined ? lema.categoria : (finalContagem[palavra]?.categoria || '')
          };
          
          lema.origem.forEach(palavraOriginal => {
              const nomeOriginal = palavraOriginal.split(' (')[0].trim().toUpperCase();
              if (nomeOriginal !== palavra && finalContagem[nomeOriginal]) {
                  delete finalContagem[nomeOriginal];
              }
          });
      }
  });

  allWords = Object.entries(finalContagem);
  renderTabela();
}

async function renderTabela() {
  const termo = currentSearch;
  
  // Lê o estado do filtro "fusoes" da URL
  const urlParams = new URLSearchParams(window.location.search);
  const apenasFusoes = urlParams.get("fusoes") === "true";

  let lista = termo
    ? allWords.filter(([palavra]) => palavra.includes(termo))
    : [...allWords];

  // Filtro de Fusões
  if (apenasFusoes) {
    lista = lista.filter(([palavra]) => {
      const lema = currentLematizacoes[palavra];
      if (lema && typeof lema === 'object' && lema.origem && Array.isArray(lema.origem)) {
        const eUmaFusaoReal = lema.origem.length > 1 || 
                           (lema.origem.length === 1 && lema.origem[0].split(' (')[0].trim().toUpperCase() !== palavra);
        return eUmaFusaoReal;
      }
      return false;
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

  const totalPages = Math.ceil(lista.length / ITEMS_PER_PAGE);
  if (currentPage > totalPages && totalPages > 0) {
      currentPage = totalPages;
      updateUrlPage(currentPage);
  }

  const container = document.getElementById("tabela-evocacoes");
  if (!container) return;
  container.innerHTML = "";

  const regexHighlight = new RegExp(`(${termo})`, "gi");
  const start = (currentPage - 1) * ITEMS_PER_PAGE;
  const end = start + ITEMS_PER_PAGE;
  const pageWords = lista.slice(start, end);

  const header_word = await window.getTranslation('evocations_header_word');
  const header_total_qty = await window.getTranslation('evocations_header_total_qty');
  const header_alter_qty = await window.getTranslation('evocations_header_alter_qty');
  const header_ego_qty = await window.getTranslation('evocations_header_ego_qty');
  const header_merges = await window.getTranslation('evocations_header_merges');

  const table = document.createElement("table");
  table.innerHTML = `
    <thead>
      <tr>
        <th><input type="checkbox" id="select-all-checkbox" /></th>
        <th data-col="palavra" class="sortable">${header_word}</th>
        <th data-col="total" class="sortable">${header_total_qty}</th>
        <th data-col="alter" class="sortable">${header_alter_qty}</th>
        <th data-col="ego" class="sortable">${header_ego_qty}</th>
        <th data-col="positividade" class="sortable">Positividade</th>
        <th data-col="categoria" class="sortable">Categoria</th>
        <th>${header_merges}</th>
      </tr>
    </thead>
    <tbody>
      ${pageWords.map(([palavra, contagem]) => {
        const palavraDestacada = termo ? palavra.replace(regexHighlight, `<mark>$1</mark>`) : palavra;
        const lema = currentLematizacoes[palavra];
        
        let fusaoDisplay = "";
        if (lema && typeof lema === 'object' && lema.origem && Array.isArray(lema.origem)) {
            const eUmaFusaoReal = lema.origem.length > 1 || 
                               (lema.origem.length === 1 && lema.origem[0].split(' (')[0].trim().toUpperCase() !== palavra);

            if (eUmaFusaoReal) {
                 fusaoDisplay = lema.origem.join(", ");
            }
        }
        
        const isSelected = window.selectedEvocacoes.includes(palavra);
        return `
          <tr class="${isSelected ? 'selected' : ''}">
            <td><input type="checkbox" ${isSelected ? 'checked' : ''}></td>
            <td>${palavraDestacada}</td>
            <td>${contagem.total}</td>
            <td>${contagem.alter}</td>
            <td>${contagem.ego}</td>
            <td>${contagem.positividade || ''}</td>
            <td>${contagem.categoria || ''}</td>
            <td>${fusaoDisplay}</td>
          </tr>
        `;
      }).join("")}
    </tbody>
  `;
  container.appendChild(table);

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

  table.querySelectorAll('tbody tr').forEach((tr, idx) => {
    const checkbox = tr.querySelector('input[type="checkbox"]');
    const palavra = pageWords[idx][0];
    
    const handleSelection = (isRowClick) => {
        if (isRowClick) {
            checkbox.checked = !checkbox.checked;
        }
        
        const isChecked = checkbox.checked;

        if (isChecked) {
            if (!window.selectedEvocacoes.includes(palavra)) {
                window.selectedEvocacoes.push(palavra);
            }
        } else {
            window.selectedEvocacoes = window.selectedEvocacoes.filter(p => p !== palavra);
        }
        
        tr.classList.toggle('selected', isChecked);
        updateSelectedContainer();
        
        if (selectAllCheckbox) {
            const todasPalavrasVisiveis = pageWords.map(([p]) => p);
            const todasSelecionadas = todasPalavrasVisiveis.every(p => window.selectedEvocacoes.includes(p));
            const algumaSelecionada = todasPalavrasVisiveis.some(p => window.selectedEvocacoes.includes(p));
            selectAllCheckbox.checked = todasSelecionadas;
            selectAllCheckbox.indeterminate = !todasSelecionadas && algumaSelecionada;
        }
    };

    checkbox.addEventListener('change', () => {
        handleSelection(false);
    });

    tr.addEventListener('click', (e) => {
        if (e.target.tagName === 'INPUT') return;
        handleSelection(true);
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

  function criarBotao(texto, pagina, ativo = false, desabilitado = false) {
    const btn = document.createElement("button");
    btn.innerText = texto;
    btn.className = "page-btn" + (ativo ? " active" : "");
    btn.disabled = desabilitado;
    if (!desabilitado) {
      btn.addEventListener("click", () => {
        currentPage = pagina;
        updateUrlPage(pagina);
        renderTabela();
        document.getElementById("tabela-evocacoes").scrollIntoView({ behavior: "smooth" });
      });
    }
    return btn;
  }

  if (totalPages <= 1) return;

  paginationContainer.appendChild(criarBotao("«", 1, false, currentPage === 1));
  paginationContainer.appendChild(criarBotao("‹", currentPage - 1, false, currentPage === 1));

  let startPage = Math.max(1, currentPage - 1);
  let endPage = Math.min(totalPages, currentPage + 1);
  if (startPage > 1) {
    paginationContainer.appendChild(criarBotao("1", 1));
    if (startPage > 2) paginationContainer.appendChild(document.createTextNode("..."));
  }
  for (let i = startPage; i <= endPage; i++) {
    paginationContainer.appendChild(criarBotao(i, i, i === currentPage));
  }
  if (endPage < totalPages) {
    if (endPage < totalPages - 1) paginationContainer.appendChild(document.createTextNode("..."));
    paginationContainer.appendChild(criarBotao(totalPages, totalPages));
  }

  paginationContainer.appendChild(criarBotao("›", currentPage + 1, false, currentPage === totalPages));
  paginationContainer.appendChild(criarBotao("»", totalPages, false, currentPage === totalPages));
}

document.getElementById("busca-palavra")?.addEventListener("input", (e) => {
  currentSearch = e.target.value.trim().toUpperCase();
  currentPage = 1;
  updateUrlPage(1);
  renderTabela();
});

window.addEventListener("atualizarTabelaEvocacoes", () => {
  renderTabela();
});

(() => {
  const params = new URLSearchParams(window.location.search);
  const planilha = params.get("planilha") || "";

  const nomeEl = document.getElementById("nome-da-planilha");
  if (nomeEl && planilha) nomeEl.textContent = planilha.toUpperCase();

  const withPlanilha = (href) => {
    const url = new URL(href, window.location.origin);
    if (planilha) url.searchParams.set("planilha", planilha);
    return url.pathname + url.search;
  };

  const map = {
    "link-dashboard": "./dashboard.html",
    "link-agora": "./agora.html",
    "link-evocacoes": "./evocacoes.html",
    "link-formar": "./formaragora.html",
    "link-mapa": "./mapa.html",
  };
  Object.entries(map).forEach(([id, base]) => {
    const a = document.getElementById(id);
    if (a) a.setAttribute("href", withPlanilha(base));
  });

  const ev = document.getElementById("link-evocacoes");
  if (ev) ev.classList.add("active");
})();