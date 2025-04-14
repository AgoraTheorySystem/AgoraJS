// dashboard.js

document.addEventListener("DOMContentLoaded", () => {
    // 1. Recupera o parâmetro "planilha" da URL
    const urlParams = new URLSearchParams(window.location.search);
    const planilhaNome = urlParams.get("planilha");
  
    if (!planilhaNome) {
      alert("Parâmetro 'planilha' ausente na URL.");
      return;
    }
  
    // 2. Função para carregar os dados do LocalStorage
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
  
    // 3. Obtém os dados da planilha
    const data = loadFromLocalStorage(planilhaNome);
    if (data.length === 0) {
      alert("Nenhum dado encontrado para a planilha: " + planilhaNome);
      return;
    }
  
    // 4. Separa o cabeçalho dos registros
    const header = data[0];
    const registros = data.slice(1);
  
    // 5. Localiza os índices das colunas de interesse
    const indiceSexo = header.findIndex(col => col.trim().toUpperCase() === "SEXO");
    const indiceIdade = header.findIndex(col => col.trim().toUpperCase() === "IDADE");
    const indiceOndeMora = header.findIndex(col => col.trim().toUpperCase() === "ONDE VOCÊ MORA?");
    const indiceCurso = header.findIndex(col => col.trim().toUpperCase() === "CURSO");
    const indiceUniversidade = header.findIndex(col => col.trim().toUpperCase() === "UNIVERSIDADE");
    const indiceRenda = header.findIndex(col => col.trim().toUpperCase().includes("RENDA MENSAL"));
    const indiceLivros = header.findIndex(col => col.trim().toUpperCase().includes("LIVROS POR ANO"));
    const indiceCursoSuperior = header.findIndex(col => col.trim().toUpperCase().includes("CURSO SUPERIOR"));
    const indiceUtilizaComputador = header.findIndex(col => col.trim().toUpperCase().includes("VOCÊ UTILIZA COMPUTADOR"));
    const indiceCursosExtracurriculares = header.findIndex(col => col.trim().toUpperCase().includes("CURSOS EXTRACURRICULARES"));
    
    // Índices para EVOC1..EVOC10 (ignorando valores "VAZIO")
    const evocColumns = [];
    for (let i = 1; i <= 10; i++) {
      const colName = "EVOC" + i;
      const idx = header.findIndex(col => col.trim().toUpperCase() === colName);
      if (idx !== -1) {
        evocColumns.push(idx);
      }
    }
  
    // 6. Função para exibir/ocultar o loading
    function exibirLoading(mostrar) {
      const loadingDiv = document.getElementById("loading");
      if (loadingDiv) {
        loadingDiv.style.display = mostrar ? "block" : "none";
      }
    }
  
    // 7. Função para atualizar os cards (com ícones)
    const updateCard = (id, title, value, iconClass) => {
      const card = document.getElementById(id);
      if (card) {
        card.innerHTML = `
          <div class="card-icon"><i class="${iconClass}"></i></div>
          <h3>${title}</h3>
          <p>${value}</p>
        `;
      }
    };
  
    // 8. Função principal para calcular as métricas e renderizar os cards
    function renderDashboardCards() {
      // a) Dados básicos
      const totalPessoas = registros.length;
      let totalHomens = 0;
      let totalMulheres = 0;
      let somaIdadeHomens = 0, countHomensComIdade = 0;
      let somaIdadeMulheres = 0, countMulheresComIdade = 0;
      const freqRegiao = {};
      const freqEvoc = {};
      const freqCurso = {};
      const freqUniversidade = {};
      let somaRenda = 0, countRenda = 0;
      let somaLivros = 0, countLivros = 0;
      let countCursoSuperior = 0;
      let countUtilizaComputador = 0;
      let countCursosExtracurriculares = 0;
  
      // b) Percorre cada registro para calcular as métricas
      registros.forEach(reg => {
        // Gênero
        if (indiceSexo >= 0) {
          const sexo = reg[indiceSexo]?.toString().trim().toUpperCase();
          if (sexo === "M" || sexo === "MASCULINO") {
            totalHomens++;
          } else if (sexo === "F" || sexo === "FEMININO") {
            totalMulheres++;
          }
        }
  
        // Idade
        if (indiceIdade >= 0) {
          const idade = parseFloat(reg[indiceIdade]);
          if (!isNaN(idade)) {
            const sexo = reg[indiceSexo]?.toString().trim().toUpperCase();
            if (sexo === "M" || sexo === "MASCULINO") {
              somaIdadeHomens += idade;
              countHomensComIdade++;
            } else if (sexo === "F" || sexo === "FEMININO") {
              somaIdadeMulheres += idade;
              countMulheresComIdade++;
            }
          }
        }
  
        // Região
        if (indiceOndeMora >= 0) {
          const local = reg[indiceOndeMora]?.toString().trim();
          if (local) {
            freqRegiao[local] = (freqRegiao[local] || 0) + 1;
          }
        }
  
        // EVOCs (ignorando "VAZIO")
        evocColumns.forEach(idx => {
          const evocValue = reg[idx]?.toString().trim().toUpperCase();
          if (evocValue && evocValue !== "VAZIO") {
            freqEvoc[evocValue] = (freqEvoc[evocValue] || 0) + 1;
          }
        });
  
        // Curso
        if (indiceCurso >= 0) {
          const curso = reg[indiceCurso]?.toString().trim();
          if (curso) {
            freqCurso[curso] = (freqCurso[curso] || 0) + 1;
          }
        }
  
        // Universidade
        if (indiceUniversidade >= 0) {
          const uni = reg[indiceUniversidade]?.toString().trim();
          if (uni) {
            freqUniversidade[uni] = (freqUniversidade[uni] || 0) + 1;
          }
        }
  
        // Renda familiar
        if (indiceRenda >= 0) {
          const rendaStr = reg[indiceRenda]?.toString();
          const renda = parseFloat(rendaStr.replace(/[^\d.,]/g, '').replace(',', '.'));
          if (!isNaN(renda)) {
            somaRenda += renda;
            countRenda++;
          }
        }
  
        // Livros por ano
        if (indiceLivros >= 0) {
          const livros = parseFloat(reg[indiceLivros]);
          if (!isNaN(livros)) {
            somaLivros += livros;
            countLivros++;
          }
        }
  
        // Curso Superior iniciado
        if (indiceCursoSuperior >= 0) {
          const iniciado = reg[indiceCursoSuperior]?.toString().trim().toUpperCase();
          if (iniciado === "SIM") {
            countCursoSuperior++;
          }
        }
  
        // Utiliza Computador
        if (indiceUtilizaComputador >= 0) {
          const utiliza = reg[indiceUtilizaComputador]?.toString().trim().toUpperCase();
          if (utiliza === "SIM") {
            countUtilizaComputador++;
          }
        }
  
        // Cursos Extracurriculares
        if (indiceCursosExtracurriculares >= 0) {
          const extracurriculares = reg[indiceCursosExtracurriculares]?.toString().trim().toUpperCase();
          if (extracurriculares === "SIM") {
            countCursosExtracurriculares++;
          }
        }
      });
  
      // c) Cálculo das médias e valores top
      const mediaIdadeHomens = countHomensComIdade ? (somaIdadeHomens / countHomensComIdade).toFixed(1) : "N/D";
      const mediaIdadeMulheres = countMulheresComIdade ? (somaIdadeMulheres / countMulheresComIdade).toFixed(1) : "N/D";
      const rendaMedia = countRenda ? (somaRenda / countRenda).toFixed(2) : "N/D";
      const livrosMedio = countLivros ? (somaLivros / countLivros).toFixed(1) : "N/D";
  
      const topRegiao = Object.entries(freqRegiao).reduce((a, b) => b[1] > a[1] ? b : a, ["", 0])[0];
      const topEvoc = Object.entries(freqEvoc).reduce((a, b) => b[1] > a[1] ? b : a, ["", 0])[0];
      const topCurso = Object.entries(freqCurso).reduce((a, b) => b[1] > a[1] ? b : a, ["", 0])[0];
      const topUniversidade = Object.entries(freqUniversidade).reduce((a, b) => b[1] > a[1] ? b : a, ["", 0])[0];
  
      // d) Atualiza os cards com os ícones (utilizando classes do Font Awesome)
      updateCard("totalPessoasCard", "Total de Pessoas", totalPessoas, "fa-solid fa-users");
      updateCard("qtdeHomensCard", "Homens", totalHomens, "fa-solid fa-mars");
      updateCard("qtdeMulheresCard", "Mulheres", totalMulheres, "fa-solid fa-venus");
      updateCard("idadeMediaHomensCard", "Média de Idade (Homens)", mediaIdadeHomens, "fa-solid fa-male");
      updateCard("idadeMediaMulheresCard", "Média de Idade (Mulheres)", mediaIdadeMulheres, "fa-solid fa-female");
      updateCard("regiaoTopCard", "Região Mais Comum", topRegiao || "N/D", "fa-solid fa-location-dot");
      updateCard("evocTopCard", "EVOC Mais Frequente", topEvoc || "N/D", "fa-solid fa-bullhorn");
      updateCard("cursoTopCard", "Curso Mais Popular", topCurso || "N/D", "fa-solid fa-book-open");
      updateCard("universidadeTopCard", "Universidade Mais Popular", topUniversidade || "N/D", "fa-solid fa-university");
      updateCard("rendaMediaCard", "Renda Média Familiar", rendaMedia, "fa-solid fa-dollar-sign");
      updateCard("livrosMedioCard", "Média de Livros por Ano", livrosMedio, "fa-solid fa-book");
      updateCard("cursoSuperiorCard", "Iniciaram Curso Superior", countCursoSuperior, "fa-solid fa-graduation-cap");
      updateCard("computadorCard", "Utilizam Computador", countUtilizaComputador, "fa-solid fa-desktop");
      updateCard("extracurricularesCard", "Cursos Extracurriculares", countCursosExtracurriculares, "fa-solid fa-chalkboard-teacher");
    }
  
    // 9. Inicializa o dashboard
    function initDashboard() {
      exibirLoading(true);
      // Simulação de atraso para loading
      setTimeout(() => {
        renderDashboardCards();
        exibirLoading(false);
      }, 1000);
    }
  
    initDashboard();
  });
  