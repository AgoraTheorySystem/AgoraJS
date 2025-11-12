import { verificarEProcessarPlanilha } from "../dashboard/atualizacao.js";

const DB_NAME = 'agoraDB';
const STORE_NAME = 'planilhas';
let allWordsData = []; // Armazena [palavra, {dados}] - COMPARTILHADO
let myChartTopN = null; // Referência Gráfico TopN
let myChartOME = null; // Referência Gráfico OME
let myChartRank = null; // Referência Gráfico Rank
let myChartDist = null; // Referência Gráfico Distribuição

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
  // Garante que Chart.js e o plugin de anotação estejam carregados
  if (typeof Chart === 'undefined') {
    console.error("Chart.js não carregado.");
    Swal.fire('Erro Crítico', 'Não foi possível carregar a biblioteca de gráficos.', 'error');
    return;
  }
  
  // Tenta registrar o plugin de anotação
  if (typeof ChartAnnotation !== 'undefined') {
    Chart.register(ChartAnnotation);
  } else {
     // Tenta novamente após um pequeno atraso, caso o script tenha demorado a carregar
     setTimeout(() => {
        if (typeof ChartAnnotation !== 'undefined') {
            Chart.register(ChartAnnotation);
        } else {
            console.warn("Plugin Chart.js Annotation não carregado. O gráfico OME pode não exibir as linhas de quadrante.");
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
    
    // Processa os dados (calcula f, ome, etc.) UMA VEZ
    allWordsData = await processarDados(data, currentLematizacoes);
    
    // Inicia TODOS os gráficos
    // Gráfico de Distribuição (Freq vs Rank) - AGORA O PRIMEIRO
    iniciarGraficoDistribuicao(allWordsData); 
    // Gráfico Top N
    iniciarGraficoTopN(allWordsData);
    // Gráfico OME (Quatro Casas)
    iniciarGraficoOME(allWordsData);
    // Gráfico de Posição (Rank)
    iniciarGraficoRank(allWordsData);

  } catch (error) {
    console.error("Erro ao carregar dados locais:", error);
    Swal.fire({
      icon: 'error',
      title: await window.getTranslation('swal_error_title'),
      text: await window.getTranslation('evocations_data_load_error')
    });
  }
  
  // Adiciona listeners aos botões de download
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


  // Adiciona listeners aos filtros
  // Filtros Gráfico 1 (Distribuição)
  document.getElementById('freq-filtro-min-dist')?.addEventListener('input', () => iniciarGraficoDistribuicao(allWordsData));
  document.getElementById('freq-filtro-max-dist')?.addEventListener('input', () => iniciarGraficoDistribuicao(allWordsData));
  
  // Filtros Gráfico 2 (Top N)
  document.getElementById('top-n-select')?.addEventListener('change', () => iniciarGraficoTopN(allWordsData));
  
  // Filtros Gráfico 3 (OME)
  document.getElementById('freq-filtro-min-ome')?.addEventListener('input', () => iniciarGraficoOME(allWordsData));
  document.getElementById('ome-filtro-min-ome')?.addEventListener('input', () => iniciarGraficoOME(allWordsData));
  document.getElementById('ome-filtro-max-ome')?.addEventListener('input', () => iniciarGraficoOME(allWordsData));

  // Gráfico 4 (Rank) não tem filtros, é automático
});

/**
 * Processa os dados brutos, calcula f, ome e aplica lemas.
 * (Função compartilhada)
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
 * GRÁFICO 1: Distribuição dos Termos (Freq. vs. Rank) - AGORA O PRIMEIRO A SER CHAMADO
 */
function iniciarGraficoDistribuicao(allWords) {
  const ctx = document.getElementById('graficoPrototipicoDist')?.getContext('2d');
  if (!ctx) return; // Se o canvas não existir, para

  if (!allWords || allWords.length === 0) {
    console.warn("Nenhum dado para exibir no gráfico de Distribuição.");
    return;
  }

  // 1. Ler valores dos filtros (com IDs únicos)
  const freqMin = parseFloat(document.getElementById('freq-filtro-min-dist')?.value) || 0;
  const freqMaxInput = document.getElementById('freq-filtro-max-dist');
  const freqMax = freqMaxInput && freqMaxInput.value ? parseFloat(freqMaxInput.value) : Infinity;

  // Lógica de Filtro Top 100
  const filtersAreEmpty = (freqMin === 0 && freqMax === Infinity);

  // 2. Filtrar os dados ANTES de ordenar
  const filteredWords = allWords.filter(([, stats]) => {
    const freqMatch = stats.f >= freqMin && (stats.f <= freqMax || freqMax === Infinity);
    return freqMatch;
  });

  // 3. Ordenar por frequência (maior primeiro) para obter o ranking
  const sortedWords = filteredWords.sort(([, statsA], [, statsB]) => statsB.f - statsA.f);
  
  // 4. Aplicar a regra do Top 100
  const wordsForChart = filtersAreEmpty ? sortedWords.slice(0, 100) : sortedWords;
  const totalTermos = wordsForChart.length;

  // 5. Atualizar Subtítulo
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
  
  // 6. Formatar dados para o gráfico (x: Rank, y: Frequência)
  const dataPoints = wordsForChart.map(([palavra, stats], index) => ({
    x: index + 1,  // Rank (iniciando em 1)
    y: stats.f,    // Frequência
    label: palavra // Rótulo para o tooltip
  }));

  // 7. Criar o gráfico
  if (myChartDist) {
    myChartDist.destroy(); // Destrói gráfico anterior se existir
  }
  
  myChartDist = new Chart(ctx, {
    type: 'scatter', // Gráfico de dispersão (pontos)
    data: {
      datasets: [{
        label: 'Termos',
        data: dataPoints,
        backgroundColor: 'rgba(54, 162, 235, 0.7)', // Pontos azuis
        borderColor: 'rgba(54, 162, 235, 1)',
        pointRadius: 4, // Bolas maiores
        pointHoverRadius: 6, // Bolas maiores no hover
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
          min: 1, 
          max: filtersAreEmpty ? 100 : undefined, // Limita o eixo X a 100 se os filtros estiverem vazios
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
        legend: {
          display: false 
        }
      }
    }
  });
}

/**
 * GRÁFICO 2: Termos Mais Frequentes (Gráfico de Barras)
 */
function iniciarGraficoTopN(allWords) {
  const ctx = document.getElementById('graficoTopN')?.getContext('2d');
  if (!ctx) return;

  if (!allWords || allWords.length === 0) {
    console.warn("Nenhum dado para exibir no gráfico Top N.");
    return;
  }

  // 1. Ler valor do filtro Top N
  const topNValue = parseInt(document.getElementById('top-n-select')?.value) || 15;

  // 2. Ordenar por frequência (maior primeiro) e pegar o Top N
  const sortedWords = [...allWords].sort(([, statsA], [, statsB]) => statsB.f - statsA.f);
  const topWords = sortedWords.slice(0, topNValue);

  // 3. Formatar dados para o gráfico
  const labels = topWords.map(([palavra]) => palavra);
  const data = topWords.map(([, stats]) => stats.f);

  // 4. Criar o gráfico
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
      indexAxis: 'y', // Gráfico de barras horizontais
      scales: {
        x: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Frequência Total'
          }
        },
        y: {
          ticks: {
            autoSkip: false // Garante que todos os labels apareçam
          }
        }
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return ` Frequência: ${context.raw}`;
            }
          }
        }
      }
    }
  });
}


/**
 * GRÁFICO 3: Inicia e renderiza o gráfico de Quatro Casas (Frequência vs. OME).
 */
function iniciarGraficoOME(allWords) {
  const ctx = document.getElementById('graficoOME')?.getContext('2d');
  if (!ctx) return;

  if (!allWords || allWords.length === 0) {
    console.warn("Nenhum dado para exibir no gráfico OME.");
    return;
  }
  
  // 1. Ler valores dos filtros
  const freqMin = parseFloat(document.getElementById('freq-filtro-min-ome')?.value) || 0;
  const omeMin = parseFloat(document.getElementById('ome-filtro-min-ome')?.value) || 0;
  const omeMax = parseFloat(document.getElementById('ome-filtro-max-ome')?.value) || Infinity;

  // 2. Filtrar os dados
  const filteredWords = allWords.filter(([, stats]) => {
    const freqMatch = stats.f >= freqMin;
    const omeMatch = stats.ome >= omeMin && (stats.ome <= omeMax || omeMax === Infinity);
    return freqMatch && omeMatch;
  });

  const totalTermos = filteredWords.length;

  // 3. Calcular Médias (para os quadrantes)
  let mediaFreq = 0;
  let mediaOME = 0;
  if (totalTermos > 0) {
      mediaFreq = filteredWords.reduce((sum, [, stats]) => sum + stats.f, 0) / totalTermos;
      mediaOME = filteredWords.reduce((sum, [, stats]) => sum + stats.ome, 0) / totalTermos;
  }

  // 4. Atualizar Subtítulo
  const subtitleEl = document.getElementById('chart-subtitle-ome');
  if (subtitleEl) {
    if (totalTermos > 0) {
      subtitleEl.textContent = `Exibindo ${totalTermos} termo(s). Cortes: Freq. Média (${mediaFreq.toFixed(2)}), OME Médio (${mediaOME.toFixed(2)})`;
    } else {
      subtitleEl.textContent = 'Nenhum termo corresponde aos filtros';
    }
  }

  // 5. Formatar dados para o gráfico (x: OME, y: Frequência)
  const dataPoints = filteredWords.map(([palavra, stats]) => ({
    x: stats.ome,    // OME no eixo X
    y: stats.f,      // Frequência no eixo Y
    label: palavra   // Rótulo para o tooltip
  }));

  // 6. Criar o gráfico
  if (myChartOME) {
    myChartOME.destroy(); // Destrói gráfico anterior se existir
  }
  
  myChartOME = new Chart(ctx, {
    type: 'scatter',
    data: {
      datasets: [{
        label: 'Termos',
        data: dataPoints,
        backgroundColor: 'rgba(230, 0, 0, 0.7)', // Pontos vermelhos
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
        legend: {
          display: false // Esconde a legenda
        },
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

/**
 * GRÁFICO 4: Análise de Posição (Rank) (Gráfico de Barras Agrupadas)
 */
function iniciarGraficoRank(allWords) {
  const ctx = document.getElementById('graficoRank')?.getContext('2d');
  if (!ctx) return;

  if (!allWords || allWords.length === 0) {
    console.warn("Nenhum dado para exibir no gráfico de Rank.");
    return;
  }

  // 1. Ordenar por frequência e pegar os Top 5
  const sortedWords = [...allWords].sort(([, statsA], [, statsB]) => statsB.f - statsA.f);
  const top5Words = sortedWords.slice(0, 5);

  // 2. Formatar dados
  const labels = top5Words.map(([palavra]) => palavra);
  
  // *** ALTERAÇÃO AQUI: Nova paleta de 10 cores visíveis e distintas ***
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

  const datasets = [];
  for (let i = 1; i <= 10; i++) { // Loop vai até 10
      datasets.push({
          label: `${i}ª Posição`,
          data: top5Words.map(([, stats]) => stats[`evoc${i}`]),
          backgroundColor: rankColors[i - 1], // Usa a nova paleta de cores
          borderColor: rankColors[i - 1],
          borderWidth: 1
      });
  }

  // 3. Criar o gráfico
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
          title: {
            display: true,
            text: 'Top 5 Termos Mais Frequentes'
          }
        },
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Frequência por Posição'
          }
        }
      },
      plugins: {
        legend: {
          position: 'top',
        },
        tooltip: {
          mode: 'index', // Mostra tooltips para todas as barras no mesmo índice
          intersect: false
        }
      }
    }
  });
}


/**
 * Função genérica para baixar um gráfico como PNG.
 */
function baixarGrafico(chartInstance, fileName) {
  if (!chartInstance) {
    console.error("Instância do gráfico não fornecida para download:", fileName);
    Swal.fire('Erro', 'O gráfico não está pronto para ser baixado.', 'error');
    return;
  }
  
  // Define o fundo do canvas como branco para o download
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