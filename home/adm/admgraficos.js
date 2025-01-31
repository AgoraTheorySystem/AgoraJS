import { initializeApp } from "https://www.gstatic.com/firebasejs/9.1.3/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/9.1.3/firebase-database.js";
import firebaseConfig from "../../firebase.js"; // Importa a configuração do Firebase

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// Referência para os usuários no banco de dados
const dbRef = ref(database, "users");

// Captura dinamicamente a cor de um elemento CSS baseado no tipo da conta
function getCardColor(tipo) {
    const tempDiv = document.createElement("div");
    tempDiv.className = `card-${tipo.toLowerCase().replace(/[\s/]/g, "-")}`;
    document.body.appendChild(tempDiv);

    const computedColor = window.getComputedStyle(tempDiv).backgroundColor;
    document.body.removeChild(tempDiv);

    return computedColor || "#606060"; // Fallback cinza se não encontrar a cor
}

// Função para quebrar o texto da legenda em múltiplas linhas
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

// Função para definir a posição da legenda dinamicamente
function getLegendPosition() {
    return window.innerWidth <= 900 ? "bottom" : "right";
}

// Função para processar os dados e gerar o gráfico
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

        // Criar labels formatadas com quebras de linha
        const labels = Object.keys(tipoContas);
        const data = Object.values(tipoContas);
        const wrappedLabels = labels.map(label => wrapLabel(label, 12));

        // Criar o gráfico empilhado
        const ctx = document.getElementById("graficoTiposContas").getContext("2d");
        const chart = new Chart(ctx, {
            type: "bar",
            data: {
                labels: [""], // Apenas um espaço para empilhar os blocos
                datasets: labels.map((label, index) => ({
                    label: wrappedLabels[index], // Aplica a versão formatada com quebra de linha
                    data: [data[index]],
                    backgroundColor: getCardColor(label), // Obtém a cor automaticamente do CSS
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
                            font: {
                                weight: "bold",
                                size: 14
                            },
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

        // Atualiza a posição da legenda quando a tela for redimensionada
        window.addEventListener("resize", () => {
            chart.options.plugins.legend.position = getLegendPosition();
            chart.update();
        });

    } else {
        console.error("Nenhum dado encontrado no Firebase.");
    }
}, (error) => {
    console.error("Erro ao buscar dados do Firebase:", error);
});
