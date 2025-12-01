import { verificarEProcessarPlanilha } from "../dashboard/atualizacao.js";

const DB_NAME = 'agoraDB';
const STORE_NAME = 'planilhas';
let allWordsData = []; 

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
  showLoading(true);
  
  await verificarEProcessarPlanilha();

  const urlParams = new URLSearchParams(window.location.search);
  const planilhaNome = urlParams.get("planilha");
  if (!planilhaNome) {
    Swal.fire({
      icon: 'error',
      title: await window.getTranslation('swal_error_title'),
      text: await window.getTranslation('dashboard_sheet_param_missing')
    });
    showLoading(false);
    return;
  }

  const nomeEl = document.getElementById("nome-da-planilha");
  if (nomeEl && planilhaNome) nomeEl.textContent = planilhaNome.toUpperCase();

  try {
    const data = await getItem(`planilha_${planilhaNome}`);
    if (!data || data.length === 0) {
      Swal.fire({
        icon: 'error',
        title: await window.getTranslation('swal_error_title'),
        text: await window.getTranslation('evocations_no_data_found')
      });
      showLoading(false);
      return;
    }
    const currentLematizacoes = await getItem(`lemas_${planilhaNome}`) || {};
    
    allWordsData = await processarDados(data, currentLematizacoes);
    
    renderizarQuadrantes();
    
    // Listeners
    document.getElementById('filtro-freq')?.addEventListener('input', renderizarQuadrantes);
    document.getElementById('filtro-ome')?.addEventListener('input', renderizarQuadrantes);
    // Alterado: Agora o input percentual dispara a renderização completa para filtrar os dados
    document.getElementById('input-percentual')?.addEventListener('input', renderizarQuadrantes);

  } catch (error) {
    console.error("Erro ao carregar dados locais:", error);
    Swal.fire({
      icon: 'error',
      title: await window.getTranslation('swal_error_title'),
      text: await window.getTranslation('evocations_data_load_error')
    });
  }
  
  showLoading(false);
});

async function processarDados(data, currentLematizacoes) {
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
          palavraContagem[palavra] = { f: 0, weightedSum: 0, ome: 0 };
        }
        
        palavraContagem[palavra].f++;
        const evocNum = parseInt(coluna.replace('EVOC', ''), 10);
        palavraContagem[palavra].weightedSum += evocNum;
      }
    }
  }

  for (const palavra in palavraContagem) {
    const contagem = palavraContagem[palavra];
    contagem.ome = (contagem.f > 0) ? (contagem.weightedSum / contagem.f) : 0;
  }

  const finalContagem = { ...palavraContagem };
  Object.entries(currentLematizacoes).forEach(([palavraFundida, lema]) => {
    const isNewFormat = lema && typeof lema === 'object' && !Array.isArray(lema) && lema.origem;
    if (isNewFormat) {
      const newCounts = finalContagem[palavraFundida] || { f: 0, weightedSum: 0, ome: 0 };

      lema.origem.forEach(palavraOriginalComContagem => {
        const nomeOriginal = palavraOriginalComContagem.split(' (')[0].trim().toUpperCase();
        if (finalContagem[nomeOriginal]) {
          newCounts.f += finalContagem[nomeOriginal].f;
          newCounts.weightedSum += finalContagem[nomeOriginal].weightedSum;
          delete finalContagem[nomeOriginal];
        }
      });
      
      newCounts.ome = (newCounts.f > 0) ? (newCounts.weightedSum / newCounts.f) : 0;
      finalContagem[palavraFundida] = newCounts;
    }
  });

  return Object.entries(finalContagem);
}

function renderizarQuadrantes() {
  if (allWordsData.length === 0) return;

  // 1. Obtém o valor de corte direto do input (Frequência Menor)
  const valorCorte = parseFloat(document.getElementById('input-percentual').value) || 0;
  
  // Atualiza label visualmente apenas para feedback
  const label = document.getElementById('label-percentual');
  if(label) label.textContent = `Remover f <= ${valorCorte}`;

  const corteFreq = parseFloat(document.getElementById('filtro-freq').value) || 0;
  const corteOME = parseFloat(document.getElementById('filtro-ome').value) || 0;

  // --- Atualiza os cabeçalhos ---
  updateBadges('badges-sup-esq', `f ≥ ${corteFreq}`, `OME < ${corteOME}`);
  updateBadges('badges-sup-dir', `f ≥ ${corteFreq}`, `OME ≥ ${corteOME}`);
  updateBadges('badges-inf-esq', `f < ${corteFreq}`, `OME < ${corteOME}`);
  updateBadges('badges-inf-dir', `f < ${corteFreq}`, `OME ≥ ${corteOME}`);

  const qSupEsq = []; 
  const qSupDir = []; 
  const qInfEsq = []; 
  const qInfDir = []; 

  for (const [palavra, stats] of allWordsData) {
    // FILTRAGEM: Remove termos com frequência MENOR OU IGUAL ao valor definido no input
    if (stats.f <= valorCorte) {
        continue; 
    }

    if (stats.f >= corteFreq) {
      if (stats.ome < corteOME) {
        qSupEsq.push({ palavra, ...stats });
      } else {
        qSupDir.push({ palavra, ...stats });
      }
    } else {
      if (stats.ome < corteOME) {
        qInfEsq.push({ palavra, ...stats });
      } else {
        qInfDir.push({ palavra, ...stats });
      }
    }
  }

  const sortFreqDesc = (a, b) => b.f - a.f || a.ome - b.ome;
  
  qSupEsq.sort(sortFreqDesc); 
  qSupDir.sort(sortFreqDesc);
  qInfEsq.sort(sortFreqDesc);
  qInfDir.sort(sortFreqDesc);

  popularLista('lista-sup-esq', qSupEsq);
  popularLista('lista-sup-dir', qSupDir);
  popularLista('lista-inf-esq', qInfEsq);
  popularLista('lista-inf-dir', qInfDir);
}

/**
 * Atualiza os badges de regra no cabeçalho do card
 */
function updateBadges(containerId, textFreq, textOme) {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = `
            <span class="regra-badge">${textFreq}</span>
            <span class="regra-badge">${textOme}</span>
        `;
    }
}

function popularLista(elementId, lista) {
  const container = document.getElementById(elementId);
  if (!container) return;
  
  container.innerHTML = ''; 
  
  if (lista.length === 0) {
      container.innerHTML = `<div style="text-align:center; color:#999; padding:20px; font-style:italic; font-size:0.9rem;">Nenhum termo atende aos critérios.</div>`;
      return;
  }

  lista.forEach(item => {
      const div = document.createElement('div');
      div.className = 'termo-row';
      
      div.innerHTML = `
        <span class="termo-nome">${item.palavra}</span>
        <div class="termo-metrics">
            <span class="metric-box" title="Frequência Total">
               <i class="fas fa-align-left"></i> ${item.f}
            </span>
            <span class="metric-box" title="Ordem Média de Evocação">
               <i class="fas fa-sort-numeric-down"></i> ${item.ome.toFixed(2)}
            </span>
        </div>
      `;
      container.appendChild(div);
  });
}

function showLoading(isLoading) {
  const loadingEl = document.getElementById('loading');
  if (loadingEl) {
    loadingEl.style.display = isLoading ? 'flex' : 'none';
  }
}