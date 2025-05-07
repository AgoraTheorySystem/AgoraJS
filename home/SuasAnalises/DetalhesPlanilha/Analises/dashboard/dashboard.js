(function () {
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

  const DATALABELS_URL = 'https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.2.0/dist/chartjs-plugin-datalabels.min.js';

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

  function runDashboard() {
    const params = new URLSearchParams(location.search);
    const planilha = params.get('planilha');
    if (!planilha) {
      return alert("Parâmetro 'planilha' ausente na URL.");
    }

    const main = document.querySelector('main.container');
    main.innerHTML = '<h1>Dashboard de Análise de Dados</h1>';

    // Modularização: função que gera todas as seções do dashboard
    const sections = [
      { title: 'Egos', id: 'egoCards' },
      { title: 'Alters', id: 'alterCards' },
      { title: 'Outros Campos', id: 'othersCards' }
    ];

    createSections(main, sections);
    
    // Carregar e validar os dados
    let data = loadData(planilha);
    if (!data) return;

    const header = data[0].map(h => String(h).trim().toUpperCase());
    const rows = data.slice(1);

    const egoIdxs = [1, 2, 3, 4, 5].map(n => header.indexOf(`EVOC${n}`)).filter(i => i >= 0);
    const alterIdxs = [6, 7, 8, 9, 10].map(n => header.indexOf(`EVOC${n}`)).filter(i => i >= 0);

    const egoRes = egoIdxs.map(i => calc(i));
    const alterRes = alterIdxs.map(i => calc(i));

    // Gerar Cards
    renderCards('egoCards', egoRes, 'EGO ');
    renderCards('alterCards', alterRes, 'ALTER ');

    // Gerar os gráficos
    const egoColors = ['#f44336', '#8bc34a', '#2196f3', '#ffeb3b', '#4caf50'];
    const alterColors = ['#e91e63', '#9c27b0', '#3f51b5', '#009688', '#ff9800'];
    drawChart('egoCardsChart', egoRes, egoColors);
    drawChart('alterCardsChart', alterRes, alterColors);

    // Adicionar os gráficos ego e alter
    addEgoChartContainer();
    addAlterChartContainer();
    drawEgoChart();
    drawAlterChart();

    // Gerar outros campos
    const otherC = document.getElementById('othersCards');
    generateOtherCards(header, rows, otherC);

    // Função para criar todas as seções do dashboard
    function createSections(main, sections) {
      sections.forEach(sec => {
        const s = document.createElement('section');
        s.classList.add('group');
        s.classList.add(sec.id);
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
    }

    // Função para carregar os dados da planilha
    function loadData(planilha) {
      let data;
      try {
        data = JSON.parse(localStorage.getItem(`planilha_${planilha}`)) || [];
      } catch {
        data = [];
      }
      if (data.length < 2) {
        return alert('Nenhum dado válido encontrado na planilha.');
      }
      return data;
    }

    // Função para calcular os dados
    function calc(colIdx) {
      const vals = rows.map(r => r[colIdx]).filter(v => v && String(v).trim().toUpperCase() !== 'VAZIO');
      const nums = vals.map(v => parseFloat(String(v).replace(',', '.'))).filter(n => !isNaN(n));
      if (nums.length >= vals.length / 2) {
        const sum = nums.reduce((a, b) => a + b, 0);
        return { isNum: true, avg: (sum / nums.length).toFixed(2), total: vals.length };
      } else {
        const freq = {};
        vals.forEach(v => { freq[v] = (freq[v] || 0) + 1; });
        const [top, topCount] = Object.entries(freq).sort((a, b) => b[1] - a[1])[0] || ['N/D', 0];
        return { isNum: false, top, topCount, total: vals.length };
      }
    }

    // Função para renderizar os cards
    function renderCards(containerId, results, prefix) {
      const cont = document.getElementById(containerId);
      results.forEach((r, i) => {
        const card = createCard(prefix + (i + 1), r);
        cont.appendChild(card);
      });
    }

    // Função para criar um card
    function createCard(title, result) {
      const card = document.createElement('div');
      card.classList.add('card');
      const val = result.isNum ? result.avg : `${result.top} (${result.topCount})`;
      card.innerHTML = `<h3>${title}</h3><p>${val}</p>`;
      return card;
    }

    // Função para desenhar o gráfico
    function drawChart(canvasId, results, colors) {
      const labels = results.map((r, i) => r.isNum ? `Col${i + 1}` : r.top);
      const freqData = results.map(r => r.isNum ? 0 : r.topCount);
      const totData = results.map(r => r.total);

      new Chart(document.getElementById(canvasId).getContext('2d'), {
        type: 'bar',
        data: {
          labels,
          datasets: [
            { label: 'Frequência', data: freqData, backgroundColor: colors },
            { label: 'Total', data: totData, backgroundColor: 'rgba(200,200,200,0.7)' }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: { x: { stacked: false }, y: { beginAtZero: true } },
          plugins: {
            legend: { position: 'top', labels: { boxWidth: 12, padding: 8 } },
            tooltip: { enabled: false },
            datalabels: {
              color: '#000',
              formatter: val => val,
              anchor: 'end',
              align: 'start',
              font: { weight: 'bold', size: 12 }
            }
          }
        },
        plugins: [ChartDataLabels]
      });
    }

    // Função para adicionar os containers de gráfico para EGO e ALTER
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

    // Função para gerar os outros campos
    function generateOtherCards(header, rows, container) {
      header.forEach((col, i) => {
        if (!col.startsWith('EVOC')) {
          const r = calc(i);
          const card = createCard(col, r);
          container.appendChild(card);
        }
      });
    }

    // Funções de desenho do gráfico de EGO e ALTER
    function drawEgoChart() {
      const topEgoTerms = calcTopTermsEgo(rows);
      const allEgoTerms = getAllTerms(1, 5);
      const totalEgo = allEgoTerms.length;

      new Chart(document.getElementById('egoChart').getContext('2d'), {
        type: 'bar',
        data: {
          labels: [...topEgoTerms.map(term => term.term), 'EGO Total'],
          datasets: [
            {
              label: 'Frequência',
              data: [...topEgoTerms.map(term => term.count), null],
              backgroundColor: '#4caf50'
            },
            {
              label: 'Total',
              data: [...topEgoTerms.map(() => null), totalEgo],
              backgroundColor: '#c0c0c0'
            }
          ]
        },
        options: {
          responsive: true,
          scales: { x: { stacked: false }, y: { beginAtZero: true } }
        }
      });
    }

    function drawAlterChart() {
      const topAlterTerms = calcTopTermsAlter(rows);
      const allAlterTerms = getAllTerms(6, 10);
      const totalAlter = allAlterTerms.length;

      new Chart(document.getElementById('alterChart').getContext('2d'), {
        type: 'bar',
        data: {
          labels: [...topAlterTerms.map(term => term.term), 'ALTER Total'],
          datasets: [
            {
              label: 'Frequência',
              data: [...topAlterTerms.map(term => term.count), null],
              backgroundColor: '#009688'
            },
            {
              label: 'Total',
              data: [...topAlterTerms.map(() => null), totalAlter],
              backgroundColor: '#c0c0c0'
            }
          ]
        },
        options: {
          responsive: true,
          scales: { x: { stacked: false }, y: { beginAtZero: true } }
        }
      });
    }

    function getAllTerms(start, end) {
      const terms = [];
      for (let i = start; i <= end; i++) {
        const colIdx = header.indexOf(`EVOC${i}`);
        if (colIdx >= 0) {
          terms.push(...rows.map(row => row[colIdx]).filter(val => val && val !== 'VAZIO'));
        }
      }
      return terms;
    }

    function calcTopTermsEgo(rows) {
      return calcTopTerms(rows, 1, 5);
    }

    function calcTopTermsAlter(rows) {
      return calcTopTerms(rows, 6, 10);
    }

    function calcTopTerms(rows, start, end) {
      const terms = [];
      for (let i = start; i <= end; i++) {
        const colIdx = header.indexOf(`EVOC${i}`);
        if (colIdx >= 0) {
          terms.push(...rows.map(row => row[colIdx]).filter(val => val && val !== 'VAZIO'));
        }
      }
      const freq = {};
      terms.forEach(term => { freq[term] = (freq[term] || 0) + 1; });
      return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([term, count]) => ({ term, count }));
    }
  }
})();
