// --- Dicionários de Normalização ---
const stateAcronyms = { 'AC': 'Acre', 'AL': 'Alagoas', 'AP': 'Amapá', 'AM': 'Amazonas', 'BA': 'Bahia', 'CE': 'Ceará', 'DF': 'Distrito Federal', 'ES': 'Espírito Santo', 'GO': 'Goiás', 'MA': 'Maranhão', 'MT': 'Mato Grosso', 'MS': 'Mato Grosso do Sul', 'MG': 'Minas Gerais', 'PA': 'Pará', 'PB': 'Paraíba', 'PR': 'Paraná', 'PE': 'Pernambuco', 'PI': 'Piauí', 'RJ': 'Rio de Janeiro', 'RN': 'Rio Grande do Norte', 'RS': 'Rio Grande do Sul', 'RO': 'Rondônia', 'RR': 'Roraima', 'SC': 'Santa Catarina', 'SP': 'São Paulo', 'SE': 'Sergipe', 'TO': 'Tocantins' };
const cityAcronyms = { 'BH': 'Belo Horizonte', 'POA': 'Porto Alegre', 'SSA': 'Salvador', 'RJ': 'Rio de Janeiro', 'SP': 'São Paulo' };

// --- VARIÁVEIS GLOBAIS ---
let map = null;
let clusterLayer = null;
let allWordsWithCount = [];
let areWordsLoaded = false;
let tippyInstance = null;
let currentPage = 1;
const WORDS_PER_PAGE = 15;

// --- ESTADO DOS FILTROS ---
const filtersState = {
    evocations: {
        isActive: false,
        selectedWords: [],
        matchType: 'all', // 'all' para E, 'any' para OU
    },
    age: {
        isActive: false,
        condition: 'eq',
        value: null,
    },
    category: 'Todas',
    positivity: 'Todas'
};

// --- FUNÇÃO AUXILIAR DE NORMALIZAÇÃO ---
function normalizeString(str) {
    if (!str) return "";
    return str.toString().trim().toUpperCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // Remove acentos e converte para maiúsculo
}

// --- ELEMENTOS DA UI ---
const ui = {
    get descriptionText() { return document.getElementById('description-text'); },
    get messageArea() { return document.getElementById('message-area'); },
    get messageText() { return document.getElementById('message-text'); },
    get messageIcon() { return document.getElementById('message-area')?.querySelector('.message-icon'); },
    get loadingOverlay() { return document.getElementById('loadingOverlay'); },
    get loadingProgressText() { return document.getElementById('loadingProgressText'); },
    get progressBar() { return document.getElementById('progressBar'); },
    get resultsPanel() { return document.getElementById('results-panel'); },
    get unlocatedCitiesSection() { return document.getElementById('unlocatedCitiesSection'); },
    get unlocatedCountSpan() { return document.getElementById('unlocatedCount'); },
    get unlocatedCitiesList() { return document.getElementById('unlocatedCitiesList'); },
    get mapButton() { return document.getElementById('map-button'); },
    get downloadPdfBtn() { return document.getElementById('download-pdf-btn'); },
    get editEvocationsBtn() { return document.getElementById('edit-evocations-filter'); },
    get evocationsFilterCard() { return document.getElementById('evocations-filter-card'); },
    get evocationsFilterStatus() { return document.getElementById('evocations-filter-status'); },
    get editAgeBtn() { return document.getElementById('edit-age-filter'); },
    get ageFilterCard() { return document.getElementById('age-filter-card'); },
    get ageFilterStatus() { return document.getElementById('age-filter-status'); },
    get categorySelect() { return document.getElementById('filtro-categoria'); },
    get positivitySelect() { return document.getElementById('filtro-positividade'); }
};

const icons = {
    info: `<svg class="message-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75ZM12 15a.75.75 0 0 0-.75.75.75.75 0 0 0 1.5 0 .75.75 0 0 0-.75-.75Z" clip-rule="evenodd" /></svg>`,
    success: `<svg class="message-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clip-rule="evenodd" /></svg>`,
    error: `<svg class="message-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="M9.401 3.003c1.155-2.001 4.045-2.001 5.199 0l3.597 6.235c1.155 2.001-.29 4.5-2.599 4.5H8.404c-2.31 0-3.754-2.499-2.599-4.5l3.597-6.235ZM12 9.75a.75.75 0 0 0-.75.75v2.25c0 .414.336.75.75.75h.008a.75.75 0 0 0 .75-.75V10.5a.75.75 0 0 0-.75-.75ZM12 15a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Z" clip-rule="evenodd" /></svg>`,
    warning: `<svg class="message-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clip-rule="evenodd" /></svg>`
};

// --- Funções de Controle da UI ---
async function displayMessage(msgKey, type = 'info', replacements = {}) {
    let msg = await window.getTranslation(msgKey);
    if(!msg) msg = msgKey; 
    for (const placeholder in replacements) {
        msg = msg.replace(`{${placeholder}}`, replacements[placeholder]);
    }
    if(ui.messageText) ui.messageText.innerHTML = msg;
    if(ui.messageArea) ui.messageArea.className = `message-area ${type}`;
    if(ui.messageIcon) ui.messageIcon.innerHTML = icons[type];
}

async function showLoading(show, progress = 0, textKey = 'map_loading_preparing', replacements = {}) {
    if (show) {
        let text = await window.getTranslation(textKey);
        if(!text) text = textKey;
        for (const placeholder in replacements) {
            text = text.replace(`{${placeholder}}`, replacements[placeholder]);
        }
        ui.loadingOverlay.classList.add('visible');
        ui.loadingProgressText.textContent = text;
        ui.progressBar.style.width = `${progress}%`;
    } else {
        ui.loadingOverlay.classList.remove('visible');
        ui.progressBar.style.width = '0%';
    }
}

window.toggleUnlocatedCities = () => { ui.unlocatedCitiesList.classList.toggle('expanded'); }

const urlPlanilha = new URLSearchParams(location.search).get('planilha');
const barraPlanilhaEl = document.getElementById("nome-da-planilha");
if(barraPlanilhaEl) barraPlanilhaEl.textContent = urlPlanilha;

// --- IndexedDB Access ---
async function getStoredItem(key) {
    try {
        const db = await new Promise((resolve, reject) => {
            const request = indexedDB.open('agoraDB', 1);
            request.onsuccess = event => resolve(event.target.result);
            request.onerror = event => reject(event.target.error);
        });
        const transaction = db.transaction('planilhas', 'readonly');
        const store = transaction.objectStore('planilhas');
        const request = store.get(key);
        return await new Promise((resolve, reject) => {
            request.onsuccess = event => resolve(event.target.result ? event.target.result.value : null);
            request.onerror = event => reject(event.target.error);
        });
    } catch (e) {
        console.error("Erro IndexedDB:", e);
        return null;
    }
}

async function loadWords(planilhaNome) {
    if (areWordsLoaded) return;
    try {
        const storedData = await getStoredItem(`planilha_${planilhaNome}`);
        if (!storedData || storedData.length < 2) throw new Error("Planilha não encontrada.");

        const header = storedData[0].map(h => h.toString().toLowerCase().trim());
        const evocColumnIndices = header.map((h, i) => h.startsWith('evoc') ? i : -1).filter(i => i !== -1);
        
        const wordCounts = {};
        for (const row of storedData.slice(1)) {
            for (const index of evocColumnIndices) {
                const word = (row[index] || '').toString().trim().toUpperCase();
                if (word && word !== 'VAZIO') wordCounts[word] = (wordCounts[word] || 0) + 1;
            }
        }
        allWordsWithCount = Object.entries(wordCounts).sort(([, a], [, b]) => b - a);
        areWordsLoaded = true;
        
        // Popula os filtros dinamicamente para garantir que as opções batam com os dados
        await populateCategories(planilhaNome);
        await populatePositivities(planilhaNome);
    } catch (error) {
        console.error(error);
    }
}

async function populateCategories(planilhaNome) {
    if(!ui.categorySelect) return;
    const lemas = await getStoredItem(`lemas_${planilhaNome}`) || {};
    const categories = new Set();
    Object.values(lemas).forEach(l => { if(l.categoria) categories.add(l.categoria.trim()); });

    ui.categorySelect.innerHTML = `<option value="Todas">Todas</option>`;
    Array.from(categories).sort().forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat; opt.textContent = cat;
        ui.categorySelect.appendChild(opt);
    });
}

// NOVO: Popula positividade dinamicamente como as categorias
async function populatePositivities(planilhaNome) {
    if(!ui.positivitySelect) return;
    const lemas = await getStoredItem(`lemas_${planilhaNome}`) || {};
    const positivities = new Set();
    Object.values(lemas).forEach(l => { if(l.positividade) positivities.add(l.positividade.trim()); });

    ui.positivitySelect.innerHTML = `<option value="Todas">Todas</option>`;
    Array.from(positivities).sort().forEach(pos => {
        const opt = document.createElement('option');
        opt.value = pos; opt.textContent = pos;
        ui.positivitySelect.appendChild(opt);
    });
}

// --- Funções de Modal ---
async function getEvocationsModalHTML() {
    return `
        <div id="evocations-modal-content">
            <div id="selected-words-panel" class="hidden">
                <h3>Selecionados (<span id="selected-count">0</span>):</h3>
                <ul id="selected-list"></ul>
                <button id="clear-selected-btn">Limpar</button>
            </div>
            <input type="text" id="word-search-input" class="filter-input" placeholder="Pesquisar...">
            <div id="word-list-container"><p>Carregando...</p></div>
            <div id="pagination-controls"></div>
        </div>`;
}

async function renderWordListInModal(tempSelectedWords) {
    const container = document.getElementById('word-list-container');
    const searchTerm = document.getElementById('word-search-input').value.trim().toUpperCase();
    const filtered = searchTerm ? allWordsWithCount.filter(([w]) => w.includes(searchTerm)) : allWordsWithCount;

    if (filtered.length === 0) {
        container.innerHTML = `<p style='text-align: center; color: #64748b;'>Nenhuma palavra encontrada</p>`;
        return;
    }

    const start = (currentPage - 1) * WORDS_PER_PAGE;
    const pageWords = filtered.slice(start, start + WORDS_PER_PAGE);

    container.innerHTML = pageWords.map(([word, count]) => `
        <div class="word-item">
            <input type="checkbox" id="cb-modal-${word}" value="${word}" ${tempSelectedWords.includes(word) ? 'checked' : ''}>
            <label for="cb-modal-${word}">${word}</label>
            <span class="word-count">${count}</span>
        </div>`).join('');

    renderPaginationInModal(filtered.length, tempSelectedWords);
}

function renderPaginationInModal(totalItems, tempSelectedWords) {
    const controls = document.getElementById('pagination-controls');
    const totalPages = Math.ceil(totalItems / WORDS_PER_PAGE);
    controls.innerHTML = '';
    if (totalPages <= 1) return;

    for (let i = 1; i <= totalPages; i++) {
        if(i > 5 && i < totalPages) continue;
        const btn = document.createElement('button');
        btn.textContent = i;
        btn.className = `page-btn ${i === currentPage ? 'active' : ''}`;
        btn.onclick = () => { currentPage = i; renderWordListInModal(tempSelectedWords); };
        controls.appendChild(btn);
    }
}

function updateSelectedWordsPanelInModal(tempSelectedWords) {
    const panel = document.getElementById('selected-words-panel');
    if (tempSelectedWords.length === 0) { panel.classList.add('hidden'); return; }
    panel.classList.remove('hidden');
    document.getElementById('selected-count').textContent = tempSelectedWords.length;
    document.getElementById('selected-list').innerHTML = tempSelectedWords.map(word => `
        <li class="selected-word-item">${word}<button class="remove-word-btn" data-word="${word}">&times;</button></li>`).join('');
}

// --- Funções de Status dos Filtros ---
async function updateEvocationsFilterStatus() {
    const { isActive, selectedWords, matchType } = filtersState.evocations;
    const matchTypeText = await window.getTranslation(matchType === 'all' ? 'map_match_all_option' : 'map_match_any_option') || (matchType === 'all' ? 'Contém todos (E)' : 'Contém qualquer um (OU)');

    if (isActive && selectedWords.length > 0) {
        ui.evocationsFilterStatus.innerHTML = `${selectedWords.length} palavras (${matchTypeText})`;
        ui.evocationsFilterCard.classList.add('active');
        ui.editEvocationsBtn.textContent = await window.getTranslation('map_btn_edit') || 'Editar';
    } else {
        ui.evocationsFilterStatus.textContent = await window.getTranslation('map_status_no_filter') || 'Nenhum filtro aplicado.';
        ui.evocationsFilterCard.classList.remove('active');
        ui.editEvocationsBtn.textContent = await window.getTranslation('map_btn_configure') || 'Configurar';
    }
    await updateDescription();
}

async function updateAgeFilterStatus() {
    const { isActive, condition, value } = filtersState.age;
    if (isActive && value !== null) {
        const condLabels = { 
            gte: await window.getTranslation('map_age_cond_gte') || 'Maior ou igual', 
            eq: await window.getTranslation('map_age_cond_eq') || 'Igual a', 
            lte: await window.getTranslation('map_age_cond_lte') || 'Menor ou igual' 
        };
        ui.ageFilterStatus.innerHTML = `${condLabels[condition]} ${value} anos`;
        ui.ageFilterCard.classList.add('active');
        ui.editAgeBtn.textContent = await window.getTranslation('map_btn_edit') || 'Editar';
    } else {
        ui.ageFilterStatus.textContent = await window.getTranslation('map_status_no_filter') || 'Nenhum filtro aplicado.';
        ui.ageFilterCard.classList.remove('active');
        ui.editAgeBtn.textContent = await window.getTranslation('map_btn_configure') || 'Configurar';
    }
    await updateDescription();
}

async function getAgeModalHTML() {
    const { condition, value } = filtersState.age;
    return `
        <div class="age-filter-inputs">
            <select id="age-condition-modal" class="filter-input" style="margin-bottom: 10px; width: 100%;">
                <option value="gte" ${condition === 'gte' ? 'selected' : ''}>Maior ou igual</option>
                <option value="eq" ${condition === 'eq' ? 'selected' : ''}>Igual a</option>
                <option value="lte" ${condition === 'lte' ? 'selected' : ''}>Menor ou igual</option>
            </select>
            <input type="number" id="age-value-modal" class="filter-input" placeholder="Idade..." min="0" value="${value || ''}" style="width: 100%;">
        </div>
    `;
}

// --- Mapa Core ---
function initializeMap() {
    if (map) return;
    map = new ol.Map({
        target: 'map',
        layers: [new ol.layer.Tile({ source: new ol.source.OSM() })],
        view: new ol.View({ center: ol.proj.fromLonLat([-51.9253, -14.235]), zoom: 4 }),
        pixelRatio: window.devicePixelRatio || 1
    });
    setupMapInteractions();
}

function setupMapInteractions() {
    map.on('pointermove', async function (evt) {
        if (evt.dragging) { if (tippyInstance) tippyInstance.destroy(); return; }
        const feature = map.forEachFeatureAtPixel(evt.pixel, f => f);
        const mapElement = map.getTargetElement();

        if (feature) {
            mapElement.style.cursor = 'pointer';
            if (tippyInstance) tippyInstance.destroy();
            
            const clusteredFeatures = feature.get('features');
            let content = '';
            
            if (clusteredFeatures.length > 1) {
                const total = clusteredFeatures.reduce((sum, f) => sum + f.get('cityCount'), 0);
                
                let tableRows = clusteredFeatures.map(f => `
                    <tr>
                        <td style="padding: 5px; text-align: left; color: #4A5568;">${f.get('cityName')}</td>
                        <td style="padding: 5px; text-align: right; font-weight: 600; color: #1A202C;">${f.get('cityCount')}</td>
                    </tr>
                `).join('');

                content = `
                    <div style="padding: 4px; font-family: 'Inter', sans-serif; min-width: 250px;">
                        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                            <thead>
                                <tr>
                                    <th style="padding: 8px 5px; text-align: left; font-weight: 700; font-size: 16px; color: #1A202C; border-bottom: 2px solid #E2E8F0;">Cidades</th>
                                    <th style="padding: 8px 5px; text-align: right; font-weight: 700; font-size: 16px; color: #1A202C; border-bottom: 2px solid #E2E8F0;">Pessoas</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${tableRows}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td style="padding: 8px 5px; text-align: left; font-weight: 700; font-size: 16px; color: #1A202C; border-top: 2px solid #E2E8F0;">Total</td>
                                    <td style="padding: 8px 5px; text-align: right; font-weight: 700; font-size: 16px; color: #C53030; border-top: 2px solid #E2E8F0;">${total}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>`;
            } else {
                const f = clusteredFeatures[0];
                const cityName = f.get('cityName');
                const cityCount = f.get('cityCount');
                content = `<div style="padding: 4px 8px; font-family: 'Inter', sans-serif; font-size: 14px;"><strong style="font-size: 15px; color: #1A202C;">${cityName}</strong><br>${cityCount} participante(s)</div>`;
            }
            
            const virtualEl = { getBoundingClientRect: () => ({ width: 0, height: 0, top: evt.pixel[1] + mapElement.getBoundingClientRect().top, right: evt.pixel[0] + mapElement.getBoundingClientRect().left, bottom: evt.pixel[1] + mapElement.getBoundingClientRect().top, left: evt.pixel[0] + mapElement.getBoundingClientRect().left }) };
            tippyInstance = tippy(document.body, { getReferenceClientRect: virtualEl.getBoundingClientRect, content: content, allowHTML: true, placement: 'top', arrow: true, animation: 'fade', theme: 'light-border', trigger: 'manual', appendTo: () => document.body });
            tippyInstance.show();
        } else {
            mapElement.style.cursor = '';
            if (tippyInstance) tippyInstance.destroy();
        }
    });
}

async function processDataFromDB(planilhaNome) {
    await showLoading(true, 0, 'map_process_loading_data');
    ui.unlocatedCitiesSection.classList.add('hidden');
    if (tippyInstance) tippyInstance.destroy();

    try {
        const storedData = await getStoredItem(`planilha_${planilhaNome}`);
        const lemas = await getStoredItem(`lemas_${planilhaNome}`) || {};
        if (!storedData) return;

        // Criar um mapeamento reverso normalizado (Key sempre em MAIÚSCULAS e sem acentos)
        const wordDataLookup = {};
        Object.entries(lemas).forEach(([lemma, data]) => {
            const lemmaKey = normalizeString(lemma);
            wordDataLookup[lemmaKey] = data;
            
            if (data.origem && Array.isArray(data.origem)) {
                data.origem.forEach(orig => {
                    // Remove a contagem (ex: "FOME (5)" vira "FOME") e normaliza
                    const originalWord = normalizeString(orig.split(' (')[0]);
                    wordDataLookup[originalWord] = data;
                });
            }
        });

        const header = storedData[0].map(h => h.toString().toLowerCase().trim());
        const cityCol = header.indexOf('cidades') !== -1 ? header.indexOf('cidades') : header.indexOf('cidade');
        const stateCol = header.indexOf('estado') !== -1 ? header.indexOf('estado') : header.indexOf('estados');
        const ageCol = header.indexOf('idade');
        const evocCols = header.map((h, i) => h.startsWith('evoc') ? i : -1).filter(i => i !== -1);

        const cityCounts = {};
        for (const row of storedData.slice(1)) {
            let pass = true;
            const rowEvocs = evocCols.map(i => (row[i] || '').toString().trim().toUpperCase()).filter(w => w && w !== 'VAZIO');

            // 1. Filtro de Evocações
            if (filtersState.evocations.isActive) {
                const set = new Set(rowEvocs);
                pass = filtersState.evocations.matchType === 'all' 
                    ? filtersState.evocations.selectedWords.every(w => set.has(w))
                    : filtersState.evocations.selectedWords.some(w => set.has(w));
            }
            // 2. Filtro de Idade
            if (pass && filtersState.age.isActive) {
                const age = parseInt(row[ageCol]);
                const val = filtersState.age.value;
                if (isNaN(age)) {
                    pass = false;
                } else if (filtersState.age.condition === 'gte') {
                    pass = age >= val;
                } else if (filtersState.age.condition === 'eq') {
                    pass = age === val;
                } else {
                    pass = age <= val;
                }
            }
            // 3. Filtro de Categoria (IGUAL AO QUE FUNCIONA)
            if (pass && filtersState.category !== 'Todas') {
                const targetCat = normalizeString(filtersState.category);
                pass = rowEvocs.some(w => {
                    const info = wordDataLookup[normalizeString(w)];
                    return normalizeString(info?.categoria) === targetCat;
                });
            }
            // 4. Filtro de Positividade (IGUAL AO DE CATEGORIA)
            if (pass && filtersState.positivity !== 'Todas') {
                const targetPos = normalizeString(filtersState.positivity);
                pass = rowEvocs.some(w => {
                    const info = wordDataLookup[normalizeString(w)];
                    return normalizeString(info?.positividade) === targetPos;
                });
            }

            if (pass && row[cityCol]) {
                const city = row[cityCol].toString().trim().toUpperCase();
                const state = stateCol !== -1 ? row[stateCol] : '';
                const key = city + (state ? `, ${state}` : '');
                cityCounts[key] = (cityCounts[key] || 0) + 1;
            }
        }

        const features = [];
        const uniqueCities = Object.keys(cityCounts);
        for (let i = 0; i < uniqueCities.length; i++) {
            const cityName = uniqueCities[i];
            await showLoading(true, Math.round(((i+1)/uniqueCities.length)*100), 'Geocodificando...', { cityName });
            const coords = await geocodeCity(...cityName.split(', '));
            if (coords) {
                const f = new ol.Feature({ geometry: new ol.geom.Point(ol.proj.fromLonLat([coords[1], coords[0]])) });
                f.setProperties({ cityName, cityCount: cityCounts[cityName] });
                features.push(f);
            }
        }

        if (clusterLayer) map.removeLayer(clusterLayer);
        const vectorSource = new ol.source.Vector({ features });
        clusterLayer = new ol.layer.Vector({
            source: new ol.source.Cluster({ distance: 40, source: vectorSource }),
            style: (feature) => {
                const clusteredFeatures = feature.get('features');
                const totalCount = clusteredFeatures.reduce((sum, f) => sum + f.get('cityCount'), 0);
                
                const radius = 12 + Math.log(totalCount) * 4;
                const startColor = [255, 255, 0], endColor = [255, 0, 0];
                const allCounts = Object.values(cityCounts);
                const maxIndividualCount = Math.max(...allCounts);
                
                let ratio = (maxIndividualCount > 1) ? (Math.log(totalCount) / Math.log(maxIndividualCount)) : 0;
                if(ratio > 1) ratio = 1;

                const r = Math.round(startColor[0] + ratio * (endColor[0] - startColor[0]));
                const g = Math.round(startColor[1] + ratio * (endColor[1] - startColor[1]));
                const color = `rgba(${r}, ${g}, 0, 0.7)`;

                return new ol.style.Style({
                    image: new ol.style.Circle({ 
                        radius: radius, 
                        fill: new ol.style.Fill({ color: color }), 
                        stroke: new ol.style.Stroke({ color: '#6B211E', width: 1.5 }) 
                    }),
                    text: new ol.style.Text({ 
                        text: totalCount.toString(), 
                        fill: new ol.style.Fill({ color: '#fff' }), 
                        stroke: new ol.style.Stroke({ color: 'rgba(0,0,0,0.6)', width: 2.5 }),
                        font: 'bold 12px sans-serif' 
                    })
                });
            }
        });
        map.addLayer(clusterLayer);
        if (features.length > 0) map.getView().fit(vectorSource.getExtent(), { padding: [50, 50, 50, 50], duration: 1000 });

        await showLoading(false);
        ui.downloadPdfBtn.classList.remove('hidden');
        displayMessage('Mapeamento concluído com sucesso!', 'success');
    } catch (e) {
        console.error(e);
        showLoading(false);
    }
}

async function geocodeCity(city, state) {
    const q = `${city}${state ? ', ' + state : ''}, Brasil`;
    try {
        await new Promise(r => setTimeout(r, 500));
        const resp = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`);
        const data = await resp.json();
        return data.length > 0 ? [parseFloat(data[0].lat), parseFloat(data[0].lon)] : null;
    } catch { return null; }
}

async function iniciarMapeamento() {
    ui.resultsPanel.classList.remove('hidden');
    const params = new URLSearchParams(window.location.search);
    const nome = params.get("planilha");
    if (nome) await processDataFromDB(nome);
}

// --- Lifecycle ---
document.addEventListener('DOMContentLoaded', async () => {
    initMapWhenReady();

    const params = new URLSearchParams(window.location.search);
    const planilhaNome = params.get("planilha");

    if (planilhaNome) {
        await loadWords(planilhaNome);
    } else {
        ui.mapButton.disabled = true;
    }

    ui.mapButton.addEventListener('click', iniciarMapeamento);

    ui.categorySelect?.addEventListener('change', (e) => {
        filtersState.category = e.target.value;
        updateDescription();
    });

    ui.positivitySelect?.addEventListener('change', (e) => {
        filtersState.positivity = e.target.value;
        updateDescription();
    });

    // Filtro de Evocações
    ui.editEvocationsBtn?.addEventListener('click', async () => {
        let temp = [...filtersState.evocations.selectedWords];
        const res = await Swal.fire({
            title: 'Filtrar Palavras',
            html: await getEvocationsModalHTML(),
            showCancelButton: true,
            confirmButtonText: 'Aplicar',
            didOpen: async () => {
                currentPage = 1;
                await renderWordListInModal(temp);
                updateSelectedWordsPanelInModal(temp);
                document.getElementById('word-search-input').oninput = () => { currentPage = 1; renderWordListInModal(temp); };
                document.getElementById('word-list-container').onchange = (e) => {
                    const w = e.target.value;
                    if(e.target.checked) { if(!temp.includes(w)) temp.push(w); }
                    else { temp = temp.filter(x => x !== w); }
                    updateSelectedWordsPanelInModal(temp);
                };
            }
        });
        if (res.isConfirmed) {
            filtersState.evocations.selectedWords = temp;
            filtersState.evocations.isActive = temp.length > 0;
            await updateEvocationsFilterStatus();
        }
    });

    // Filtro de Idade
    ui.editAgeBtn?.addEventListener('click', async () => {
        const res = await Swal.fire({
            title: 'Filtro de Idade',
            html: await getAgeModalHTML(),
            showCancelButton: true,
            confirmButtonText: 'Aplicar',
            showDenyButton: filtersState.age.isActive,
            denyButtonText: 'Limpar Filtro',
            preConfirm: () => {
                const valInput = document.getElementById('age-value-modal');
                const condInput = document.getElementById('age-condition-modal');
                if (!valInput.value && !Swal.getDenyButton().clicked) {
                    Swal.showValidationMessage('Por favor, insira uma idade.');
                    return false;
                }
                return { value: parseInt(valInput.value, 10), condition: condInput.value };
            }
        });

        if (res.isConfirmed) {
            filtersState.age.value = res.value.value;
            filtersState.age.condition = res.value.condition;
            filtersState.age.isActive = true;
            await updateAgeFilterStatus();
        } else if (res.isDenied) {
            filtersState.age.isActive = false;
            filtersState.age.value = null;
            await updateAgeFilterStatus();
        }
    });

    ui.downloadPdfBtn?.addEventListener('click', async () => {
        const { jsPDF } = window.jspdf;
        const canvas = await html2canvas(document.getElementById('map'));
        const pdf = new jsPDF('l', 'mm', 'a4');
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 297, 210);
        pdf.save('mapa.pdf');
    });
});

// --- Patch de Redimensionamento ---
const MAP_ID = "map";
const PAGE_WRAPPER_SEL = ".page-wrapper";
const MENU_SEL = ".container > .menu";

function hasArea(el){ return el && el.offsetWidth>0 && el.offsetHeight>0; }
function waitForArea(el, tries=40){
  return new Promise((res, rej)=>{
    const tick=()=>{ if(hasArea(el)) return res(true);
      if(tries--<=0) return rej(new Error("map container sem área"));
      requestAnimationFrame(tick);
    }; tick();
  });
}
function refreshMapSize(){
  if (!map) return;
  try {
    map.updateSize();
    requestAnimationFrame(()=>map.updateSize());
  } catch(e){ console.warn("updateSize:", e); }
}
async function initMapWhenReady(){
  const el = document.getElementById(MAP_ID);
  if (!el) return;
  try { await waitForArea(el); } catch { el.style.minHeight = el.style.minHeight || "500px"; }
  if (!map) initializeMap();
  const wrapper = document.querySelector(PAGE_WRAPPER_SEL);
  if (wrapper && "ResizeObserver" in window) {
    new ResizeObserver(()=>refreshMapSize()).observe(wrapper);
  }
  const mq = window.matchMedia("(max-width: 768px)");
  (mq.addEventListener? mq.addEventListener("change", refreshMapSize) : mq.addListener(refreshMapSize));
  window.addEventListener("resize", refreshMapSize);
  window.addEventListener("orientationchange", refreshMapSize);
  const menu = document.querySelector(MENU_SEL);
  if (menu) document.addEventListener("transitionend", (e)=>{ if(menu.contains(e.target)) refreshMapSize(); });
  requestAnimationFrame(refreshMapSize);
}