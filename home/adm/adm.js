import { initializeApp } from "https://www.gstatic.com/firebasejs/9.1.3/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/9.1.3/firebase-database.js";
import firebaseConfig from "../../firebase.js"; // Importa a configuração do Firebase

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

function createUserCard(data, userId) {
    const card = document.createElement("div");
    const cardClass = `card-${(data.tipo || "default").toLowerCase().replace(/[\s/]/g, "-")}`;
    card.classList.add("card", cardClass);

    card.innerHTML = `
        <h1>${data.tipo}</h1>
        <p>Email: ${data.email}</p>
        <div class="btn-container">
            <button class="btn-saiba-mais">Saiba Mais</button>
            <! ANIMAÇÃO LIXEIRA        -- From Uiverse.io by vinodjangid07 --> 
            <button class="bin-button">
            <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 39 7"
                class="bin-top"
            >
                <line stroke-width="4" stroke="white" y2="5" x2="39" y1="5"></line>
                <line
                stroke-width="3"
                stroke="white"
                y2="1.5"
                x2="26.0357"
                y1="1.5"
                x1="12"
                ></line>
            </svg>
            <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 33 39"
                class="bin-bottom"
            >
                <mask fill="white" id="path-1-inside-1_8_19">
                <path
                    d="M0 0H33V35C33 37.2091 31.2091 39 29 39H4C1.79086 39 0 37.2091 0 35V0Z"
                ></path>
                </mask>
                <path
                mask="url(#path-1-inside-1_8_19)"
                fill="white"
                d="M0 0H33H0ZM37 35C37 39.4183 33.4183 43 29 43H4C-0.418278 43 -4 39.4183 -4 35H4H29H37ZM4 43C-0.418278 43 -4 39.4183 -4 35V0H4V35V43ZM37 0V35C37 39.4183 33.4183 43 29 43V35V0H37Z"
                ></path>
                <path stroke-width="4" stroke="white" d="M12 6L12 29"></path>
                <path stroke-width="4" stroke="white" d="M21 6V29"></path>
            </svg>
            <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 89 80"
                class="garbage"
            >
                <path
                fill="white"
                d="M20.5 10.5L37.5 15.5L42.5 11.5L51.5 12.5L68.75 0L72 11.5L79.5 12.5H88.5L87 22L68.75 31.5L75.5066 25L86 26L87 35.5L77.5 48L70.5 49.5L80 50L77.5 71.5L63.5 58.5L53.5 68.5L65.5 70.5L45.5 73L35.5 79.5L28 67L16 63L12 51.5L0 48L16 25L22.5 17L20.5 10.5Z"
                ></path>
            </svg>
            </button>

                `;

    const container = document.getElementById("containerCards");
    container.appendChild(card);

    // Adiciona evento de clique ao botão "Saiba Mais"
    const button = card.querySelector(".btn-saiba-mais");
    button.addEventListener("click", () => showExpandedCard(data, cardClass));

    // Evento para o botão "Excluir"
    const buttonExcluir = card.querySelector(".bin-button");
    buttonExcluir.addEventListener("click", () => deleteUser(userId, card));
}

function deleteUser(userId, cardElement) {
    console.log(`Tentando excluir usuário com ID: ${userId}`);

    const userRef = ref(database, `users/${userId}`);
    if (confirm("Tem certeza que deseja excluir este usuário?")) {
        remove(userRef)
            .then(() => {
                console.log("Usuário excluído com sucesso!");
                alert("Usuário excluído com sucesso!");
                cardElement.remove(); // Remove o card da interface
            })
            .catch((error) => {
                console.error("Erro ao excluir o usuário:", error);
                alert("Não foi possível excluir o usuário. Verifique o console.");
            });
    }
}


function showExpandedCard(data, cardClass) {
    // Esconde o container principal
    const containerCards = document.getElementById("containerCards");
    containerCards.style.display = "none";

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
    });
}

// Função para capitalizar a primeira letra das propriedades
function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

// Função para buscar os dados do Realtime Database
async function fetchData() {
    const dbRef = ref(database, "users"); // Caminho para a coleção "users"

    onValue(dbRef, (snapshot) => {
        if (snapshot.exists()) {
            const users = snapshot.val(); // Retorna todos os dados dentro de "users"

            // Itera sobre os objetos (documentos) dentro de "users"
            Object.entries(users).forEach(([userId, userData]) => {
                createUserCard(userData, userId); // Passa os dados e o ID
            });
        } else {
            console.error("Nenhum dado encontrado no Firebase.");
        }
    }, (error) => {
        console.error("Erro ao buscar dados do Firebase:", error);
    });
}

// Chama a função para buscar e exibir os cards
fetchData();
