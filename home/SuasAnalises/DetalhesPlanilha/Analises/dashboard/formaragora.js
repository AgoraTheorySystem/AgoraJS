// formaragora.js - Versão Corrigida e Funcional
document.addEventListener("DOMContentLoaded", async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const planilhaNome = urlParams.get("planilha");
  
  if (!planilhaNome) {
    const alertMessage = typeof window.getTranslation === 'function' 
      ? await window.getTranslation('form_agoras_param_missing_alert') 
      : "Parâmetro 'planilha' ausente na URL.";
    alert(alertMessage);
    return;
  }

  // Define o nome na barra superior
  const barraPlanilha = document.querySelector(".barra-planilha");
  if (barraPlanilha) barraPlanilha.textContent = planilhaNome;
  
  const DB_NAME = 'agoraDB';
  const STORE_NAME = 'planilhas';

  // --- Funções de Banco de Dados (IndexedDB) ---
  function openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onsuccess = (event) => resolve(event.target.result);
      request.onerror = (event) => reject(event.target.error);
    });
  }

  async function getItem(key) {
    try {
      const db = await openDB();
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);
      return new Promise((resolve, reject) => {
        request.onsuccess = (event) => resolve(event.target.result ? event.target.result.value : null);
        request.onerror = (event) => reject(event.target.error);
      });
    } catch (e) {
      console.error("Erro ao acessar IndexedDB:", e);
      return null;
    }
  }

  // --- Processamento de Dados e Lemas ---
  function applyLemas(sheetData, lemas) {
    if (!lemas || Object.keys(lemas).length === 0) return sheetData;
    const reverseLemaMap = {};
    const deletedWords = new Set();

    for (const [palavraFundida, dataLema] of Object.entries(lemas)) {
      const palavraFundidaUpper = palavraFundida.toUpperCase();
      if (dataLema === null) {
        deletedWords.add(palavraFundidaUpper);
        continue;
      }
      const isNewFormat = dataLema && typeof dataLema === 'object' && !Array.isArray(dataLema) && dataLema.origem;
      if (isNewFormat) {
        dataLema.origem.forEach(origemStr => {
          const palavraOriginal = origemStr.split(' (')[0].trim().toUpperCase();
          if (palavraOriginal) reverseLemaMap[palavraOriginal] = palavraFundidaUpper;
        });
      }
    }

    return sheetData.map((row, rowIndex) => {
      if (rowIndex === 0 || !Array.isArray(row)) return row;
      return row.map(cell => {
        const valor = String(cell || "").trim().toUpperCase();
        if (!valor) return cell;
        if (reverseLemaMap[valor]) return reverseLemaMap[valor];
        if (deletedWords.has(valor)) return "VAZIO";
        return cell;
      });
    });
  }

  const selectedWords = Array(5).fill(null);
  const planilhas = [];
  let globalLemas = {};

  // --- Elementos de Filtro ---
  const selectPositividade = document.getElementById("filtroPositividade");
  const selectCategorias = document.getElementById("filtroCategorias");
  const extraOpcao = document.getElementById("extraOpcao");
  
  function atualizarVisibilidadeExtraOpcao() {
    const radioChecked = document.querySelector('input[name="analise"]:checked');
    if (extraOpcao && radioChecked) {
      extraOpcao.style.display = (radioChecked.value === "Conectividade") ? "flex" : "none";
    }
  }

  function refazerTabelas() {
    planilhas.forEach(p => p.container.renderTable(1));
  }

  // Configuração de Listeners Globais
  if (selectPositividade) selectPositividade.addEventListener("change", refazerTabelas);
  if (selectCategorias) selectCategorias.addEventListener("change", refazerTabelas);

  document.querySelectorAll('input[name="analise"]').forEach(r => {
    r.addEventListener("change", () => {
      atualizarVisibilidadeExtraOpcao();
      refazerTabelas();
    });
  });

  document.querySelectorAll('input[name="aspecto"]').forEach(r => {
    r.addEventListener("change", refazerTabelas);
  });

  function popularCategorias(lemas) {
    if (!selectCategorias) return;
    const categorias = new Set();
    Object.values(lemas).forEach(lema => {
      if (lema && lema.categoria) {
        categorias.add(lema.categoria.toUpperCase().trim());
      }
    });

    selectCategorias.innerHTML = '<option value="">Todas as Categorias</option>';
    const sortedCats = Array.from(categorias).sort();
    sortedCats.forEach(cat => {
      const opt = document.createElement("option");
      opt.value = cat;
      opt.textContent = cat;
      selectCategorias.appendChild(opt);
    });
  }

  // --- Criação Dinâmica de Planilhas por Nível ---
  async function createPlanilhaElement() {
    const planilhaEl = document.createElement("div");
    planilhaEl.classList.add("planilha");

    const searchInput = document.createElement("input");
    searchInput.type = "search";
    searchInput.placeholder = "Filtrar palavra...";
    planilhaEl.appendChild(searchInput);

    const table = document.createElement("table");
    table.classList.add("data-table");
    const thead = document.createElement("thead");
    const tbody = document.createElement("tbody");
    table.append(thead, tbody);
    planilhaEl.appendChild(table);

    const pagination = document.createElement("div");
    pagination.classList.add("pagination");
    const prevBtn = document.createElement("button"); prevBtn.textContent = "<";
    const pageInfo = document.createElement("span");
    const nextBtn = document.createElement("button"); nextBtn.textContent = ">";
    const pageNumbers = document.createElement("div");
    pageNumbers.classList.add("page-numbers");

    pagination.append(prevBtn, pageInfo, nextBtn, pageNumbers);
    planilhaEl.appendChild(pagination);

    const loading = document.createElement("div");
    loading.classList.add("loading-inner");
    loading.style.display = "none";
    loading.innerHTML = `<div class="loader-small"></div>`;
    planilhaEl.appendChild(loading);

    return { planilhaEl, searchInput, thead, tbody, prevBtn, pageInfo, nextBtn, pageNumbers, loading };
  }

  function initPlanilha(container, planilhaNome, level) {
    let headerData = [];
    let tableData = [];
    const rowsPerPage = 15;
    let currentPage = 1;
    let currentSearch = "";

    async function loadData() {
      const key = `planilha_${planilhaNome}`;
      const lemasKey = `lemas_${planilhaNome}`;
      try {
        const raw = await getItem(key);
        const lemas = await getItem(lemasKey) || {};
        globalLemas = lemas;
        
        if (level === 1) popularCategorias(lemas);

        if (!raw || raw.length === 0) return [[], {}];
        const processedData = applyLemas(raw, lemas); 
        return [processedData, lemas];
      } catch (error) {
        console.error("Erro ao carregar dados do nível:", error);
        return [[], {}];
      }
    }

    function computeFrequencies() {
      const radioAspecto = document.querySelector('input[name="aspecto"]:checked');
      if (!radioAspecto) return [];

      const aspecto = radioAspecto.value;
      const fPos = selectPositividade ? selectPositividade.value.toUpperCase().trim() : "";
      const fCat = selectCategorias ? selectCategorias.value.toUpperCase().trim() : "";

      const pattern = aspecto === "Ego" ? /^EVOC[1-5]$/i : /^EVOC(?:6|7|8|9|10)$/i;

      const indices = headerData
        .map((col, i) => ({ col: col.toUpperCase(), i }))
        .filter(o => pattern.test(o.col))
        .map(o => o.i);

      let rows = tableData;
      
      // Filtro de níveis anteriores (Efeito Cascata)
      if (level > 1) {
        const palavrasFiltroAnterior = selectedWords.slice(0, level - 1).filter(Boolean);
        if (palavrasFiltroAnterior.length > 0) {
          rows = rows.filter(row => {
            const evocValues = new Set(indices.map(j => String(row[j] || "").trim().toUpperCase()));
            return palavrasFiltroAnterior.every(p => evocValues.has(p.toUpperCase()));
          });
        }
      }

      const exclude = selectedWords.slice(0, level - 1).filter(Boolean).map(w => w.toUpperCase());
      exclude.push("VAZIO");

      const freq = {};
      rows.forEach(row => {
        indices.forEach(j => {
          const raw = String(row[j] || "").trim();
          if (!raw) return;
          const upper = raw.toUpperCase();
          if (exclude.includes(upper)) return; 

          // --- CORREÇÃO: Filtros de metadados com normalização ---
          const infoLema = globalLemas[upper];
          
          if (fPos) {
              const valorPositividade = String(infoLema?.positividade || "").toUpperCase().trim();
              // Aceita correspondências parciais ou exatas (ex: "POSITIVA" ou "POSITIVO")
              if (!valorPositividade.startsWith(fPos.substring(0, 5))) return;
          }
          
          if (fCat) {
              const valorCategoria = String(infoLema?.categoria || "").toUpperCase().trim();
              if (valorCategoria !== fCat) return;
          }

          if (currentSearch && !raw.toLowerCase().includes(currentSearch.toLowerCase())) return;
          freq[raw] = (freq[raw] || 0) + 1;
        });
      });

      return Object.entries(freq).sort((a, b) => b[1] - a[1]);
    }

    async function renderTable(page = currentPage) {
      currentPage = page;
      const freqArray = computeFrequencies();
      const total = freqArray.length;
      const totalPages = Math.max(1, Math.ceil(total / rowsPerPage));

      if (currentPage > totalPages) currentPage = totalPages;
      container.tbody.innerHTML = "";

      const start = (currentPage - 1) * rowsPerPage;
      const slice = freqArray.slice(start, start + rowsPerPage);

      if (slice.length === 0) {
        container.tbody.innerHTML = `<tr><td colspan="2" style="text-align:center; padding: 2rem; color: #888;">Nenhuma palavra encontrada com estes filtros.</td></tr>`;
      } else {
        slice.forEach(([word, count]) => {
          const tr = document.createElement("tr");
          tr.innerHTML = `<td>${word}</td><td>${count}</td>`;
          
          if (selectedWords[level - 1] === word) tr.classList.add("selected-word");

          tr.addEventListener("click", () => {
            selectedWords[level - 1] = word;
            // Reseta seleções dos níveis à direita
            for (let l = level; l < 5; l++) selectedWords[l] = null;
            
            container.tbody.querySelectorAll("tr").forEach(r => r.classList.remove("selected-word"));
            tr.classList.add("selected-word");
            
            // Re-renderiza as tabelas subsequentes
            planilhas.filter(p => p.level > level).forEach(p => p.container.renderTable(1));
          });
          container.tbody.appendChild(tr);
        });
      }

      container.pageInfo.textContent = `Pág. ${currentPage}/${totalPages}`;
      container.prevBtn.disabled = currentPage <= 1;
      container.nextBtn.disabled = currentPage >= totalPages;

      container.pageNumbers.innerHTML = "";
      for (let p = Math.max(1, currentPage - 1); p <= Math.min(totalPages, currentPage + 1); p++) {
        const btn = document.createElement("button");
        btn.textContent = p;
        btn.className = (p === currentPage) ? "page-btn active" : "page-btn";
        btn.onclick = () => renderTable(p);
        container.pageNumbers.appendChild(btn);
      }
    }

    container.prevBtn.onclick = () => renderTable(currentPage - 1);
    container.nextBtn.onclick = () => renderTable(currentPage + 1);
    container.searchInput.oninput = (e) => {
      currentSearch = e.target.value.trim();
      renderTable(1);
    };

    container.renderTable = renderTable;
    container.loading.style.display = "block";
    
    loadData().then(([data]) => {
      if (data && data.length >= 2) {
        headerData = data[0]; 
        tableData = data.slice(1);
        container.thead.innerHTML = `<tr><th>Palavra</th><th>Freq.</th></tr>`;
        renderTable(1);
      }
    }).finally(() => container.loading.style.display = "none");
  }

  // --- Inicialização dos Níveis ---
  const niveisContainer = document.getElementById("niveisContainer");
  const planilhasContainer = document.getElementById("planilhasContainer");

  if (niveisContainer) {
    for (let i = 1; i <= 5; i++) {
      const btn = document.createElement("button");
      btn.textContent = i;
      btn.addEventListener("click", async () => {
        document.querySelectorAll("#niveisContainer button").forEach(b => b.classList.remove("selected"));
        btn.classList.add("selected");
        planilhasContainer.innerHTML = "";
        planilhas.length = 0;
        selectedWords.fill(null);

        for (let lvl = 1; lvl <= i; lvl++) {
          const elem = await createPlanilhaElement();
          planilhasContainer.appendChild(elem.planilhaEl);
          planilhas.push({ container: elem, level: lvl });
          initPlanilha(elem, planilhaNome, lvl);
        }
      });
      niveisContainer.appendChild(btn);
    }
    // Seleciona o nível 1 por padrão
    niveisContainer.querySelector("button")?.click();
  }

  // --- FUNÇÃO GLOBAL: Rodar Análise ---
  // Exposta via window para que o onclick do HTML funcione com type="module"
  window.rodarAnalise = () => {
    const nivelElement = document.querySelector("#niveisContainer .selected");
    const analiseElement = document.querySelector('input[name="analise"]:checked');
    const aspectoElement = document.querySelector('input[name="aspecto"]:checked');
    const valorConectividade = document.getElementById("valorConectividade")?.value;

    if (!analiseElement) {
        alert("Por favor, selecione um tipo de análise.");
        return;
    }

    const parametros = {
      nivelSelecionado: nivelElement ? nivelElement.textContent : "1",
      analise: analiseElement.value,
      aspecto: aspectoElement ? aspectoElement.value : "Ego",
      positividade: selectPositividade ? selectPositividade.value : "",
      categoria: selectCategorias ? selectCategorias.value : "",
      valorConectividade: valorConectividade || null,
      palavrasPorNivel: selectedWords.filter(w => w)
    };

    console.log("Rodando análise com parâmetros:", parametros);

    // Verifica se a função de geração de bolhas existe no escopo global
    if (typeof window.gerarBolhas === "function") {
      window.gerarBolhas(parametros);
    } else {
      console.error("Erro: A função window.gerarBolhas não foi encontrada em bolhas.js.");
      alert("Erro ao iniciar visualização. Verifique se os componentes de análise foram carregados.");
    }
  };

  atualizarVisibilidadeExtraOpcao();
});