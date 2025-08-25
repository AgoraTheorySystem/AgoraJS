// formaragora.js
document.addEventListener("DOMContentLoaded", () => {
  const urlParams = new URLSearchParams(window.location.search);
  const planilhaNome = urlParams.get("planilha");
  if (!planilhaNome) {
    alert("Parâmetro 'planilha' ausente na URL.");
    return;
  }
  const planilha = new URLSearchParams(location.search).get('planilha');
  document.querySelector(".barra-planilha").textContent = planilha;
  
  const DB_NAME = 'agoraDB';
  const STORE_NAME = 'planilhas';

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


  // Armazena a palavra selecionada em cada um dos 5 níveis
  const selectedWords = Array(5).fill(null);
  // Guarda referência aos containers de cada planilha (nível)
  const planilhas = [];

  // Controle de exibir/esconder o campo extraOpcao quando "Conectividade" estiver selecionado
  const extraOpcao = document.getElementById("extraOpcao");
  const radiosAnalise = document.querySelectorAll('input[name="analise"]');

  function atualizarVisibilidadeExtraOpcao() {
    const selecionado = document.querySelector('input[name="analise"]:checked').value;
    if (selecionado === "Conectividade") {
      extraOpcao.style.display = "flex";
    } else {
      extraOpcao.style.display = "none";
    }
  }
  // Inicializa a visibilidade correta assim que a página carrega
  atualizarVisibilidadeExtraOpcao();

  // Reagir a mudanças de "análise" e atualizar visibilidade + refazer tabelas
  radiosAnalise.forEach(radio => {
    radio.addEventListener("change", () => {
      atualizarVisibilidadeExtraOpcao();
      planilhas.forEach(p => p.container.renderTable(1));
    });
  });

  // Cria o DOM de uma planilha (tabela + campo de busca + paginação + loading)
  function createPlanilhaElement() {
    const planilhaEl = document.createElement("div");
    planilhaEl.classList.add("planilha");

    // Campo de busca
    const searchInput = document.createElement("input");
    searchInput.type = "search";
    searchInput.placeholder = "Pesquisar palavra...";
    searchInput.style.marginBottom = "10px";
    searchInput.style.padding = "6px";
    searchInput.style.width = "100%";
    planilhaEl.appendChild(searchInput);

    // Tabela de dados
    const table = document.createElement("table");
    table.classList.add("data-table");
    const thead = document.createElement("thead");
    const tbody = document.createElement("tbody");
    table.append(thead, tbody);
    planilhaEl.appendChild(table);

    // Controles de paginação
    const pagination = document.createElement("div");
    pagination.classList.add("pagination");

    const prevBtn = document.createElement("button");
    prevBtn.classList.add("prev-btn");
    prevBtn.textContent = "Anterior";

    const pageInfo = document.createElement("span");
    pageInfo.classList.add("page-info");

    const nextBtn = document.createElement("button");
    nextBtn.classList.add("next-btn");
    nextBtn.textContent = "Próximo";

    const pageNumbers = document.createElement("div");
    pageNumbers.classList.add("page-numbers");

    pagination.append(prevBtn, pageInfo, nextBtn, pageNumbers);
    planilhaEl.appendChild(pagination);

    // Indicador de loading
    const loading = document.createElement("div");
    loading.classList.add("loading");
    loading.setAttribute("aria-live", "polite");
    loading.setAttribute("aria-busy", "true");
    loading.style.display = "none";
    loading.innerHTML = `
      <figure class="loader">
        <div class="dot white"></div>
        <div class="dot"></div>
        <div class="dot"></div>
        <div class="dot"></div>
        <div class="dot"></div>
      </figure>`;
    planilhaEl.appendChild(loading);

    return { planilhaEl, searchInput, thead, tbody, prevBtn, pageInfo, nextBtn, pageNumbers, loading };
  }

  // Inicializa cada planilha (nível), carregando dados e configurando filtros/paginação
  function initPlanilha(container, planilhaNome, level) {
    let headerData = [];
    let tableData = [];
    const rowsPerPage = 15;
    let currentPage = 1;
    let currentSearch = "";

    // Busca os dados brutos no IndexedDB
    async function loadData() {
        const key = `planilha_${planilhaNome}`;
        try {
            const raw = await getItem(key);
            return raw || [];
        } catch (error) {
            console.error(error);
            return [];
        }
    }

    // Calcula frequência das palavras no intervalo (Ego: EVOC1–5 ou Alter: EVOC6–10),
    // aplicando filtros de nível anterior, exclusão de "VAZIO" e termos já selecionados,
    // além de filtro de busca se houver algo digitado
    function computeFrequencies() {
      const analiseSelecionada = document.querySelector('input[name="analise"]:checked').value;
      // (Caso queira tratar Conectividade de forma específica, faz aqui)

      const aspecto = document.querySelector('input[name="aspecto"]:checked').value;
      const pattern = aspecto === "Ego"
        ? /^EVOC[1-5]$/i
        : /^EVOC(?:6|7|8|9|10)$/i;

      // Mapeia índices das colunas que batem com o padrão (EVOCx)
      const indices = headerData
        .map((col, i) => ({ col: col.toUpperCase(), i }))
        .filter(o => pattern.test(o.col))
        .map(o => o.i);

      // Filtra linhas que contenham todas as palavras selecionadas nos níveis anteriores
      let rows = tableData;
      if (level > 1) {
        for (let l = 1; l < level; l++) {
          if (!selectedWords[l - 1]) return [];
        }
        rows = rows.filter(row =>
          selectedWords
            .slice(0, level - 1)
            .every(w =>
              indices.some(j => String(row[j] || "").trim() === w)
            )
        );
      }

      // Lista de termos a excluir: "VAZIO" e palavras já selecionadas em níveis anteriores
      const exclude = selectedWords
        .slice(0, level - 1)
        .filter(Boolean)
        .map(w => w.toUpperCase());

      // Conta frequências
      const freq = {};
      rows.forEach(row => {
        indices.forEach(j => {
          const raw = String(row[j] || "").trim();
          if (!raw) return;
          const upper = raw.toUpperCase();
          if (upper === "VAZIO") return;
          if (exclude.includes(upper)) return;
          if (currentSearch && !raw.toLowerCase().includes(currentSearch.toLowerCase())) return;
          freq[raw] = (freq[raw] || 0) + 1;
        });
      });

      // Transforma em array e ordena do maior para o menor
      return Object.entries(freq)
        .sort((a, b) => b[1] - a[1]);
    }

    // Renderiza o cabeçalho fixo (duas colunas: Palavra / Frequência)
    function renderTableHeader() {
      container.thead.innerHTML = "";
      const tr = document.createElement("tr");
      ["Palavra", "Frequência"].forEach(txt => {
        const th = document.createElement("th");
        th.textContent = txt;
        tr.appendChild(th);
      });
      container.thead.appendChild(tr);
    }

    // Renderiza o corpo da tabela, criando linhas clicáveis que selecionam palavra
    function renderTable(page = currentPage) {
      currentPage = page;
      const freqArray = computeFrequencies();
      const total = freqArray.length;
      const totalPages = Math.max(1, Math.ceil(total / rowsPerPage));

      if (currentPage > totalPages) currentPage = totalPages;
      if (currentPage < 1) currentPage = 1;

      container.tbody.innerHTML = "";

      const start = (currentPage - 1) * rowsPerPage;
      const slice = freqArray.slice(start, start + rowsPerPage);

      if (slice.length === 0) {
        const tr = document.createElement("tr");
        const td = document.createElement("td");
        td.colSpan = 2;
        td.textContent = "Nenhum registro encontrado.";
        td.style.textAlign = "center";
        tr.appendChild(td);
        container.tbody.appendChild(tr);
      } else {
        slice.forEach(([word, count]) => {
          const tr = document.createElement("tr");
          const td1 = document.createElement("td");
          td1.textContent = word;
          const td2 = document.createElement("td");
          td2.textContent = count;
          tr.append(td1, td2);

          // Ao clicar, marca-se como palavra selecionada no nível,
          // limpa-se seleções abaixo e refaz tabelas dos níveis superiores
          tr.addEventListener("click", () => {
            selectedWords[level - 1] = word;
            for (let l = level; l < 5; l++) selectedWords[l] = null;
            container.tbody
              .querySelectorAll("tr")
              .forEach(r => r.classList.remove("selected-word"));
            tr.classList.add("selected-word");
            planilhas
              .filter(p => p.level > level)
              .forEach(p => p.container.renderTable(1));
          });

          container.tbody.appendChild(tr);
        });
      }

      // Atualiza controles de paginação
      container.pageInfo.textContent = `Página ${currentPage} de ${totalPages}`;
      container.prevBtn.disabled = currentPage <= 1;
      container.nextBtn.disabled = currentPage >= totalPages;

      container.pageNumbers.innerHTML = "";
      const startPg = Math.max(1, currentPage - 2);
      const endPg = Math.min(totalPages, currentPage + 2);
      for (let p = startPg; p <= endPg; p++) {
        const btn = document.createElement("button");
        btn.textContent = p;
        btn.className = "page-btn";
        if (p === currentPage) btn.classList.add("active");
        btn.addEventListener("click", () => renderTable(p));
        container.pageNumbers.appendChild(btn);
      }
    }

    // Botões de anterior/proximo da paginação
    container.prevBtn.addEventListener("click", () => {
      if (currentPage > 1) renderTable(currentPage - 1);
    });
    container.nextBtn.addEventListener("click", () => {
      const freqArray = computeFrequencies();
      const total = freqArray.length;
      const totalPages = Math.max(1, Math.ceil(total / rowsPerPage));
      if (currentPage < totalPages) renderTable(currentPage + 1);
    });

    // Filtro de busca: atualiza currentSearch e refaz tabela a partir da página 1
    container.searchInput.addEventListener("input", (e) => {
      currentSearch = e.target.value.trim();
      renderTable(1);
    });

    // Expor renderTable para que outros níveis possam invocar
    container.renderTable = renderTable;

    // Processo inicial de carregamento de dados e renderização
    container.loading.style.display = "block";
    loadData().then(data => {
        if (data.length < 2) {
          container.loading.style.display = "none";
          return;
        }
        headerData = data[0];
        tableData = data.slice(1);
        renderTableHeader();
        renderTable(1);
        container.loading.style.display = "none";
    });

    // Ao mudar de "aspecto" (Ego/Alter), refaz a tabela deste nível
    document
      .querySelectorAll('input[name="aspecto"]')
      .forEach(inp => inp.addEventListener("change", () => renderTable(1)));
  }

  // CONTROLES DE NÍVEIS: cria botões 1 a 5 e renderiza a quantidade escolhida de planilhas
  const niveisContainer = document.getElementById("niveisContainer");
  const planilhasContainer = document.getElementById("planilhasContainer");
  niveisContainer.innerHTML = "";
  planilhasContainer.innerHTML = "";
  planilhas.length = 0;

  for (let i = 1; i <= 5; i++) {
    const btn = document.createElement("button");
    btn.textContent = i;
    btn.addEventListener("click", () => {
      // Marca botão selecionado e reseta containers
      document
        .querySelectorAll("#niveisContainer button")
        .forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
      planilhasContainer.innerHTML = "";
      planilhas.length = 0;
      selectedWords.fill(null);

      // Cria 'i' planilhas (níveis) na tela
      for (let lvl = 1; lvl <= i; lvl++) {
        const elem = createPlanilhaElement();
        planilhasContainer.appendChild(elem.planilhaEl);
        planilhas.push({ container: elem, level: lvl });
        initPlanilha(elem, planilhaNome, lvl);
      }
    });
    niveisContainer.appendChild(btn);
  }

  // Seleciona o nível 1 por padrão ao iniciar
  niveisContainer.querySelector("button").click();

  // ------------------------------------------------------------
  // Função executada pelo botão "FORMAR ÁGORAS 💡"
  // Agora monta um objeto com todos os parâmetros e envia para bolhas.js
  window.rodarAnalise = () => {
    const nivel = document.querySelector("#niveisContainer .selected")?.textContent;
    const analise = document.querySelector('input[name="analise"]:checked').value;
    const aspecto = document.querySelector('input[name="aspecto"]:checked').value;
    const valor = document.getElementById("valorConectividade").value;

    // Monta objeto com todos os dados necessários
    const parametros = {
      nivelSelecionado: nivel,
      analise: analise,
      aspecto: aspecto,
      valorConectividade: valor || null,
      palavrasPorNivel: selectedWords.slice(0).filter(w => w)
    };

    // Chama a função em bolhas.js (deve estar definida como window.gerarBolhas)
    if (typeof window.gerarBolhas === "function") {
      window.gerarBolhas(parametros);
    } else {
      console.warn("Função gerarBolhas não encontrada em bolhas.js");
    }
  };
});