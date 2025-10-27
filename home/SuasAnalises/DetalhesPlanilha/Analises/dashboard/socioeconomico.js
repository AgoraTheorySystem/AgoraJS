// socioeconomico.js
document.addEventListener("DOMContentLoaded", () => {
  const urlParams = new URLSearchParams(window.location.search);
  const planilhaNome = urlParams.get("planilha");

  const nomePlanilhaDiv = document.getElementById("nome-da-planilha");
  if (nomePlanilhaDiv && planilhaNome) {
    nomePlanilhaDiv.textContent = planilhaNome.toUpperCase();
  }

  if (!planilhaNome) {
    alert("Parâmetro 'planilha' ausente na URL.");
    return;
  }

  const DB_NAME = 'agoraDB';
  const STORE_NAME = 'planilhas';

  let data = [];
  let filteredData = [];
  let headerData = [];
  let tableData = [];
  let currentLemas = {};
  let currentQuery = "";
  let currentPage = 1;
  const rowsPerPage = 10;

  const table = document.getElementById("data-table");
  const tableHead = table.querySelector("thead");
  const tableBody = table.querySelector("tbody");
  const pageInfo = document.getElementById("page-info");
  const prevBtn = document.getElementById("prev-btn");
  const nextBtn = document.getElementById("next-btn");
  const loadingDiv = document.getElementById("loading");
  const filterInput = document.getElementById("filter-input");
  const downloadBtn = document.getElementById("download-btn");

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
      request.onsuccess = (event) => {
        resolve(event.target.result ? event.target.result.value : null);
      };
      request.onerror = (event) => reject(event.target.error);
    });
  }

  async function loadFromIndexedDB(fileName) {
    const key = `planilha_${fileName}`;
    try {
      const storedData = await getItem(key);
      return storedData ? storedData : [];
    } catch (error) {
      console.error("Erro ao ler os dados do IndexedDB:", error);
      return [];
    }
  }

  function applyLemas(sheetData, lemas) {
      if (!lemas || Object.keys(lemas).length === 0) {
          return sheetData;
      }

      // Cria um mapa reverso: { PALAVRA_ORIGINAL: PALAVRA_FUNDIDA }
      const reverseLemaMap = {};
      for (const [palavraFundida, dataLema] of Object.entries(lemas)) {
          if (dataLema && Array.isArray(dataLema.origem)) {
              dataLema.origem.forEach(origemStr => {
                  const palavraOriginal = origemStr.split(' (')[0].trim().toUpperCase();
                  reverseLemaMap[palavraOriginal] = palavraFundida.toUpperCase();
              });
          }
      }
      
      if (Object.keys(reverseLemaMap).length === 0) {
        return sheetData;
      }

      // Mapeia os dados da planilha, substituindo as palavras
      return sheetData.map((row, rowIndex) => {
          if (rowIndex === 0) return row; // Mantém o cabeçalho
          return row.map(cell => {
              const valor = String(cell || "").trim().toUpperCase();
              return reverseLemaMap[valor] || cell;
          });
      });
  }


  const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  function highlightText(text, query) {
    if (!query) return text;
    const escapedQuery = escapeRegExp(query);
    const regex = new RegExp(`(${escapedQuery})`, "gi");
    return text.replace(regex, '<span class="destaque">$1</span>');
  }

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
      cell.colSpan = headerData ? headerData.length : 1;
      cell.textContent = "Nenhum registro encontrado.";
      cell.style.textAlign = "center";
      row.appendChild(cell);
      tableBody.appendChild(row);
    } else {
      paginatedData.forEach((rowData) => {
        const row = document.createElement("tr");
        rowData.forEach((cellData) => {
          const cell = document.createElement("td");
          cell.innerHTML = highlightText(String(cellData), currentQuery);
          row.appendChild(cell);
        });
        tableBody.appendChild(row);
      });
    }
    updatePagination();
  }

  function updatePagination() {
    const totalPages = Math.max(1, Math.ceil(filteredData.length / rowsPerPage));
    pageInfo.textContent = `Página ${currentPage} de ${totalPages}`;
    prevBtn.disabled = currentPage <= 1;
    nextBtn.disabled = currentPage >= totalPages;

    const pageNumbersContainer = document.getElementById("page-numbers");
    if (pageNumbersContainer) {
      pageNumbersContainer.innerHTML = "";
      const pagesToDisplay = getPageNumbers(totalPages, currentPage);
      pagesToDisplay.forEach(page => {
        const btn = document.createElement("button");
        btn.textContent = page;
        btn.className = "page-btn";
        if (page === currentPage) btn.classList.add("active");
        btn.addEventListener("click", () => {
          currentPage = page;
          renderTable(currentPage);
        });
        pageNumbersContainer.appendChild(btn);
      });
    }
  }

  function getPageNumbers(totalPages, currentPage) {
    const start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, currentPage + 2);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }

  function applyFilter(query) {
    currentQuery = query;
    if (query === "") {
      filteredData = tableData;
    } else {
      filteredData = tableData.filter((row) =>
        row.some((cell) => cell.toString().toLowerCase().includes(query))
      );
    }
    currentPage = 1;
    renderTable(currentPage);
  }

  function debounce(func, delay) {
    let timeoutId;
    return function (...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        func.apply(this, args);
      }, delay);
    };
  }

  function showLoading(show) {
    loadingDiv.style.display = show ? "block" : "none";
  }

  async function downloadPlanilha() {
    try {
        showLoading(true);
        // Para o download, usamos os dados já transformados com as fusões
        const dataToDownload = [headerData, ...tableData];
        
        const worksheet = XLSX.utils.aoa_to_sheet(dataToDownload);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Dados");

        XLSX.writeFile(workbook, `${planilhaNome}_socioeconomico.xlsx`);
    } catch (error) {
        console.error("Erro ao gerar o arquivo XLSX:", error);
        alert("Ocorreu um erro ao tentar baixar a planilha.");
    } finally {
        showLoading(false);
    }
  }

  prevBtn.addEventListener("click", () => {
    if (currentPage > 1) {
      currentPage--;
      renderTable(currentPage);
    }
  });

  nextBtn.addEventListener("click", () => {
    const totalPages = Math.ceil(filteredData.length / rowsPerPage);
    if (currentPage < totalPages) {
      currentPage++;
      renderTable(currentPage);
    }
  });

  filterInput.addEventListener("input", debounce((e) => {
    applyFilter(e.target.value.trim().toLowerCase());
  }, 300));

  downloadBtn.addEventListener("click", downloadPlanilha);

  async function init() {
    showLoading(true);
    try {
      data = await loadFromIndexedDB(planilhaNome);
      currentLemas = await getItem(`lemas_${planilhaNome}`) || {};

      if (data.length === 0) return;

      const dataComLemas = applyLemas(data, currentLemas);

      headerData = dataComLemas[0];
      tableData = dataComLemas.slice(1);
      filteredData = tableData;

      renderTableHeader();
      renderTable(currentPage);
    } catch (err) {
      console.error("Erro ao carregar dados:", err);
    } finally {
      showLoading(false);
    }
  }

  init();
});
