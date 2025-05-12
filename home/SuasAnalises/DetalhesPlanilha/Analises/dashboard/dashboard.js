(function () {
  // cabeçalhos e linhas ficam disponíveis em todo o escopo da IIFE
  let header = [];
  let rows = [];

  const DATALABELS_URL =
    'https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.2.0/dist/chartjs-plugin-datalabels.min.js';

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

    // 1) Seções iniciais e ordem
    const sections = [
      { title: 'Egos',          id: 'egoCards'    },
      { title: 'Alters',        id: 'alterCards'  },
      { title: 'Outros Campos', id: 'othersCards' }
    ];
    createSections(main, sections);

    // 2) Carregar e validar dados
    const data = loadData(planilha);
    if (!data) return;

    header = data[0].map(h => String(h).trim().toUpperCase());
    rows = data.slice(1);

    // 3) Mapear colunas EVOC1…5 e EVOC6…10
    const egoIdxs   = [1,2,3,4,5].map(n => header.indexOf(`EVOC${n}`)).filter(i=>i>=0);
    const alterIdxs = [6,7,8,9,10].map(n=> header.indexOf(`EVOC${n}`)).filter(i=>i>=0);

    // 4) Criar e renderizar cards
    const egoRes   = egoIdxs.map(i => calc(i));
    const alterRes = alterIdxs.map(i => calc(i));
    renderCards('egoCards',   egoRes,   'EGO '  );
    renderCards('alterCards', alterRes, 'ALTER ');

    // 5) Gráficos de barras
    drawChart('egoCardsChart',   egoRes,   ['#f44336','#8bc34a','#2196f3','#ffeb3b','#4caf50']);
    drawChart('alterCardsChart', alterRes, ['#e91e63','#9c27b0','#3f51b5','#009688','#ff9800']);

    // 6) Gráficos de resumo (top terms)
    addEgoChartContainer();
    addAlterChartContainer();
    drawEgoChart();
    drawAlterChart();

    // 7) Outros campos
    generateOtherCards(header, rows, document.getElementById('othersCards'));

    // ——— Reordenações ———

    // a) Reordenar seções no <main>
    reorderSections(['egoCards','alterCards','othersCards']);

    // b) Inverter a ordem dos cards
    reverseCards('egoCards');
    reverseCards('alterCards');

    // c) Ordenar alfabeticamente os cards em "Outros Campos"
    reorderCardsByTitle('othersCards');

    // d) Reordenar itens dentro da seção "Egos" na ordem exata que você quiser
    reorderChildren(
      'section.group.egoCards',
      [
        '#egoCards',                            // container de cards
        '.chart-container:nth-of-type(1)',      // wrapper com canvas #egoCardsChart
        '.chart-container:nth-of-type(2)'       // wrapper com canvas #egoChart
      ]
    );

    // e) Mesmo para "Alters"
    reorderChildren(
      'section.group.alterCards',
      [
        '#alterCards',
        '.chart-container:nth-of-type(1)',
        '.chart-container:nth-of-type(2)'
      ]
    );

  } // end runDashboard

  // — Funções auxiliares —

  function createSections(main, sections) {
    sections.forEach(sec => {
      const s = document.createElement('section');
      s.classList.add('group', sec.id);
      s.innerHTML = `
        <h2>${sec.title}</h2>
        <div id="${sec.id}" class="cards-container"></div>
      `;
      if (sec.id !== 'othersCards') {
        const cw = document.createElement('div');
        cw.classList.add('chart-container');
        cw.innerHTML = `<canvas id="${sec.id}Chart"></canvas>`;
        s.appendChild(cw);
      }
      main.appendChild(s);
    });
  }

  function loadData(planilha) {
    let data;
    try {
      data = JSON.parse(localStorage.getItem(`planilha_${planilha}`)) || [];
    } catch {
      data = [];
    }
    if (data.length < 2) {
      alert('Nenhum dado válido encontrado na planilha.');
      return null;
    }
    return data;
  }

  function calc(colIdx) {
    const vals = rows
      .map(r => r[colIdx])
      .filter(v => v && String(v).trim().toUpperCase() !== 'VAZIO');
    const nums = vals
      .map(v => parseFloat(String(v).replace(',', '.')))
      .filter(n => !isNaN(n));

    if (nums.length >= vals.length / 2) {
      const sum = nums.reduce((a, b) => a + b, 0);
      return { isNum: true, avg: (sum / nums.length).toFixed(2), total: vals.length };
    } else {
      const freq = {};
      vals.forEach(v => { freq[v] = (freq[v] || 0) + 1; });
      const [top, topCount] = Object.entries(freq)
        .sort((a, b) => b[1] - a[1])[0] || ['N/D', 0];
      return { isNum: false, top, topCount, total: vals.length };
    }
  }

  function renderCards(containerId, results, prefix) {
    const cont = document.getElementById(containerId);
    results.forEach((r, i) => cont.appendChild(createCard(prefix + (i+1), r)));
  }

  function createCard(title, result) {
    const card = document.createElement('div');
    card.classList.add('card');
    const val = result.isNum
      ? result.avg
      : `${result.top} (${result.topCount})`;
    card.innerHTML = `<h3>${title}</h3><p>${val}</p>`;
    return card;
  }

  function drawChart(canvasId, results, colors) {
    new Chart(
      document.getElementById(canvasId).getContext('2d'),
      {
        type: 'bar',
        data: {
          labels: results.map((r,i) => r.isNum ? `Col${i+1}` : r.top),
          datasets: [
            {
              label: 'Frequência',
              data: results.map(r => r.isNum ? 0 : r.topCount),
              backgroundColor: colors
            },
            {
              label: 'Total',
              data: results.map(r => r.total),
              backgroundColor: 'rgba(200,200,200,0.7)'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: { x:{stacked:false}, y:{beginAtZero:true} },
          plugins: {
            legend: { position:'top', labels:{boxWidth:12,padding:8} },
            tooltip:{enabled:false},
            datalabels:{
              color:'#000',
              formatter: v => v,
              anchor:'end',
              align:'start',
              font:{ weight:'bold', size:12 }
            }
          }
        },
        plugins: [ChartDataLabels]
      }
    );
  }

  function addEgoChartContainer() {
    const cw = document.createElement('div');
    cw.classList.add('chart-container');
    cw.innerHTML = `<canvas id="egoChart"></canvas>`;
    document.querySelector('section.egoCards').appendChild(cw);
  }

  function addAlterChartContainer() {
    const cw = document.createElement('div');
    cw.classList.add('chart-container');
    cw.innerHTML = `<canvas id="alterChart"></canvas>`;
    document.querySelector('section.alterCards').appendChild(cw);
  }

  function generateOtherCards(headerParam, rowsParam, container) {
    headerParam.forEach((col, i) => {
      if (!col.startsWith('EVOC')) {
        container.appendChild(createCard(col, calc(i)));
      }
    });
  }

  function getAllTerms(start, end) {
    const list = [];
    for (let i = start; i <= end; i++) {
      const idx = header.indexOf(`EVOC${i}`);
      if (idx >= 0) {
        rows.forEach(r => {
          const v = r[idx];
          if (v && String(v).trim().toUpperCase() !== 'VAZIO') {
            list.push(v);
          }
        });
      }
    }
    return list;
  }

  function calcTopTerms(start, end) {
    const freq = {};
    getAllTerms(start, end).forEach(v => {
      freq[v] = (freq[v] || 0) + 1;
    });
    return Object.entries(freq)
      .sort((a,b) => b[1] - a[1])
      .slice(0,4)
      .map(([term,count]) => ({ term, count }));
  }

  function drawEgoChart() {
    const top  = calcTopTerms(1, 5);
    const all  = getAllTerms(1, 5).length;
    new Chart(
      document.getElementById('egoChart').getContext('2d'),
      {
        type: 'bar',
        data: {
          labels: [...top.map(t => t.term), 'EGO Total'],
          datasets: [
            {
              label: 'Frequência',
              data: [...top.map(t => t.count), null],
              backgroundColor: '#4caf50'
            },
            {
              label: 'Total',
              data: [...top.map(() => null), all],
              backgroundColor: '#c0c0c0'
            }
          ]
        },
        options: {
          responsive: true,
          scales: { x:{stacked:false}, y:{beginAtZero:true} }
        }
      }
    );
  }

  function drawAlterChart() {
    const top  = calcTopTerms(6, 10);
    const all  = getAllTerms(6, 10).length;
    new Chart(
      document.getElementById('alterChart').getContext('2d'),
      {
        type: 'bar',
        data: {
          labels: [...top.map(t => t.term), 'ALTER Total'],
          datasets: [
            {
              label: 'Frequência',
              data: [...top.map(t => t.count), null],
              backgroundColor: '#009688'
            },
            {
              label: 'Total',
              data: [...top.map(() => null), all],
              backgroundColor: '#c0c0c0'
            }
          ]
        },
        options: {
          responsive: true,
          scales: { x:{stacked:false}, y:{beginAtZero:true} }
        }
      }
    );
  }

  // — Funções de reordenação genéricas —

  function reorderSections(order) {
    const main = document.querySelector('main.container');
    order.forEach(id => {
      const sec = main.querySelector(`section.${id}`);
      if (sec) main.appendChild(sec);
    });
  }

  function reverseCards(containerId) {
    const cont = document.getElementById(containerId);
    Array.from(cont.children)
         .reverse()
         .forEach(el => cont.appendChild(el));
  }

  function reorderCardsByTitle(containerId) {
    const cont  = document.getElementById(containerId);
    const cards = Array.from(cont.children);
    cards.sort((a, b) =>
      a.querySelector('h3').textContent.localeCompare(
        b.querySelector('h3').textContent
      )
    );
    cards.forEach(el => cont.appendChild(el));
  }

  function reorderChildren(parentSelector, childSelectors) {
    const parent = document.querySelector(parentSelector);
    childSelectors.forEach(sel => {
      const el = parent.querySelector(sel);
      if (el) parent.appendChild(el);
    });
  }

})();
