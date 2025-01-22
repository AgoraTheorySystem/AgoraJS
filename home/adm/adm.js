import { initializeApp } from "https://www.gstatic.com/firebasejs/9.1.3/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/9.1.3/firebase-database.js";
import firebaseConfig from "../../firebase.js"; // Importa a configuração do Firebase

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// Referência para "users" no banco de dados
const usersRef = ref(database, "users");

// Recupera a lista de usuários e exibe no console
onValue(usersRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
        const userList = Object.keys(data); // Cria uma lista com os IDs dos usuários
        console.log("Lista de usuários:", userList);

        // Define o userId como o segundo usuário da lista (se existir)
        const selectedUserId = userList[1] || "";
        console.log("Selecionado userId:", selectedUserId);
    } else {
        console.log("Nenhum usuário encontrado!");
    }
});

// Referência para o corpo da tabela
const tableBody = document.querySelector("#userTable tbody");

// Função para buscar os emails dos usuários e exibir na tabela
function fetchEmailsAndDisplay() {
    if (!tableBody) {
        console.error("Elemento da tabela não encontrado!");
        return;
    }

    onValue(usersRef, (snapshot) => {
        // Limpa a tabela antes de preenchê-la
        tableBody.innerHTML = "";

        if (snapshot.exists()) {
            // Itera pelos usuários no Firebase
            snapshot.forEach((childSnapshot) => {
                const data = childSnapshot.val(); // Obtém os dados do usuário

                // Verifica se é CNPJ ou CPF
                const documentNumber = data.cnpj || data.cpf || "N/A";

                // Cria uma nova linha na tabela
                const row = document.createElement("tr");

                // Preenche a linha com os dados do Firebase
                row.innerHTML = `
                    <td>${data.email || "N/A"}</td>
                    <td></td> <!-- Espaço reservado -->
                    <td></td> <!-- Espaço reservado -->
                    <td>${documentNumber}</td>
                    <td>${data.tipo || "N/A"}</td>
                `;

                // Adiciona "A" na última célula existente
                const lastCell = document.createElement("td");
                lastCell.innerHTML = `
                    <a href="#" class="last-link">
                        <img src="/home/adm/assets_adm/Group 13.svg" alt="Ícone" class="svg-icon">
                    </a>
                `;
                row.appendChild(lastCell);

                // Adiciona a linha ao corpo da tabela
                tableBody.appendChild(row);
            });
        } else {
            console.log("Nenhum dado encontrado no nó 'users'.");
        }
    });
}

// Chama a função ao carregar a página
fetchEmailsAndDisplay();
