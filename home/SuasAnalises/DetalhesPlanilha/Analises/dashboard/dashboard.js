(async function () {
  // --- VARIÁVEIS GLOBAIS E CONFIGURAÇÃO ---
  let header = [];
  let rows = [];
  let currentPlanilhaName = '';
  const SELECTED_CARDS_BASE_STORAGE_KEY = 'agora_selected_cards_';
  let currentlySelectedCardIds = new Set();
  const DATALABELS_URL = 'https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.2.0/dist/chartjs-plugin-datalabels.min.js';
  const DB_NAME = 'agoraDB';
  const STORE_NAME = 'planilhas';

  // --- FUNÇÕES DE BANCO DE DADOS LOCAL (INDEXEDDB) ---
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
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(key);
    return new Promise((resolve, reject) => {
      request.onsuccess = (event) => resolve(event.target.result ? event.target.result.value : null);
      request.onerror = (event) => reject(event.target.error);
    });
  }

  async function setItem(key, value) {
    const db = await openDB();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.put({ key, value });
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = (event) => reject(event.target.error);
    });
  }

  // --- FUNÇÕES DE INICIALIZAÇÃO E CARREGAMENTO ---
  function loadScript(url) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = url;
      s.async = true;
      s.onload = resolve;
      s.onerror = () => reject(new Error(`Falha ao carregar ${url}`));
      document.head.appendChild(s);
    });
  }

  async function loadData(planilha) {
    try {
      return await getItem(`planilha_${planilha}`) || [];
    } catch {
      alert(await window.getTranslation('dashboard_data_load_error'));
      return null;
    }
  }

  // --- LÓGICA PRINCIPAL DO DASHBOARD ---
  async function runDashboard() {
    const planilha = new URLSearchParams(location.search).get('planilha');
    if (!planilha) {
        alert(await window.getTranslation('dashboard_sheet_param_missing'));
        return;
    }

    currentPlanilhaName = planilha;
    document.getElementById('nome-da-planilha').textContent = currentPlanilhaName.toUpperCase();

    try {
      const savedCards = await getItem(SELECTED_CARDS_BASE_STORAGE_KEY + currentPlanilhaName);
      currentlySelectedCardIds = new Set(savedCards || []);
    } catch (e) {
      console.error("[STORAGE] Erro ao carregar cards do IndexedDB:", e);
      currentlySelectedCardIds = new Set();
    }

    const main = document.querySelector('main#dashboard-content');
    const sections = [
      { id: 'egoCards', titleKey: 'egos', charts: ['egoChart', 'egoCardsChart'] },
      { id: 'alterCards', titleKey: 'alters', charts: ['alterChart', 'alterCardsChart'] },
      { id: 'othersCards', titleKey: 'other_fields' }
    ];
    await createSections(main, sections);

    const data = await loadData(planilha);
    if (!data) return;

    header = data[0].map(h => String(h).trim().toUpperCase());
    rows = data.slice(1);

    const egoIdxs = [1, 2, 3, 4, 5].map(n => header.indexOf(`EVOC${n}`)).filter(i => i >= 0);
    const alterIdxs = [6, 7, 8, 9, 10].map(n => header.indexOf(`EVOC${n}`)).filter(i => i >= 0);
    const egoRes = egoIdxs.map(calc);
    const alterRes = alterIdxs.map(calc);

    const egoTranslated = await window.getTranslation('ego');
    const alterTranslated = await window.getTranslation('alter');

    renderCards('egoCards', egoRes, `${egoTranslated} `);
    renderCards('alterCards', alterRes, `${alterTranslated} `);

    await drawTopTermsChart('egoChart', calcTopTerms(1, 5), getAllTerms(1, 5).length, '#4caf50');
    await drawChart('egoCardsChart', egoRes, ['#f44336', '#8bc34a', '#2196f3', '#ffeb3b', '#4caf50']);
    await drawTopTermsChart('alterChart', calcTopTerms(6, 10), getAllTerms(6, 10).length, '#009688');
    await drawChart('alterCardsChart', alterRes, ['#e91e63', '#9c27b0', '#3f51b5', '#009688', '#ff9800']);

    generateOtherCards(header, rows, document.getElementById('othersCards'));
    
    setTimeout(reapplySelectedState, 100);
  }

  // --- FUNÇÕES DE CRIAÇÃO DE UI E RENDERIZAÇÃO ---
  async function createSections(main, sections) {
    for (const sec of sections) {
        const s = document.createElement('section');
        s.classList.add('group', sec.id);
        const translatedTitle = await window.getTranslation(sec.titleKey);
        s.innerHTML = `<h2 id="Texto2">${translatedTitle}</h2>`;

        if (sec.charts) {
            for (const id of sec.charts) {
                await createChartContainer(s, id);
            }
        }
        
        const cardsContainer = document.createElement('div');
        cardsContainer.id = sec.id;
        cardsContainer.className = 'cards-container';
        s.appendChild(cardsContainer);

        main.appendChild(s);
    }
}

async function createChartContainer(sectionEl, chartId) {
    const title = await window.getTranslation(`dashboard_${chartId}_title`);
    const subtitle = await window.getTranslation(`dashboard_${chartId}_subtitle`);

    const cw = document.createElement('div');
    cw.classList.add('chart-container');
    cw.innerHTML = `
      <h3>${title}</h3>
      <p>${subtitle}</p>
      <canvas id="${chartId}"></canvas>
    `;
    sectionEl.appendChild(cw);
}

  // --- FUNÇÕES DE CÁLCULO DE DADOS ---
  function calc(colIdx) {
    const vals = rows.map(r => r[colIdx]).filter(v => v && String(v).trim().toUpperCase() !== 'VAZIO');
    const nums = vals.map(v => parseFloat(String(v).replace(',', '.'))).filter(n => !isNaN(n));
    if (nums.length >= vals.length / 2) {
      const sum = nums.reduce((a, b) => a + b, 0);
      return { isNum: true, avg: (sum / nums.length).toFixed(2), total: vals.length };
    } else {
      const freq = {};
      vals.forEach(v => {
        const cleanedV = String(v).trim();
        freq[cleanedV] = (freq[cleanedV] || 0) + 1;
      });
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
    getAllTerms(start, end).forEach(v => {
        const cleanedV = String(v).trim();
        freq[cleanedV] = (freq[cleanedV] || 0) + 1;
    });
    return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([term, count]) => ({ term, count }));
  }

  // --- FUNÇÕES DE MANIPULAÇÃO DE CARDS ---
  function renderCards(containerId, results, prefix) {
    const cont = document.getElementById(containerId);
    cont.innerHTML = '';
    results.forEach((r, i) => cont.appendChild(createCard(prefix + (i + 1), r, containerId)));
  }

  function createCard(title, result, parentContainerId) {
    const card = document.createElement('div');
    card.className = 'card';
    card.setAttribute('data-selected', 'false');
    const safeTitle = title.replace(/[^a-zA-Z0-9-]/g, '_');
    const cardContentHash = btoa(unescape(encodeURIComponent(title + result.top + result.avg))).slice(0, 8);
    card.id = `original-card-${parentContainerId}-${safeTitle}-${cardContentHash}`;
    
    const val = result.isNum ? result.avg : `${result.top} (${result.topCount})`;
    card.innerHTML = `<h3>${title}</h3><p>${val}<i class="fas fa-star star-icon"></i></p>`;

    card.addEventListener('click', function () {
      const isSelected = this.getAttribute('data-selected') === 'true';
      this.setAttribute('data-selected', !isSelected);
      
      if (!isSelected) {
        this.classList.add('selected');
        currentlySelectedCardIds.add(this.id);
        duplicateCardToTop(this.id, title, val);
      } else {
        this.classList.remove('selected');
        currentlySelectedCardIds.delete(this.id);
        removeDuplicatedCard(this.id);
      }
      saveSelectedCards();
    });

    return card;
  }

  async function duplicateCardToTop(originalCardId, title, value) {
    const topContainer = document.getElementById('selected-cards-display');
    if (topContainer) {
      if (topContainer.querySelector(`#cloned-${originalCardId}`)) return;

      // Limpa a mensagem inicial se for o primeiro card
      if (topContainer.querySelector('.initial-message')) {
          topContainer.innerHTML = '';
      }

      const clonedCard = document.createElement('div');
      clonedCard.className = 'card duplicated-card';
      clonedCard.id = `cloned-${originalCardId}`;
      clonedCard.innerHTML = `<h3>${title}</h3><p>${value}</p>`;
      
      clonedCard.addEventListener('click', function() {
          const originalCard = document.getElementById(originalCardId);
          if (originalCard) {
              originalCard.click();
          } else {
              removeDuplicatedCard(originalCardId);
              currentlySelectedCardIds.delete(originalCardId);
              saveSelectedCards();
          }
      });
      topContainer.appendChild(clonedCard);
    }
  }

  async function removeDuplicatedCard(originalCardId) {
    const topContainer = document.getElementById('selected-cards-display');
    const clonedCard = topContainer.querySelector(`#cloned-${originalCardId}`);
    if (clonedCard) {
      topContainer.removeChild(clonedCard);
    }
    // Se não houver mais cards, mostra a mensagem inicial
    if (topContainer.children.length === 0) {
        const title = await window.getTranslation('no_favorite_cards');
        const subtitle = await window.getTranslation('customize_area_message');
        topContainer.innerHTML = `<div class="initial-message"><h2>${title}</h2><p>${subtitle}</p></div>`;
    }
  }

  async function saveSelectedCards() {
    try {
      await setItem(SELECTED_CARDS_BASE_STORAGE_KEY + currentPlanilhaName, Array.from(currentlySelectedCardIds));
    } catch (e) {
      console.error("[STORAGE] Erro ao salvar cards no IndexedDB:", e);
    }
  }

  async function reapplySelectedState() {
      const topContainer = document.getElementById('selected-cards-display');
      topContainer.innerHTML = ''; // Limpa antes de reaplicar

      if (currentlySelectedCardIds.size === 0) {
          const title = await window.getTranslation('no_favorite_cards');
          const subtitle = await window.getTranslation('customize_area_message');
          topContainer.innerHTML = `<div class="initial-message"><h2>${title}</h2><p>${subtitle}</p></div>`;
          return;
      }

      currentlySelectedCardIds.forEach(id => {
          const originalCard = document.getElementById(id);
          if (originalCard) {
              originalCard.classList.add('selected');
              originalCard.setAttribute('data-selected', 'true');
              const title = originalCard.querySelector('h3').textContent;
              const value = originalCard.querySelector('p').textContent;
              duplicateCardToTop(id, title, value);
          } else {
              currentlySelectedCardIds.delete(id);
          }
      });
      if (document.querySelectorAll('.duplicated-card').length !== currentlySelectedCardIds.size) {
        saveSelectedCards();
      }
  }

  // --- FUNÇÕES DE DESENHO DE GRÁFICOS ---
  async function drawChart(canvasId, results, colors) {
    const frequencyLabel = await window.getTranslation('dashboard_frequency_label');
    const totalLabel = await window.getTranslation('dashboard_total_label');
    
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    
    new Chart(ctx.getContext('2d'), {
      type: 'bar',
      data: {
        labels: results.map((r, i) => r.isNum ? `Col${i + 1}` : r.top),
        datasets: [{
          label: frequencyLabel,
          data: results.map(r => r.isNum ? 0 : r.topCount),
          backgroundColor: colors
        }, {
          label: totalLabel,
          data: results.map(r => r.total),
          backgroundColor: 'rgba(200,200,200,0.7)'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { y: { beginAtZero: true } },
        plugins: {
          legend: { position: 'top' },
          tooltip: { enabled: true },
          datalabels: {
            anchor: 'end',
            align: 'start',
            formatter: v => v,
            color: '#FFFFFF'
          }
        }
      },
      plugins: [ChartDataLabels]
    });
  }

  async function drawTopTermsChart(canvasId, topTerms, total, color) {
    const frequencyLabel = await window.getTranslation('dashboard_frequency_label');
    const totalLabel = await window.getTranslation('dashboard_total_label');
    
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    
    new Chart(ctx.getContext('2d'), {
      type: 'bar',
      data: {
        labels: [...topTerms.map(t => t.term), totalLabel],
        datasets: [{
          label: frequencyLabel,
          data: [...topTerms.map(t => t.count), null],
          backgroundColor: color
        }, {
          label: totalLabel,
          data: [...topTerms.map(() => null), total],
          backgroundColor: 'rgba(200,200,200,0.7)'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { y: { beginAtZero: true } },
        plugins: {
          legend: { position: 'top' },
          datalabels: {
            anchor: 'end',
            align: 'start',
            formatter: v => v,
            color: '#FFFFFF'
          }
        }
      },
      plugins: [ChartDataLabels]
    });
  }

  function generateOtherCards(headerParam, rowsParam, container) {
    headerParam.forEach((col, i) => {
      if (!col.startsWith('EVOC')) {
        container.appendChild(createCard(col, calc(i), 'othersCards'));
      }
    });
  }

  // --- INICIALIZAÇÃO ---
  loadScript(DATALABELS_URL)
    .then(() => {
      if (window.ChartDataLabels) Chart.register(ChartDataLabels);
      runDashboard();
    })
    .catch(console.error);

})();

