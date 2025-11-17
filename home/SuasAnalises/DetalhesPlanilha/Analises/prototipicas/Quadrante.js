import { verificarEProcessarPlanilha } from "../dashboard/atualizacao.js";

const DB_NAME = 'agoraDB';
const STORE_NAME = 'planilhas';
let allWordsData = []; // Armazena [palavra, {dados}] - COMPARTILHADO

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
    
    // Processa os dados (calcula f, ome, etc.) UMA VEZ
    allWordsData = await processarDados(data, currentLematizacoes);
    
    // Inicia a renderização dos quadrantes
    renderizarQuadrantes();
    
    // Adiciona listeners aos filtros
    document.getElementById('filtro-freq')?.addEventListener('input', renderizarQuadrantes);
    document.getElementById('filtro-ome')?.addEventListener('input', renderizarQuadrantes);
    document.getElementById('input-percentual')?.addEventListener('input', calcularPercentual);


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

/**
 * Processa os dados brutos, calcula f, ome e aplica lemas.
 * (Reutilizado de prototipicas.js)
 */
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
          palavraContagem[palavra] = {
            f: 0, weightedSum: 0, ome: 0
            // Otimizado para não calcular evoc1-10 se não for necessário
          };
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
      const newCounts = finalContagem[palavraFundida] || {
        f: 0, weightedSum: 0, ome: 0
      };

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

  // Retorna [ [palavra, {f, ome, ...}], ... ]
  return Object.entries(finalContagem);
}


/**
 * Renderiza os quatro quadrantes com base nos filtros
 */
function renderizarQuadrantes() {
  if (allWordsData.length === 0) return; // Não faz nada se não houver dados

  // 1. Obter valores dos filtros
  const corteFreq = parseFloat(document.getElementById('filtro-freq').value) || 0;
  const corteOME = parseFloat(document.getElementById('filtro-ome').value) || 0;

  // 2. Atualizar títulos dos quadrantes
  document.getElementById('titulo-sup-esq').textContent = `OME < ${corteOME}`;
  document.getElementById('titulo-sup-dir').textContent = `OME >= ${corteOME}`;
  // Os títulos inferiores (f < corteFreq) estão ocultos via CSS, mas poderiam ser atualizados se visíveis
  document.getElementById('titulo-inf-esq').textContent = `f < ${corteFreq}`;
  document.getElementById('titulo-inf-dir').textContent = `f < ${corteFreq}`;

  // 3. Preparar listas para cada quadrante
  const qSupEsq = []; // Núcleo Central: f >= corte, ome < corte
  const qSupDir = []; // Contraste:     f >= corte, ome >= corte
  const qInfEsq = []; // Periferia:     f < corte,  ome < corte
  const qInfDir = []; // Contraste:     f < corte,  ome >= corte

  // 4. Distribuir palavras
  for (const [palavra, stats] of allWordsData) {
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

  // 5. Ordenar listas (Ex: por OME no núcleo, por Frequência na periferia)
  // Ordena pela Frequência (maior primeiro) e depois OME (menor primeiro)
  const sortFunction = (a, b) => {
    if (b.f !== a.f) {
        return b.f - a.f; // Maior frequência primeiro
    }
    return a.ome - b.ome; // Menor OME (mais importante) primeiro
  };

  qSupEsq.sort(sortFunction);
  qSupDir.sort(sortFunction);
  qInfEsq.sort(sortFunction);
  qInfDir.sort(sortFunction);

  // 6. Renderizar listas no HTML
  popularLista('lista-sup-esq', qSupEsq);
  popularLista('lista-sup-dir', qSupDir);
  popularLista('lista-inf-esq', qInfEsq);
  popularLista('lista-inf-dir', qInfDir);

  // 7. Atualizar cálculo de percentual
  calcularPercentual();
}

/**
 * Preenche uma <ul> com a lista de palavras
 */
function popularLista(elementId, lista) {
  const ul = document.getElementById(elementId);
  if (!ul) return;
  ul.innerHTML = lista.map(item => `<li>${item.palavra}</li>`).join('');
}

/**
 * Calcula o percentual (como no print)
 */
function calcularPercentual() {
    const inputVal = parseFloat(document.getElementById('input-percentual').value) || 0;
    const label = document.getElementById('label-percentual');

    if (allWordsData.length === 0) {
        label.textContent = `(%) ≅ 0.00 (abs)`;
        return;
    }

    // Calcula o total de evocações (frequência total)
    const totalFrequencia = allWordsData.reduce((sum, [, stats]) => sum + stats.f, 0);
    
    if (totalFrequencia === 0) {
        label.textContent = `(%) ≅ 0.00 (abs)`;
        return;
    }

    const percentual = (inputVal / totalFrequencia) * 100;
    label.textContent = `(%) ≅ ${percentual.toFixed(2)} (abs)`;
}

/**
 * Controla o indicador de loading
 */
function showLoading(isLoading) {
  const loadingEl = document.getElementById('loading');
  if (loadingEl) {
    loadingEl.style.display = isLoading ? 'flex' : 'none';
  }
}