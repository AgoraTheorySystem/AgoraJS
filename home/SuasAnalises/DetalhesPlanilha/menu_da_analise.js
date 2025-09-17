document.addEventListener('DOMContentLoaded', function () {
    // Pega a string de consulta da URL
    const queryString = window.location.search;
    // Cria uma instância de URLSearchParams para manipular os parâmetros
    const urlParams = new URLSearchParams(queryString);
    // Pega o valor do parâmetro "planilha"
    const planilhaNome = urlParams.get('planilha');

    if (!planilhaNome) {
        console.log("Parâmetro 'planilha' não encontrado na URL.");
    }

    // Função genérica para tratar o clique em um botão
    function handleNavigation(categoria) {
        if (planilhaNome) {
            // Estrutura de URL ajustada para corresponder ao projeto original
            const destinationUrl = `./Analises/${categoria}/${categoria}.html?planilha=${encodeURIComponent(planilhaNome)}`;
            console.log(`Navegando para: ${destinationUrl}`);
            
            // Linha reativada para habilitar a navegação
            window.location.href = destinationUrl;
        } else {
            console.log("Nenhuma planilha foi encontrada para navegação.");
            // Opcional: desabilitar botões ou mostrar uma mensagem ao usuário
        }
    }

    // Adiciona eventos de clique a todos os botões de análise
    const buttons = document.querySelectorAll('.analyze-btn');
    buttons.forEach(btn => {
        const category = btn.dataset.category;
        if (category) {
            btn.addEventListener('click', () => handleNavigation(category));
        }
    });
});

