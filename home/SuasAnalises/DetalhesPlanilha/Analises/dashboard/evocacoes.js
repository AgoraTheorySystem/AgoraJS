document.addEventListener("DOMContentLoaded", () => {
  // Recupera o parâmetro "planilha" da URL atual
  const urlParams = new URLSearchParams(window.location.search);
  const planilhaNome = urlParams.get("planilha");

  if (!planilhaNome) {
    alert("Parâmetro 'planilha' ausente na URL.");
    return;
  }

  let data = [];
  let filteredData = [];
  let headerData = [];
  let tableData = [];
  let currentQuery = "";
  let currentPage = 1;
  const rowsPerPage = 15;

  // Seleciona os elementos do DOM referentes à tabela, paginação e filtro
  const table = document.getElementById("data-table");
  const tableHead = table.querySelector("thead");
  const tableBody = table.querySelector("tbody");
  const pageInfo = document.getElementById("page-info");
  const prevBtn = document.getElementById("prev-btn");
  const nextBtn = document.getElementById("next-btn");
  const loadingDiv = document.getElementById("loading");
  const filterInput = document.getElementById("search-input"); // Alterado para o ID correto

  // Função para carregar dados do LocalStorage
  function loadFromLocalStorage(fileName) {
    const key = `planilha_auxiliar_${fileName}`;
    const storedData = localStorage.getItem(key);
    try {
      return storedData ? JSON.parse(storedData) : [];
    } catch (error) {
      console.error("Erro ao ler os dados do LocalStorage:", error);
      return [];
    }
  }

  // Função para escapar caracteres especiais para uso em regex
  const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // Função para destacar o termo pesquisado dentro do texto
  function highlightText(text, query) {
    if (!query) return text;
    const escapedQuery = escapeRegExp(query);
    const regex = new RegExp(`(${escapedQuery})`, "gi");
    return text.replace(regex, '<span style="color: blue; font-weight: bold;">$1</span>');
  }

  // Renderiza o cabeçalho da tabela com base nas chaves do primeiro item dos dados
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

  // Renderiza o corpo da tabela com os dados paginados e destaca o termo pesquisado
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

  // Atualiza os botões e os números da paginação
  function updatePagination() {
    const totalPages = Math.max(1, Math.ceil(filteredData.length / rowsPerPage));
    pageInfo.textContent = `Página ${currentPage} de ${totalPages}`;
    prevBtn.disabled = currentPage <= 1;
    nextBtn.disabled = currentPage >= totalPages;

    // Renderiza os números das páginas
    const pageNumbersContainer = document.getElementById("page-numbers");
    if (pageNumbersContainer) {
      pageNumbersContainer.innerHTML = "";
      const pagesToDisplay = getPageNumbers(totalPages, currentPage);
      pagesToDisplay.forEach(page => {
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

  // Função auxiliar para determinar quais números de página exibir:
  // Exibe somente 2 páginas anteriores e 2 posteriores à página atual.
  function getPageNumbers(totalPages, currentPage) {
    const start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, currentPage + 2);
    const pages = [];
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  }

  // Aplica o filtro de busca na tabela
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

  // Função debounce para otimizar o filtro enquanto o usuário digita
  function debounce(func, delay) {
    let timeoutId;
    return function (...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        func.apply(this, args);
      }, delay);
    };
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

  // Atribui os eventos aos botões e ao campo de filtro
  prevBtn.addEventListener("click", goToPreviousPage);
  nextBtn.addEventListener("click", goToNextPage);
  filterInput.addEventListener("input", debounce((e) => {
    applyFilter(e.target.value.trim().toLowerCase());
  }, 300));

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
      // Inicialmente, o filtro utiliza todos os dados do corpo
      filteredData = tableData;
      renderTableHeader();
      renderTable(currentPage);
      showLoading(false);
    }, 1000);
  }

  init();
});
