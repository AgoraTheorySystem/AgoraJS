// bolha_conectividade.js (ajuste de captura para evitar corte no PDF)
export function gerarBolhasConectividade(parametros, headers, rows, containerElement) {
  const filtroPattern = parametros.aspecto === "Ego"
    ? /^EVOC[1-5]$/i
    : /^EVOC[6-9]$|^EVOC10$/i;

  const correlatoPattern = parametros.aspecto === "Ego"
    ? /^EVOC[6-9]$|^EVOC10$/i
    : /^EVOC[1-5]$/i;

  const filtroIndices = headers
    .map((h, i) => ({ h, i }))
    .filter(obj => filtroPattern.test(obj.h.toUpperCase()))
    .map(obj => obj.i);

  const correlatoIndices = headers
    .map((h, i) => ({ h, i }))
    .filter(obj => correlatoPattern.test(obj.h.toUpperCase()))
    .map(obj => obj.i);

  const palavrasFiltro = parametros.palavrasPorNivel.map(p => p.toUpperCase().trim());

  const linhasFiltradas = rows.filter(row => {
    const evocValues = filtroIndices.map(i => String(row[i] || "").toUpperCase().trim());
    return palavrasFiltro.every(p => evocValues.includes(p));
  });

  const freq = {};
  let totalFreqCentral = 0;

  linhasFiltradas.forEach(row => {
    let linhaTemCentral = false;
    const vistos = new Set();

    filtroIndices.forEach(i => {
      const val = String(row[i] || "").toUpperCase().trim();
      if (!val || val === "VAZIO") return;
      if (palavrasFiltro.includes(val)) linhaTemCentral = true;
    });
    if (linhaTemCentral) totalFreqCentral++;

    correlatoIndices.forEach(i => {
      const val = String(row[i] || "").toUpperCase().trim();
      if (!val || val === "VAZIO") return;
      if (vistos.has(val)) return;
      freq[val] = (freq[val] || 0) + 1;
      vistos.add(val);
    });
  });

  const quantas = parseInt(parametros.valorConectividade) || 20;
  const correlatas = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, quantas);

  const nodes = [];
  const edges = [];

  const corCentral = parametros.aspecto === "Ego" ? "#2ecc71" : "#e74c3c";
  const corConectada = parametros.aspecto === "Ego" ? "#e74c3c" : "#2ecc71";

  const labelCentral = `${palavrasFiltro.join(" + ")} = ${totalFreqCentral}, 100%`;
  nodes.push({
    id: "central",
    label: labelCentral,
    value: totalFreqCentral || 10,
    color: corCentral,
    font: { color: "#000", size: 22, multi: true },
    x: 0,
    y: 0
  });

  const maxFreq = correlatas.length > 0 ? correlatas[0][1] : 1;
  const minRadius = 200;
  const maxRadius = 400;

  correlatas.forEach(([palavra, count], i) => {
    const nodeId = `correlata-${i}`;
    const percentual = totalFreqCentral > 0 ? ((count / totalFreqCentral) * 100).toFixed(1) : "0.0";
    const rank = `${i + 1}º`;

    const radius = maxRadius - ((count / maxFreq) * (maxRadius - minRadius));
    const angle = (2 * Math.PI / correlatas.length) * i;
    const x = radius * Math.cos(angle);
    const y = radius * Math.sin(angle);

    nodes.push({
      id: nodeId,
      label: `${rank} ${palavra}\n(${count}, ${percentual}%)`,
      value: count,
      color: corConectada,
      font: { color: "#000", size: 18, multi: true },
      x: x,
      y: y
    });

    edges.push({
      from: "central",
      to: nodeId,
      width: 1.5,
      color: "#cccccc"
    });
  });

  const popup = document.createElement("div");
  popup.className = "popup-overlay";

  const popupContent = document.createElement("div");
  popupContent.className = "popup-content";
  popupContent.style.maxWidth = "90vw";
  popupContent.style.margin = "5vh auto";

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "Fechar";
  closeBtn.className = "popup-close";
  closeBtn.addEventListener("click", () => popup.remove());

  const downloadBtn = document.createElement("button");
  downloadBtn.textContent = "⬇️ Baixar Tudo como PDF";
  downloadBtn.className = "popup-download";
  downloadBtn.style.marginLeft = "1rem";
  downloadBtn.addEventListener("click", async () => {
    const originalHeight = networkDiv.style.height;
    networkDiv.style.height = 'auto';
    await new Promise(resolve => setTimeout(resolve, 500));
    const canvas = await window.html2canvas(networkDiv, { scale: 2 });
    networkDiv.style.height = originalHeight;

    const imgData = canvas.toDataURL("image/png");
    const pdf = new window.jspdf.jsPDF({ orientation: "landscape" });
    const width = pdf.internal.pageSize.getWidth();
    const height = (canvas.height * width) / canvas.width;

    pdf.addImage(imgData, "PNG", 0, 10, width, height);

    const nomePlanilha = new URLSearchParams(window.location.search).get("planilha") || "Planilha";
    const dataStr = new Date().toISOString().split("T")[0];
    const nomeArquivo = `${nomePlanilha}_Agora_Conectividade_${dataStr}.pdf`;
    pdf.save(nomeArquivo);
  });

  const legenda = document.createElement("div");
  legenda.style.position = "absolute";
  legenda.style.top = "5rem";
  legenda.style.right = "2rem";
  legenda.style.background = "#fff";
  legenda.style.border = "1px solid #ccc";
  legenda.style.borderRadius = "6px";
  legenda.style.padding = "0.5rem 1rem";
  legenda.style.fontSize = "0.9rem";
  legenda.style.color = "Black";
  legenda.innerHTML = `
    <div style="margin-bottom: 0.2rem;"><span style="display:inline-block;width:12px;height:12px;background:${corCentral};margin-right:5px;border-radius:50%;"></span> ${parametros.aspecto}</div>
    <div><span style="display:inline-block;width:12px;height:12px;background:${corConectada};margin-right:5px;border-radius:50%;"></span> ${parametros.aspecto === "Ego" ? "Alter" : "Ego"}</div>
  `;

  const buttonsContainer = document.createElement("div");
  buttonsContainer.style.marginBottom = "1rem";
  buttonsContainer.appendChild(closeBtn);
  buttonsContainer.appendChild(downloadBtn);
  popupContent.appendChild(buttonsContainer);
  popupContent.appendChild(legenda);

  const networkDiv = document.createElement("div");
  networkDiv.id = "grafoConectividade";
  networkDiv.style.height = "700px";
  networkDiv.style.background = "#fafafa";

  popupContent.appendChild(networkDiv);
  popup.appendChild(popupContent);
  document.body.appendChild(popup);

  const network = new vis.Network(networkDiv, {
    nodes: new vis.DataSet(nodes),
    edges: new vis.DataSet(edges)
  }, {
    nodes: {
      shape: "dot",
      font: {
        size: 20,
        face: "arial",
        color: "#000",
        multi: true
      },
      scaling: {
        min: 5,
        max: 50
      }
    },
    layout: {
      randomSeed: 42,
      improvedLayout: true
    },
    physics: {
      enabled: true,
      stabilization: false
    },
    interaction: {
      dragNodes: true
    },
    edges: {
      smooth: true
    }
  });

  network.fit({ animation: true });
}