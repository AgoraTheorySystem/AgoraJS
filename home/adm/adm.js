import { initializeApp } from "https://www.gstatic.com/firebasejs/9.1.3/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/9.1.3/firebase-database.js";
import firebaseConfig from "../../firebase.js"; // Importa a configuração do Firebase

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

function createUserCard(data) {
    const card = document.createElement("div");
    card.classList.add("card", `card-${(data.tipo || "default").toLowerCase().replace(/[\s/]/g, "-")}`);

    card.innerHTML = `
    <h1>${data.tipo}</h1>
    <p>Email: ${data.email}</p>
    `
    const container = document.getElementById("containerCards");
    container.appendChild(card);
}

// Função para buscar os dados do Realtime Database
async function fetchData() {
    const dbRef = ref(database, "users"); // Caminho para a coleção "users"

    onValue(dbRef, (snapshot) => {
        if (snapshot.exists()) {
            const users = snapshot.val(); // Retorna todos os dados dentro de "users"

            // Itera sobre os objetos (documentos) dentro de "users"
            Object.values(users).forEach((user) => {
                createUserCard(user); // Cria um card para cada usuário
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