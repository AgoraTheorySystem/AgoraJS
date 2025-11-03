import { verificarEProcessarPlanilha } from "../dashboard/atualizacao.js";

const ITEMS_PER_PAGE = 20;
let currentPage = 1;
let allWords = []; // Armazena [palavra, {dados}]
let currentLematizacoes = {};
let currentSearch = "";
let currentSortColumn = "f"; // Ordenação inicial por frequência total
let currentSortDirection = "desc";

const DB_NAME = 'agoraDB';
const STORE_NAME = 'planilhas';

// --- Funções do IndexedDB ---
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(event.target.error);
  });
}

async function getItem(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).get(key);
    request.onsuccess = (event) => resolve(event.target.result ? event.target.result.value : null);
    request.onerror = (event) => reject(event.target.error);
  });
}

// --- Lógica Principal ---

document.addEventListener("DOMContentLoaded", async () => {
  // Garante que os dados estão baixados e sincronizados ANTES de tentar ler
  await verificarEProcessarPlanilha();

  const urlParams = new URLSearchParams(window.location.search);
  const planilhaNome = urlParams.get("planilha");
  if (!planilhaNome) {
    Swal.fire({
      icon: 'error',
      title: await window.getTranslation('swal_error_title'),
      text: await window.getTranslation('dashboard_sheet_param_missing')
    });
    return;
  }

  // Atualiza nome da planilha no banner
  const nomeEl = document.getElementById("nome-da-planilha");
  if (nomeEl && planilhaNome) nomeEl.textContent = planilhaNome.toUpperCase();

  try {
    // Carrega a planilha e as lematizações do armazenamento local (IndexedDB)
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

/**
 * Processa os dados brutos da planilha, calcula frequências (f, evoc1-10, OME)
 * e aplica as lematizações (fusões).
 */
async function processarTabela(data) {
  const header = data[0];
  const rows = data.slice(1);

  // 1. Calcula contagens para TODAS as palavras brutas
  const palavraContagem = {};
  for (const row of rows) {
    for (let j = 0; j < header.length; j++) {
      const coluna = header[j].toUpperCase();
      // Verifica se a coluna é EVOC1 até EVOC10
      if (/^EVOC[1-9]$|^EVOC10$/.test(coluna)) {
        const palavra = String(row[j] || "").trim().toUpperCase();
        if (!palavra || palavra === "VAZIO") continue;

        // Inicializa o objeto de contagem se a palavra for nova
        if (!palavraContagem[palavra]) {
          palavraContagem[palavra] = {
            f: 0,
            weightedSum: 0, // Soma ponderada para cálculo do OME
            ome: 0,
            evoc1: 0, evoc2: 0, evoc3: 0, evoc4: 0, evoc5: 0,
            evoc6: 0, evoc7: 0, evoc8: 0, evoc9: 0, evoc10: 0
          };
        }
        
        // Incrementa a frequência total (f)
        palavraContagem[palavra].f++;
        
        // Incrementa a frequência da EVOC* específica
        const evocNum = parseInt(coluna.replace('EVOC', ''), 10); // 1, 2, ..., 10
        const evocKey = `evoc${evocNum}`; // "evoc1", "evoc2", ... "evoc10"

        // Adiciona o rank (1, 2, ..., 10) à soma ponderada
        palavraContagem[palavra].weightedSum += evocNum;
        
        if (palavraContagem[palavra].hasOwnProperty(evocKey)) {
          palavraContagem[palavra][evocKey]++;
        }
      }
    }
  }

  // 1.5. Calcula o OME para todas as palavras brutas (antes das fusões)
  for (const palavra in palavraContagem) {
    const contagem = palavraContagem[palavra];
    if (contagem.f > 0) {
      contagem.ome = (contagem.weightedSum / contagem.f);
    } else {
      contagem.ome = 0;
    }
  }

  // 2. Aplica as fusões (lematizações)
  const finalContagem = { ...palavraContagem };
  Object.entries(currentLematizacoes).forEach(([palavraFundida, lema]) => {
    const isNewFormat = lema && typeof lema === 'object' && !Array.isArray(lema) && lema.origem;
    if (isNewFormat) {
      // Pega a contagem da própria palavra fundida (se ela já existir)
      const newCounts = finalContagem[palavraFundida] || {
        f: 0,
        weightedSum: 0,
        ome: 0,
        evoc1: 0, evoc2: 0, evoc3: 0, evoc4: 0, evoc5: 0,
        evoc6: 0, evoc7: 0, evoc8: 0, evoc9: 0, evoc10: 0
      };

      // Itera sobre as palavras de origem da fusão
      lema.origem.forEach(palavraOriginalComContagem => {
        const nomeOriginal = palavraOriginalComContagem.split(' (')[0].trim().toUpperCase();
        if (finalContagem[nomeOriginal]) {
          // Soma as contagens da palavra original na palavra fundida
          newCounts.f += finalContagem[nomeOriginal].f;
          newCounts.weightedSum += finalContagem[nomeOriginal].weightedSum; // Soma as somas ponderadas
          for (let i = 1; i <= 10; i++) {
            newCounts[`evoc${i}`] += finalContagem[nomeOriginal][`evoc${i}`];
          }
          // Remove a palavra original da contagem final
          delete finalContagem[nomeOriginal];
        }
      });
      
      // RECALCULA O OME para a palavra fundida com os totais somados
      if (newCounts.f > 0) {
          newCounts.ome = newCounts.weightedSum / newCounts.f;
      } else {
          newCounts.ome = 0;
      }
      
      // Atribui as contagens somadas à palavra fundida
      finalContagem[palavraFundida] = newCounts;
    }
  });

  allWords = Object.entries(finalContagem);
  renderTabela();
}

/**
 * Renderiza a tabela de prototípicas com os dados processados.
 */
async function renderTabela() {
  const termo = currentSearch;
  let lista = termo
    ? allWords.filter(([palavra]) => palavra.includes(termo))
    : [...allWords];

  // Aplica ordenação
  if (currentSortColumn) {
    lista.sort(([palavraA, contA], [palavraB, contB]) => {
      let valA, valB;

      if (currentSortColumn === "palavra") {
        valA = palavraA;
        valB = palavraB;
      } else if (currentSortColumn === "ome") {
        valA = contA['ome'] || 0; // Usa o OME calculado
        valB = contB['ome'] || 0; // Usa o OME calculado
      } else {
        valA = contA[currentSortColumn];
        valB = contB[currentSortColumn];
      }

      if (typeof valA === "string") {
        return valA.localeCompare(valB) * (currentSortDirection === "asc" ? 1 : -1);
      } else {
        return (valA - valB) * (currentSortDirection === "asc" ? 1 : -1);
      }
    });
  }

  const container = document.getElementById("tabela-prototipicas");
  container.innerHTML = "";

  const regexHighlight = new RegExp(`(${termo})`, "gi");
  const start = (currentPage - 1) * ITEMS_PER_PAGE;
  const end = start + ITEMS_PER_PAGE;
  const pageWords = lista.slice(start, end);

  const table = document.createElement("table");
  table.innerHTML = `
    <thead>
      <tr>
        <th data-col="palavra" class="sortable">Termos</th>
        <th data-col="f" class="sortable">f</th>
        <th data-col="ome" class="sortable">OME</th>
        <th data-col="evoc1" class="sortable">1º</th>
        <th data-col="evoc2" class="sortable">2º</th>
        <th data-col="evoc3" class="sortable">3º</th>
        <th data-col="evoc4" class="sortable">4º</th>
        <th data-col="evoc5" class="sortable">5º</th>
        <th data-col="evoc6" class="sortable">6º</th>
        <th data-col="evoc7" class="sortable">7º</th>
        <th data-col="evoc8" class="sortable">8º</th>
        <th data-col="evoc9" class="sortable">9º</th>
        <th data-col="evoc10" class="sortable">10º</th>
      </tr>
    </thead>
    <tbody>
      ${pageWords.map(([palavra, contagem]) => {
        const palavraDestacada = termo ? palavra.replace(regexHighlight, `<mark>$1</mark>`) : palavra;
        return `
          <tr>
            <td data-label="Termo">${palavraDestacada}</td>
            <td data-label="f">${contagem.f}</td>
            <td data-label="OME">${contagem.ome ? contagem.ome.toFixed(2) : '0.00'}</td>
            <td data-label="1º">${contagem.evoc1}</td>
            <td data-label="2º">${contagem.evoc2}</td>
            <td data-label="3º">${contagem.evoc3}</td>
            <td data-label="4º">${contagem.evoc4}</td>
            <td data-label="5º">${contagem.evoc5}</td>
            <td data-label="6º">${contagem.evoc6}</td>
            <td data-label="7º">${contagem.evoc7}</td>
            <td data-label="8º">${contagem.evoc8}</td>
            <td data-label="9º">${contagem.evoc9}</td>
            <td data-label="10º">${contagem.evoc10}</td>
          </tr>
        `;
      }).join("")}
    </tbody>
  `;
  container.appendChild(table);

  // Adiciona classes de ordenação
  table.querySelectorAll(".sortable").forEach(th => {
    const col = th.getAttribute("data-col");
    th.style.cursor = "pointer";
    th.classList.remove("active-asc", "active-desc");
    if (col === currentSortColumn) {
      th.classList.add(currentSortDirection === "asc" ? "active-asc" : "active-desc");
    }
    // Adiciona listener de clique para ordenação
    th.addEventListener("click", () => {
      if (currentSortColumn === col) {
        currentSortDirection = currentSortDirection === "asc" ? "desc" : "asc";
      } else {
        currentSortColumn = col;
        // Palavra ordena ASC, números ordenam DESC (ou ASC para OME)
        currentSortDirection = (col === "palavra" || col === "ome") ? "asc" : "desc";
      }
      renderTabela();
    });
  });

  renderizarPaginacao(lista.length);
}

/**
 * Renderiza os controles de paginação.
 */
function renderizarPaginacao(totalItems) {
  let paginationContainer = document.getElementById("pagination");
  if (!paginationContainer) return;

  paginationContainer.innerHTML = "";
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  if (totalPages <= 1) return; // Não mostra paginação se só tiver 1 página

  function criarBotao(texto, pagina, ativo = false, desabilitado = false) {
    const btn = document.createElement("button");
    btn.innerText = texto;
    btn.className = "page-btn" + (ativo ? " active" : "");
    btn.disabled = desabilitado;
    if (!desabilitado) {
      btn.addEventListener("click", () => {
        currentPage = pagina;
        renderTabela();
        document.getElementById("tabela-prototipicas").scrollIntoView({ behavior: "smooth" });
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

// Event listener para o campo de busca
document.getElementById("busca-palavra")?.addEventListener("input", (e) => {
  currentSearch = e.target.value.trim().toUpperCase();
  currentPage = 1;
  renderTabela();
});

