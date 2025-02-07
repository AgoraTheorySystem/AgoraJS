document.addEventListener("DOMContentLoaded", () => {
  // Recupera o parâmetro "planilha" da URL
  const urlParams = new URLSearchParams(window.location.search);
  const planilhaNome = urlParams.get("planilha");

  if (!planilhaNome) {
    alert("Parâmetro 'planilha' ausente na URL.");
    return;
  }

  let currentPage = 1;
  const rowsPerPage = 20;
  let data = [];
  let filteredData = [];
  let currentQuery = "";

  // Seleção dos elementos
  const menuAnalisesBtn = document.querySelector(".menu_analises");
  const table = document.getElementById("data-table");
  const tableHead = table.querySelector("thead");
  const tableBody = table.querySelector("tbody");
  const pageInfo = document.getElementById("page-info");
  const prevBtn = document.getElementById("prev-btn");
  const nextBtn = document.getElementById("next-btn");
  const loadingDiv = document.getElementById("loading");
  const filterInput = document.getElementById("filter-input");

  // Função para carregar dados do LocalStorage
  function loadFromLocalStorage(fileName) {
    const key = `planilha_${fileName}`;
    const storedData = localStorage.getItem(key);
    return storedData ? JSON.parse(storedData) : [];
  }

  // Função para escapar caracteres especiais para uso em regex
  function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  // Função para destacar o termo pesquisado dentro do texto
  function highlightText(text, query) {
    if (!query) return text;
    const escapedQuery = escapeRegExp(query);
    const regex = new RegExp(`(${escapedQuery})`, "gi");
    return text.replace(regex, '<span style="color: blue; font-weight: bold;">$1</span>');
  }

  // Renderiza o cabeçalho da tabela
  function renderTableHeader() {
    tableHead.innerHTML = "";
    if (filteredData.length > 0) {
      const headerRow = document.createElement("tr");
      Object.keys(filteredData[0]).forEach((key) => {
        const th = document.createElement("th");
        th.textContent = key;
        headerRow.appendChild(th);
      });
      tableHead.appendChild(headerRow);
    }
  }

  // Renderiza o corpo da tabela com paginação e destaca o termo pesquisado
  function renderTable(page) {
    tableBody.innerHTML = "";
    const start = (page - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    const paginatedData = filteredData.slice(start, end);

    if (paginatedData.length === 0) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = filteredData.length > 0 ? Object.keys(filteredData[0]).length : 1;
      cell.textContent = "Nenhum registro encontrado.";
      cell.style.textAlign = "center";
      row.appendChild(cell);
      tableBody.appendChild(row);
    } else {
      paginatedData.forEach((item) => {
        const row = document.createElement("tr");
        Object.values(item).forEach((value) => {
          const cell = document.createElement("td");
          cell.innerHTML = highlightText(String(value), currentQuery);
          row.appendChild(cell);
        });
        tableBody.appendChild(row);
      });
    }

    updatePagination();
  }

  // Atualiza os botões de paginação
  function updatePagination() {
    const totalPages = Math.max(1, Math.ceil(filteredData.length / rowsPerPage));
    pageInfo.textContent = `Página ${currentPage} de ${totalPages}`;

    prevBtn.disabled = currentPage <= 1;
    nextBtn.disabled = currentPage >= totalPages;
  }

  // Função para aplicar o filtro na tabela
  function applyFilter(query) {
    currentQuery = query;
    if (query === "") {
      filteredData = data;
    } else {
      filteredData = data.filter((item) => 
        Object.values(item).some((value) => value.toString().toLowerCase().includes(query))
      );
    }
    currentPage = 1;
    renderTableHeader();
    renderTable(currentPage);
  }

  // Exibe ou oculta o loading
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
    if (currentPage < Math.ceil(filteredData.length / rowsPerPage)) {
      currentPage++;
      renderTable(currentPage);
    }
  }

  // Eventos dos botões e do campo de filtro
  prevBtn.addEventListener("click", goToPreviousPage);
  nextBtn.addEventListener("click", goToNextPage);
  filterInput.addEventListener("input", (e) => applyFilter(e.target.value.trim().toLowerCase()));

  // Verifica se o botão de análise existe antes de adicionar o evento
  if (menuAnalisesBtn) {
    menuAnalisesBtn.addEventListener("click", () => {
      window.location.href = `/home/SuasAnalises/DetalhesPlanilha/menu_da_analise.html?planilha=${encodeURIComponent(planilhaNome)}`;
    });
  }

  // Inicialização da tabela
  function init() {
    showLoading(true);
    setTimeout(() => {
      data = loadFromLocalStorage(planilhaNome) || [];
      filteredData = data;
      renderTableHeader();
      renderTable(currentPage);
      showLoading(false);
    }, 1000);
  }

  init();
});
