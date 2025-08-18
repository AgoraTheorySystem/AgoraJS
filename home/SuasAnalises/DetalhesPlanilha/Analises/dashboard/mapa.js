// --- Dicionários de Normalização ---
        const stateAcronyms = { 'AC': 'Acre', 'AL': 'Alagoas', 'AP': 'Amapá', 'AM': 'Amazonas', 'BA': 'Bahia', 'CE': 'Ceará', 'DF': 'Distrito Federal', 'ES': 'Espírito Santo', 'GO': 'Goiás', 'MA': 'Maranhão', 'MT': 'Mato Grosso', 'MS': 'Mato Grosso do Sul', 'MG': 'Minas Gerais', 'PA': 'Pará', 'PB': 'Paraíba', 'PR': 'Paraná', 'PE': 'Pernambuco', 'PI': 'Piauí', 'RJ': 'Rio de Janeiro', 'RN': 'Rio Grande do Norte', 'RS': 'Rio Grande do Sul', 'RO': 'Rondônia', 'RR': 'Roraima', 'SC': 'Santa Catarina', 'SP': 'São Paulo', 'SE': 'Sergipe', 'TO': 'Tocantins' };
        const cityAcronyms = { 'BH': 'Belo Horizonte', 'POA': 'Porto Alegre', 'SSA': 'Salvador' };

        // --- VARIÁVEIS GLOBAIS ---
        let map = null;
        let clusterLayer = null;
        let allWordsWithCount = [];
        let selectedWords = [];
        let currentPage = 1;
        const WORDS_PER_PAGE = 15;

        // --- ELEMENTOS DA UI ---
        const ui = {
            messageArea: document.getElementById('message-area'),
            messageText: document.getElementById('message-text'),
            messageIcon: document.getElementById('message-area').querySelector('.message-icon'),
            loadingOverlay: document.getElementById('loadingOverlay'),
            loadingProgressText: document.getElementById('loadingProgressText'),
            progressBar: document.getElementById('progressBar'),
            unlocatedCitiesSection: document.getElementById('unlocatedCitiesSection'),
            unlocatedCountSpan: document.getElementById('unlocatedCount'),
            unlocatedCitiesList: document.getElementById('unlocatedCitiesList'),
            mapContainer: document.getElementById('map-container'),
            mapButton: document.getElementById('map-button'),
            downloadPdfBtn: document.getElementById('download-pdf-btn'),
            wordSearchInput: document.getElementById('word-search-input'),
            wordListContainer: document.getElementById('word-list-container'),
            selectedWordsPanel: document.getElementById('selected-words-panel'),
            selectedCount: document.getElementById('selected-count'),
            selectedList: document.getElementById('selected-list'),
            clearSelectedBtn: document.getElementById('clear-selected-btn'),
            paginationControls: document.getElementById('pagination-controls')
        };
        
        const icons = {
            info: `<svg class="message-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75ZM12 15a.75.75 0 0 0-.75.75.75.75 0 0 0 1.5 0 .75.75 0 0 0-.75-.75Z" clip-rule="evenodd" /></svg>`,
            success: `<svg class="message-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clip-rule="evenodd" /></svg>`,
            error: `<svg class="message-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="M9.401 3.003c1.155-2.001 4.045-2.001 5.199 0l3.597 6.235c1.155 2.001-.29 4.5-2.599 4.5H8.404c-2.31 0-3.754-2.499-2.599-4.5l3.597-6.235ZM12 9.75a.75.75 0 0 0-.75.75v2.25c0 .414.336.75.75.75h.008a.75.75 0 0 0 .75-.75V10.5a.75.75 0 0 0-.75-.75ZM12 15a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Z" clip-rule="evenodd" /></svg>`,
            warning: `<svg class="message-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clip-rule="evenodd" /></svg>`
        };
        let tippyInstance = null;

        // --- Funções de Controle da UI ---
        function displayMessage(msg, type = 'info') { ui.messageText.innerHTML = msg; ui.messageArea.className = `message-area ${type}`; ui.messageIcon.innerHTML = icons[type]; }
        function showLoading(show, progress = 0, text = 'Processando...') { if (show) { ui.loadingOverlay.classList.add('visible'); ui.loadingProgressText.textContent = text; ui.progressBar.style.width = `${progress}%`; } else { ui.loadingOverlay.classList.remove('visible'); ui.progressBar.style.width = '0%'; } }
        function toggleUnlocatedCities() { ui.unlocatedCitiesList.classList.toggle('expanded'); }

        // --- Lógica do Filtro de Palavras ---
        async function initializeFilter(planilhaNome) {
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
                    ui.wordListContainer.innerHTML = "<p>Dados da planilha não encontrados.</p>"; return;
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
                renderWordList();

            } catch (error) {
                console.error("Erro ao inicializar filtro:", error);
                ui.wordListContainer.innerHTML = "<p>Ocorreu um erro ao carregar as palavras.</p>";
            }
        }

        function renderWordList() {
            const searchTerm = ui.wordSearchInput.value.trim().toUpperCase();
            const filteredWords = searchTerm
                ? allWordsWithCount.filter(([word]) => word.includes(searchTerm))
                : allWordsWithCount;

            if (filteredWords.length === 0) {
                ui.wordListContainer.innerHTML = "<p class='p-4 text-center text-gray-500'>Nenhuma palavra encontrada.</p>";
                renderPagination(0);
                return;
            }

            const startIndex = (currentPage - 1) * WORDS_PER_PAGE;
            const endIndex = startIndex + WORDS_PER_PAGE;
            const pageWords = filteredWords.slice(startIndex, endIndex);

            ui.wordListContainer.innerHTML = pageWords.map(([word, count]) => `
                <div class="word-item">
                    <input type="checkbox" id="cb-${word}" value="${word}" ${selectedWords.includes(word) ? 'checked' : ''}>
                    <label for="cb-${word}">${word}</label>
                    <span class="word-count">${count}</span>
                </div>
            `).join('');
            renderPagination(filteredWords.length);
        }
        
        function renderPagination(totalItems) {
            const totalPages = Math.ceil(totalItems / WORDS_PER_PAGE);
            ui.paginationControls.innerHTML = '';
            if (totalPages <= 1) return;

            const createButton = (text, page, isDisabled = false, isActive = false) => {
                const btn = document.createElement('button');
                btn.className = `page-btn ${isActive ? 'active' : ''}`;
                btn.textContent = text;
                btn.disabled = isDisabled;
                btn.onclick = () => { currentPage = page; renderWordList(); };
                return btn;
            };

            ui.paginationControls.appendChild(createButton('«', 1, currentPage === 1));
            ui.paginationControls.appendChild(createButton('‹', currentPage - 1, currentPage === 1));

            // Logic for displaying page numbers is simplified for brevity
            const startPage = Math.max(1, currentPage - 1);
            const endPage = Math.min(totalPages, currentPage + 1);

            if (startPage > 1) {
                ui.paginationControls.appendChild(createButton('1', 1));
                if (startPage > 2) ui.paginationControls.insertAdjacentHTML('beforeend', `<span class="px-2">...</span>`);
            }

            for (let i = startPage; i <= endPage; i++) {
                ui.paginationControls.appendChild(createButton(i, i, false, i === currentPage));
            }

            if (endPage < totalPages) {
                if (endPage < totalPages - 1) ui.paginationControls.insertAdjacentHTML('beforeend', `<span class="px-2">...</span>`);
                ui.paginationControls.appendChild(createButton(totalPages, totalPages));
            }

            ui.paginationControls.appendChild(createButton('›', currentPage + 1, currentPage === totalPages));
            ui.paginationControls.appendChild(createButton('»', totalPages, currentPage === totalPages));
        }

        function updateSelectedWordsPanel() {
            if (selectedWords.length === 0) {
                ui.selectedWordsPanel.classList.add('hidden');
                return;
            }
            ui.selectedWordsPanel.classList.remove('hidden');
            ui.selectedCount.textContent = selectedWords.length;
            ui.selectedList.innerHTML = selectedWords.map(word => `
                <li class="selected-word-item">
                    ${word}
                    <button class="remove-word-btn" data-word="${word}">&times;</button>
                </li>
            `).join('');
        }

        ui.wordListContainer.addEventListener('change', (event) => {
            if (event.target.type === 'checkbox') {
                const word = event.target.value;
                if (event.target.checked) {
                    if (!selectedWords.includes(word)) selectedWords.push(word);
                } else {
                    selectedWords = selectedWords.filter(w => w !== word);
                }
                updateSelectedWordsPanel();
            }
        });

        ui.selectedList.addEventListener('click', (event) => {
            if (event.target.classList.contains('remove-word-btn')) {
                const wordToRemove = event.target.dataset.word;
                selectedWords = selectedWords.filter(w => w !== wordToRemove);
                updateSelectedWordsPanel();
                renderWordList(); // Re-render to update checkbox state
            }
        });
        
        ui.clearSelectedBtn.addEventListener('click', () => {
            selectedWords = [];
            updateSelectedWordsPanel();
            renderWordList();
        });

        ui.wordSearchInput.addEventListener('input', () => {
            currentPage = 1;
            renderWordList();
        });

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
            map.on('pointermove', function (evt) {
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
                        let listItems = clusteredFeatures.map(f => `<div class="flex justify-between items-center text-sm py-1"><span class="text-gray-600">${f.get('cityName')}</span><span class="font-semibold text-gray-800">${f.get('cityCount')}</span></div>`).join('');
                        content = `<div class="p-1 font-sans"><h3 class="font-bold text-base mb-2 text-gray-800">Cidades Agrupadas</h3><div class="space-y-1">${listItems}</div><hr class="my-2"><div class="flex justify-between items-center font-bold text-base"><span class="text-gray-900">Total</span><span class="text-red-600">${total}</span></div></div>`;
                    } else {
                        const singleFeature = clusteredFeatures[0];
                        const cityName = singleFeature.get('cityName');
                        const cityCount = singleFeature.get('cityCount');
                        content = `<div class="p-1 font-sans"><strong class="text-base">${cityName}</strong><br>${cityCount} ocorrência${cityCount > 1 ? 's' : ''}</div>`;
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

        async function processDataFromDB(planilhaNome, filterWords) {
            showLoading(true, 0, `Carregando dados da planilha...`);
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
                    displayMessage('Dados não encontrados ou planilha vazia.', 'error'); showLoading(false); return;
                }

                const header = storedData[0].map(h => h.toString().toLowerCase().trim());
                const cityColumnIndex = header.indexOf('cidades') !== -1 ? header.indexOf('cidades') : header.indexOf('cidade');
                const stateColumnIndex = header.indexOf('estado') !== -1 ? header.indexOf('estado') : header.indexOf('estados');
                const evocColumnIndices = header.map((h, i) => h.startsWith('evoc') ? i : -1).filter(i => i !== -1);

                if (cityColumnIndex === -1 || evocColumnIndices.length === 0) {
                    displayMessage('Colunas "CIDADES" e/ou "EVOC" não encontradas na planilha.', 'error'); showLoading(false); return;
                }

                displayMessage('Filtrando participantes com base nas palavras-chave...', 'info');
                const cityCounts = {};
                for (const row of storedData.slice(1)) {
                    const userEvocations = evocColumnIndices.map(index => (row[index] || '').toString().trim().toUpperCase());
                    const isMatch = filterWords.every(word => userEvocations.includes(word));
                    
                    if (isMatch && row[cityColumnIndex]) {
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
                    displayMessage('Nenhum participante encontrado com essa combinação de palavras.', 'warning');
                    showLoading(false);
                    if(clusterLayer) map.removeLayer(clusterLayer);
                    return;
                }

                const unlocatedCitiesDetails = [];
                const uniqueCities = Object.keys(cityCounts);
                const features = [];
                for (let i = 0; i < uniqueCities.length; i++) {
                    const cityIdentifier = uniqueCities[i];
                    let [cityName, stateName] = cityIdentifier.split(', ');
                    const progressText = `Geocodificando: ${cityName}... (${i + 1}/${uniqueCities.length})`;
                    showLoading(true, Math.round(((i + 1) / uniqueCities.length) * 100), progressText);

                    let coords = await geocodeCity(cityName, stateName);
                    if (coords) {
                        const feature = new ol.Feature({ geometry: new ol.geom.Point(ol.proj.fromLonLat([coords[1], coords[0]])) });
                        feature.setProperties({ cityName: cityIdentifier, cityCount: cityCounts[cityIdentifier] });
                        features.push(feature);
                    } else {
                        unlocatedCitiesDetails.push({ name: cityIdentifier, count: cityCounts[cityIdentifier] });
                    }
                }

                if (features.length === 0) { displayMessage('Nenhuma cidade foi geocodificada com sucesso.', 'error'); showLoading(false); return; }

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

                let finalMessage = `Mapeamento concluído! <br>Cidades únicas mapeadas: ${features.length}.`;
                if (unlocatedCitiesDetails.length > 0) {
                    finalMessage += `<br>Cidades não encontradas: ${unlocatedCitiesDetails.length}.`;
                    ui.unlocatedCitiesSection.classList.remove('hidden');
                    ui.unlocatedCountSpan.textContent = unlocatedCitiesDetails.length;
                    ui.unlocatedCitiesList.innerHTML = unlocatedCitiesDetails.map(item => `<li>${item.name} (${item.count} ocorrência${item.count > 1 ? 's' : ''})</li>`).join('');
                }
                displayMessage(finalMessage, 'success');
                showLoading(false);
                ui.downloadPdfBtn.classList.remove('hidden');

            } catch (error) {
                console.error("Erro ao processar dados:", error);
                displayMessage(`Erro: ${error.message}.`, 'error');
                showLoading(false);
            }
        }

        function iniciarMapeamento() {
            if (selectedWords.length === 0) {
                ui.mapContainer.classList.remove('hidden');
                displayMessage('Por favor, selecione pelo menos uma palavra-chave para filtrar.', 'warning');
                ui.downloadPdfBtn.classList.add('hidden');
                if(clusterLayer) map.removeLayer(clusterLayer);
                return;
            }
            
            ui.mapContainer.classList.remove('hidden');
            initializeMap();
            
            const urlParams = new URLSearchParams(window.location.search);
            const planilhaNome = urlParams.get("planilha");

            if (planilhaNome) {
                processDataFromDB(planilhaNome, selectedWords);
            } else {
                displayMessage('Nome da planilha não fornecido na URL.', 'error');
            }
        }
        
        // --- Event Listeners ---
        document.addEventListener('DOMContentLoaded', () => {
            ui.mapButton.addEventListener('click', iniciarMapeamento);
            const urlParams = new URLSearchParams(window.location.search);
            const planilhaNome = urlParams.get("planilha");
            if (planilhaNome) {
                initializeFilter(planilhaNome);
            } else {
                 ui.wordListContainer.innerHTML = "<p>Nome da planilha não fornecido na URL.</p>";
            }
        });

        ui.downloadPdfBtn.addEventListener('click', async () => {
             showLoading(true, 0, 'Gerando PDF...');
            try {
                const { jsPDF } = window.jspdf;
                const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
                const mapCanvas = await html2canvas(document.getElementById('map'), { scale: 2, useCORS: true });
                const mapImgData = mapCanvas.toDataURL('image/png');
                const mapImgProps = pdf.getImageProperties(mapImgData);
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = pdf.internal.pageSize.getHeight();
                const mapPdfWidth = pdfWidth;
                const mapPdfHeight = (mapImgProps.height * mapPdfWidth) / mapImgProps.width;
                let y = (mapPdfHeight < pdfHeight) ? (pdfHeight - mapPdfHeight) / 2 : 0;
                pdf.addImage(mapImgData, 'PNG', 0, y, mapPdfWidth, mapPdfHeight);
                const planilhaNome = new URLSearchParams(window.location.search).get("planilha") || "Analise";
                const dataStr = new Date().toISOString().split("T")[0];
                pdf.save(`${planilhaNome}_MapaFiltrado_${dataStr}.pdf`);
            } catch (error) {
                console.error("Erro ao gerar PDF:", error);
                displayMessage('Ocorreu um erro ao gerar o PDF.', 'error');
            } finally {
                showLoading(false);
            }
        });