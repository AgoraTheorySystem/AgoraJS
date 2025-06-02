window.gerarBolhas = async function(parametros) {
    const existing = document.getElementById("bolhasContainer");
    if (existing) existing.remove();
  
    const planilhasContainer = document.getElementById("planilhasContainer");
    const bolhasContainer = document.createElement("div");
    bolhasContainer.id = "bolhasContainer";
    bolhasContainer.style.marginTop = "2rem";
    planilhasContainer.insertAdjacentElement("afterend", bolhasContainer);
  
    const resumo = document.createElement("div");
    resumo.classList.add("bolhas-resumo");
    resumo.style.marginBottom = "1rem";
    resumo.innerHTML = `
      <strong>Nível selecionado:</strong> ${parametros.nivelSelecionado}<br>
      <strong>Análise:</strong> ${parametros.analise}<br>
      <strong>Aspecto:</strong> ${parametros.aspecto}
      ${parametros.valorConectividade ? `<br><strong>Qtd. palavras/Nível:</strong> ${parametros.valorConectividade}` : ""}
    `;
    bolhasContainer.appendChild(resumo);
  
    if (parametros.analise === "Socioeconômica") {
      const popup = document.createElement("div");
      popup.className = "popup-overlay";
  
      const popupContent = document.createElement("div");
      popupContent.className = "popup-content";
  
      const closeBtn = document.createElement("button");
      closeBtn.textContent = "Fechar";
      closeBtn.className = "popup-close";
      closeBtn.addEventListener("click", () => popup.remove());
  
      popupContent.appendChild(closeBtn);
  
      const chartsWrapper = document.createElement("div");
      chartsWrapper.className = "charts-wrapper";
      popupContent.appendChild(chartsWrapper);
      popup.appendChild(popupContent);
      document.body.appendChild(popup);
  
      const urlParams = new URLSearchParams(window.location.search);
      const planilhaNome = urlParams.get("planilha");
      const raw = localStorage.getItem(`planilha_${planilhaNome}`);
      if (!raw) {
        chartsWrapper.innerHTML = "<p>Planilha não encontrada.</p>";
        return;
      }
  
      const data = JSON.parse(raw);
      const headers = data[0];
      const rows = data.slice(1);
  
      // Mapeia colunas EVOC conforme aspecto
      const evocPattern = parametros.aspecto === "Ego"
        ? /^EVOC[1-5]$/i
        : /^EVOC[6-9]$|^EVOC10$/i;
  
      const evocIndices = headers
        .map((h, i) => ({ h, i }))
        .filter(obj => evocPattern.test(obj.h.toUpperCase()))
        .map(obj => obj.i);
  
      const palavrasFiltro = parametros.palavrasPorNivel.map(p => p.toUpperCase().trim());
  
      // Filtra linhas com pelo menos uma palavra nas colunas EVOC
      const linhasFiltradas = rows.filter(row => {
        const evocValues = evocIndices.map(i => String(row[i] || "").toUpperCase().trim());
        return palavrasFiltro.every(p => evocValues.includes(p));
      });
      
  
      const nonEvocIndexes = headers
        .map((h, idx) => ({ name: h, idx }))
        .filter(h => !/^EVOC/i.test(h.name));
  
      nonEvocIndexes.forEach(({ name, idx }) => {
        const freq = {};
        linhasFiltradas.forEach(row => {
          const val = row[idx];
          if (val === undefined || val === null) return;
  
          const strVal = String(val).trim();
          if (strVal.toUpperCase() === "VAZIO" || strVal === "") return;
  
          freq[strVal] = (freq[strVal] || 0) + 1;
        });
  
        let entradas = Object.entries(freq).sort((a, b) => b[1] - a[1]);
        if (entradas.length === 0) return;
  
        const top25 = entradas.slice(0, 25);
        const restantes = entradas.slice(25);
  
        const temOutros = restantes.length > 0;
        if (temOutros) {
          const outrosTotal = restantes.reduce((acc, [_, val]) => acc + val, 0);
          top25.push(["OUTROS", outrosTotal]);
        }
  
        const respostas = top25.map(([resp]) => resp);
        const valores = top25.map(([_, val]) => val);
  
        const allNumericos = respostas.every(r => !isNaN(r) && r !== "OUTROS");
        const labels = allNumericos ? respostas : respostas.map((_, i) => String(i + 1));
  
        const canvasWrapper = document.createElement("div");
        canvasWrapper.className = "grafico-container";
        chartsWrapper.appendChild(canvasWrapper);
  
        const canvas = document.createElement("canvas");
        canvas.className = "grafico-canvas";
        canvasWrapper.appendChild(canvas);
  
        new Chart(canvas, {
          type: 'bar',
          data: {
            labels,
            datasets: [{
              label: name,
              data: valores,
              backgroundColor: 'rgba(54, 162, 235, 0.6)'
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
              padding: {
                bottom: 40
              }
            },
            plugins: {
              legend: { display: false },
              title: { display: true, text: name }
            },
            scales: {
              x: {
                ticks: {
                  autoSkip: false,
                  maxRotation: allNumericos ? 45 : 0,
                  minRotation: allNumericos ? 45 : 0,
                  align: allNumericos ? "start" : "center"
                }
              },
              y: {
                beginAtZero: true
              }
            }
          }
        });
  
        if (!allNumericos) {
          const legenda = document.createElement("div");
          legenda.className = "grafico-legenda";
          legenda.innerHTML = "<strong>Legenda:</strong><br>" + respostas
            .map((txt, i) => `<strong>${i + 1}:</strong> ${txt}`)
            .join("<br>");
          canvasWrapper.appendChild(legenda);
        }
  
        if (temOutros) {
          const outrosTabela = document.createElement("div");
          outrosTabela.className = "tabela-outros";
          const outrosHtml = `
            <h4>Detalhamento de OUTROS</h4>
            <table>
              <thead><tr><th>Resposta</th><th>Frequência</th></tr></thead>
              <tbody>
                ${restantes.map(([resp, val]) => `<tr><td>${resp}</td><td>${val}</td></tr>`).join("")}
              </tbody>
            </table>
          `;
          outrosTabela.innerHTML = outrosHtml;
          canvasWrapper.appendChild(outrosTabela);
        }
      });
  
      return;
    }
  
    // --- CASO PADRÃO: BOLHAS ---
    const listaBolhas = document.createElement("div");
    listaBolhas.classList.add("bolhas-lista");
    listaBolhas.style.display = "flex";
    listaBolhas.style.flexWrap = "wrap";
    listaBolhas.style.gap = "0.75rem";
    bolhasContainer.appendChild(listaBolhas);
  
    parametros.palavrasPorNivel.forEach((palavra, idx) => {
      const bola = document.createElement("span");
      bola.classList.add("bola");
      bola.textContent = palavra;
      const tamanhoBase = 50;
      const incremento = idx * 5;
      bola.style.width = `${tamanhoBase + incremento}px`;
      bola.style.height = `${tamanhoBase + incremento}px`;
      listaBolhas.appendChild(bola);
    });
  };
  