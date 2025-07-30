import { initializeApp } from "https://www.gstatic.com/firebasejs/9.1.3/firebase-app.js";
import { getDatabase, ref, onValue, remove } from "https://www.gstatic.com/firebasejs/9.1.3/firebase-database.js";
import firebaseConfig from "../../firebase.js";
import { getAuth, deleteUser as deleteAuthUser } from "https://www.gstatic.com/firebasejs/9.1.3/firebase-auth.js";

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
let currentPage = 1;
const cardsPerPage = 9;
let allCardsData = [];

const apiBaseUrl = 'https://nodejsteste.vercel.app';

function createUserCard(data, userId) {
    const card = document.createElement("div");
    const cardClass = `card-${(data.tipo || data.displayName || "default")
        .toLowerCase()
        .replace(/[\s/]/g, "-")}`;
    card.classList.add("card", cardClass);
    card.setAttribute("data-id", userId);

    card.innerHTML = `
      <h1>${data.tipo || data.displayName || "Sem Nome"}</h1>
      <p>Email: ${data.email}</p>
      <div class="timestamps">
        <p>Carregando informações...</p>
      </div>
      <div class="btn-container">
        <button class="btn-saiba-mais icon-btn">
            <img src="/assets/plus.png" alt="Mais" />
        </button>
        <button class="trash-btn icon-btn">
            <img src="/assets/trash.png" alt="Excluir" />
        </button>
      </div>
    `;

    document.getElementById("containerCards").appendChild(card);

    card.querySelector(".btn-saiba-mais").addEventListener("click", () => {
        showExpandedCard(data, cardClass);
    });

    card.querySelector(".trash-btn").addEventListener("click", () => {
        deleteUser(userId, card);
    });

    fetch(`${apiBaseUrl}/users/${userId}/timestamps`)
        .then(response => response.text())
        .then(htmlSnippet => {
            const timestampsDiv = card.querySelector(".timestamps");
            const matches = [...htmlSnippet.matchAll(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z)/g)];
            const [createdAtRaw, lastAccessRaw] = matches.map(m => m[0]);

            const toBrazilTime = (utcStr) =>
                new Date(utcStr).toLocaleString("pt-BR", {
                    timeZone: "America/Sao_Paulo",
                    weekday: "long",
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit"
                });

            if (createdAtRaw && lastAccessRaw) {
                timestampsDiv.innerHTML = `
                    <p>criado em: ${toBrazilTime(createdAtRaw)}</p>
                    <p>último acesso: ${toBrazilTime(lastAccessRaw)}</p>
                `;
            } else {
                timestampsDiv.innerHTML = `<p>Informações indisponíveis.</p>`;
            }
        })
        .catch((error) => {
            card.querySelector(".timestamps").innerHTML = `<p>Erro ao carregar os dados: ${error.message}</p>`;
        });
}

async function deleteUser(userId, cardElement) {
    if (confirm("Tem certeza que deseja excluir este usuário?")) {
        try {
            await remove(ref(database, `users/${userId}`));
            const response = await fetch(`${apiBaseUrl}/users/${userId}`, { method: 'DELETE' });
            const data = await response.json();
            if (response.ok) {
                alert("Usuário excluído com sucesso!");
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
    paginationControls.innerHTML = "";
    const totalPages = Math.ceil(totalCards / cardsPerPage);
    const maxVisibleButtons = 5;
    const halfRange = Math.floor(maxVisibleButtons / 2);
    let startPage = Math.max(1, currentPage - halfRange);
    let endPage = Math.min(totalPages, startPage + maxVisibleButtons - 1);

    if (endPage - startPage + 1 < maxVisibleButtons) {
        startPage = Math.max(1, endPage - maxVisibleButtons + 1);
    }

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

    for (let i = startPage; i <= endPage; i++) {
        const button = document.createElement("button");
        button.textContent = i;
        button.classList.add("pagination-button");
        if (i === currentPage) {
            button.classList.add("active");
        }
        button.addEventListener("click", () => {
            currentPage = i;
            onPageChange();
            updatePaginationControls(totalCards, onPageChange);
        });
        paginationControls.appendChild(button);
    }

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

function renderCards(dataArray, createCardFn) {
    const container = document.getElementById("containerCards");
    container.innerHTML = "";
    const startIndex = (currentPage - 1) * cardsPerPage;
    const endIndex = startIndex + cardsPerPage;
    dataArray.slice(startIndex, endIndex).forEach(({ userId, cardData }) => {
        createCardFn(cardData, userId);
    });
}

function createFilterButtons(accountTypes) {
    const filterBar = document.querySelector(".filter-bar");
    if (!filterBar) return;
    filterBar.innerHTML = "";

    const allButton = document.createElement("button");
    allButton.textContent = "TODOS";
    allButton.classList.add("filter-tab", "active");
    allButton.setAttribute("data-filter", "TODOS");
    allButton.addEventListener("click", () => applyFilter("TODOS"));
    filterBar.appendChild(allButton);

    accountTypes.forEach((type) => {
        const button = document.createElement("button");
        button.textContent = type.toUpperCase();
        button.classList.add("filter-tab");
        button.setAttribute("data-filter", type);
        button.addEventListener("click", () => applyFilter(type));
        filterBar.appendChild(button);
    });
}

function applyFilter(filterType) {
    const expanded = document.querySelector(".expanded-card");
    const voltarBtn = document.querySelector(".btn-voltar");
    if (expanded) expanded.remove();
    if (voltarBtn) voltarBtn.remove();

    document.getElementById("containerCards").style.display = "flex";
    document.getElementById("pagination-controls").style.display = "flex";

    document.querySelectorAll(".filter-tab").forEach(button => {
        button.classList.remove("active");
        if (button.getAttribute("data-filter") === filterType) {
            button.classList.add("active");
        }
    });

    const filtered = filterType === "TODOS"
        ? allCardsData
        : allCardsData.filter(({ cardData }) =>
            (cardData.tipo || "").toUpperCase() === filterType.toUpperCase());

    updatePaginationControls(filtered.length, () => {
        renderCards(filtered, createUserCard);
    });

    renderCards(filtered, createUserCard);
}

function showExpandedCard(data, cardClass) {
    const containerCards = document.getElementById("containerCards");
    containerCards.style.display = "none";
    document.getElementById("pagination-controls").style.display = "none";

    const expandedContainer = document.createElement("div");
    expandedContainer.classList.add("expanded-card", cardClass);

    // Remove qualquer botão "Voltar" anterior
    const previousBtn = document.querySelector(".btn-voltar");
    if (previousBtn) previousBtn.remove();

    // Botão Voltar
    const voltarBtn = document.createElement("button");
    voltarBtn.classList.add("btn-voltar");
    voltarBtn.textContent = "Voltar";
    voltarBtn.addEventListener("click", () => {
        expandedContainer.remove();
        voltarBtn.remove();
        containerCards.style.display = "flex";
        document.getElementById("pagination-controls").style.display = "flex";
    });

    // Título (tipo) e Email
    const title = document.createElement("h1");
    title.textContent = data.tipo || "Usuário";

    const email = document.createElement("p");
    email.textContent = data.email || "Email não informado";

    const fields = {
        cidade: "Cidade",
        cnpj: "CNPJ",
        endereco: "Endereço",
        inscricao: "Inscrição",
        interesses: "Interesses",
        nacionalidade: "Nacionalidade",
        nomeFantasia: "Nome Fantasia",
        pais: "País",
        razaoSocial: "Razão Social",
        representanteCargo: "Cargo do Representante",
        representanteContato: "Contato do Representante"
    };

    const infoElements = Object.entries(fields).map(([key, label]) => {
        if (data[key]) {
            const p = document.createElement("p");
            p.innerHTML = `<strong>${label}:</strong> ${data[key]}`;
            return p;
        }
        return null;
    }).filter(el => el !== null);

    const footer = document.createElement("div");
    footer.classList.add("expanded-footer");

    const lastAccess = document.createElement("div");
    lastAccess.textContent = "último acesso: " + (data.lastAccess || "—");

    const createdAt = document.createElement("div");
    createdAt.textContent = "criado em: " + (data.createdAt || "—");

    footer.appendChild(lastAccess);
    footer.appendChild(createdAt);

    const icon = document.createElement("img");
    icon.src = "/assets/icon-detalhe.png";
    icon.alt = "ícone";
    icon.classList.add("corner-icon");

    expandedContainer.appendChild(title);
    expandedContainer.appendChild(email);
    infoElements.forEach(el => expandedContainer.appendChild(el));
    expandedContainer.appendChild(footer);
    expandedContainer.appendChild(icon);

    document.querySelector(".dashboard-wrapper").appendChild(expandedContainer);
    document.querySelector(".dashboard-wrapper").appendChild(voltarBtn);
}

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

async function fetchData() {
    const dbRef = ref(database, "users");

    onValue(dbRef, (snapshot) => {
        if (snapshot.exists()) {
            const users = snapshot.val();

            allCardsData = Object.entries(users).map(([userId, cardData]) => ({
                userId,
                cardData,
            }));

            const accountTypes = new Set();
            allCardsData.forEach(({ cardData }) => {
                if (cardData.tipo) accountTypes.add(cardData.tipo);
            });

            createFilterButtons([...accountTypes]);

            updatePaginationControls(allCardsData.length, () => {
                renderCards(allCardsData, createUserCard);
            });

            renderCards(allCardsData, createUserCard);
        } else {
            document.getElementById("containerCards").innerHTML = "<p>Nenhum usuário encontrado.</p>";
            document.getElementById("pagination-controls").style.display = "none";
        }
    }, (error) => {
        console.error("Erro ao buscar dados do Firebase:", error);
    });
}

fetchData();
