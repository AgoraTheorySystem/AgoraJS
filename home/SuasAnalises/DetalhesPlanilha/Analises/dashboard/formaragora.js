document.addEventListener("DOMContentLoaded", () => {
  // Recupera o parâmetro "planilha" da URL
  const urlParams = new URLSearchParams(window.location.search);
  const planilhaNome = urlParams.get("planilha");

  if (!planilhaNome) {
    alert("Parâmetro 'planilha' ausente na URL.");
    return;
  }

  // Função que cria a estrutura de uma planilha dentro de um container
  function createPlanilhaElement() {
    const planilhaEl = document.createElement("div");
    planilhaEl.classList.add("planilha");

    // Cria a tabela com thead e tbody
    const table = document.createElement("table");
    table.classList.add("data-table");
    const thead = document.createElement("thead");
    const tbody = document.createElement("tbody");
    table.appendChild(thead);
    table.appendChild(tbody);
    planilhaEl.appendChild(table);

    // Cria a área de paginação
    const paginationDiv = document.createElement("div");
    paginationDiv.classList.add("pagination");

    const prevBtn = document.createElement("button");
    prevBtn.classList.add("prev-btn");
    prevBtn.textContent = "Anterior";
    paginationDiv.appendChild(prevBtn);

    const pageInfo = document.createElement("span");
    pageInfo.classList.add("page-info");
    paginationDiv.appendChild(pageInfo);

    const nextBtn = document.createElement("button");
    nextBtn.classList.add("next-btn");
    nextBtn.textContent = "Próximo";
    paginationDiv.appendChild(nextBtn);

    const pageNumbersDiv = document.createElement("div");
    pageNumbersDiv.classList.add("page-numbers");
    paginationDiv.appendChild(pageNumbersDiv);

    planilhaEl.appendChild(paginationDiv);

    // Cria a área de loading
    const loadingDiv = document.createElement("div");
    loadingDiv.classList.add("loading");
    loadingDiv.setAttribute("aria-live", "polite");
    loadingDiv.setAttribute("aria-busy", "true");
    loadingDiv.style.display = "none";
    loadingDiv.innerHTML = `<figure class="loader">
      <div class="dot white"></div>
      <div class="dot"></div>
      <div class="dot"></div>
      <div class="dot"></div>
      <div class="dot"></div>
    </figure>`;
    planilhaEl.appendChild(loadingDiv);

    return {
      planilhaEl,
      table,
      thead,
      tbody,
      paginationDiv,
      prevBtn,
      nextBtn,
      pageInfo,
      pageNumbersDiv,
      loadingDiv
    };
  }

  // Função que inicializa uma planilha em um container criado
  function initPlanilha(containerElements, planilhaNome) {
    let data = [];
    let filteredData = [];
    let headerData = [];
    let tableData = [];
    let currentQuery = "";
    let currentPage = 1;
    const rowsPerPage = 15;

    // Carrega os dados do LocalStorage
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

    // Função para escapar caracteres especiais para regex
    const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    // Função para destacar o termo pesquisado
    function highlightText(text, query) {
      if (!query) return text;
      const escapedQuery = escapeRegExp(query);
      const regex = new RegExp(`(${escapedQuery})`, "gi");
      return text.replace(regex, '<span style="color: blue; font-weight: bold;">$1</span>');
    }

    // Renderiza o cabeçalho da tabela (apenas primeira e última coluna)
    function renderTableHeader() {
      containerElements.thead.innerHTML = "";
      if (headerData && headerData.length > 0) {
        const headerRow = document.createElement("tr");
        const thFirst = document.createElement("th");
        thFirst.textContent = headerData[0];
        headerRow.appendChild(thFirst);
        if (headerData.length > 1) {
          const thLast = document.createElement("th");
          thLast.textContent = headerData[headerData.length - 1];
          headerRow.appendChild(thLast);
        }
        containerElements.thead.appendChild(headerRow);
      }
    }

    // Renderiza o corpo da tabela com paginação e destaque na pesquisa
    function renderTable(page) {
      containerElements.tbody.innerHTML = "";
      const start = (page - 1) * rowsPerPage;
      const end = start + rowsPerPage;
      const paginatedData = filteredData.slice(start, end);

      if (paginatedData.length === 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.colSpan = 2;
        cell.textContent = "Nenhum registro encontrado.";
        cell.style.textAlign = "center";
        row.appendChild(cell);
        containerElements.tbody.appendChild(row);
      } else {
        paginatedData.forEach((rowData) => {
          const row = document.createElement("tr");
          const cellFirst = document.createElement("td");
          cellFirst.innerHTML = highlightText(String(rowData[0]), currentQuery);
          row.appendChild(cellFirst);
          if (rowData.length > 1) {
            const cellLast = document.createElement("td");
            cellLast.innerHTML = highlightText(String(rowData[rowData.length - 1]), currentQuery);
            row.appendChild(cellLast);
          }
          containerElements.tbody.appendChild(row);
        });
      }
      updatePagination();
    }

    // Atualiza a paginação
    function updatePagination() {
      const totalPages = Math.max(1, Math.ceil(filteredData.length / rowsPerPage));
      containerElements.pageInfo.textContent = `Página ${currentPage} de ${totalPages}`;
      containerElements.prevBtn.disabled = currentPage <= 1;
      containerElements.nextBtn.disabled = currentPage >= totalPages;

      containerElements.pageNumbersDiv.innerHTML = "";
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
        containerElements.pageNumbersDiv.appendChild(btn);
      });
    }

    function getPageNumbers(totalPages, currentPage) {
      const start = Math.max(1, currentPage - 2);
      const end = Math.min(totalPages, currentPage + 2);
      const pages = [];
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      return pages;
    }

    function showLoading(show) {
      containerElements.loadingDiv.style.display = show ? "block" : "none";
    }

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

    // Eventos de paginação e filtro
    containerElements.prevBtn.addEventListener("click", goToPreviousPage);
    containerElements.nextBtn.addEventListener("click", goToNextPage);

    function init() {
      showLoading(true);
      setTimeout(() => {
        data = loadFromLocalStorage(planilhaNome);
        if (data.length === 0) {
          showLoading(false);
          return;
        }
        // A primeira linha é o cabeçalho
        headerData = data[0];
        tableData = data.slice(1);
        filteredData = tableData;
        renderTableHeader();
        renderTable(currentPage);
        showLoading(false);
      }, 1000);
    }

    init();
  }

  // --- CONTROLE DA ÁGORA: Seleção de níveis e exibição de planilhas ---

  // Elementos do DOM para os controles da Ágora
  const niveisContainer = document.getElementById('niveisContainer');
  const extraOpcao = document.getElementById('extraOpcao');
  // Container onde as planilhas serão exibidas
  const planilhasContainer = document.getElementById('planilhasContainer');

  // Limpa os containers, se necessário
  niveisContainer.innerHTML = "";
  planilhasContainer.innerHTML = "";

  // Cria os botões de níveis (1 a 5)
  for (let i = 1; i <= 5; i++) {
    const btn = document.createElement('button');
    btn.textContent = i;
    btn.onclick = () => {
      selecionarNivel(i, btn);
      renderPlanilhas(i);
    };
    niveisContainer.appendChild(btn);
  }

  // Ao selecionar um nível, destaca o botão correspondente
  function selecionarNivel(nivel, button) {
    document.querySelectorAll('#niveisContainer button').forEach(btn => {
      btn.classList.remove('selected');
    });
    button.classList.add('selected');
    console.log('Nível selecionado:', nivel);
  }

  // Cria e inicializa as planilhas de acordo com o nível selecionado
  function renderPlanilhas(level) {
    planilhasContainer.innerHTML = ""; // limpa planilhas anteriores
    for (let i = 0; i < level; i++) {
      const planilhaElem = createPlanilhaElement();
      planilhasContainer.appendChild(planilhaElem.planilhaEl);
      initPlanilha(planilhaElem, planilhaNome);
    }
  }

  // Exibe, por padrão, 1 planilha (caso nenhum nível seja alterado)
  renderPlanilhas(1);

  // --- CONTROLE DOS DEMAIS ELEMENTOS DA ÁGORA ---

  // Controle da exibição da opção extra conforme a análise escolhida
  document.querySelectorAll('input[name="analise"]').forEach(input => {
    input.addEventListener('change', () => {
      if (input.value === 'Conectividade' && input.checked) {
        extraOpcao.style.display = 'flex';
      } else if (input.value === 'Socioeconômica' && input.checked) {
        extraOpcao.style.display = 'none';
      }
    });
  });

  // Função para executar a análise (usada pelo botão "FORMAÇÃO DAS ÁGORAS 💡")
  window.rodarAnalise = function() {
    const nivelSelecionado = document.querySelector('#niveisContainer button.selected')?.textContent || 'Nenhum';
    const analise = document.querySelector('input[name="analise"]:checked').value;
    const aspecto = document.querySelector('input[name="aspecto"]:checked').value;
    const valorConectividade = document.getElementById('valorConectividade').value;

    let msg = `Análise: ${analise}\nAspecto: ${aspecto}\nNível da Ágora: ${nivelSelecionado}`;
    if (analise === 'Conectividade') {
      msg += `\nValor de Conectividade: ${valorConectividade || 'não informado'}`;
    }
    alert(msg);
  };
});
