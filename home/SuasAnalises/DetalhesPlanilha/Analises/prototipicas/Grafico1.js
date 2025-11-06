import { verificarEProcessarPlanilha } from "../dashboard/atualizacao.js";

const DB_NAME = 'agoraDB';
const STORE_NAME = 'planilhas';
let allWordsData = []; // Armazena [palavra, {dados}]
let myChart = null; // Referência global ao gráfico

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
  // Garante que Chart.js esteja carregado
  if (typeof Chart === 'undefined') {
    console.error("Chart.js não carregado.");
    Swal.fire('Erro Crítico', 'Não foi possível carregar a biblioteca de gráficos.', 'error');
    return;
  }
  
  // Plugin de anotação não é mais necessário para este gráfico
  // Chart.register(ChartAnnotation); 

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
      return;
    }
    const currentLematizacoes = await getItem(`lemas_${planilhaNome}`) || {};
    
    // Processa os dados (calcula f, ome, etc.)
    allWordsData = await processarDados(data, currentLematizacoes);
    
    // Inicia o gráfico
    iniciarGrafico(allWordsData);

  } catch (error) {
    console.error("Erro ao carregar dados locais:", error);
    Swal.fire({
      icon: 'error',
      title: await window.getTranslation('swal_error_title'),
      text: await window.getTranslation('evocations_data_load_error')
    });
  }
  
  // Adiciona o link de volta (agora botão de download)
  const btnDownload = document.getElementById('btn-download-grafico');
  if (btnDownload) {
      btnDownload.addEventListener('click', baixarGrafico);
  }

  // Adiciona listeners aos filtros
  document.getElementById('freq-filtro-min')?.addEventListener('input', () => iniciarGrafico(allWordsData));
  document.getElementById('freq-filtro-max')?.addEventListener('input', () => iniciarGrafico(allWordsData));
});

/**
 * Processa os dados brutos, calcula f, ome e aplica lemas.
 * Esta função é copiada de prototipicas.js
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
            f: 0, weightedSum: 0, ome: 0,
            evoc1: 0, evoc2: 0, evoc3: 0, evoc4: 0, evoc5: 0,
            evoc6: 0, evoc7: 0, evoc8: 0, evoc9: 0, evoc10: 0
          };
        }
        
        palavraContagem[palavra].f++;
        const evocNum = parseInt(coluna.replace('EVOC', ''), 10);
        palavraContagem[palavra].weightedSum += evocNum;
        palavraContagem[palavra][`evoc${evocNum}`]++;
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
        f: 0, weightedSum: 0, ome: 0,
        evoc1: 0, evoc2: 0, evoc3: 0, evoc4: 0, evoc5: 0,
        evoc6: 0, evoc7: 0, evoc8: 0, evoc9: 0, evoc10: 0
      };

      lema.origem.forEach(palavraOriginalComContagem => {
        const nomeOriginal = palavraOriginalComContagem.split(' (')[0].trim().toUpperCase();
        if (finalContagem[nomeOriginal]) {
          newCounts.f += finalContagem[nomeOriginal].f;
          newCounts.weightedSum += finalContagem[nomeOriginal].weightedSum;
          for (let i = 1; i <= 10; i++) {
            newCounts[`evoc${i}`] += finalContagem[nomeOriginal][`evoc${i}`];
          }
          delete finalContagem[nomeOriginal];
        }
      });
      
      newCounts.ome = (newCounts.f > 0) ? (newCounts.weightedSum / newCounts.f) : 0;
      finalContagem[palavraFundida] = newCounts;
    }
  });

  return Object.entries(finalContagem); // Retorna [ [palavra, {stats}], ... ]
}

/**
 * Inicia e renderiza o gráfico de distribuição (Frequência vs Ranking).
 */
function iniciarGrafico(allWords) {
  const ctx = document.getElementById('graficoPrototipico').getContext('2d');

  if (!allWords || allWords.length === 0) {
    console.warn("Nenhum dado para exibir no gráfico.");
    return;
  }

  // 1. Ler valores dos filtros
  const freqMin = parseFloat(document.getElementById('freq-filtro-min')?.value) || 0;
  const freqMax = parseFloat(document.getElementById('freq-filtro-max')?.value) || Infinity;

  // 2. Filtrar os dados ANTES de ordenar
  const filteredWords = allWords.filter(([, stats]) => {
    const freqMatch = stats.f >= freqMin && (stats.f <= freqMax || freqMax === Infinity);
    return freqMatch;
  });

  // 3. Ordenar por frequência (maior primeiro) para obter o ranking
  const sortedWords = filteredWords.sort(([, statsA], [, statsB]) => statsB.f - statsA.f);
  
  const totalTermos = sortedWords.length;
  const maxFreq = totalTermos > 0 ? sortedWords[0][1].f : 0;

  // 4. Atualizar Título e Subtítulo
  const titleEl = document.getElementById('chart-title');
  const subtitleEl = document.getElementById('chart-subtitle');
  if (titleEl) titleEl.textContent = 'Distribuição dos Termos';
  if (subtitleEl) {
    if (totalTermos > 0) {
      subtitleEl.textContent = `Exibindo ${totalTermos} termo(s) filtrado(s)`;
    } else {
      subtitleEl.textContent = 'Nenhum termo corresponde aos filtros';
    }
  }
  
  // 5. Formatar dados para o gráfico (x: Rank, y: Frequência)
  const dataPoints = sortedWords.map(([palavra, stats], index) => ({
    x: index + 1,  // Rank (iniciando em 1)
    y: stats.f,    // Frequência
    label: palavra // Rótulo para o tooltip
  }));

  // 6. Criar o gráfico
  if (myChart) {
    myChart.destroy(); // Destrói gráfico anterior se existir
  }
  
  myChart = new Chart(ctx, {
    type: 'scatter', // Gráfico de dispersão (pontos)
    data: {
      datasets: [{
        label: 'Termos',
        data: dataPoints,
        backgroundColor: 'rgba(230, 0, 0, 0.7)', // Pontos vermelhos (como na referência)
        borderColor: 'rgba(230, 0, 0, 1)',
        pointRadius: 3,
        pointHoverRadius: 5,
        borderWidth: 0 // Sem linha conectando os pontos
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          type: 'linear',
          position: 'bottom',
          min: 1, // Eixo X começa em 1 (Ranking 1)
          // max: totalTermos, // Deixa o Chart.js definir o máximo dinamicamente
          title: {
            display: true,
            text: 'Ranking',
            font: { size: 14, weight: 'bold' }
          }
        },
        y: {
          min: 0, // Eixo Y começa em 0 (ou 1 se preferir)
          // max: maxFreq, // Deixa o Chart.js calcular o máximo
          title: {
            display: true,
            text: 'Frequência',
            font: { size: 14, weight: 'bold' }
          }
        }
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: function(context) {
              const d = context.raw;
              return `${d.label}: (Ranking: ${d.x}, Frequência: ${d.y})`;
            }
          }
        },
        legend: {
          display: false // Esconde a legenda (como na referência)
        }
        // Remove o plugin 'annotation'
      }
    }
  });
}

/**
 * Função para baixar o gráfico como PNG.
 */
function baixarGrafico() {
  if (!myChart) {
    console.error("Gráfico não inicializado.");
    return;
  }
  const urlParams = new URLSearchParams(window.location.search);
  const planilhaNome = urlParams.get("planilha") || "grafico";
  
  // Define o fundo do canvas como branco para o download
  const canvas = myChart.canvas;
  const ctx = canvas.getContext('2d');
  ctx.save();
  ctx.globalCompositeOperation = 'destination-over';
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
  
  const dataURL = myChart.toBase64Image();
  const link = document.createElement('a');
  link.href = dataURL;
  link.download = `Grafico_Distribuicao_${planilhaNome}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}


// Funções 'updateChartLines' e 'createAnnotations' removidas pois não são mais necessárias