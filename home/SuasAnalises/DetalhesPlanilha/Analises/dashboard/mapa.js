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
    }
};

// --- ELEMENTOS DA UI ---
const ui = {
    descriptionText: document.getElementById('description-text'),
    messageArea: document.getElementById('message-area'),
    messageText: document.getElementById('message-text'),
    messageIcon: document.getElementById('message-area').querySelector('.message-icon'),
    loadingOverlay: document.getElementById('loadingOverlay'),
    loadingProgressText: document.getElementById('loadingProgressText'),
    progressBar: document.getElementById('progressBar'),
    resultsPanel: document.getElementById('results-panel'),
    unlocatedCitiesSection: document.getElementById('unlocatedCitiesSection'),
    unlocatedCountSpan: document.getElementById('unlocatedCount'),
    unlocatedCitiesList: document.getElementById('unlocatedCitiesList'),
    mapButton: document.getElementById('map-button'),
    downloadPdfBtn: document.getElementById('download-pdf-btn'),
    // Filtros
    editEvocationsBtn: document.getElementById('edit-evocations-filter'),
    evocationsFilterCard: document.getElementById('evocations-filter-card'),
    evocationsFilterStatus: document.getElementById('evocations-filter-status'),
    editAgeBtn: document.getElementById('edit-age-filter'),
    ageFilterCard: document.getElementById('age-filter-card'),
    ageFilterStatus: document.getElementById('age-filter-status'),
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
    for (const placeholder in replacements) {
        msg = msg.replace(`{${placeholder}}`, replacements[placeholder]);
    }
    ui.messageText.innerHTML = msg;
    ui.messageArea.className = `message-area ${type}`;
    ui.messageIcon.innerHTML = icons[type];
}

async function showLoading(show, progress = 0, textKey = 'map_loading_preparing', replacements = {}) {
    if (show) {
        let text = await window.getTranslation(textKey);
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

async function updateDescription() {
    const { evocations, age } = filtersState;
    let textKey = '';

    if (evocations.isActive && age.isActive) {
        textKey = 'map_description_evocations_and_age';
    } else if (evocations.isActive) {
        textKey = 'map_description_evocations';
    } else if (age.isActive) {
        textKey = 'map_description_age';
    } else {
        textKey = 'map_description_default';
    }
    ui.descriptionText.innerHTML = await window.getTranslation(textKey);
}

const planilha = new URLSearchParams(location.search).get('planilha');
document.querySelector(".barra-planilha").textContent = planilha;

// --- Lógica do Filtro de Palavras (Modal) ---
async function loadWords(planilhaNome) {
    if (areWordsLoaded) return;
    try {
        const db = await new Promise((resolve, reject) => {
            const request = indexedDB.open('agoraDB', 1);
            request.onsuccess = event => resolve(event.target.result);
            request.onerror = event => reject(event.target.error);
        });
        const transaction = db.transaction('planilhas', 'readonly');
        const store = transaction.objectStore('planilhas');
        const request = store.get(`planilha_${planilhaNome}`);
        const storedData = await new Promise((resolve, reject) => {
            request.onsuccess = event => resolve(event.target.result ? event.target.result.value : null);
            request.onerror = event => reject(event.target.error);
        });

        if (!storedData || storedData.length < 2) {
            throw new Error(await window.getTranslation('map_error_sheet_data_not_found'));
        }

        const header = storedData[0].map(h => h.toString().toLowerCase().trim());
        const evocColumnIndices = header.map((h, i) => h.startsWith('evoc') ? i : -1).filter(i => i !== -1);
        
        const wordCounts = {};
        for (const row of storedData.slice(1)) {
            for (const index of evocColumnIndices) {
                const word = (row[index] || '').toString().trim().toUpperCase();
                if (word && word !== 'VAZIO') {
                    wordCounts[word] = (wordCounts[word] || 0) + 1;
                }
            }
        }
        allWordsWithCount = Object.entries(wordCounts).sort(([, countA], [, countB]) => countB - countA);
        areWordsLoaded = true;
    } catch (error) {
        console.error("Erro ao carregar palavras:", error);
        const errorMsg = (await window.getTranslation('map_error_loading_words')).replace('{message}', error.message);
        Swal.showValidationMessage(errorMsg);
    }
}

async function getEvocationsModalHTML() {
    return `
        <div id="evocations-modal-content">
            <div id="selected-words-panel" class="hidden">
                <h3>${await window.getTranslation('map_modal_selected_title')} (<span id="selected-count">0</span>):</h3>
                <ul id="selected-list"></ul>
                <button id="clear-selected-btn">${await window.getTranslation('map_modal_clear_btn')}</button>
            </div>
            <input type="text" id="word-search-input" class="filter-input" placeholder="${await window.getTranslation('map_modal_search_placeholder')}">
            <div id="word-list-container"><p>${await window.getTranslation('map_modal_loading_words')}</p></div>
            <div id="pagination-controls"></div>
        </div>
    `;
}

async function renderWordListInModal(tempSelectedWords) {
    const wordListContainer = document.getElementById('word-list-container');
    const paginationControls = document.getElementById('pagination-controls');
    const searchTerm = document.getElementById('word-search-input').value.trim().toUpperCase();
    
    const filteredWords = searchTerm
        ? allWordsWithCount.filter(([word]) => word.includes(searchTerm))
        : allWordsWithCount;

    if (filteredWords.length === 0) {
        wordListContainer.innerHTML = `<p style='padding: 1rem; text-align: center; color: #64748b;'>${await window.getTranslation('map_modal_no_words_found')}</p>`;
        paginationControls.innerHTML = '';
        return;
    }

    const startIndex = (currentPage - 1) * WORDS_PER_PAGE;
    const endIndex = startIndex + WORDS_PER_PAGE;
    const pageWords = filteredWords.slice(startIndex, endIndex);

    wordListContainer.innerHTML = pageWords.map(([word, count]) => `
        <div class="word-item">
            <input type="checkbox" id="cb-modal-${word}" value="${word}" ${tempSelectedWords.includes(word) ? 'checked' : ''}>
            <label for="cb-modal-${word}">${word}</label>
            <span class="word-count">${count}</span>
        </div>
    `).join('');

    await renderPaginationInModal(filteredWords.length, tempSelectedWords);
}

async function renderPaginationInModal(totalItems, tempSelectedWords) {
    const paginationControls = document.getElementById('pagination-controls');
    const totalPages = Math.ceil(totalItems / WORDS_PER_PAGE);
    paginationControls.innerHTML = '';
    if (totalPages <= 1) return;

    const createButton = (text, page, isDisabled = false, isActive = false) => {
        const btn = document.createElement('button');
        btn.className = `page-btn ${isActive ? 'active' : ''}`;
        btn.textContent = text;
        btn.disabled = isDisabled;
        btn.onclick = async () => { currentPage = page; await renderWordListInModal(tempSelectedWords); };
        return btn;
    };

    paginationControls.appendChild(createButton('«', 1, currentPage === 1));
    paginationControls.appendChild(createButton('‹', currentPage - 1, currentPage === 1));

    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);

    if (startPage > 1) paginationControls.appendChild(createButton('1', 1));
    if (startPage > 2) paginationControls.insertAdjacentHTML('beforeend', `<span>...</span>`);
    
    for (let i = startPage; i <= endPage; i++) {
        paginationControls.appendChild(createButton(i, i, false, i === currentPage));
    }

    if (endPage < totalPages - 1) paginationControls.insertAdjacentHTML('beforeend', `<span>...</span>`);
    if (endPage < totalPages) paginationControls.appendChild(createButton(totalPages, totalPages));

    paginationControls.appendChild(createButton('›', currentPage + 1, currentPage === totalPages));
    paginationControls.appendChild(createButton('»', totalPages, currentPage === totalPages));
}

function updateSelectedWordsPanelInModal(tempSelectedWords) {
    const panel = document.getElementById('selected-words-panel');
    if (tempSelectedWords.length === 0) {
        panel.classList.add('hidden');
        return;
    }
    panel.classList.remove('hidden');
    document.getElementById('selected-count').textContent = tempSelectedWords.length;
    document.getElementById('selected-list').innerHTML = tempSelectedWords.map(word => `
        <li class="selected-word-item">
            ${word}
            <button class="remove-word-btn" data-word="${word}">&times;</button>
        </li>
    `).join('');
}

async function updateEvocationsFilterStatus() {
    const { isActive, selectedWords, matchType } = filtersState.evocations;
    const matchTypeText = await window.getTranslation(matchType === 'all' ? 'map_match_type_all' : 'map_match_type_any');

    if (isActive && selectedWords.length > 0) {
        const statusText = (await window.getTranslation('map_status_evocations'))
            .replace('{count}', selectedWords.length)
            .replace('{matchType}', matchTypeText);
        ui.evocationsFilterStatus.innerHTML = statusText;
        ui.evocationsFilterCard.classList.add('active');
        ui.editEvocationsBtn.textContent = await window.getTranslation('map_btn_edit');
    } else {
        ui.evocationsFilterStatus.textContent = await window.getTranslation('map_status_no_filter');
        ui.evocationsFilterCard.classList.remove('active');
        ui.editEvocationsBtn.textContent = await window.getTranslation('map_btn_configure');
        filtersState.evocations.isActive = false;
        filtersState.evocations.selectedWords = [];
    }
    await updateDescription();
}

// --- Lógica do Filtro de Idade (Modal) ---
async function getAgeModalHTML() {
    const { condition, value } = filtersState.age;
    return `
        <div class="age-filter-inputs">
            <select id="age-condition-modal" class="filter-input">
                <option value="gte" ${condition === 'gte' ? 'selected' : ''}>${await window.getTranslation('map_age_cond_gte')}</option>
                <option value="eq" ${condition === 'eq' ? 'selected' : ''}>${await window.getTranslation('map_age_cond_eq')}</option>
                <option value="lte" ${condition === 'lte' ? 'selected' : ''}>${await window.getTranslation('map_age_cond_lte')}</option>
            </select>
            <input type="number" id="age-value-modal" class="filter-input" placeholder="${await window.getTranslation('map_modal_age_placeholder')}" min="0" value="${value || ''}">
        </div>
    `;
}

async function updateAgeFilterStatus() {
    const { isActive, condition, value } = filtersState.age;
    if (isActive && value !== null) {
        const conditionText = await window.getTranslation({ gte: 'map_age_cond_gte', eq: 'map_age_cond_eq', lte: 'map_age_cond_lte' }[condition]);
        const statusText = (await window.getTranslation('map_status_age'))
            .replace('{conditionText}', conditionText)
            .replace('{value}', value);
        ui.ageFilterStatus.innerHTML = statusText;
        ui.ageFilterCard.classList.add('active');
        ui.editAgeBtn.textContent = await window.getTranslation('map_btn_edit');
    } else {
        ui.ageFilterStatus.textContent = await window.getTranslation('map_status_no_filter');
        ui.ageFilterCard.classList.remove('active');
        ui.editAgeBtn.textContent = await window.getTranslation('map_btn_configure');
        filtersState.age.isActive = false;
        filtersState.age.value = null;
    }
    await updateDescription();
}


// --- Lógica do Mapa ---
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
                                    <th style="padding: 8px 5px; text-align: left; font-weight: 700; font-size: 16px; color: #1A202C; border-bottom: 2px solid #E2E8F0;">${await window.getTranslation('map_tippy_cities_grouped')}</th>
                                    <th style="padding: 8px 5px; text-align: right; font-weight: 700; font-size: 16px; color: #1A202C; border-bottom: 2px solid #E2E8F0;">${await window.getTranslation('map_tippy_people')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${tableRows}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td style="padding: 8px 5px; text-align: left; font-weight: 700; font-size: 16px; color: #1A202C; border-top: 2px solid #E2E8F0;">${await window.getTranslation('map_tippy_total')}</td>
                                    <td style="padding: 8px 5px; text-align: right; font-weight: 700; font-size: 16px; color: #C53030; border-top: 2px solid #E2E8F0;">${total}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>`;
            } else {
                const singleFeature = clusteredFeatures[0];
                const cityName = singleFeature.get('cityName');
                const cityCount = singleFeature.get('cityCount');
                const personText = await window.getTranslation(cityCount > 1 ? 'map_tippy_persons' : 'map_tippy_person');
                content = `<div style="padding: 4px 8px; font-family: 'Inter', sans-serif; font-size: 14px;"><strong style="font-size: 15px; color: #1A202C;">${cityName}</strong><br>${cityCount} ${personText}</div>`;
            }
            const virtualEl = { getBoundingClientRect: () => ({ width: 0, height: 0, top: evt.pixel[1] + mapElement.getBoundingClientRect().top, right: evt.pixel[0] + mapElement.getBoundingClientRect().left, bottom: evt.pixel[1] + mapElement.getBoundingClientRect().top, left: evt.pixel[0] + mapElement.getBoundingClientRect().left }) };
            tippyInstance = tippy(document.body, { getReferenceClientRect: virtualEl.getBoundingClientRect, content: content, allowHTML: true, placement: 'top', arrow: true, animation: 'fade', theme: 'light-border', trigger: 'manual', appendTo: () => document.body });
            tippyInstance.show();
        } else {
            mapElement.style.cursor = '';
            if (tippyInstance) tippyInstance.destroy();
        }
    });
    map.getViewport().addEventListener('mouseout', () => { if (tippyInstance) tippyInstance.destroy(); });
}


// --- Geocodificação e Processamento de Dados ---
async function geocodeCity(cityName, stateName) {
    const query = stateName ? `${cityName}, ${stateName}, Brasil` : `${cityName}, Brasil`;
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=3&addressdetails=1`;
    try {
        await new Promise(resolve => setTimeout(resolve, 500)); // Rate limiting
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);
        const data = await response.json();
        if (data && data.length > 0) {
            const preferredResult = data.find(r => r.addresstype === 'city' || r.addresstype === 'town' || r.addresstype === 'village');
            const result = preferredResult || data[0];
            return [parseFloat(result.lat), parseFloat(result.lon)];
        }
        return null;
    } catch (error) {
        console.error(`Erro ao geocodificar "${query}":`, error);
        return null;
    }
}

async function processDataFromDB(planilhaNome) {
    await showLoading(true, 0, 'map_process_loading_data');
    ui.unlocatedCitiesSection.classList.add('hidden');
    ui.unlocatedCitiesList.innerHTML = '';
    if (tippyInstance) tippyInstance.destroy();

    try {
        const db = await new Promise((resolve, reject) => {
            const request = indexedDB.open('agoraDB', 1);
            request.onsuccess = event => resolve(event.target.result);
            request.onerror = event => reject(event.target.error);
        });
        const transaction = db.transaction('planilhas', 'readonly');
        const store = transaction.objectStore('planilhas');
        const request = store.get(`planilha_${planilhaNome}`);
        const storedData = await new Promise((resolve, reject) => {
            request.onsuccess = event => resolve(event.target.result ? event.target.result.value : null);
            request.onerror = event => reject(event.target.error);
        });

        if (!storedData || storedData.length < 2) {
            await displayMessage('map_process_no_data', 'error'); await showLoading(false); return;
        }

        const header = storedData[0].map(h => h.toString().toLowerCase().trim());
        const cityColumnIndex = header.indexOf('cidades') !== -1 ? header.indexOf('cidades') : header.indexOf('cidade');
        const stateColumnIndex = header.indexOf('estado') !== -1 ? header.indexOf('estado') : header.indexOf('estados');
        const ageColumnIndex = header.indexOf('idade');
        const evocColumnIndices = header.map((h, i) => h.startsWith('evoc') ? i : -1).filter(i => i !== -1);

        if (cityColumnIndex === -1) {
            await displayMessage('map_process_no_city_column', 'error'); await showLoading(false); return;
        }
        if (filtersState.age.isActive && ageColumnIndex === -1) {
            await displayMessage('map_process_no_age_column', 'error'); await showLoading(false); return;
        }
        if (filtersState.evocations.isActive && evocColumnIndices.length === 0) {
            await displayMessage('map_process_no_evoc_column', 'error'); await showLoading(false); return;
        }

        await displayMessage('map_process_filtering', 'info');
        const cityCounts = {};
        const dataRows = storedData.slice(1);

        for (const row of dataRows) {
            let passesFilters = true;

            if (filtersState.evocations.isActive) {
                const userEvocations = new Set(evocColumnIndices.map(index => (row[index] || '').toString().trim().toUpperCase()));
                if (filtersState.evocations.matchType === 'all') {
                    if (!filtersState.evocations.selectedWords.every(word => userEvocations.has(word))) passesFilters = false;
                } else {
                    if (!filtersState.evocations.selectedWords.some(word => userEvocations.has(word))) passesFilters = false;
                }
            }

            if (passesFilters && filtersState.age.isActive) {
                const userAge = parseInt(row[ageColumnIndex], 10);
                if (isNaN(userAge)) {
                    passesFilters = false;
                } else {
                    const targetAge = filtersState.age.value;
                    switch (filtersState.age.condition) {
                        case 'gte': if (userAge < targetAge) passesFilters = false; break;
                        case 'eq':  if (userAge !== targetAge) passesFilters = false; break;
                        case 'lte': if (userAge > targetAge) passesFilters = false; break;
                    }
                }
            }
            
            if (passesFilters && row[cityColumnIndex]) {
                const cityUpper = row[cityColumnIndex].toString().trim().toUpperCase();
                let finalIdentifier = cityAcronyms[cityUpper] || row[cityColumnIndex].toString().trim();
                if (stateColumnIndex !== -1 && row[stateColumnIndex]) {
                    const stateUpper = row[stateColumnIndex].toString().trim().toUpperCase();
                    finalIdentifier += `, ${stateAcronyms[stateUpper] || row[stateColumnIndex].toString().trim()}`;
                }
                cityCounts[finalIdentifier] = (cityCounts[finalIdentifier] || 0) + 1;
            }
        }

        if (Object.keys(cityCounts).length === 0) {
            await displayMessage('map_process_no_participants_found', 'warning');
            await showLoading(false);
            if(clusterLayer) map.removeLayer(clusterLayer);
            return;
        }

        const unlocatedCitiesDetails = [];
        const uniqueCities = Object.keys(cityCounts);
        const features = [];
        for (let i = 0; i < uniqueCities.length; i++) {
            const cityIdentifier = uniqueCities[i];
            let [cityName, stateName] = cityIdentifier.split(', ');
            
            await showLoading(true, Math.round(((i + 1) / uniqueCities.length) * 100), 'map_process_geocoding', {
                cityName: cityName,
                current: i + 1,
                total: uniqueCities.length
            });

            let coords = await geocodeCity(cityName, stateName);
            if (coords) {
                const feature = new ol.Feature({ geometry: new ol.geom.Point(ol.proj.fromLonLat([coords[1], coords[0]])) });
                feature.setProperties({ cityName: cityIdentifier, cityCount: cityCounts[cityIdentifier] });
                features.push(feature);
            } else {
                unlocatedCitiesDetails.push({ name: cityIdentifier, count: cityCounts[cityIdentifier] });
            }
        }

        if (features.length === 0) { await displayMessage('map_process_no_cities_geocoded', 'error'); await showLoading(false); return; }

        const vectorSource = new ol.source.Vector({ features: features });
        const clusterSource = new ol.source.Cluster({ distance: 40, minDistance: 20, source: vectorSource });

        if (clusterLayer) map.removeLayer(clusterLayer);
        clusterLayer = new ol.layer.Vector({
            source: clusterSource,
            style: function (feature) {
                const featuresInCluster = feature.get('features');
                const totalCount = featuresInCluster.reduce((sum, f) => sum + f.get('cityCount'), 0);
                const radius = 12 + Math.log(totalCount) * 4;
                const startColor = [255, 255, 0], endColor = [255, 0, 0];
                const allCounts = Object.values(cityCounts);
                const maxTotalCount = allCounts.reduce((sum, count) => sum + count, 0);
                let ratio = (maxTotalCount > 1) ? (Math.log(totalCount) / Math.log(maxTotalCount)) : 0;
                const r = Math.round(startColor[0] + ratio * (endColor[0] - startColor[0]));
                const g = Math.round(startColor[1] + ratio * (endColor[1] - startColor[1]));
                const color = `rgba(${r}, ${g}, 0, 0.7)`;

                return new ol.style.Style({
                    image: new ol.style.Circle({ radius: radius, fill: new ol.style.Fill({ color: color }), stroke: new ol.style.Stroke({ color: '#6B211E', width: 1.5 }) }),
                    text: new ol.style.Text({ text: totalCount.toString(), fill: new ol.style.Fill({ color: '#fff' }), stroke: new ol.style.Stroke({ color: 'rgba(0,0,0,0.6)', width: 2.5 }), font: 'bold 12px sans-serif' }),
                });
            },
        });
        map.addLayer(clusterLayer);
        if (!ol.extent.isEmpty(vectorSource.getExtent())) { map.getView().fit(vectorSource.getExtent(), { padding: [50, 50, 50, 50], duration: 1000 }); }

        let finalMessage = (await window.getTranslation('map_process_completed')).replace('{count}', features.length);
        if (unlocatedCitiesDetails.length > 0) {
            finalMessage += (await window.getTranslation('map_process_unlocated_cities')).replace('{count}', unlocatedCitiesDetails.length);
            ui.unlocatedCitiesSection.classList.remove('hidden');
            ui.unlocatedCountSpan.textContent = unlocatedCitiesDetails.length;
            const occurrenceText = await window.getTranslation('map_process_occurrence');
            const occurrencesText = await window.getTranslation('map_process_occurrences');
            ui.unlocatedCitiesList.innerHTML = unlocatedCitiesDetails.map(item => `<li>${item.name} (${item.count} ${item.count > 1 ? occurrencesText : occurrenceText})</li>`).join('');
        }
        await displayMessage('map_msg_from_string', 'success', { message: finalMessage }); // Use a generic key for raw HTML
        await showLoading(false);
        ui.downloadPdfBtn.classList.remove('hidden');

    } catch (error) {
        console.error("Erro ao processar dados:", error);
        await displayMessage('map_process_error', 'error', { message: error.message });
        await showLoading(false);
    }
}

async function iniciarMapeamento() {
    if (filtersState.evocations.isActive && filtersState.evocations.selectedWords.length === 0) {
        ui.resultsPanel.classList.remove('hidden');
        await displayMessage('map_validate_select_evocation', 'warning');
        if(clusterLayer) map.removeLayer(clusterLayer);
        ui.downloadPdfBtn.classList.add('hidden');
        return;
    }
    if (filtersState.age.isActive && (filtersState.age.value === null || filtersState.age.value === '')) {
        ui.resultsPanel.classList.remove('hidden');
        await displayMessage('map_validate_enter_age', 'warning');
        if(clusterLayer) map.removeLayer(clusterLayer);
        ui.downloadPdfBtn.classList.add('hidden');
        return;
    }
    
    ui.resultsPanel.classList.remove('hidden');
    
    const urlParams = new URLSearchParams(window.location.search);
    const planilhaNome = urlParams.get("planilha");

    if (planilhaNome) {
        await processDataFromDB(planilhaNome);
    } else {
        await displayMessage('map_validate_no_sheet_name', 'error');
    }
}

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    initializeMap(); 

    const urlParams = new URLSearchParams(window.location.search);
    const planilhaNome = urlParams.get("planilha");

    if (!planilhaNome) {
        ui.mapButton.disabled = true;
        ui.editAgeBtn.disabled = true;
        ui.editEvocationsBtn.disabled = true;
    }

    ui.mapButton.addEventListener('click', iniciarMapeamento);

    document.getElementById('evocations-match-type').addEventListener('change', (e) => {
        filtersState.evocations.matchType = e.target.value;
        updateEvocationsFilterStatus();
    });

    ui.editEvocationsBtn.addEventListener('click', async () => {
        let tempSelectedWords = [...filtersState.evocations.selectedWords];

        const result = await Swal.fire({
            title: await window.getTranslation('map_modal_evocations_title'),
            html: await getEvocationsModalHTML(),
            showCancelButton: true,
            confirmButtonText: await window.getTranslation('map_modal_apply_filter_btn'),
            cancelButtonText: await window.getTranslation('map_modal_cancel_btn'),
            showDenyButton: filtersState.evocations.isActive,
            denyButtonText: await window.getTranslation('map_modal_clear_filter_btn'),
            didOpen: async () => {
                await loadWords(planilhaNome);
                currentPage = 1;
                await renderWordListInModal(tempSelectedWords);
                updateSelectedWordsPanelInModal(tempSelectedWords);

                const searchInput = document.getElementById('word-search-input');
                searchInput.addEventListener('input', async () => {
                    currentPage = 1;
                    await renderWordListInModal(tempSelectedWords);
                });

                document.getElementById('word-list-container').addEventListener('change', (e) => {
                    if (e.target.type === 'checkbox') {
                        const word = e.target.value;
                        if (e.target.checked) {
                            if (!tempSelectedWords.includes(word)) tempSelectedWords.push(word);
                        } else {
                            tempSelectedWords = tempSelectedWords.filter(w => w !== word);
                        }
                        updateSelectedWordsPanelInModal(tempSelectedWords);
                    }
                });

                document.getElementById('selected-words-panel').addEventListener('click', async (e) => {
                     if (e.target.classList.contains('remove-word-btn')) {
                        const wordToRemove = e.target.dataset.word;
                        tempSelectedWords = tempSelectedWords.filter(w => w !== wordToRemove);
                        updateSelectedWordsPanelInModal(tempSelectedWords);
                        await renderWordListInModal(tempSelectedWords);
                    }
                    if (e.target.id === 'clear-selected-btn') {
                        tempSelectedWords = [];
                        updateSelectedWordsPanelInModal(tempSelectedWords);
                        await renderWordListInModal(tempSelectedWords);
                    }
                });
            },
            preConfirm: () => ({ selectedWords: tempSelectedWords })
        });

        if (result.isConfirmed) {
            filtersState.evocations.selectedWords = result.value.selectedWords;
            filtersState.evocations.isActive = result.value.selectedWords.length > 0;
        }
        if (result.isDenied) {
            filtersState.evocations.selectedWords = [];
            filtersState.evocations.isActive = false;
        }
        await updateEvocationsFilterStatus();
    });

    ui.editAgeBtn.addEventListener('click', async () => {
        const result = await Swal.fire({
            title: await window.getTranslation('map_modal_age_title'),
            html: await getAgeModalHTML(),
            showCancelButton: true,
            confirmButtonText: await window.getTranslation('map_modal_apply_filter_btn'),
            cancelButtonText: await window.getTranslation('map_modal_cancel_btn'),
            showDenyButton: filtersState.age.isActive,
            denyButtonText: await window.getTranslation('map_modal_clear_filter_btn'),
            preConfirm: async () => {
                const value = document.getElementById('age-value-modal').value;
                const condition = document.getElementById('age-condition-modal').value;
                if (!value) {
                    Swal.showValidationMessage(await window.getTranslation('map_modal_age_validation'));
                    return false;
                }
                return { value: parseInt(value, 10), condition };
            }
        });

        if (result.isConfirmed) {
            filtersState.age.value = result.value.value;
            filtersState.age.condition = result.value.condition;
            filtersState.age.isActive = true;
        }
        if (result.isDenied) {
            filtersState.age.value = null;
            filtersState.age.isActive = false;
        }
        await updateAgeFilterStatus();
    });

    ui.downloadPdfBtn.addEventListener('click', async () => {
        await showLoading(true, 5, 'map_pdf_rendering');
        await new Promise(resolve => setTimeout(resolve, 500)); 
        
        try {
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
            
            await showLoading(true, 30, 'map_pdf_capturing');
            const mapCanvas = await html2canvas(document.getElementById('map'), { 
                scale: 2, 
                useCORS: true,
                logging: false,
                onclone: (clonedDoc) => {
                    clonedDoc.querySelectorAll('[data-tippy-root]').forEach(el => el.style.visibility = 'hidden');
                }
            });
            
            await showLoading(true, 70, 'map_pdf_adding_image');
            const mapImgData = mapCanvas.toDataURL('image/png');
            const mapImgProps = pdf.getImageProperties(mapImgData);
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const mapPdfWidth = pdfWidth;
            const mapPdfHeight = (mapImgProps.height * mapPdfWidth) / mapImgProps.width;
            let y = (mapPdfHeight < pdfHeight) ? (pdfHeight - mapPdfHeight) / 2 : 0;
            pdf.addImage(mapImgData, 'PNG', 0, y, mapPdfWidth, mapPdfHeight);
            
            await showLoading(true, 95, 'map_pdf_finishing');
            const fileName = `MapaFiltrado_${new Date().toISOString().split("T")[0]}.pdf`;
            pdf.save(fileName);
        } catch (error) {
            console.error("Erro ao gerar PDF:", error);
            await displayMessage('map_pdf_error', 'error');
        } finally {
            await showLoading(false);
        }

        // chama depois do DOM pronto
            window.addEventListener('load', () => {
            setTimeout(() => { if (window.map) { try { map.updateSize(); } catch(e){} } }, 0);
            });

            // no resize / rotação (já ajuda a manter o alinhamento perfeito)
            window.addEventListener('resize', () => {
            if (window.map) { try { map.updateSize(); } catch(e){} }
            });

    });
});

// ========== PATCH OpenLayers: initializar só com área e manter updateSize ==========
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
  if (!window.map) return;
  try {
    map.updateSize();
    requestAnimationFrame(()=>map.updateSize());
  } catch(e){ console.warn("updateSize:", e); }
}
async function initMapWhenReady(){
  const el = document.getElementById(MAP_ID);
  if (!el) return;
  try { await waitForArea(el); } catch { el.style.minHeight = el.style.minHeight || "60vh"; }
  if (!window.map) initializeMap();          // usa sua initializeMap existente
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

// troque isto:
// document.addEventListener('DOMContentLoaded', () => { initializeMap(); ... });

// por isto:
document.addEventListener('DOMContentLoaded', () => { 
  initMapWhenReady(); 
  // ... (o resto do seu código DOMContentLoaded permanece igual)
});

