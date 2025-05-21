// formaragora.js
document.addEventListener("DOMContentLoaded", () => {
  const urlParams = new URLSearchParams(window.location.search);
  const planilhaNome = urlParams.get("planilha");
  if (!planilhaNome) {
    alert("Parâmetro 'planilha' ausente na URL.");
    return;
  }

  // Cria estrutura da planilha (tabela + paginação + loading)
  function createPlanilhaElement() {
    const planilhaEl = document.createElement("div");
    planilhaEl.classList.add("planilha");

    const table = document.createElement("table");
    table.classList.add("data-table");
    const thead = document.createElement("thead");
    const tbody = document.createElement("tbody");
    table.appendChild(thead);
    table.appendChild(tbody);
    planilhaEl.appendChild(table);

    const paginationDiv = document.createElement("div");
    paginationDiv.classList.add("pagination");
    const prevBtn = document.createElement("button");
    prevBtn.classList.add("prev-btn");
    prevBtn.textContent = "Anterior";
    const pageInfo = document.createElement("span");
    pageInfo.classList.add("page-info");
    const nextBtn = document.createElement("button");
    nextBtn.classList.add("next-btn");
    nextBtn.textContent = "Próximo";
    const pageNumbersDiv = document.createElement("div");
    pageNumbersDiv.classList.add("page-numbers");

    paginationDiv.append(prevBtn, pageInfo, nextBtn, pageNumbersDiv);
    planilhaEl.appendChild(paginationDiv);

    const loadingDiv = document.createElement("div");
    loadingDiv.classList.add("loading");
    loadingDiv.setAttribute("aria-live", "polite");
    loadingDiv.setAttribute("aria-busy", "true");
    loadingDiv.style.display = "none";
    loadingDiv.innerHTML = `
      <figure class="loader">
        <div class="dot white"></div>
        <div class="dot"></div>
        <div class="dot"></div>
        <div class="dot"></div>
        <div class="dot"></div>
      </figure>`;
    planilhaEl.appendChild(loadingDiv);

    return { planilhaEl, thead, tbody, prevBtn, pageInfo, nextBtn, pageNumbersDiv, loadingDiv };
  }

  // Inicializa planilha: carrega dados, configura paginação e renderiza
  function initPlanilha(container, planilhaNome) {
    let headerData = [];
    let tableData = [];
    let currentPage = 1;
    const rowsPerPage = 15;

    function loadData() {
      const key = `planilha_${planilhaNome}`;
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : [];
      } catch {
        return [];
      }
    }

    // Calcula frequências no intervalo selecionado
    function computeFrequencies() {
      // lê aspecto (Ego ou Alter) do menu :contentReference[oaicite:1]{index=1}
      const aspecto = document.querySelector('input[name="aspecto"]:checked').value;
      const pattern = aspecto === "Ego"
        ? /^EVOC[1-5]$/i
        : /^EVOC(?:6|7|8|9|10)$/i;

      // encontra índices das colunas EVOCx desejadas
      const indices = headerData
        .map((col, i) => ({ col: col.toUpperCase(), i }))
        .filter(({ col }) => pattern.test(col))
        .map(({ i }) => i);

      // monta contagem
      const freqMap = {};
      tableData.forEach(row => {
        indices.forEach(j => {
          const palavra = String(row[j] || "").trim();
          if (!palavra) return;
          freqMap[palavra] = (freqMap[palavra] || 0) + 1;
        });
      });
      // ordena do maior para o menor
      return Object.entries(freqMap)
        .sort((a, b) => b[1] - a[1]);
    }

    // Renderiza cabeçalho fixo: Palavra / Frequência
    function renderTableHeader() {
      container.thead.innerHTML = "";
      const tr = document.createElement("tr");
      ["Palavra", "Frequência"].forEach(text => {
        const th = document.createElement("th");
        th.textContent = text;
        tr.appendChild(th);
      });
      container.thead.appendChild(tr);
    }

    // Renderiza corpo da tabela com paginação
    function renderTable(page) {
      const freqArray = computeFrequencies();
      const totalItems = freqArray.length;
      const totalPages = Math.max(1, Math.ceil(totalItems / rowsPerPage));
      if (page > totalPages) page = totalPages;
      container.tbody.innerHTML = "";

      const start = (page - 1) * rowsPerPage;
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
        slice.forEach(([palavra, count]) => {
          const tr = document.createElement("tr");
          const td1 = document.createElement("td");
          td1.textContent = palavra;
          const td2 = document.createElement("td");
          td2.textContent = count;
          tr.append(td1, td2);
          container.tbody.appendChild(tr);
        });
      }
      updatePagination(totalItems, page);
    }

    // Atualiza botões e números de página
    function updatePagination(totalItems, page) {
      const totalPages = Math.max(1, Math.ceil(totalItems / rowsPerPage));
      container.pageInfo.textContent = `Página ${page} de ${totalPages}`;
      container.prevBtn.disabled = page <= 1;
      container.nextBtn.disabled = page >= totalPages;

      container.pageNumbersDiv.innerHTML = "";
      const start = Math.max(1, page - 2);
      const end = Math.min(totalPages, page + 2);
      for (let p = start; p <= end; p++) {
        const btn = document.createElement("button");
        btn.textContent = p;
        btn.className = "page-btn";
        if (p === page) btn.classList.add("active");
        btn.addEventListener("click", () => {
          currentPage = p;
          renderTable(p);
        });
        container.pageNumbersDiv.appendChild(btn);
      }
    }

    // Eventos de paginação
    container.prevBtn.addEventListener("click", () => {
      if (currentPage > 1) {
        currentPage--;
        renderTable(currentPage);
      }
    });
    container.nextBtn.addEventListener("click", () => {
      const totalItems = computeFrequencies().length;
      const totalPages = Math.ceil(totalItems / rowsPerPage);
      if (currentPage < totalPages) {
        currentPage++;
        renderTable(currentPage);
      }
    });

    // Carrega dados e inicia rendering
    function init() {
      container.loadingDiv.style.display = "block";
      setTimeout(() => {
        const data = loadData();
        if (data.length < 2) {
          container.loadingDiv.style.display = "none";
          return;
        }
        headerData = data[0];
        tableData = data.slice(1);
        renderTableHeader();
        renderTable(currentPage);
        container.loadingDiv.style.display = "none";
      }, 500);
    }

    // Re-renderiza sempre que o aspecto mudar
    document.querySelectorAll('input[name="aspecto"]').forEach(input => {
      input.addEventListener("change", () => {
        currentPage = 1;
        renderTable(1);
      });
    });

    init();
  }

  // Controles de níveis (igual ao original)
  const niveisContainer = document.getElementById("niveisContainer");
  const planilhasContainer = document.getElementById("planilhasContainer");
  niveisContainer.innerHTML = "";
  planilhasContainer.innerHTML = "";
  for (let i = 1; i <= 5; i++) {
    const btn = document.createElement("button");
    btn.textContent = i;
    btn.addEventListener("click", () => {
      document.querySelectorAll("#niveisContainer button")
        .forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
      planilhasContainer.innerHTML = "";
      for (let k = 0; k < i; k++) {
        const elem = createPlanilhaElement();
        planilhasContainer.appendChild(elem.planilhaEl);
        initPlanilha(elem, planilhaNome);
      }
    });
    niveisContainer.appendChild(btn);
  }
  // exibe 1 planilha por padrão
  niveisContainer.querySelector("button").click();

  // Botão FORMAR ÁGORAS (mantém comportamento original)
  window.rodarAnalise = () => {
    const nivel = document.querySelector("#niveisContainer .selected")?.textContent;
    const analise = document.querySelector('input[name="analise"]:checked').value;
    const aspecto = document.querySelector('input[name="aspecto"]:checked').value;
    const valor = document.getElementById("valorConectividade").value;
    let msg = `Análise: ${analise}\nAspecto: ${aspecto}\nNível: ${nivel}`;
    if (analise === "Conectividade") {
      msg += `\nQtd. palavras: ${valor || "não informado"}`;
    }
    alert(msg);
  };
});
