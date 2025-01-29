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
        window.location.href = `./Analises/${categoria}/${categoria}.html?planilha=${encodeURIComponent(planilhaNome)}`;
    } else {
        console.log("Nenhuma planilha foi encontrada.");
    }
}

// Mapeamento das categorias para as classes de botões
const categorias = ["agora", "persona", "prototipicas", "configuracoes"];

// Adicionar eventos de clique de forma dinâmica
categorias.forEach(categoria => {
    const buttons = document.getElementsByClassName(categoria);
    Array.from(buttons).forEach(btn => {
        btn.addEventListener('click', () => handlePlanilhaClick(planilhaNome, categoria));
    });
});
