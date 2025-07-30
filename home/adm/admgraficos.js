import { initializeApp } from "https://www.gstatic.com/firebasejs/9.1.3/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/9.1.3/firebase-database.js";
import firebaseConfig from "../../firebase.js";

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// Referência para os usuários no Realtime Database
const dbRef = ref(database, "users");

// === Cores fixas por tipo ===
const tipoCores = {
  "ONG": "#FFD700", // amarelo
  "Empresa": "#1E90FF", // azul
  "Pessoa Física": "#4F8105", // verde escuro
  "Universidade/Escola": "#6C3483", // roxo
  "Outros": "#B80355", // vermelho
  "Desconhecido": "#808080" // cinza
};


function getFixedColor(tipo) {
  return tipoCores[tipo] || "#606060";
}

// === Funções auxiliares ===
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

      // GRÁFICO 1: Distribuição por Tipo
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
          labels: [""],
          datasets: labelsTipos.map((label, index) => ({
            label: wrappedLabels[index],
            data: [dataTipos[index]],
            backgroundColor: getFixedColor(label),
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

      // GRÁFICO 2: Tamanho de cada Usuário (MB)
      const userSizes = [];

      Object.entries(users).forEach(([uid, userData]) => {
        const userJson = JSON.stringify(userData);
        const sizeInBytes = new TextEncoder().encode(userJson).length;
        const sizeInMB = sizeInBytes / (1024 * 1024);
        const userEmail = userData.email || uid;

        userSizes.push({
          email: userEmail,
          sizeInMB: sizeInMB
        });
      });

      const ctxTamanho = document.getElementById("graficoTamanhoUsuarios").getContext("2d");
      const chartTamanho = new Chart(ctxTamanho, {
        type: "bar",
        data: {
          labels: userSizes.map(item => item.email),
          datasets: [{
            label: "Tamanho (MB)",
            data: userSizes.map(item => item.sizeInMB),
            backgroundColor: "rgba(54, 162, 235, 0.7)",
            borderColor: "rgba(54, 162, 235, 1)",
            borderWidth: 1
          }]
        },
        options: {
          indexAxis: 'y',
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
              ticks: {
                color: "#000",
                font: { size: 12 },
                autoSkip: false
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

// Geração de PDF
window.addEventListener("load", () => {
  document.getElementById("gerarRelatorio").addEventListener("click", () => {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'mm', 'a4');

    const canvas1 = document.getElementById("graficoTiposContas");
    const canvas2 = document.getElementById("graficoTamanhoUsuarios");

    const imgData1 = canvas1.toDataURL("image/png");
    const imgData2 = canvas2.toDataURL("image/png");

    const pageWidth = pdf.internal.pageSize.getWidth();
    const margin = 10;
    const imgWidth = pageWidth - margin * 2;
    const imgHeight1 = imgWidth * (canvas1.height / canvas1.width);
    const imgHeight2 = imgWidth * (canvas2.height / canvas2.width);

    pdf.addImage(imgData1, "PNG", margin, margin, imgWidth, imgHeight1);
    pdf.addPage();
    pdf.addImage(imgData2, "PNG", margin, margin, imgWidth, imgHeight2);

    const hoje = new Date();
    const dataFormatada =
      hoje.getFullYear() +
      "-" +
      (hoje.getMonth() + 1).toString().padStart(2, "0") +
      "-" +
      hoje.getDate().toString().padStart(2, "0");

    pdf.save(`RelatorioAgora(${dataFormatada}).pdf`);
  });
});
