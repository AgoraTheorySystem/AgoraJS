// Pegar a string de consulta da URL
const queryString = window.location.search;

// Criar uma instância de URLSearchParams para manipular os parâmetros
const urlParams = new URLSearchParams(queryString);

// Pegar o valor do parâmetro "planilha"
const planilhaNome = urlParams.get('planilha');

// Verificar e exibir o valor
if (planilhaNome) {

} else {
    console.log("Parâmetro 'planilha' não encontrado na URL.");
}

// Função genérica para tratar o clique em uma planilha
function handlePlanilhaClick(planilhaNome, categoria) {
  if (planilhaNome) {
    const loadingElement = document.getElementById('loading');
    if (loadingElement) {
      loadingElement.style.display = 'flex';
    }
    setTimeout(() => {
      window.location.href = `./Analises/${categoria}/${categoria}.html?planilha=${encodeURIComponent(planilhaNome)}`;
    }, 1000);
  } else {
    console.log("Nenhuma planilha foi encontrada.");
  }
}

// Mapeamento das categorias para as classes de botões
const categorias = ["dashboard", "persona", "prototipicas", "configuracoes"];

// Adicionar eventos de clique de forma dinâmica
categorias.forEach(categoria => {
    const buttons = document.getElementsByClassName(categoria);
    Array.from(buttons).forEach(btn => {
        btn.addEventListener('click', () => handlePlanilhaClick(planilhaNome, categoria));
    });
});

document.addEventListener('DOMContentLoaded', function () {
    const buttonTextMap = {
        dashboard: "IR PARA ÁGORA",
        persona: "IR PARA PERSONA",
        prototipicas: "IR PARA PROTOTÍPICAS",
        configuracoes: "CONFIGURAÇÕES"
    };

    const buttons = document.querySelectorAll('.analyze-btn');

    buttons.forEach(button => {
        const cardClass = button.classList[1]; // Obtém a segunda classe do botão (dashboard, persona, etc.)
        if (buttonTextMap[cardClass]) {
            button.textContent = buttonTextMap[cardClass]; // Atualiza o texto do botão
        }
    });
});

