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

    const sections = [
      { title: 'Egos', id: 'egoCards' },
      { title: 'Alters', id: 'alterCards' },
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

    let data;
    try {
      data = JSON.parse(localStorage.getItem(`planilha_${planilha}`)) || [];
    } catch {
      data = [];
    }
    if (data.length < 2) {
      return alert('Nenhum dado válido encontrado na planilha.');
    }

    const header = data[0].map(h => String(h).trim().toUpperCase());
    const rows = data.slice(1);

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

    const egoIdxs = [1, 2, 3, 4, 5].map(n => header.indexOf(`EVOC${n}`)).filter(i => i >= 0);
    const alterIdxs = [6, 7, 8, 9, 10].map(n => header.indexOf(`EVOC${n}`)).filter(i => i >= 0);

    const egoRes = egoIdxs.map(i => calc(i));
    const alterRes = alterIdxs.map(i => calc(i));

    function renderCards(containerId, results, prefix) {
      const cont = document.getElementById(containerId);
      results.forEach((r, i) => {
        const card = document.createElement('div');
        card.classList.add('card');
        const label = `${prefix}${i + 1}`;
        const val = r.isNum ? r.avg : `${r.top} (${r.topCount})`;
        card.innerHTML = `<h3>${label}</h3><p>${val}</p>`;
        cont.appendChild(card);
      });
    }
    renderCards('egoCards', egoRes, 'EGO ');
    renderCards('alterCards', alterRes, 'ALTER ');

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

    const egoColors = ['#f44336', '#8bc34a', '#2196f3', '#ffeb3b', '#4caf50'];
    const alterColors = ['#e91e63', '#9c27b0', '#3f51b5', '#009688', '#ff9800'];

    drawChart('egoCardsChart', egoRes, egoColors);
    drawChart('alterCardsChart', alterRes, alterColors);

    function calcTopTermsEgo(rows) {
      const egoTerms = [];
      for (let i = 1; i <= 5; i++) {
        const colIdx = header.indexOf(`EVOC${i}`);
        if (colIdx >= 0) {
          egoTerms.push(...rows.map(row => row[colIdx]).filter(val => val && val !== 'VAZIO'));
        }
      }
      const freq = {};
      egoTerms.forEach(term => { freq[term] = (freq[term] || 0) + 1; });
      return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([term, count]) => ({ term, count }));
    }

    function calcTopTermsAlter(rows) {
      const alterTerms = [];
      for (let i = 6; i <= 10; i++) {
        const colIdx = header.indexOf(`EVOC${i}`);
        if (colIdx >= 0) {
          alterTerms.push(...rows.map(row => row[colIdx]).filter(val => val && val !== 'VAZIO'));
        }
      }
      const freq = {};
      alterTerms.forEach(term => { freq[term] = (freq[term] || 0) + 1; });
      return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([term, count]) => ({ term, count }));
    }

    function drawEgoChart() {
      const topEgoTerms = calcTopTermsEgo(rows);
    
      const allEgoTerms = [];
      for (let i = 1; i <= 5; i++) {
        const colIdx = header.indexOf(`EVOC${i}`);
        if (colIdx >= 0) {
          allEgoTerms.push(...rows.map(row => row[colIdx]).filter(val => val && val !== 'VAZIO'));
        }
      }
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
    
      const allAlterTerms = [];
      for (let i = 6; i <= 10; i++) {
        const colIdx = header.indexOf(`EVOC${i}`);
        if (colIdx >= 0) {
          allAlterTerms.push(...rows.map(row => row[colIdx]).filter(val => val && val !== 'VAZIO'));
        }
      }
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

    addEgoChartContainer();
    addAlterChartContainer();
    drawEgoChart();
    drawAlterChart();

    const otherC = document.getElementById('othersCards');
    header.forEach((col, i) => {
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
