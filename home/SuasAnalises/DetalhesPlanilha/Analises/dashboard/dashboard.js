(function () {
  let header = [];
  let rows = [];

  let currentPlanilhaName = '';
  const SELECTED_CARDS_BASE_STORAGE_KEY = 'agora_selected_cards_';
  let currentlySelectedCardIds = new Set();

  const DATALABELS_URL = 'https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.2.0/dist/chartjs-plugin-datalabels.min.js';

  const DB_NAME = 'agoraDB';
  const STORE_NAME = 'planilhas';

  const chartConfig = {
    egoCardsChart: { title: 'Análise de Frequência EGO', subtitle: 'Distribuição de respostas por cada EGO' },
    egoChart: { title: 'Termos Principais EGO', subtitle: 'Top 4 termos mais frequentes em EGO' },
    alterCardsChart: { title: 'Análise de Frequência ALTER', subtitle: 'Distribuição de respostas por cada ALTER' },
    alterChart: { title: 'Termos Principais ALTER', subtitle: 'Top 4 termos mais frequentes em ALTER' }
  };

  // Abre ou cria o banco de dados IndexedDB
  function openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        }
      };

      request.onsuccess = (event) => {
        resolve(event.target.result);
      };

      request.onerror = (event) => {
        reject(event.target.error);
      };
    });
  }

    // Pega um item do IndexedDB
    async function getItem(key) {
        const db = await openDB();
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(key);

        return new Promise((resolve, reject) => {
            request.onsuccess = (event) => {
                resolve(event.target.result ? event.target.result.value : null);
            };
            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }

    // Adiciona ou atualiza um item no IndexedDB
    async function setItem(key, value) {
        const db = await openDB();
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put({ key, value });

        return new Promise((resolve, reject) => {
            transaction.oncomplete = () => {
                resolve();
            };
            transaction.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }

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

  async function runDashboard() {
    const planilha = new URLSearchParams(location.search).get('planilha');
    if (!planilha) return alert("Falta o parâmetro 'planilha' na URL.");

<<<<<<< HEAD
    currentPlanilhaName = planilha;

    try {
      currentlySelectedCardIds = new Set(JSON.parse(localStorage.getItem(SELECTED_CARDS_BASE_STORAGE_KEY + currentPlanilhaName) || '[]'));
    } catch (e) {
      console.error("[STORAGE] Erro ao carregar cards do localStorage:", e);
      currentlySelectedCardIds = new Set();
=======
    currentPlanilhaName = planilha; // Armazena o nome da planilha
    // Carrega os IDs selecionados com base na planilha atual do IndexedDB
    try {
        const savedCards = await getItem(SELECTED_CARDS_BASE_STORAGE_KEY + currentPlanilhaName);
        currentlySelectedCardIds = new Set(savedCards || []);
        console.log(`[STORAGE] Carregando cards selecionados para '${currentPlanilhaName}':`, Array.from(currentlySelectedCardIds));
    } catch (e) {
        console.error("[STORAGE] Erro ao carregar cards do IndexedDB:", e);
        currentlySelectedCardIds = new Set(); // Resetar em caso de erro
>>>>>>> c79f5825b9851fac7dd356bb5a4d8a070f5d621b
    }


    const barraTop = document.createElement('div');
    barraTop.className = 'top-barra-planilha';
    barraTop.innerHTML = `
      <div class="barra-conteudo card-banner">
        <div class="barra-logo">
          <img src="/assets/tipo_de_analise_agora.png" alt="Logo Ágora">
          <div class="titulo-site">METODOLOGIAS DAS<br>ÁGORAS COGNITIVAS</div>
        </div>
        <div class="barra-planilha">${planilha.toUpperCase()}</div>
      </div>
    `;
    const headerEl = document.querySelector('header');
    if (headerEl) headerEl.parentNode.insertBefore(barraTop, headerEl);

    const main = document.querySelector('main.container');
    main.innerHTML = '<h1 style="color:#FFD600">Dashboard de Análise de Dados</h1>';

    const selectedCardsDisplay = document.getElementById('selected-cards-display');
    if (!selectedCardsDisplay) return;

    selectedCardsDisplay.innerHTML = `
      <p id="no-favorites-message" class="text-center" style="width:100%; color:var(--color-subtext); font-weight:bold;">
        Personalize esta área escolhendo itens abaixo para que sejam exibidos aqui em destaque
      </p>
    `;

    const sections = [
      { id: 'egoCards', title: 'Egos', charts: ['egoChart', 'egoCardsChart'] },
      { id: 'alterCards', title: 'Alters', charts: ['alterChart', 'alterCardsChart'] },
      { id: 'othersCards', title: 'Outros Campos' }
    ];
    createSections(main, sections);

    const data = await loadData(planilha);
    if (!data) return;

    header = data[0].map(h => String(h).trim().toUpperCase()); // <- FIX: não é mais const
    rows = data.slice(1);

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

    setTimeout(() => {
      reapplySelectedState();
      updateNoFavoritesMessage();
    }, 100);
  }

  function updateNoFavoritesMessage() {
    const container = document.getElementById('selected-cards-display');
    const msg = document.getElementById('no-favorites-message');
    if (!container || !msg) return;
    const hasCards = container.querySelectorAll('.duplicated-card').length > 0;
    msg.style.display = hasCards ? 'none' : 'block';
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
    cw.innerHTML = `<h3>${cfg.title}</h3><p>${cfg.subtitle}</p><canvas id="${chartId}"></canvas>`;
    sectionEl.appendChild(cw);
  }

  function moveCardsIntoChart(sectionId) {
    const section = document.querySelector(`section.group.${sectionId}`);
    const cards = section.querySelector(`div#${sectionId}`);
    const charts = section.querySelectorAll('.chart-container');
    if (cards && charts[1]) charts[1].appendChild(cards);
  }

  async function loadData(planilha) {
    try {
        return await getItem(`planilha_${planilha}`) || [];
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
    return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([term, count]) => ({ term, count }));
  }

  function renderCards(containerId, results, prefix) {
    const cont = document.getElementById(containerId);
    results.forEach((r, i) => cont.appendChild(createCard(prefix + (i + 1), r, containerId)));
  }

  function createCard(title, result, parentContainerId) {
    const card = document.createElement('div');
    card.className = 'card';
    card.setAttribute('data-selected', 'false');
    const safeTitle = title.replace(/[^a-zA-Z0-9-]/g, '_');
    const cardContentHash = btoa(unescape(encodeURIComponent(title + result.top + result.avg))).slice(0, 8);
    card.id = `original-card-${parentContainerId}-${safeTitle}-${cardContentHash}`;
<<<<<<< HEAD
=======

>>>>>>> c79f5825b9851fac7dd356bb5a4d8a070f5d621b
    const val = result.isNum ? result.avg : `${result.top} (${result.topCount})`;
    card.innerHTML = `<h3>${title}</h3><p>${val}<i class="far fa-star star-icon"></i></p>`;

    card.addEventListener('click', function () {
      const isSelected = card.getAttribute('data-selected') === 'true';
      card.setAttribute('data-selected', !isSelected);

      if (!isSelected) {
        card.classList.add('selected');
        currentlySelectedCardIds.add(card.id);
        saveSelectedCards();
        card.querySelector('.star-icon').classList.replace('far', 'fas');
        duplicateCardToTop(card.id, title, val);
      } else {
        card.classList.remove('selected');
        const star = card.querySelector('.star-icon');
        if (star) star.classList.replace('fas', 'far');
        currentlySelectedCardIds.delete(card.id);
        saveSelectedCards();
        removeDuplicatedCard(card.id);
      }
    });

    return card;
  }

  function duplicateCardToTop(originalCardId, title, value) {
    const topContainer = document.getElementById('selected-cards-display');
    if (!topContainer || topContainer.querySelector(`#cloned-${originalCardId}`)) return;
    const clonedCard = document.createElement('div');
    clonedCard.className = 'card duplicated-card';
    clonedCard.id = `cloned-${originalCardId}`;
    clonedCard.innerHTML = `<h3>${title}</h3><p>${value}</p>`;
    clonedCard.addEventListener('click', function (event) {
      event.stopPropagation();
      const originalCard = document.getElementById(originalCardId);
      if (originalCard) {
        originalCard.classList.remove('selected');
        originalCard.setAttribute('data-selected', 'false');
        const star = originalCard.querySelector('.star-icon');
        if (star) star.classList.replace('fas', 'far');
      }
<<<<<<< HEAD
      currentlySelectedCardIds.delete(originalCardId);
      saveSelectedCards();
      removeDuplicatedCard(originalCardId);
    });
    topContainer.appendChild(clonedCard);
    updateNoFavoritesMessage();
=======

      const clonedCard = document.createElement('div');
      clonedCard.className = 'card duplicated-card';
      clonedCard.id = `cloned-${originalCardId}`;
      clonedCard.innerHTML = `<h3>${title}</h3><p>${value}</p>`;

      clonedCard.addEventListener('click', function(event) {
          event.stopPropagation();
          console.log(`[DUPLICATE EVENT] Clicked duplicated card: ${clonedCard.id}. Attempting to deselect original: ${originalCardId}`); // Debug log
          const originalCard = document.getElementById(originalCardId);
          if (originalCard) {
              originalCard.classList.remove('selected');
              originalCard.setAttribute('data-selected', 'false');
              currentlySelectedCardIds.delete(originalCard.id); // Remove do Set
              saveSelectedCards(); // Salva no IndexedDB
              removeDuplicatedCard(originalCardId);
              console.log(`[DUPLICATE EVENT] Successfully deselected original card and removed duplicated for: ${originalCardId}`); // Debug log
          } else {
              console.error(`[DUPLICATE EVENT] Original card with ID ${originalCardId} not found when clicking duplicated card. Removing only duplicated.`); // Debug log
              currentlySelectedCardIds.delete(originalCardId); // Limpa do armazenamento se o original não for encontrado
              saveSelectedCards(); // Salva
              removeDuplicatedCard(originalCardId);
          }
      });

      topContainer.appendChild(clonedCard);
      console.log(`[DUPLICATE] Duplicated card added: ${clonedCard.id}`); // Debug log
    }
>>>>>>> c79f5825b9851fac7dd356bb5a4d8a070f5d621b
  }

  function removeDuplicatedCard(originalCardId) {
    const topContainer = document.getElementById('selected-cards-display');
    if (!topContainer) return;
    const clonedCard = topContainer.querySelector(`#cloned-${originalCardId}`);
    if (clonedCard) topContainer.removeChild(clonedCard);
    updateNoFavoritesMessage();
  }

  function saveSelectedCards() {
    try {
      localStorage.setItem(SELECTED_CARDS_BASE_STORAGE_KEY + currentPlanilhaName, JSON.stringify(Array.from(currentlySelectedCardIds)));
    } catch (e) {
      console.error("[STORAGE] Erro ao salvar cards no localStorage:", e);
    }
  }

<<<<<<< HEAD
  function reapplySelectedState() {
    currentlySelectedCardIds.forEach(id => {
      const originalCard = document.getElementById(id);
      if (originalCard) {
        originalCard.classList.add('selected');
        originalCard.setAttribute('data-selected', 'true');
        const title = originalCard.querySelector('h3')?.textContent || 'N/A';
        const value = originalCard.querySelector('p')?.textContent || 'N/A';
        duplicateCardToTop(originalCard.id, title, value);
      } else {
        currentlySelectedCardIds.delete(id);
=======
  // --- Funções de persistência ---

  async function saveSelectedCards() {
      try {
          await setItem(SELECTED_CARDS_BASE_STORAGE_KEY + currentPlanilhaName, Array.from(currentlySelectedCardIds));
          console.log(`[STORAGE] Cards selecionados salvos para '${currentPlanilhaName}':`, Array.from(currentlySelectedCardIds));
      } catch (e) {
          console.error("[STORAGE] Erro ao salvar cards no IndexedDB:", e);
      }
  }

  function reapplySelectedState() {
      console.log(`[STORAGE] Reaplicando estado selecionado para '${currentPlanilhaName}'. IDs a re-aplicar:`, Array.from(currentlySelectedCardIds));
      const foundCardsToReselect = []; // Para depurar cards não encontrados
      currentlySelectedCardIds.forEach(id => {
          const originalCard = document.getElementById(id);
          if (originalCard) {
              // Aplicar a classe e atributo 'selected'
              originalCard.classList.add('selected');
              originalCard.setAttribute('data-selected', 'true');

              // Extrair title e value para duplicar (garantir que pega o texto correto do DOM)
              const title = originalCard.querySelector('h3') ? originalCard.querySelector('h3').textContent : 'N/A';
              const value = originalCard.querySelector('p') ? originalCard.querySelector('p').textContent : 'N/A';

              duplicateCardToTop(originalCard.id, title, value);
              foundCardsToReselect.push(id); // Adiciona aos encontrados
              console.log(`[STORAGE] Re-selecionado e duplicado card: ${id}`);
          } else {
              console.warn(`[STORAGE] Card com ID ${id} não encontrado durante reapplySelectedState. Removendo do armazenamento.`);
              // Se o card original não for encontrado, remove-o do armazenamento para evitar problemas futuros.
              currentlySelectedCardIds.delete(id);
          }
      });

      if (foundCardsToReselect.length !== currentlySelectedCardIds.size) {
          saveSelectedCards();
>>>>>>> c79f5825b9851fac7dd356bb5a4d8a070f5d621b
      }
    });
    saveSelectedCards();
  }

  function drawChart(canvasId, results, colors) {
    new Chart(document.getElementById(canvasId).getContext('2d'), {
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

  function drawTopTermsChart(canvasId, topTerms, total, color) {
    new Chart(document.getElementById(canvasId).getContext('2d'), {
      type: 'bar',
      data: {
        labels: [...topTerms.map(t => t.term), 'Total'],
        datasets: [
          { label: 'Frequência', data: [...topTerms.map(t => t.count), null], backgroundColor: color },
          { label: 'Total', data: [...topTerms.map(() => null), total], backgroundColor: 'rgba(200,200,200,0.7)' }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { x: { stacked: false }, y: { beginAtZero: true } },
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
      if (!col.startsWith('EVOC') && col !== 'SEXO' && col !== 'IDADE') {
        container.appendChild(createCard(col, calc(i), 'othersCards'));
      }
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
