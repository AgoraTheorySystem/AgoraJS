import { initializeApp } from "https://www.gstatic.com/firebasejs/9.1.3/firebase-app.js";
import { getDatabase, ref, onValue, remove } from "https://www.gstatic.com/firebasejs/9.1.3/firebase-database.js";
import firebaseConfig from "../../firebase.js"; // Importa a configuração do Firebase
import { getAuth, deleteUser as deleteAuthUser } from "https://www.gstatic.com/firebasejs/9.1.3/firebase-auth.js";


// Inicializa o Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
let currentPage = 1; // Página inicial
const cardsPerPage = 9; // Máximo de cards por página
let allCardsData = Array.from({ length: 100 }, (_, i) => ({
    userId: `user-${i + 1}`,
    cardData: {
        tipo: `Tipo ${i + 1}`,
        email: `usuario${i + 1}@exemplo.com`,
    },
}));

const apiBaseUrl = 'https://nodejsteste.vercel.app';

function createUserCard(data, userId) {
    const card = document.createElement("div");
    // Define uma classe para o card baseada no displayName ou em "default"
    const cardClass = `card-${(data.tipo || data.displayName || "default")
        .toLowerCase()
        .replace(/[\s/]/g, "-")}`;
    card.classList.add("card", cardClass);
    card.setAttribute("data-id", userId);

    // Cria um placeholder para os timestamps
    card.innerHTML = `
      <h1>${data.tipo || data.displayName || "Sem Nome"}</h1>
      <p>Email: ${data.email}</p>
      <div class="timestamps">
        <p>Carregando informações...</p>
      </div>
      <div class="btn-container">
        <button class="btn-saiba-mais">Saiba Mais</button>
        <!-- Botão para exclusão com ícone (SVG simplificado) -->
        <button class="bin-button">Excluir</button>
      </div>
    `;

    const container = document.getElementById("containerCards");
    container.appendChild(card);

    // Busca os timestamps via API e atualiza o card
    fetch(apiBaseUrl + '/users/' + userId + '/timestamps')
        .then(response => response.text())
        .then(htmlSnippet => {
            const timestampsDiv = card.querySelector(".timestamps");
            timestampsDiv.innerHTML = htmlSnippet;
        })
        .catch(err => {
            console.error("Erro ao carregar timestamps:", err);
            const timestampsDiv = card.querySelector(".timestamps");
            timestampsDiv.innerHTML = `<p>Não foi possível carregar os timestamps.</p>`;
        });

    // Evento para "Saiba Mais"
    const buttonSaibaMais = card.querySelector(".btn-saiba-mais");
    buttonSaibaMais.addEventListener("click", () => {
        showExpandedCard(data, cardClass);
    });

    // Evento para excluir o usuário
    const buttonExcluir = card.querySelector(".bin-button");
    buttonExcluir.addEventListener("click", () => {
        deleteUser(userId, card);
    });
}


async function deleteUser(userId, cardElement) {
    console.log(`Tentando excluir usuário com ID: ${userId}`);

    // Referência para o usuário no Realtime Database
    const userRef = ref(database, `users/${userId}`);

    if (confirm("Tem certeza que deseja excluir este usuário?")) {
        try {
            // 1. Excluir do Realtime Database
            await remove(userRef);
            console.log(`Usuário excluído do Realtime Database com ID ${userId}.`);

            // 2. Excluir via API (DELETE /users/:userId)
            // A API já cuida de remover o usuário do Firebase Authentication
            const response = await fetch(apiBaseUrl + '/users/' + userId, { method: 'DELETE' });
            const data = await response.json();
            if (response.ok) {
                alert("Usuário excluído com sucesso!");
                // Atualiza a interface removendo o card
                cardElement.remove();
            } else {
                alert("Erro: " + data.error);
            }
        } catch (error) {
            console.error("Erro ao excluir o usuário:", error);
            alert("Erro ao excluir o usuário. Verifique o console.");
        }
    }
}



function updatePaginationControls(totalCards, onPageChange) {
    const paginationControls = document.getElementById("pagination-controls");
    paginationControls.innerHTML = ""; // Limpa os controles existentes

    const totalPages = Math.ceil(totalCards / cardsPerPage);
    const maxVisibleButtons = 5; // Máximo de botões visíveis ao mesmo tempo
    const halfRange = Math.floor(maxVisibleButtons / 2);

    let startPage = Math.max(1, currentPage - halfRange);
    let endPage = Math.min(totalPages, startPage + maxVisibleButtons - 1);

    if (endPage - startPage + 1 < maxVisibleButtons) {
        startPage = Math.max(1, endPage - maxVisibleButtons + 1);
    }

    // Botão "Anterior"
    if (currentPage > 1) {
        const prevButton = document.createElement("button");
        prevButton.textContent = "Anterior";
        prevButton.classList.add("pagination-button");
        prevButton.addEventListener("click", () => {
            currentPage--;
            onPageChange();
            updatePaginationControls(totalCards, onPageChange);
        });
        paginationControls.appendChild(prevButton);
    }

    // Botões de página
    for (let i = startPage; i <= endPage; i++) {
        const button = document.createElement("button");
        button.textContent = i;
        button.classList.add("pagination-button");
        if (i === currentPage) {
            button.classList.add("active");
        }
        button.addEventListener("click", () => {
            currentPage = i;
            onPageChange(); // Atualiza os cards da página atual
            updatePaginationControls(totalCards, onPageChange); // Atualiza os controles
        });
        paginationControls.appendChild(button);
    }

    // Botão "Próximo"
    if (currentPage < totalPages) {
        const nextButton = document.createElement("button");
        nextButton.textContent = "Próximo";
        nextButton.classList.add("pagination-button");
        nextButton.addEventListener("click", () => {
            currentPage++;
            onPageChange();
            updatePaginationControls(totalCards, onPageChange);
        });
        paginationControls.appendChild(nextButton);
    }
}

function renderCards(allCardsData, createCardFunction) {
    const container = document.getElementById("containerCards");
    container.innerHTML = ""; // Limpa os cards exibidos

    const startIndex = (currentPage - 1) * cardsPerPage;
    const endIndex = startIndex + cardsPerPage;

    // Exibe apenas os cards da página atual
    allCardsData.slice(startIndex, endIndex).forEach(({ userId, cardData }) => {
        createCardFunction(cardData, userId);
    });
}

function createFilterButtons(accountTypes) {
    const filterContainer = document.getElementById("filter-container");
    filterContainer.innerHTML = ""; // Limpa os filtros antigos

    // Botão "Todos" (sem cor específica)
    const allButton = document.createElement("button");
    allButton.textContent = "Todos";
    allButton.classList.add("filter-button", "active");
    allButton.setAttribute("data-filter", "all");
    allButton.style.backgroundColor = "#444"; // Cor padrão para "Todos"
    allButton.addEventListener("click", () => applyFilter("all"));
    filterContainer.appendChild(allButton);

    // Criar botões para cada tipo de conta com cor correspondente ao CSS
    accountTypes.forEach((type) => {
        const button = document.createElement("button");
        button.textContent = type;
        button.classList.add("filter-button");
        button.setAttribute("data-filter", type);

        // Aplica a mesma classe dos cards
        const cardClass = `card-${type.toLowerCase().replace(/[\s/]/g, "-")}`;
        button.classList.add(cardClass);

        button.addEventListener("click", () => applyFilter(type));
        filterContainer.appendChild(button);
    });
}

function applyFilter(filterType) {
    // Atualiza os botões ativos
    document.querySelectorAll(".filter-button").forEach(button => {
        button.classList.remove("active");
        if (button.getAttribute("data-filter") === filterType) {
            button.classList.add("active");
        }
    });

    // Filtra os dados
    const filteredCards = filterType === "all"
        ? allCardsData
        : allCardsData.filter(({ cardData }) => cardData.tipo === filterType);

    // Atualiza a paginação para exibir apenas os cards filtrados
    updatePaginationControls(filteredCards.length, () => {
        renderCards(filteredCards, createUserCard);
    });

    // Renderiza a primeira página com os cards filtrados
    renderCards(filteredCards, createUserCard);
}

function showExpandedCard(data, cardClass) {
    // Esconde o container principal
    const containerCards = document.getElementById("containerCards");
    containerCards.style.display = "none";

    // Esconde os botões de paginação
    document.getElementById("pagination-controls").style.display = "none";

    // Cria o container expandido
    const expandedContainer = document.createElement("div");
    expandedContainer.classList.add("expanded-card", cardClass); // Adiciona a mesma classe dinâmica

    // Conteúdo inicial do card expandido
    expandedContainer.innerHTML = `
        <h1>${data.tipo}</h1>
        <button class="btn-voltar">Voltar</button>
    `;

    // Itera sobre as propriedades do objeto `data` e adiciona em `<p>`
    Object.entries(data).forEach(([key, value]) => {
        const info = document.createElement("p");
        info.textContent = `${capitalizeFirstLetter(key)}: ${value}`;
        expandedContainer.appendChild(info);
    });

    // Adiciona ao body
    document.body.appendChild(expandedContainer);

    // Evento para botão "Voltar"
    const backButton = expandedContainer.querySelector(".btn-voltar");
    backButton.addEventListener("click", () => {
        expandedContainer.remove(); // Remove o card expandido
        containerCards.style.display = "flex"; // Mostra o container principal

        // Reexibe os botões de paginação quando volta à tela de cards menores
        document.getElementById("pagination-controls").style.display = "flex";
    });
}

// Função para capitalizar a primeira letra das propriedades
function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

// Função para buscar os dados do Realtime Database
async function fetchData() {
    const dbRef = ref(database, "users");

    onValue(dbRef, (snapshot) => {
        if (snapshot.exists()) {
            const users = snapshot.val();

            // Armazena os dados na variável global
            allCardsData = Object.entries(users).map(([userId, cardData]) => ({
                userId,
                cardData,
            }));

            // Coletar os tipos de conta únicos
            const accountTypes = new Set();
            allCardsData.forEach(({ cardData }) => {
                if (cardData.tipo) {
                    accountTypes.add(cardData.tipo);
                }
            });

            // Criar botões de filtro
            createFilterButtons([...accountTypes]);

            // Atualiza os controles de paginação dinamicamente
            updatePaginationControls(allCardsData.length, () => {
                renderCards(allCardsData, createUserCard);
            });

            // Renderiza a primeira página
            renderCards(allCardsData, createUserCard);
        } else {
            console.error("Nenhum dado encontrado no Firebase.");
            document.getElementById("containerCards").innerHTML = "<p>Nenhum usuário encontrado.</p>";
            document.getElementById("pagination-controls").style.display = "none";
        }
    }, (error) => {
        console.error("Erro ao buscar dados do Firebase:", error);
    });
}

// Chama a função para buscar e exibir os cards
fetchData();
