import { initializeApp } from "https://www.gstatic.com/firebasejs/9.1.3/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/9.1.3/firebase-database.js";
import firebaseConfig from "../../firebase.js";

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// Referência para os usuários no Realtime Database
const dbRef = ref(database, "users");

// === Funções auxiliares ===
function getCardColor(tipo) {
  const tempDiv = document.createElement("div");
  tempDiv.className = `card-${tipo.toLowerCase().replace(/[\s/]/g, "-")}`;
  document.body.appendChild(tempDiv);
  const computedColor = window.getComputedStyle(tempDiv).backgroundColor;
  document.body.removeChild(tempDiv);
  return computedColor || "#606060";
}

function wrapLabel(text, maxLength) {
  const words = text.split(" ");
  let line = "";
  let lines = [];
  words.forEach(word => {
    if ((line + word).length <= maxLength) {
      line += (line.length ? " " : "") + word;
    } else {
      lines.push(line);
      line = word;
    }
  });
  lines.push(line);
  return lines.join("\n");
}

function getLegendPosition() {
  return window.innerWidth <= 900 ? "bottom" : "right";
}

// === Lógica principal ===
window.addEventListener("load", () => {
  onValue(dbRef, (snapshot) => {
    if (snapshot.exists()) {
      const users = snapshot.val();

      // =================================
      // GRÁFICO 1: Distribuição por Tipo
      // =================================
      const tipoContas = {};
      let totalUsuarios = 0;

      Object.values(users).forEach(user => {
        const tipo = user.tipo || "Desconhecido";
        tipoContas[tipo] = (tipoContas[tipo] || 0) + 1;
        totalUsuarios++;
      });

      const labelsTipos = Object.keys(tipoContas);
      const dataTipos = Object.values(tipoContas);
      const wrappedLabels = labelsTipos.map(label => wrapLabel(label, 12));

      const ctxTipos = document.getElementById("graficoTiposContas").getContext("2d");
      const chartTipos = new Chart(ctxTipos, {
        type: "bar",
        data: {
          // Usamos um array vazio para que todos os tipos sejam empilhados em uma única barra
          labels: [""],
          datasets: labelsTipos.map((label, index) => ({
            label: wrappedLabels[index],
            data: [dataTipos[index]],
            backgroundColor: getCardColor(label),
            borderColor: "#000",
            borderWidth: 2
          }))
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: getLegendPosition(),
              labels: {
                color: "#000",
                font: { weight: "bold", size: 14 },
                padding: 10,
                boxWidth: 15,
                usePointStyle: true
              }
            },
            datalabels: {
              color: "white",
              font: { weight: "bold", size: 14 },
              anchor: "center",
              align: "center",
              formatter: (value) => {
                return ((value / totalUsuarios) * 100).toFixed(1) + "%";
              }
            }
          },
          scales: {
            x: {
              stacked: true,
              display: false
            },
            y: {
              stacked: true,
              beginAtZero: true,
              grid: { display: false },
              ticks: { display: false },
              border: { display: false }
            }
          }
        },
        plugins: [ChartDataLabels]
      });

      window.addEventListener("resize", () => {
        chartTipos.options.plugins.legend.position = getLegendPosition();
        chartTipos.update();
      });

      // ======================================
      // GRÁFICO 2: Tamanho de cada Usuário (MB)
      // ======================================
      const userSizes = [];

      // 1) Calcula o tamanho (em MB) de cada usuário
      Object.entries(users).forEach(([uid, userData]) => {
        // Converte o objeto em JSON
        const userJson = JSON.stringify(userData);

        // Calcula o tamanho em bytes
        const sizeInBytes = new TextEncoder().encode(userJson).length;
        // ou: const sizeInBytes = new Blob([userJson]).size; (outra forma)

        // Converte para MB
        const sizeInMB = sizeInBytes / (1024 * 1024);

        // Usa o e-mail como rótulo (fallback para UID se não houver email)
        const userEmail = userData.email || uid;

        userSizes.push({
          email: userEmail,
          sizeInMB: sizeInMB
        });
      });

      // 2) Cria o gráfico usando Chart.js
      //    Aqui usamos "indexAxis: 'y'" para ter um gráfico HORIZONTAL
      const ctxTamanho = document.getElementById("graficoTamanhoUsuarios").getContext("2d");
      const chartTamanho = new Chart(ctxTamanho, {
        type: "bar",
        data: {
          labels: userSizes.map(item => item.email), // Exibe o email como rótulo (no eixo Y)
          datasets: [{
            label: "Tamanho (MB)",
            data: userSizes.map(item => item.sizeInMB),
            backgroundColor: "rgba(54, 162, 235, 0.7)",
            borderColor: "rgba(54, 162, 235, 1)",
            borderWidth: 1
          }]
        },
        options: {
          indexAxis: 'y', // Gera o gráfico horizontal
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: "top",
              labels: {
                color: "#000",
                font: { weight: "bold", size: 14 }
              }
            },
            datalabels: {
              color: "#000",
              font: { weight: "bold", size: 12 },
              anchor: "end",
              align: "right",
              formatter: (value) => value.toFixed(2) + " MB"
            }
          },
          scales: {
            y: {
              // Como o eixo Y agora tem as labels (nomes/emails), habilite autoSkip = false
              ticks: {
                color: "#000",
                font: { size: 12 },
                autoSkip: false // para não pular labels se tiver muitos
              }
            },
            x: {
              beginAtZero: true,
              ticks: {
                color: "#000",
                font: { size: 12 }
              }
            }
          }
        },
        plugins: [ChartDataLabels]
      });

    } else {
      console.error("Nenhum dado encontrado no Firebase.");
    }
  }, (error) => {
    console.error("Erro ao buscar dados do Firebase:", error);
  });
});

// Aguarda o carregamento do DOM
window.addEventListener("load", () => {
  document.getElementById("gerarRelatorio").addEventListener("click", () => {
    // Acessa a instância jsPDF a partir do objeto global (usando a UMD do jsPDF)
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'mm', 'a4');

    // Seleciona os elementos canvas dos gráficos
    const canvas1 = document.getElementById("graficoTiposContas");
    const canvas2 = document.getElementById("graficoTamanhoUsuarios");

    // Converte os canvas em imagens (formato PNG)
    const imgData1 = canvas1.toDataURL("image/png");
    const imgData2 = canvas2.toDataURL("image/png");

    // Calcula as dimensões para centralizar as imagens na página A4
    const pageWidth = pdf.internal.pageSize.getWidth();
    const margin = 10; // margem de 10mm
    const imgWidth = pageWidth - margin * 2;
    const imgHeight1 = imgWidth * (canvas1.height / canvas1.width);
    const imgHeight2 = imgWidth * (canvas2.height / canvas2.width);

    // Adiciona o primeiro gráfico à primeira página
    pdf.addImage(imgData1, "PNG", margin, margin, imgWidth, imgHeight1);

    // Adiciona uma nova página para o segundo gráfico
    pdf.addPage();
    pdf.addImage(imgData2, "PNG", margin, margin, imgWidth, imgHeight2);

    // Gera uma string com a data atual no formato YYYY-MM-DD
    const hoje = new Date();
    const dataFormatada =
      hoje.getFullYear() +
      "-" +
      (hoje.getMonth() + 1).toString().padStart(2, "0") +
      "-" +
      hoje.getDate().toString().padStart(2, "0");

    // Salva o PDF com o nome "RelatorioAgora(Data).pdf"
    pdf.save(`RelatorioAgora(${dataFormatada}).pdf`);
  });
});
