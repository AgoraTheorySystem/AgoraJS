import { verificarEProcessarPlanilha } from "../dashboard/atualizacao.js";

const DB_NAME = 'agoraDB';
const STORE_NAME = 'planilhas';
let allWordsData = []; // Armazena [palavra, {dados}]
let myChartTopN = null; 
let myChartOME = null; 
let myChartRank = null; 
let myChartDist = null; 

// Controle de Evoc
let currentEvocRange = localStorage.getItem('agora_evoc_range') || '1-5';
let rawData = [];
let currentLemas = {};

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
  if (typeof Chart === 'undefined') {
    console.error("Chart.js não carregado.");
    Swal.fire('Erro Crítico', 'Não foi possível carregar a biblioteca de gráficos.', 'error');
    return;
  }
  
  if (typeof ChartAnnotation !== 'undefined') {
    Chart.register(ChartAnnotation);
  } else {
     setTimeout(() => {
        if (typeof ChartAnnotation !== 'undefined') {
            Chart.register(ChartAnnotation);
        } else {
            console.warn("Plugin Chart.js Annotation não carregado.");
        }
     }, 500);
  }

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

  // Sincroniza o estado inicial do switch com o localStorage
  const switchEl = document.getElementById('evoc-switch');
  if (switchEl) {
    switchEl.checked = (currentEvocRange === '6-10');
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
    currentLemas = await getItem(`lemas_${planilhaNome}`) || {};
    rawData = data;
    
    // Processa a primeira vez
    allWordsData = await processarDados(rawData, currentLemas);
    
    iniciarGraficoDistribuicao(allWordsData); 
    iniciarGraficoTopN(allWordsData);
    iniciarGraficoOME(allWordsData);
    iniciarGraficoRank(allWordsData);

    // Event listener do Switch EVOC
    document.getElementById('evoc-switch')?.addEventListener('change', async (e) => {
      currentEvocRange = e.target.checked ? '6-10' : '1-5';
      localStorage.setItem('agora_evoc_range', currentEvocRange); // Salva a preferência
      
      const loadingDiv = document.getElementById("loading");
      if (loadingDiv) loadingDiv.style.display = 'block';

      setTimeout(async () => {
        allWordsData = await processarDados(rawData, currentLemas);
        iniciarGraficoDistribuicao(allWordsData); 
        iniciarGraficoTopN(allWordsData);
        iniciarGraficoOME(allWordsData);
        iniciarGraficoRank(allWordsData);
        if (loadingDiv) loadingDiv.style.display = 'none';
      }, 50);
    });

  } catch (error) {
    console.error("Erro ao carregar dados locais:", error);
    Swal.fire({
      icon: 'error',
      title: await window.getTranslation('swal_error_title'),
      text: await window.getTranslation('evocations_data_load_error')
    });
  }
  
  // Listeners de Download
  document.getElementById('btn-download-grafico-dist')?.addEventListener('click', () => 
    baixarGrafico(myChartDist, `Grafico_Distribuicao_${planilhaNome}`)
  );
  document.getElementById('btn-download-grafico-top-n')?.addEventListener('click', () => 
    baixarGrafico(myChartTopN, `Grafico_TopN_${planilhaNome}`)
  );
  document.getElementById('btn-download-grafico-ome')?.addEventListener('click', () => 
    baixarGrafico(myChartOME, `Grafico_QuatroCasas_${planilhaNome}`)
  );
  document.getElementById('btn-download-grafico-rank')?.addEventListener('click', () => 
    baixarGrafico(myChartRank, `Grafico_Rank_${planilhaNome}`)
  );

  // Filtros
  document.getElementById('freq-filtro-min-dist')?.addEventListener('input', () => iniciarGraficoDistribuicao(allWordsData));
  document.getElementById('freq-filtro-max-dist')?.addEventListener('input', () => iniciarGraficoDistribuicao(allWordsData));
  document.getElementById('top-n-select')?.addEventListener('change', () => iniciarGraficoTopN(allWordsData));
  document.getElementById('freq-filtro-min-ome')?.addEventListener('input', () => iniciarGraficoOME(allWordsData));
  document.getElementById('ome-filtro-min-ome')?.addEventListener('input', () => iniciarGraficoOME(allWordsData));
  document.getElementById('ome-filtro-max-ome')?.addEventListener('input', () => iniciarGraficoOME(allWordsData));
});

/**
 * Processa os dados brutos, baseados no currentEvocRange escolhido no Switch.
 */
async function processarDados(data, currentLematizacoes) {
  const header = data[0];
  const rows = data.slice(1);
  const palavraContagem = {};

  for (const row of rows) {
    for (let j = 0; j < header.length; j++) {
      const coluna = header[j].toUpperCase();
      if (/^EVOC[1-9]$|^EVOC10$/.test(coluna)) {
        const evocNum = parseInt(coluna.replace('EVOC', ''), 10);
        
        let isColumnInRange = false;
        if (currentEvocRange === '1-5' && evocNum >= 1 && evocNum <= 5) isColumnInRange = true;
        if (currentEvocRange === '6-10' && evocNum >= 6 && evocNum <= 10) isColumnInRange = true;

        if (!isColumnInRange) continue;

        const palavra = String(row[j] || "").trim().toUpperCase();
        if (!palavra || palavra === "VAZIO") continue;

        if (!palavraContagem[palavra]) {
          palavraContagem[palavra] = {
            f: 0, weightedSum: 0, ome: 0,
            evoc1: 0, evoc2: 0, evoc3: 0, evoc4: 0, evoc5: 0,
            evoc6: 0, evoc7: 0, evoc8: 0, evoc9: 0, evoc10: 0
          };
        }
        
        // Ajusta o peso da evocação: Se for 6-10, diminui 5 para o peso ficar entre 1 e 5
        let pesoEvoc = evocNum;
        if (currentEvocRange === '6-10') {
          pesoEvoc = evocNum - 5;
        }

        palavraContagem[palavra].f++;
        palavraContagem[palavra].weightedSum += pesoEvoc;
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

  return Object.entries(finalContagem); 
}

function iniciarGraficoDistribuicao(allWords) {
  const ctx = document.getElementById('graficoPrototipicoDist')?.getContext('2d');
  if (!ctx) return;

  if (!allWords || allWords.length === 0) {
    if (myChartDist) myChartDist.destroy();
    return;
  }

  const freqMin = parseFloat(document.getElementById('freq-filtro-min-dist')?.value) || 0;
  const freqMaxInput = document.getElementById('freq-filtro-max-dist');
  const freqMax = freqMaxInput && freqMaxInput.value ? parseFloat(freqMaxInput.value) : Infinity;

  const filtersAreEmpty = (freqMin === 0 && freqMax === Infinity);

  const filteredWords = allWords.filter(([, stats]) => {
    const freqMatch = stats.f >= freqMin && (stats.f <= freqMax || freqMax === Infinity);
    return freqMatch;
  });

  const sortedWords = filteredWords.sort(([, statsA], [, statsB]) => statsB.f - statsA.f);
  
  const wordsForChart = filtersAreEmpty ? sortedWords.slice(0, 100) : sortedWords;
  const totalTermos = wordsForChart.length;

  const subtitleEl = document.getElementById('chart-subtitle-dist');
  if (subtitleEl) {
    if (filtersAreEmpty) {
      subtitleEl.textContent = `Exibindo os Top 100 termos (de ${allWords.length} no total). Defina um filtro de frequência para ver mais.`;
    } else if (totalTermos > 0) {
      subtitleEl.textContent = `Exibindo ${totalTermos} termo(s) filtrado(s)`;
    } else {
      subtitleEl.textContent = 'Nenhum termo corresponde aos filtros';
    }
  }
  
  const dataPoints = wordsForChart.map(([palavra, stats], index) => ({
    x: index + 1,  
    y: stats.f,    
    label: palavra 
  }));

  if (myChartDist) {
    myChartDist.destroy();
  }
  
  myChartDist = new Chart(ctx, {
    type: 'scatter', 
    data: {
      datasets: [{
        label: 'Termos',
        data: dataPoints,
        backgroundColor: 'rgba(54, 162, 235, 0.7)', 
        borderColor: 'rgba(54, 162, 235, 1)',
        pointRadius: 4, 
        pointHoverRadius: 6, 
        borderWidth: 0 
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          type: 'linear',
          position: 'bottom',
          min: 1, 
          max: filtersAreEmpty ? 100 : undefined, 
          title: {
            display: true,
            text: 'Ranking (Ordem de Frequência)',
            font: { size: 14, weight: 'bold' }
          }
        },
        y: {
          min: 0, 
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
        legend: { display: false }
      }
    }
  });
}

function iniciarGraficoTopN(allWords) {
  const ctx = document.getElementById('graficoTopN')?.getContext('2d');
  if (!ctx) return;

  if (!allWords || allWords.length === 0) {
    if (myChartTopN) myChartTopN.destroy();
    return;
  }

  const topNValue = parseInt(document.getElementById('top-n-select')?.value) || 15;
  const sortedWords = [...allWords].sort(([, statsA], [, statsB]) => statsB.f - statsA.f);
  const topWords = sortedWords.slice(0, topNValue);

  const labels = topWords.map(([palavra]) => palavra);
  const data = topWords.map(([, stats]) => stats.f);

  if (myChartTopN) {
    myChartTopN.destroy();
  }

  myChartTopN = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Frequência Total',
        data: data,
        backgroundColor: 'rgba(43, 111, 105, 0.7)',
        borderColor: 'rgba(43, 111, 105, 1)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      scales: {
        x: {
          beginAtZero: true,
          title: { display: true, text: 'Frequência Total' }
        },
        y: {
          ticks: { autoSkip: false }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(context) { return ` Frequência: ${context.raw}`; }
          }
        }
      }
    }
  });
}

function iniciarGraficoOME(allWords) {
  const ctx = document.getElementById('graficoOME')?.getContext('2d');
  if (!ctx) return;

  if (!allWords || allWords.length === 0) {
    if (myChartOME) myChartOME.destroy();
    return;
  }
  
  const freqMin = parseFloat(document.getElementById('freq-filtro-min-ome')?.value) || 0;
  const omeMin = parseFloat(document.getElementById('ome-filtro-min-ome')?.value) || 0;
  const omeMax = parseFloat(document.getElementById('ome-filtro-max-ome')?.value) || Infinity;

  const filteredWords = allWords.filter(([, stats]) => {
    const freqMatch = stats.f >= freqMin;
    const omeMatch = stats.ome >= omeMin && (stats.ome <= omeMax || omeMax === Infinity);
    return freqMatch && omeMatch;
  });

  const totalTermos = filteredWords.length;
  let mediaFreq = 0;
  let mediaOME = 0;
  
  if (totalTermos > 0) {
      mediaFreq = filteredWords.reduce((sum, [, stats]) => sum + stats.f, 0) / totalTermos;
      mediaOME = filteredWords.reduce((sum, [, stats]) => sum + stats.ome, 0) / totalTermos;
  }

  const subtitleEl = document.getElementById('chart-subtitle-ome');
  if (subtitleEl) {
    if (totalTermos > 0) {
      subtitleEl.textContent = `Exibindo ${totalTermos} termo(s). Cortes: Freq. Média (${mediaFreq.toFixed(2)}), OME Médio (${mediaOME.toFixed(2)})`;
    } else {
      subtitleEl.textContent = 'Nenhum termo corresponde aos filtros';
    }
  }

  const dataPoints = filteredWords.map(([palavra, stats]) => ({
    x: stats.ome,    
    y: stats.f,      
    label: palavra   
  }));

  if (myChartOME) {
    myChartOME.destroy(); 
  }
  
  myChartOME = new Chart(ctx, {
    type: 'scatter',
    data: {
      datasets: [{
        label: 'Termos',
        data: dataPoints,
        backgroundColor: 'rgba(230, 0, 0, 0.7)', 
        borderColor: 'rgba(230, 0, 0, 1)',
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
            text: 'Ordem Média de Evocação (OME) - (Menor = Mais Importante)',
            font: { size: 14, weight: 'bold' }
          }
        },
        y: {
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
              return `${d.label}: (OME: ${d.x.toFixed(2)}, Freq: ${d.y})`;
            }
          }
        },
        legend: { display: false },
        annotation: (typeof ChartAnnotation !== 'undefined') ? {
          annotations: {
            lineFreq: {
              type: 'line',
              yMin: mediaFreq,
              yMax: mediaFreq,
              borderColor: 'rgba(255, 99, 132, 0.8)',
              borderWidth: 2,
              borderDash: [6, 6],
              label: {
                content: `Freq. Média (${mediaFreq.toFixed(2)})`,
                enabled: true,
                position: 'start',
                backgroundColor: 'rgba(255, 99, 132, 0.7)',
                font: { size: 10 }
              }
            },
            lineOME: {
              type: 'line',
              xMin: mediaOME,
              xMax: mediaOME,
              borderColor: 'rgba(54, 162, 235, 0.8)',
              borderWidth: 2,
              borderDash: [6, 6],
              label: {
                content: `OME Médio (${mediaOME.toFixed(2)})`,
                enabled: true,
                position: 'start',
                backgroundColor: 'rgba(54, 162, 235, 0.7)',
                font: { size: 10 },
                rotation: -90
              }
            }
          }
        } : {}
      }
    }
  });
}

function iniciarGraficoRank(allWords) {
  const ctx = document.getElementById('graficoRank')?.getContext('2d');
  if (!ctx) return;

  if (!allWords || allWords.length === 0) {
    if (myChartRank) myChartRank.destroy();
    return;
  }

  const sortedWords = [...allWords].sort(([, statsA], [, statsB]) => statsB.f - statsA.f);
  const top5Words = sortedWords.slice(0, 5);

  const labels = top5Words.map(([palavra]) => palavra);
  
  const rankColors = [
      '#3366CC', // 1ª Posição (Azul)
      '#DC3912', // 2ª Posição (Vermelho)
      '#FF9900', // 3ª Posição (Laranja)
      '#109618', // 4ª Posição (Verde)
      '#990099', // 5ª Posição (Roxo)
      '#0099C6', // 6ª Posição (Ciano)
      '#DD4477', // 7ª Posição (Rosa)
      '#66AA00', // 8ª Posição (Verde-Oliva)
      '#B82E2E', // 9ª Posição (Vinho)
      '#316395'  // 10ª Posição (Azul Escuro)
  ];

  // Define as posições iniciais e finais dinamicamente
  const startIdx = currentEvocRange === '1-5' ? 1 : 6;
  const endIdx = currentEvocRange === '1-5' ? 5 : 10;
  
  const datasets = [];
  for (let i = startIdx; i <= endIdx; i++) {
      datasets.push({
          label: `${i}ª Posição`,
          data: top5Words.map(([, stats]) => stats[`evoc${i}`]),
          backgroundColor: rankColors[i - 1], // Usa a cor respectiva global
          borderColor: rankColors[i - 1],
          borderWidth: 1
      });
  }

  if (myChartRank) {
    myChartRank.destroy();
  }

  myChartRank = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          title: { display: true, text: 'Top 5 Termos Mais Frequentes' }
        },
        y: {
          beginAtZero: true,
          title: { display: true, text: 'Frequência por Posição' }
        }
      },
      plugins: {
        legend: { position: 'top' },
        tooltip: {
          mode: 'index',
          intersect: false
        }
      }
    }
  });
}

function baixarGrafico(chartInstance, fileName) {
  if (!chartInstance) {
    console.error("Instância do gráfico não fornecida para download:", fileName);
    Swal.fire('Erro', 'O gráfico não está pronto para ser baixado.', 'error');
    return;
  }
  
  const canvas = chartInstance.canvas;
  const ctx = canvas.getContext('2d');
  ctx.save();
  ctx.globalCompositeOperation = 'destination-over';
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
  
  const dataURL = chartInstance.toBase64Image();
  const link = document.createElement('a');
  link.href = dataURL;
  link.download = `${fileName}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}