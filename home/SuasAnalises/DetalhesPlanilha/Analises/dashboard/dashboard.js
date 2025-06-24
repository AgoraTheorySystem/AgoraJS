(function () {
  let header = [];
  let rows = [];

  const DATALABELS_URL = 'https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.2.0/dist/chartjs-plugin-datalabels.min.js';

  const chartConfig = {
    egoCardsChart: { title: 'Análise de Frequência EGO', subtitle: 'Distribuição de respostas por cada EGO' },
    egoChart: { title: 'Termos Principais EGO', subtitle: 'Top 4 termos mais frequentes em EGO' },
    alterCardsChart: { title: 'Análise de Frequência ALTER', subtitle: 'Distribuição de respostas por cada ALTER' },
    alterChart: { title: 'Termos Principais ALTER', subtitle: 'Top 4 termos mais frequentes em ALTER' }
  };

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
      if (window.ChartDataLabels) Chart.register(ChartDataLabels);
      else console.warn('ChartDataLabels não disponível.');
    })
    .catch(console.warn)
    .finally(runDashboard);

  function runDashboard() {
    const planilha = new URLSearchParams(location.search).get('planilha');
    if (!planilha) return alert("Falta o parâmetro 'planilha' na URL.");

    const barraTop = document.createElement('div');
    barraTop.className = 'top-barra-planilha';
    barraTop.innerHTML = `
    <div class="barra-unificada verde">
      <div class="barra-logo">
        <img src="/assets/tipo_de_analise_agora.png" alt="Logo Ágora">
        <div class="titulo-site">METODOLOGIAS DAS<br>ÁGORAS COGNITIVAS</div>
      </div>
      <div class="barra-planilha">${planilha.toUpperCase()}</div>
    </div>
  `;
    document.body.insertBefore(barraTop, document.body.firstChild);

    // Painel de informações abaixo do menu
    const infoPanel = document.createElement('div');
    infoPanel.className = 'painel-info';
    infoPanel.innerHTML = `
      <div class="info-card alto"></div>
      <div class="info-card"><p class="valor">0</p><p>Quantidade de pessoas</p></div>
      <div class="info-card" id="gender-card">
        <p class="valor" id="male-count">0</p><p>Homens</p>
        <p class="valor" id="female-count">0</p><p>Mulheres</p>
      </div>
      <div class="info-card" id="age-card">
        <p class="valor" id="average-age">0 anos</p><p>Média de idade</p>
      </div>
      <div class="info-card"></div>
      <div class="info-card grande"></div>
      <div class="info-card"></div>
      <div class="info-card"></div>
    `;
    document.body.insertBefore(infoPanel, document.querySelector('main.container'));

    const main = document.querySelector('main.container');
    main.innerHTML = '<h1>Dashboard de Análise de Dados</h1>';

    const sections = [
      { id: 'egoCards', title: 'Egos', charts: ['egoChart', 'egoCardsChart'] },
      { id: 'alterCards', title: 'Alters', charts: ['alterChart', 'alterCardsChart'] },
      { id: 'othersCards', title: 'Outros Campos' }
    ];
    createSections(main, sections);

    const data = loadData(planilha);
    if (!data) return;
    header = data[0].map(h => String(h).trim().toUpperCase());
    rows = data.slice(1);

    // Modificação para pegar a quantidade de pessoas
    const totalPessoas = rows.length;
    const quantidadePessoasCard = document.querySelector('.info-card p.valor');
    if (quantidadePessoasCard) {
      quantidadePessoasCard.textContent = totalPessoas;
    }

    // --- Lógica para contar Homens e Mulheres ---
    const genderColIndex = header.indexOf('SEXO');
    let maleCount = 0;
    let femaleCount = 0;

    if (genderColIndex !== -1) {
      rows.forEach(row => {
        const gender = String(row[genderColIndex]).trim().toUpperCase();
        if (gender === 'M') {
          maleCount++;
        } else if (gender === 'F') {
          femaleCount++;
        }
      });
    }

    const maleCountElement = document.getElementById('male-count');
    const femaleCountElement = document.getElementById('female-count');
    if (maleCountElement) maleCountElement.textContent = maleCount;
    if (femaleCountElement) femaleCountElement.textContent = femaleCount;
    // --- Fim da lógica para Homens e Mulheres ---

    // --- Nova lógica para calcular a média de idade usando a coluna 'IDADE' ---
    const ageColIndex = header.indexOf('IDADE'); // Encontra o índice da coluna 'IDADE'
    let totalAge = 0;
    let validAgeCount = 0;

    if (ageColIndex !== -1) { // Verifica se a coluna 'IDADE' existe
      rows.forEach(row => {
        const ageValue = String(row[ageColIndex]).trim();
        const age = parseFloat(ageValue); // Converte o valor para número

        if (!isNaN(age) && age > 0) { // Valida se é um número e maior que zero
          totalAge += age;
          validAgeCount++;
        }
      });
    }

    const averageAge = validAgeCount > 0 ? (totalAge / validAgeCount).toFixed(0) : 'N/D';
    const averageAgeElement = document.getElementById('average-age');
    if (averageAgeElement) {
      averageAgeElement.textContent = `${averageAge} anos`;
    }
    // --- Fim da nova lógica para média de idade ---

    const egoIdxs = [1, 2, 3, 4, 5].map(n => header.indexOf(`EVOC${n}`)).filter(i => i >= 0);
    const alterIdxs = [6, 7, 8, 9, 10].map(n => header.indexOf(`EVOC${n}`)).filter(i => i >= 0);
    const egoRes = egoIdxs.map(calc);
    const alterRes = alterIdxs.map(calc);

    renderCards('egoCards', egoRes, 'EGO ');
    renderCards('alterCards', alterRes, 'ALTER ');

    drawTopTermsChart('egoChart', calcTopTerms(1, 5), getAllTerms(1, 5).length, '#4caf50');
    drawChart('egoCardsChart', egoRes, ['#f44336', '#8bc34a', '#2196f3', '#ffeb3b', '#4caf50']);
    drawTopTermsChart('alterChart', calcTopTerms(6, 10), getAllTerms(6, 10).length, '#009688');
    drawChart('alterCardsChart', alterRes, ['#e91e63', '#9c27b0', '#3f51b5', '#009688', '#ff9800']);

    generateOtherCards(header, rows, document.getElementById('othersCards'));

    moveCardsIntoChart('egoCards');
    moveCardsIntoChart('alterCards');

    reorderSections(['egoCards', 'alterCards', 'othersCards']);
  }

  function createSections(main, sections) {
    sections.forEach(sec => {
      const s = document.createElement('section');
      s.classList.add('group', sec.id);
      s.innerHTML = `<h2 id="Texto2">${sec.title}</h2><div id="${sec.id}" class="cards-container"></div>`;
      if (sec.charts) sec.charts.forEach(id => createChartContainer(s, id));
      main.appendChild(s);
    });
  }

  function createChartContainer(sectionEl, chartId) {
    const cfg = chartConfig[chartId];
    const cw = document.createElement('div');
    cw.classList.add('chart-container');
    cw.innerHTML = `
      <h3>${cfg.title}</h3>
      <p>${cfg.subtitle}</p>
      <canvas id="${chartId}"></canvas>
    `;
    sectionEl.appendChild(cw);
  }

  function moveCardsIntoChart(sectionId) {
    const section = document.querySelector(`section.group.${sectionId}`);
    const cards = section.querySelector(`div#${sectionId}`);
    const charts = section.querySelectorAll('.chart-container');
    if (cards && charts[1]) charts[1].appendChild(cards);
  }

  function loadData(planilha) {
    try {
      return JSON.parse(localStorage.getItem(`planilha_${planilha}`)) || [];
    } catch {
      alert('Erro ao carregar dados.');
      return null;
    }
  }

  function calc(colIdx) {
    const vals = rows.map(r => r[colIdx]).filter(v => v && String(v).trim().toUpperCase() !== 'VAZIO');
    const nums = vals.map(v => parseFloat(String(v).replace(',', '.'))).filter(n => !isNaN(n));
    if (nums.length >= vals.length / 2) {
      const sum = nums.reduce((a, b) => a + b, 0);
      return { isNum: true, avg: (sum / nums.length).toFixed(2), total: vals.length };
    } else {
      const freq = {};
      vals.forEach(v => freq[v] = (freq[v] || 0) + 1);
      const [top, topCount] = Object.entries(freq).sort((a, b) => b[1] - a[1])[0] || ['N/D', 0];
      return { isNum: false, top, topCount, total: vals.length };
    }
  }

  function getAllTerms(start, end) {
    return rows.flatMap(r => {
      return Array.from({ length: end - start + 1 }, (_, i) => r[header.indexOf(`EVOC${start + i}`)]).filter(v => v && String(v).trim().toUpperCase() !== 'VAZIO');
    });
  }

  function calcTopTerms(start, end) {
    const freq = {};
    getAllTerms(start, end).forEach(v => freq[v] = (freq[v] || 0) + 1);
    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([term, count]) => ({ term, count }));
  }

  function renderCards(containerId, results, prefix) {
    const cont = document.getElementById(containerId);
    results.forEach((r, i) => cont.appendChild(createCard(prefix + (i + 1), r)));
  }

  function createCard(title, result) {
    const card = document.createElement('div');
    card.className = 'card';
    const val = result.isNum ? result.avg : `${result.top} (${result.topCount})`;
    card.innerHTML = `<h3>${title}</h3><p>${val}</p>`;
    return card;
  }

  function drawChart(canvasId, results, colors) {
    new Chart(
      document.getElementById(canvasId).getContext('2d'),
      {
        type: 'bar',
        data: {
          labels: results.map((r, i) => r.isNum ? `Col${i + 1}` : r.top),
          datasets: [
            { label: 'Frequência', data: results.map(r => r.isNum ? 0 : r.topCount), backgroundColor: colors },
            { label: 'Total', data: results.map(r => r.total), backgroundColor: 'rgba(200,200,200,0.7)' }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: { x: { stacked: false }, y: { beginAtZero: true } },
          plugins: {
            legend: { position: 'top' },
            tooltip: { enabled: false },
            datalabels: { // <--- Adicione ou modifique esta seção
              anchor: 'end',
              align: 'start',
              formatter: v => v,
              color: '#FFFFFF' // <--- Define a cor do texto para branco
            }
          }
        },
        plugins: [ChartDataLabels]
      }
    );
  }

  function drawTopTermsChart(canvasId, topTerms, total, color) {
    const labels = [...topTerms.map(t => t.term), 'Total'];
    const freqData = [...topTerms.map(t => t.count), null];
    const totData = [...topTerms.map(() => null), total];
    new Chart(
      document.getElementById(canvasId).getContext('2d'),
      {
        type: 'bar',
        data: {
          labels,
          datasets: [
            { label: 'Frequência', data: freqData, backgroundColor: color },
            { label: 'Total', data: totData, backgroundColor: 'rgba(200,200,200,0.7)' }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: { x: { stacked: false }, y: { beginAtZero: true } },
          plugins: {
            legend: { position: 'top' },
            datalabels: { // <--- Adicione esta seção aqui também
              anchor: 'end',
              align: 'start',
              formatter: v => v,
              color: '#FFFFFF' // <--- Define a cor do texto para branco
            }
          }
        },
        plugins: [ChartDataLabels] // <--- Certifique-se de que o plugin está aqui
      }
    );
  }

  function generateOtherCards(headerParam, rowsParam, container) {
    headerParam.forEach((col, i) => {
      // Exclui as colunas 'SEXO' e 'IDADE' dos "Outros Campos"
      if (!col.startsWith('EVOC') && col !== 'SEXO' && col !== 'IDADE') container.appendChild(createCard(col, calc(i)));
    });
  }

  function reorderSections(order) {
    const main = document.querySelector('main.container');
    order.forEach(id => {
      const sec = main.querySelector(`section.${id}`);
      if (sec) main.appendChild(sec);
    });
  }
})();