document.addEventListener("DOMContentLoaded", () => {
    // Recupera o parâmetro "planilha" da URL atual
    const urlParams = new URLSearchParams(window.location.search);
    const planilhaNome = urlParams.get("planilha");
  
    if (!planilhaNome) {
      alert("Parâmetro 'planilha' ausente na URL.");
      return;
    }
  
    // Variáveis para cabeçalho, dados e paginação
    let headerData = [];
    let tableData = [];
    let filteredData = [];
    let currentPage = 1;
    const rowsPerPage = 20;
  
    // Seleciona os elementos do DOM referentes à tabela, paginação e campo de busca
    const table = document.getElementById("data-table");
    const tableHead = table.querySelector("thead");
    const tableBody = table.querySelector("tbody");
    const pageInfo = document.getElementById("page-info");
    const prevBtn = document.getElementById("prev-btn");
    const nextBtn = document.getElementById("next-btn");
    const loadingDiv = document.getElementById("loading");
    const pageNumbersContainer = document.getElementById("page-numbers");
    const searchInput = document.getElementById("search-input");
  
    // -------------------------
    // 1. Carregar dados do LocalStorage
    // -------------------------
    function loadFromLocalStorage(fileName) {
      const key = `planilha_${fileName}`;
      const storedData = localStorage.getItem(key);
      try {
        return storedData ? JSON.parse(storedData) : [];
      } catch (error) {
        console.error("Erro ao ler os dados do LocalStorage:", error);
        return [];
      }
    }
  
    // -------------------------
    // 2. Processar dados: agrupar por palavra
    // -------------------------
    function processEvocData(rawData) {
      // rawData[0] => cabeçalho
      // rawData.slice(1) => linhas com dados
      const header = rawData[0];
      const rows = rawData.slice(1);
  
      // Identifica as colunas evoc1..evoc5 => EGO, evoc6..evoc10 => ALTER
      const evocEgoIndices = [];
      const evocAlterIndices = [];
  
      header.forEach((colName, idx) => {
        const colNameLower = colName.toLowerCase();
        if (/^evoc[1-5]$/.test(colNameLower)) {
          evocEgoIndices.push(idx);
        } else if (/^evoc(6|7|8|9|10)$/.test(colNameLower)) {
          evocAlterIndices.push(idx);
        }
      });
  
      // Dicionário para contar ocorrências: { "TEMPO": { ego: 0, alter: 0 }, ... }
      const wordCounts = {};
  
      rows.forEach((row) => {
        // Somatório EGO
        evocEgoIndices.forEach((colIdx) => {
          const word = (row[colIdx] || "").trim();
          if (word) {
            if (!wordCounts[word]) {
              wordCounts[word] = { ego: 0, alter: 0 };
            }
            wordCounts[word].ego++;
          }
        });
  
        // Somatório ALTER
        evocAlterIndices.forEach((colIdx) => {
          const word = (row[colIdx] || "").trim();
          if (word) {
            if (!wordCounts[word]) {
              wordCounts[word] = { ego: 0, alter: 0 };
            }
            wordCounts[word].alter++;
          }
        });
      });
  
      // Monta um novo array em formato de tabela:
      // Cabeçalho: ["PALAVRA", "QUANTIDADE_ALTER", "QUANTIDADE_EGO", "QUANTIDADE_TOTAL"]
      const bodyTable = [];
      Object.keys(wordCounts).forEach((word) => {
        if (word.toUpperCase() !== "VAZIO") {
          const { ego, alter } = wordCounts[word];
          bodyTable.push([word, alter, ego, ego + alter]);
        }
      });
  
      // Ordena do MAIOR para o MENOR na coluna "QUANTIDADE_TOTAL" (índice 3)
      bodyTable.sort((a, b) => b[3] - a[3]);
  
      return [
        ["PALAVRA", "QUANTIDADE_ALTER", "QUANTIDADE_EGO", "QUANTIDADE_TOTAL"],
        ...bodyTable
      ];
    }
  
    // -------------------------
    // 3. Renderizar tabela e paginação
    // -------------------------
    function renderTableHeader() {
      tableHead.innerHTML = "";
      if (headerData) {
        const headerRow = document.createElement("tr");
        headerData.forEach((cell) => {
          const th = document.createElement("th");
          th.textContent = cell;
          headerRow.appendChild(th);
        });
        tableHead.appendChild(headerRow);
      }
    }
  
    function renderTable(page) {
      tableBody.innerHTML = "";
      const start = (page - 1) * rowsPerPage;
      const end = start + rowsPerPage;
      const paginatedData = filteredData.slice(start, end);
  
      if (paginatedData.length === 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.colSpan = headerData.length || 1;
        cell.textContent = "Nenhum registro encontrado.";
        cell.style.textAlign = "center";
        row.appendChild(cell);
        tableBody.appendChild(row);
      } else {
        paginatedData.forEach((rowData) => {
          const row = document.createElement("tr");
          rowData.forEach((cellData) => {
            const cell = document.createElement("td");
            cell.textContent = cellData;
            row.appendChild(cell);
          });
          tableBody.appendChild(row);
        });
      }
      updatePagination();
    }
  
    // Atualiza os botões e os números da paginação
    function updatePagination() {
      const totalPages = Math.max(1, Math.ceil(filteredData.length / rowsPerPage));
      pageInfo.textContent = `Página ${currentPage} de ${totalPages}`;
  
      prevBtn.disabled = currentPage <= 1;
      nextBtn.disabled = currentPage >= totalPages;
  
      if (pageNumbersContainer) {
        pageNumbersContainer.innerHTML = "";
        // Exibe somente duas páginas para trás e duas à frente da página atual
        const pagesToDisplay = getPageNumbers(totalPages, currentPage);
        pagesToDisplay.forEach((page) => {
          const btn = document.createElement("button");
          btn.textContent = page;
          btn.className = "page-btn";
          if (page === currentPage) {
            btn.classList.add("active");
          }
          btn.addEventListener("click", () => {
            currentPage = page;
            renderTable(currentPage);
          });
          pageNumbersContainer.appendChild(btn);
        });
      }
    }
  
    // Função de paginação: janela fixa com duas páginas antes e duas depois
    function getPageNumbers(totalPages, currentPage) {
      const start = Math.max(1, currentPage - 2);
      const end = Math.min(totalPages, currentPage + 2);
      const pages = [];
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      return pages;
    }
  
    // Exibe ou oculta o elemento de loading
    function showLoading(show) {
      loadingDiv.style.display = show ? "block" : "none";
    }
  
    // Navegação entre páginas
    function goToPreviousPage() {
      if (currentPage > 1) {
        currentPage--;
        renderTable(currentPage);
      }
    }
  
    function goToNextPage() {
      const totalPages = Math.ceil(filteredData.length / rowsPerPage);
      if (currentPage < totalPages) {
        currentPage++;
        renderTable(currentPage);
      }
    }
  
    prevBtn.addEventListener("click", goToPreviousPage);
    nextBtn.addEventListener("click", goToNextPage);
  
    // -------------------------
    // 4. Filtro instantâneo de palavras
    // -------------------------
    function applyFilter(searchTerm) {
      if (!searchTerm) {
        filteredData = tableData;
      } else {
        const lowerTerm = searchTerm.toLowerCase();
        filteredData = tableData.filter((row) =>
          row[0].toLowerCase().includes(lowerTerm)
        );
      }
      currentPage = 1;
      renderTable(currentPage);
    }
  
    if (searchInput) {
      searchInput.addEventListener("input", () => {
        applyFilter(searchInput.value);
      });
    }
  
    // -------------------------
    // 5. Inicializar a tabela
    // -------------------------
    function init() {
      showLoading(true);
      setTimeout(() => {
        const rawData = loadFromLocalStorage(planilhaNome);
        if (rawData.length === 0) {
          console.warn("Nenhum dado encontrado no LocalStorage para esta planilha.");
          showLoading(false);
          return;
        }
  
        // Processa os dados para obter [PALAVRA, QUANTIDADE_ALTER, QUANTIDADE_EGO, QUANTIDADE_TOTAL],
        // já ordenado e sem incluir a palavra "VAZIO"
        const newData = processEvocData(rawData);
        headerData = newData[0];
        tableData = newData.slice(1);
        filteredData = tableData;
  
        renderTableHeader();
        renderTable(currentPage);
        showLoading(false);
      }, 1000);
    }
  
    init();
  });
  