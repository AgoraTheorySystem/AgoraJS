// formaragora.js
document.addEventListener("DOMContentLoaded", () => {
  const urlParams = new URLSearchParams(window.location.search);
  const planilhaNome = urlParams.get("planilha");
  if (!planilhaNome) {
    alert("Parâmetro 'planilha' ausente na URL.");
    return;
  }

  const selectedWords = Array(5).fill(null);
  const planilhas = [];

  function createPlanilhaElement() {
    const planilhaEl = document.createElement("div");
    planilhaEl.classList.add("planilha");

    const table = document.createElement("table");
    table.classList.add("data-table");
    const thead = document.createElement("thead");
    const tbody = document.createElement("tbody");
    table.append(thead, tbody);
    planilhaEl.appendChild(table);

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

    return { planilhaEl, thead, tbody, prevBtn, pageInfo, nextBtn, pageNumbers, loading };
  }

  function initPlanilha(container, planilhaNome, level) {
    let headerData = [];
    let tableData = [];
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

    function computeFrequencies() {
      const aspecto = document.querySelector('input[name="aspecto"]:checked').value;
      const pattern = aspecto === "Ego"
        ? /^EVOC[1-5]$/i
        : /^EVOC(?:6|7|8|9|10)$/i;

      const indices = headerData
        .map((col, i) => ({ col: col.toUpperCase(), i }))
        .filter(o => pattern.test(o.col))
        .map(o => o.i);

      // 1) filtra linhas que contêm todas as palavras dos níveis anteriores
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

      // prepara lista de palavras a excluir da contagem:
      // - "VAZIO" (case-insensitive)
      // - qualquer palavra já selecionada em níveis anteriores
      const exclude = selectedWords
        .slice(0, level - 1)
        .filter(Boolean)
        .map(w => w.toUpperCase());

      const freq = {};
      rows.forEach(row => {
        indices.forEach(j => {
          const raw = String(row[j] || "").trim();
          if (!raw) return;
          const upper = raw.toUpperCase();
          if (upper === "VAZIO") return;
          if (exclude.includes(upper)) return;
          freq[raw] = (freq[raw] || 0) + 1;
        });
      });

      return Object.entries(freq)
        .sort((a, b) => b[1] - a[1]);
    }

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

    function renderTable(page = 1) {
      const freqArray = computeFrequencies();
      const total = freqArray.length;
      const totalPages = Math.max(1, Math.ceil(total / rowsPerPage));
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
        slice.forEach(([word, count]) => {
          const tr = document.createElement("tr");
          const td1 = document.createElement("td");
          td1.textContent = word;
          const td2 = document.createElement("td");
          td2.textContent = count;
          tr.append(td1, td2);

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

      // paginação
      container.pageInfo.textContent = `Página ${page} de ${totalPages}`;
      container.prevBtn.disabled = page <= 1;
      container.nextBtn.disabled = page >= totalPages;
      container.pageNumbers.innerHTML = "";
      const startPg = Math.max(1, page - 2);
      const endPg = Math.min(totalPages, page + 2);
      for (let p = startPg; p <= endPg; p++) {
        const btn = document.createElement("button");
        btn.textContent = p;
        btn.className = "page-btn";
        if (p === page) btn.classList.add("active");
        btn.addEventListener("click", () => renderTable(p));
        container.pageNumbers.appendChild(btn);
      }
    }

    container.prevBtn.addEventListener("click", () => renderTable());
    container.nextBtn.addEventListener("click", () => renderTable());
    container.renderTable = renderTable;

    container.loading.style.display = "block";
    setTimeout(() => {
      const data = loadData();
      if (data.length < 2) {
        container.loading.style.display = "none";
        return;
      }
      headerData = data[0];
      tableData = data.slice(1);
      renderTableHeader();
      renderTable(1);
      container.loading.style.display = "none";
    }, 300);

    document
      .querySelectorAll('input[name="aspecto"]')
      .forEach(inp => inp.addEventListener("change", () => renderTable(1)));
  }

  // CONTROLES DE NÍVEIS
  const niveisContainer = document.getElementById("niveisContainer");
  const planilhasContainer = document.getElementById("planilhasContainer");
  niveisContainer.innerHTML = "";
  planilhasContainer.innerHTML = "";
  planilhas.length = 0;

  for (let i = 1; i <= 5; i++) {
    const btn = document.createElement("button");
    btn.textContent = i;
    btn.addEventListener("click", () => {
      document
        .querySelectorAll("#niveisContainer button")
        .forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
      planilhasContainer.innerHTML = "";
      planilhas.length = 0;
      selectedWords.fill(null);

      for (let lvl = 1; lvl <= i; lvl++) {
        const elem = createPlanilhaElement();
        planilhasContainer.appendChild(elem.planilhaEl);
        planilhas.push({ container: elem, level: lvl });
        initPlanilha(elem, planilhaNome, lvl);
      }
    });
    niveisContainer.appendChild(btn);
  }
  niveisContainer.querySelector("button").click();

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
