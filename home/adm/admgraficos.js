import { initializeApp } from "https://www.gstatic.com/firebasejs/9.1.3/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/9.1.3/firebase-database.js";
import firebaseConfig from "../../firebase.js"; // Certifique-se de que o caminho está correto

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// Referência para os usuários no Realtime Database
const dbRef = ref(database, "users");

// Funções auxiliares
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

// Aguarda o carregamento completo do DOM
window.addEventListener("load", () => {
  // === Gráfico de Tipos de Contas ===
  onValue(dbRef, (snapshot) => {
    if (snapshot.exists()) {
      const users = snapshot.val();
      const tipoContas = {};
      let totalUsuarios = 0;
      Object.values(users).forEach(user => {
        const tipo = user.tipo || "Desconhecido";
        tipoContas[tipo] = (tipoContas[tipo] || 0) + 1;
        totalUsuarios++;
      });
      const labels = Object.keys(tipoContas);
      const data = Object.values(tipoContas);
      const wrappedLabels = labels.map(label => wrapLabel(label, 12));

      const ctxTipos = document.getElementById("graficoTiposContas").getContext("2d");
      const chartTipos = new Chart(ctxTipos, {
        type: "bar",
        data: {
          labels: [""], // Espaço para empilhar os blocos
          datasets: labels.map((label, index) => ({
            label: wrappedLabels[index],
            data: [data[index]],
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
            x: { stacked: true, display: false },
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
    } else {
      console.error("Nenhum dado encontrado no Firebase.");
    }
  }, (error) => {
    console.error("Erro ao buscar dados do Firebase:", error);
  });

  // === Gráfico: Tamanho dos Dados dos Usuários (Uso MB) ===
  fetch('https://nodejsteste.vercel.app/users/size')
    .then(response => {
      if (!response.ok) {
        throw new Error(`Erro na resposta da API: ${response.status}`);
      }
      return response.json();
    })
    .then(sizes => {
      // Os dados devem vir no formato: { uid1: tamanhoEmMB, uid2: tamanhoEmMB, ... }
      const labels = Object.keys(sizes);
      const data = Object.values(sizes);

      const ctxSize = document.getElementById("graficoTamanhoUsuarios").getContext("2d");
      new Chart(ctxSize, {
        type: "bar",
        data: {
          labels: labels, // UID de cada usuário
          datasets: [{
            label: "Tamanho dos Dados (MB)",
            data: data,
            backgroundColor: "rgba(75, 192, 192, 0.5)",
            borderColor: "rgba(75, 192, 192, 1)",
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: true,
              labels: {
                font: { weight: "bold", size: 14 },
                color: "#000"
              }
            },
            tooltip: {
              callbacks: {
                label: context => `${context.parsed.y} MB`
              }
            }
          },
          scales: {
            x: {
              title: { display: true, text: "UID do Usuário" },
              ticks: { autoSkip: false }
            },
            y: {
              beginAtZero: true,
              title: { display: true, text: "Tamanho (MB)" }
            }
          }
        }
      });
    })
    .catch(error => {
      console.error("Erro ao buscar os tamanhos dos dados:", error);
    });
});
