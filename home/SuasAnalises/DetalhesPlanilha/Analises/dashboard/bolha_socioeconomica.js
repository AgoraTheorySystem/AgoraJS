// bolha_socioeconomica.js (com loading visual ao exportar PDF)
export function gerarBolhasSocioeconomica(parametros, headers, rows) {
  const evocPattern = parametros.aspecto === "Ego"
    ? /^EVOC[1-5]$/i
    : /^EVOC[6-9]$|^EVOC10$/i;

  const evocIndices = headers
    .map((h, i) => ({ h, i }))
    .filter(obj => evocPattern.test(obj.h.toUpperCase()))
    .map(obj => obj.i);

  const palavrasFiltro = parametros.palavrasPorNivel.map(p => p.toUpperCase().trim());

  const linhasFiltradas = rows.filter(row => {
    const evocValues = evocIndices.map(i => String(row[i] || "").toUpperCase().trim());
    return palavrasFiltro.every(p => evocValues.includes(p));
  });

  const nonEvocIndexes = headers
    .map((h, idx) => ({ name: h, idx }))
    .filter(h => !/^EVOC/i.test(h.name));

  const popup = document.createElement("div");
  popup.className = "popup-overlay";

  const popupContent = document.createElement("div");
  popupContent.className = "popup-content";

  const closeBtn = document.createElement("button");
  closeBtn.innerHTML = "❌";
  closeBtn.className = "popup-close";
  closeBtn.addEventListener("click", () => popup.remove());

  const loadingOverlay = document.createElement("div");
  loadingOverlay.style.position = "fixed";
  loadingOverlay.style.top = "0";
  loadingOverlay.style.left = "0";
  loadingOverlay.style.right = "0";
  loadingOverlay.style.bottom = "0";
  loadingOverlay.style.background = "rgba(255,255,255,0.85)";
  loadingOverlay.style.zIndex = "9999";
  loadingOverlay.style.display = "flex";
  loadingOverlay.style.justifyContent = "center";
  loadingOverlay.style.alignItems = "center";
  loadingOverlay.style.fontSize = "1.25rem";
  loadingOverlay.style.fontFamily = "'Inter', sans-serif";
  loadingOverlay.innerText = "Gerando PDF... Por favor, aguarde.";
  loadingOverlay.style.display = "none";
  document.body.appendChild(loadingOverlay);

  const downloadBtn = document.createElement("button");
  downloadBtn.textContent = "⬇️ Baixar Tudo como PDF";
  downloadBtn.className = "popup-download";
  downloadBtn.style.marginBottom = "1rem";
  downloadBtn.addEventListener("click", async () => {
    const chartsWrapper = popupContent.querySelector(".charts-wrapper");
    loadingOverlay.style.display = "flex";

    const legendas = chartsWrapper.querySelectorAll('.grafico-legenda');
    legendas.forEach(el => {
      el.dataset.originalMaxHeight = el.style.maxHeight;
      el.dataset.originalOverflow = el.style.overflowY;
      el.style.maxHeight = 'unset';
      el.style.overflowY = 'visible';
    });

    const originalHeight = chartsWrapper.style.height;
    chartsWrapper.style.height = 'auto';
    await new Promise(resolve => setTimeout(resolve, 500));
    const canvas = await window.html2canvas(chartsWrapper, { scale: 2 });
    chartsWrapper.style.height = originalHeight;

    legendas.forEach(el => {
      el.style.maxHeight = el.dataset.originalMaxHeight || '150px';
      el.style.overflowY = el.dataset.originalOverflow || 'auto';
    });

    const imgData = canvas.toDataURL("image/png");
    const pdf = new window.jspdf.jsPDF("p", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    if (imgHeight < pageHeight) {
      pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);
    } else {
      let position = 0;
      while (position < imgHeight) {
        pdf.addImage(imgData, "PNG", 0, position * -1, imgWidth, imgHeight);
        position += pageHeight;
        if (position < imgHeight) pdf.addPage();
      }
    }

    const nomePlanilha = new URLSearchParams(window.location.search).get("planilha") || "Planilha";
    const dataStr = new Date().toISOString().split("T")[0];
    const nomeArquivo = `${nomePlanilha}_Agora_Socioeconomico_${dataStr}.pdf`;
    pdf.save(nomeArquivo);
    loadingOverlay.style.display = "none";
  });

  popupContent.appendChild(closeBtn);
  popupContent.appendChild(downloadBtn);

  const title = document.createElement("h2");
  title.textContent = "Gráficos Socioeconômicos";
  popupContent.appendChild(title);

  const subtitle = document.createElement("p");
  subtitle.textContent = "Distribuição por variáveis não-evocadas entre os respondentes selecionados.";
  popupContent.appendChild(subtitle);

  const chartsWrapper = document.createElement("div");
  chartsWrapper.className = "charts-wrapper";
  popupContent.appendChild(chartsWrapper);
  popup.appendChild(popupContent);
  document.body.appendChild(popup);

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
    const respostasLongas = respostas.some(txt => txt.length > 8);
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
          backgroundColor: 'rgba(50, 150, 250, 0.3)',
          borderColor: 'rgba(50, 150, 250, 0.7)',
          borderWidth: 1.2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { bottom: 40 } },
        plugins: {
          legend: { display: false },
          title: {
            display: true,
            text: name,
            font: { size: 16, weight: '600' },
            padding: { bottom: 10 }
          }
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
          y: { beginAtZero: true }
        }
      }
    });

    if (!allNumericos && respostasLongas) {
      const legenda = document.createElement("div");
      legenda.className = "grafico-legenda";
      legenda.innerHTML = "<strong>Legenda:</strong><br>" + respostas
        .map((txt, i) => `<strong>${i + 1}:</strong> ${txt}`)
        .join("<br>");
      canvasWrapper.appendChild(legenda);
    }
  });
}
