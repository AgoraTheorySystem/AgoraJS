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
  // Garante que Chart.js e o plugin estejam carregados
  if (typeof Chart === 'undefined' || typeof ChartAnnotation === 'undefined') {
    console.error("Chart.js ou chartjs-plugin-annotation não carregados.");
    Swal.fire('Erro Crítico', 'Não foi possível carregar a biblioteca de gráficos.', 'error');
    return;
  }

  // Registra o plugin de anotação
  Chart.register(ChartAnnotation);

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

  // Adiciona listeners aos inputs para atualizar o gráfico
  document.getElementById('freq-corte').addEventListener('change', updateChartLines);
  document.getElementById('ome-corte').addEventListener('change', updateChartLines);
  
  // Adiciona o link de volta correto
  const btnVoltar = document.getElementById('btn-voltar-tabela');
  if (btnVoltar) {
      btnVoltar.href = `prototipicas.html?planilha=${encodeURIComponent(planilhaNome)}`;
  }
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
 * Inicia e renderiza o gráfico de dispersão.
 */
function iniciarGrafico(allWords) {
  const ctx = document.getElementById('graficoPrototipico').getContext('2d');

  if (allWords.length === 0) {
    console.warn("Nenhum dado para exibir no gráfico.");
    return;
  }

  // 1. Calcular médias
  const totalFrequencia = allWords.reduce((sum, [, stats]) => sum + stats.f, 0);
  const totalOme = allWords.reduce((sum, [, stats]) => sum + stats.ome * stats.f, 0); // OME média ponderada pela frequência
  
  const freqMedia = totalFrequencia / allWords.length;
  const omeMedio = (totalFrequencia > 0) ? (totalOme / totalFrequencia) : 0;
  
  // 2. Preencher inputs
  const freqInput = document.getElementById('freq-corte');
  const omeInput = document.getElementById('ome-corte');
  freqInput.value = Math.round(freqMedia); // Frequência média arredondada
  omeInput.value = omeMedio.toFixed(2); // OME média com 2 casas

  // 3. Formatar dados para o gráfico
  const dataPoints = allWords.map(([palavra, stats]) => ({
    x: stats.f,      // Frequência no eixo X
    y: stats.ome,    // OME no eixo Y
    label: palavra   // Rótulo para o tooltip
  }));

  // 4. Criar o gráfico
  myChart = new Chart(ctx, {
    type: 'scatter',
    data: {
      datasets: [{
        label: 'Termos Evocados',
        data: dataPoints,
        backgroundColor: 'rgba(43, 111, 105, 0.7)', // Cor do ponto
        borderColor: 'rgba(43, 111, 105, 1)',
        borderWidth: 1,
        pointRadius: 5,
        pointHoverRadius: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          type: 'linear',
          position: 'bottom',
          title: {
            display: true,
            text: 'Frequência (f)',
            font: { size: 14, weight: 'bold' }
          }
        },
        y: {
          title: {
            display: true,
            text: 'Ordem Média de Evocação (OME)',
            font: { size: 14, weight: 'bold' }
          }
        }
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: function(context) {
              const d = context.raw;
              return `${d.label}: (f: ${d.x}, OME: ${d.y.toFixed(2)})`;
            }
          }
        },
        legend: {
          display: false // Esconde a legenda do dataset
        },
        // Plugin de anotação para as linhas e rótulos
        annotation: {
          annotations: createAnnotations(freqMedia, omeMedio)
        }
      }
    }
  });
}

/**
 * Cria as linhas e rótulos dos quadrantes.
 */
function createAnnotations(freqCorte, omeCorte) {
  // Ajusta a posição dos rótulos para ficarem dentro dos quadrantes
  const maxOme = myChart ? myChart.scales.y.max : omeCorte * 2;
  const maxFreq = myChart ? myChart.scales.x.max : freqCorte * 2;
  
  return {
    // Linha Vertical (Frequência)
    freqLine: {
      type: 'line',
      xMin: freqCorte,
      xMax: freqCorte,
      borderColor: 'rgba(255, 99, 132, 0.8)',
      borderWidth: 2,
      borderDash: [6, 6]
    },
    // Linha Horizontal (OME)
    omeLine: {
      type: 'line',
      yMin: omeCorte,
      yMax: omeCorte,
      borderColor: 'rgba(255, 99, 132, 0.8)',
      borderWidth: 2,
      borderDash: [6, 6]
    },
    // Quadrante 1: Núcleo Central (Baixo OME, Alta Freq)
    labelNucleo: {
      type: 'label',
      xValue: (freqCorte + maxFreq) / 2,
      yValue: (myChart.scales.y.min + omeCorte) / 2,
      content: 'NÚCLEO CENTRAL',
      color: 'rgba(0, 0, 0, 0.3)',
      font: { size: 16, weight: 'bold' }
    },
    // Quadrante 2: Elementos de Contraste (Alto OME, Baixa Freq)
    labelContraste: {
      type: 'label',
      xValue: (myChart.scales.x.min + freqCorte) / 2,
      yValue: (omeCorte + maxOme) / 2,
      content: 'ELEMENTOS DE CONTRASTE',
      color: 'rgba(0, 0, 0, 0.3)',
      font: { size: 16, weight: 'bold' }
    },
    // Quadrante 3: 1ª Periferia (Baixo OME, Baixa Freq)
    labelPeriferia1: {
      type: 'label',
      xValue: (myChart.scales.x.min + freqCorte) / 2,
      yValue: (myChart.scales.y.min + omeCorte) / 2,
      content: 'PERIFERIA',
      color: 'rgba(0, 0, 0, 0.3)',
      font: { size: 16, weight: 'bold' }
    },
    // Quadrante 4: 2ª Periferia (Alto OME, Alta Freq)
    labelPeriferia2: {
      type: 'label',
      xValue: (freqCorte + maxFreq) / 2,
      yValue: (omeCorte + maxOme) / 2,
      content: 'PERIFERIA',
      color: 'rgba(0, 0, 0, 0.3)',
      font: { size: 16, weight: 'bold' }
    }
  };
}

/**
 * Atualiza as linhas de corte no gráfico quando os valores dos inputs mudam.
 */
function updateChartLines() {
  if (!myChart) return;

  const freqCorte = parseFloat(document.getElementById('freq-corte').value) || 0;
  const omeCorte = parseFloat(document.getElementById('ome-corte').value) || 0;

  // Atualiza as anotações
  myChart.options.plugins.annotation.annotations = createAnnotations(freqCorte, omeCorte);
  
  myChart.update();
}