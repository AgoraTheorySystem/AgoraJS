(function() {
  // 1) Função para injetar e carregar um script externo
  function loadScript(url) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = url;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error(`Falha ao carregar ${url}`));
      document.head.appendChild(s);
    });
  }

  // 2) URL do plugin de DataLabels (versão estável)
  const DATALABELS_URL = 'https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.2.0/dist/chartjs-plugin-datalabels.min.js';

  // 3) Carrega o plugin e só então roda o dashboard
  loadScript(DATALABELS_URL)
    .then(() => {
      if (window.ChartDataLabels) {
        Chart.register(ChartDataLabels);
      } else {
        console.warn('ChartDataLabels não disponível após carregar o script.');
      }
    })
    .catch(err => console.warn(err))
    .finally(() => {
      runDashboard();
    });

  // 4) Todo o resto do dashboard dentro desta função
  function runDashboard() {
    // Pega parâmetro ?planilha=...
    const params = new URLSearchParams(location.search);
    const planilha = params.get('planilha');
    if (!planilha) {
      return alert("Parâmetro 'planilha' ausente na URL.");
    }

    // Seleciona e prepara <main>
    const main = document.querySelector('main.container');
    main.innerHTML = '<h1>Dashboard de Análise de Dados</h1>';

    // Seções: Egos, Alters, Outros
    const sections = [
      { title: 'Egos',       id: 'egoCards'   },
      { title: 'Alters',     id: 'alterCards' },
      { title: 'Outros Campos', id: 'othersCards' }
    ];
    sections.forEach(sec => {
      const s = document.createElement('section');
      s.classList.add('group');
      s.classList.add(`${sec.id}`);
      s.innerHTML = `
        <h2>${sec.title}</h2>
        <div id="${sec.id}" class="cards-container"></div>
      `;
      if (sec.id !== 'othersCards') {
        const chartWrapper = document.createElement('div');
        chartWrapper.classList.add('chart-container');
        chartWrapper.innerHTML = `<canvas id="${sec.id}Chart"></canvas>`;
        s.appendChild(chartWrapper);
      }
      main.appendChild(s);
    });

    // Carrega JSON do localStorage
    let data;
    try {
      data = JSON.parse(localStorage.getItem(`planilha_${planilha}`)) || [];
    } catch {
      data = [];
    }
    if (data.length < 2) {
      return alert('Nenhum dado válido encontrado na planilha.');
    }

    // Header e linhas
    const header = data[0].map(h => String(h).trim().toUpperCase());
    const rows   = data.slice(1);

    // Função que calcula a média ou moda+contagem
    function calc(colIdx) {
      const vals = rows
        .map(r => r[colIdx])
        .filter(v => {
          if (v == null) return false;
          const s = String(v).trim();
          return s && s.toUpperCase() !== 'VAZIO';
        });
      const nums = vals
        .map(v => parseFloat(String(v).replace(',', '.')))
        .filter(n => !isNaN(n));
      if (nums.length >= vals.length / 2) {
        const sum = nums.reduce((a,b) => a + b, 0);
        return { isNum: true, avg: (sum/nums.length).toFixed(2), total: vals.length };
      } else {
        const freq = {};
        vals.forEach(v => {
          const k = String(v).trim();
          freq[k] = (freq[k]||0) + 1;
        });
        const [top, topCount] = Object.entries(freq)
          .sort((a,b)=>b[1]-a[1])[0] || ['N/D',0];
        return { isNum: false, top, topCount, total: vals.length };
      }
    }

    // Índices EVOC1–5 e EVOC6–10
    const egoIdxs   = [1,2,3,4,5].map(n => header.indexOf(`EVOC${n}`)).filter(i=>i>=0);
    const alterIdxs = [6,7,8,9,10].map(n => header.indexOf(`EVOC${n}`)).filter(i=>i>=0);

    const egoRes   = egoIdxs.map(i => calc(i));
    const alterRes = alterIdxs.map(i => calc(i));

    // Renderiza cards
    function renderCards(containerId, results, prefix) {
      const cont = document.getElementById(containerId);
      results.forEach((r,i) => {
        const card = document.createElement('div');
        card.classList.add('card');
        const label = `${prefix}${i+1}`;
        const val = r.isNum ? r.avg : `${r.top} (${r.topCount})`;
        card.innerHTML = `<h3>${label}</h3><p>${val}</p>`;
        cont.appendChild(card);
      });
    }
    renderCards('egoCards',   egoRes,   'EGO ');
    renderCards('alterCards', alterRes, 'ALTER ');

    // Função para desenhar gráfico de barras
    function drawChart(canvasId, results, colors) {
      const labels   = results.map((r,i)=> r.isNum ? `Col${i+1}` : r.top);
      const freqData = results.map(r => r.isNum ? 0 : r.topCount);
      const totData  = results.map(r => r.total);

      new Chart(
        document.getElementById(canvasId).getContext('2d'),
        {
          type: 'bar',
          data: {
            labels,
            datasets: [
              {
                label: 'Frequência',
                data: freqData,
                backgroundColor: colors
              },
              {
                label: 'Total',
                data: totData,
                backgroundColor: 'rgba(200,200,200,0.7)'
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              x: { stacked: false },
              y: { beginAtZero: true }
            },
            plugins: {
              legend: { position:'top', labels:{boxWidth:12, padding:8} },
              tooltip: { enabled:false },
              datalabels: {
                color: '#000',
                formatter: val => val,
                anchor: 'end',
                align: 'start',
                font: { weight:'bold', size:12 }
              }
            }
          },
          plugins: [ ChartDataLabels ]  // se plugin não foi registrado, ele é ignorado
        }
      );
    }

    const egoColors   = ['#f44336','#8bc34a','#2196f3','#ffeb3b','#4caf50'];
    const alterColors = ['#e91e63','#9c27b0','#3f51b5','#009688','#ff9800'];

    drawChart('egoCardsChart',   egoRes,   egoColors);
    drawChart('alterCardsChart', alterRes, alterColors);

    // Função para calcular os 4 termos mais repetidos entre EVOC1 até EVOC5 (EGO)
    function calcTopTermsEgo(rows) {
      const egoTerms = [];
      for (let i = 1; i <= 5; i++) {
        const colIdx = header.indexOf(`EVOC${i}`);
        if (colIdx >= 0) {
          const values = rows.map(row => row[colIdx]).filter(val => val != null && val !== 'VAZIO');
          egoTerms.push(...values);
        }
      }

      const freq = {};
      egoTerms.forEach(term => {
        freq[term] = (freq[term] || 0) + 1;
      });

      const sortedTerms = Object.entries(freq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4); // Pega os 4 termos mais repetidos

      return sortedTerms.map(([term, count]) => ({ term, count }));
    }

    // Função para calcular os 4 termos mais repetidos entre EVOC6 até EVOC10 (ALTER)
    function calcTopTermsAlter(rows) {
      const alterTerms = [];
      for (let i = 6; i <= 10; i++) {
        const colIdx = header.indexOf(`EVOC${i}`);
        if (colIdx >= 0) {
          const values = rows.map(row => row[colIdx]).filter(val => val != null && val !== 'VAZIO');
          alterTerms.push(...values);
        }
      }

      const freq = {};
      alterTerms.forEach(term => {
        freq[term] = (freq[term] || 0) + 1;
      });

      const sortedTerms = Object.entries(freq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4); // Pega os 4 termos mais repetidos

      return sortedTerms.map(([term, count]) => ({ term, count }));
    }

    // Adicionar gráficos para todos os EGOS e ALTERS
    function drawEgoChart() {
      const topEgoTerms = calcTopTermsEgo(rows);
      new Chart(document.getElementById('egoChart').getContext('2d'), {
        type: 'bar',
        data: {
          labels: topEgoTerms.map(term => term.term),
          datasets: [{
            label: 'Frequência',
            data: topEgoTerms.map(term => term.count),
            backgroundColor: '#4caf50'
          }]
        },
        options: {
          responsive: true,
          scales: {
            x: { stacked: false },
            y: { beginAtZero: true }
          }
        }
      });
    }

    function drawAlterChart() {
      const topAlterTerms = calcTopTermsAlter(rows);
      new Chart(document.getElementById('alterChart').getContext('2d'), {
        type: 'bar',
        data: {
          labels: topAlterTerms.map(term => term.term),
          datasets: [{
            label: 'Frequência',
            data: topAlterTerms.map(term => term.count),
            backgroundColor: '#009688'
          }]
        },
        options: {
          responsive: true,
          scales: {
            x: { stacked: false },
            y: { beginAtZero: true }
          }
        }
      });
    }

    // Adicionar contêineres para os gráficos EGO e ALTER
    function addEgoChartContainer() {
      const chartWrapper = document.createElement('div');
      chartWrapper.classList.add('chart-container');
      chartWrapper.innerHTML = `<canvas id="egoChart"></canvas>`;
      document.querySelector('.egoCards').appendChild(chartWrapper);
    }

    function addAlterChartContainer() {
      const chartWrapper = document.createElement('div');
      chartWrapper.classList.add('chart-container');
      chartWrapper.innerHTML = `<canvas id="alterChart"></canvas>`;
      document.querySelector('.alterCards').appendChild(chartWrapper);
    }

    // Chamar as funções para adicionar os gráficos e desenhá-los
    addEgoChartContainer();
    addAlterChartContainer();
    drawEgoChart();
    drawAlterChart();

    // Por fim, “Outros Campos”
    const otherC = document.getElementById('othersCards');
    header.forEach((col,i) => {
      if (!col.startsWith('EVOC')) {
        const r = calc(i);
        const card = document.createElement('div');
        card.classList.add('card');
        const val = r.isNum ? r.avg : `${r.top} (${r.topCount})`;
        card.innerHTML = `<h3>${col}</h3><p>${val}</p>`;
        otherC.appendChild(card);
      }
    });
  }
})();
