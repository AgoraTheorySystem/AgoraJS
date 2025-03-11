document.addEventListener("DOMContentLoaded", () => {
    // Recupera o parâmetro "planilha" da URL atual
    const urlParams = new URLSearchParams(window.location.search);
    const planilhaNome = urlParams.get("planilha");
  
    if (!planilhaNome) {
      alert("Parâmetro 'planilha' ausente na URL.");
      return;
    }
  
    let data = [];
    let headerData = [];
    let tableData = [];
    let filteredData = [];
    let currentPage = 1;
    const rowsPerPage = 10;
  
    // Seleciona os elementos do DOM referentes à tabela e paginação
    const table = document.getElementById("data-table");
    const tableHead = table.querySelector("thead");
    const tableBody = table.querySelector("tbody");
    const pageInfo = document.getElementById("page-info");
    const prevBtn = document.getElementById("prev-btn");
    const nextBtn = document.getElementById("next-btn");
    const loadingDiv = document.getElementById("loading");
  
    // Função para carregar dados do LocalStorage
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
  
    // Filtra as colunas que começam com "EVOC"
    function filterColumns() {
      const indices = [];
      headerData = headerData.filter((header, index) => {
        if (header.startsWith("EVOC")) {
          indices.push(index);
          return true;
        }
        return false;
      });
      tableData = tableData.map(row => row.filter((cell, index) => indices.includes(index)));
      filteredData = tableData;
    }
  
    // Renderiza o cabeçalho da tabela
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
  
    // Renderiza o corpo da tabela com os dados paginados
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
  
      const pageNumbersContainer = document.getElementById("page-numbers");
      if (pageNumbersContainer) {
        pageNumbersContainer.innerHTML = "";
        const pagesToDisplay = getPageNumbers(totalPages, currentPage);
        pagesToDisplay.forEach(page => {
          if (page === "...") {
            const span = document.createElement("span");
            span.textContent = "...";
            span.className = "ellipsis";
            pageNumbersContainer.appendChild(span);
          } else {
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
          }
        });
      }
    }
  
    // Função auxiliar para determinar quais números de página exibir
    function getPageNumbers(totalPages, currentPage) {
      const delta = 2;
      const range = [];
      const rangeWithDots = [];
      let l;
      for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - delta && i <= currentPage + delta)) {
          range.push(i);
        }
      }
      for (let i of range) {
        if (l) {
          if (i - l === 2) {
            rangeWithDots.push(l + 1);
          } else if (i - l > 2) {
            rangeWithDots.push("...");
          }
        }
        rangeWithDots.push(i);
        l = i;
      }
      return rangeWithDots;
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
  
    // Inicializa a tabela com os dados do LocalStorage
    function init() {
      showLoading(true);
      setTimeout(() => {
        data = loadFromLocalStorage(planilhaNome);
        if (data.length === 0) {
          showLoading(false);
          return;
        }
        // Separa a primeira linha (cabeçalho) dos dados
        headerData = data[0];
        tableData = data.slice(1);
        filterColumns();
        filteredData = tableData;
        renderTableHeader();
        renderTable(currentPage);
        showLoading(false);
      }, 1000);
    }
  
    init();
  });
  