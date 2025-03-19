import { initializeApp } from "https://www.gstatic.com/firebasejs/9.9.3/firebase-app.js";
import { getDatabase, ref, set, get } from "https://www.gstatic.com/firebasejs/9.9.3/firebase-database.js";
import firebaseConfig from '/firebase.js';

// Inicialize o Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

const urlParams = new URLSearchParams(window.location.search);
const planilhaNome = urlParams.get("planilha");

function getUserFromSession() {
    try {
      const userData = sessionStorage.getItem('user');
      if (!userData) throw new Error("Dados do usuário não encontrados na sessão.");
      const parsedData = JSON.parse(userData);
      if (!parsedData.uid) throw new Error("Dados do usuário inválidos.");
      return { uid: parsedData.uid };
    } catch (error) {
      console.error("Erro ao recuperar dados do usuário:", error);
      Swal.fire({ icon: 'error', title: 'Erro', text: 'Faça login novamente.' });
      return null;
    }
  }

// Função de comparação de timestamps
async function compareTimestamps(user, fileName) {
    try {
        // Recupera o timestamp do localStorage
        const localStorageKey = `planilha_ultima_alteracao_${fileName}`;
        const localStorageData = JSON.parse(localStorage.getItem(localStorageKey));
        console.log("Timestamp do localStorage:", localStorageData);  // Exibe o timestamp do localStorage
        if (!localStorageData || !localStorageData.timestamp) {
            console.error("Timestamp no localStorage não encontrado.");
            return;
        }

        const localStorageTimestamp = localStorageData.timestamp;

        // Recupera o timestamp do Firebase
        const firebaseRef = ref(database, `/users/${user.uid}/UltimasAlteracoes/${fileName}`);
        const snapshot = await get(firebaseRef);

        // Verifica se o snapshot existe e contém dados
        if (!snapshot.exists()) {
            console.error("Dados não encontrados no Firebase. Caminho:", firebaseRef);
            return;
        }

        const firebaseData = snapshot.val();
        console.log("Dados do Firebase:", firebaseData);  // Exibe todos os dados recebidos do Firebase

        // Acessa o timestamp correto dentro da estrutura de dados
        const firebaseTimestamp = firebaseData?.[Object.keys(firebaseData)[0]]?.timestamp;

        if (firebaseTimestamp === undefined) {
            console.error("Timestamp não encontrado no Firebase.");
            return;
        }

        // Exibe o timestamp do Firebase
        console.log("Timestamp do Firebase:", firebaseTimestamp);  // Exibe o timestamp do Firebase

        // Compara os timestamps
        if (localStorageTimestamp === firebaseTimestamp) {
            console.log("IGUAL");
        } else {
            console.log("DIFERENTE");
        }

    } catch (error) {
        console.error("Erro ao comparar os timestamps:", error);
    }
}




// Evento de carregamento
document.addEventListener("DOMContentLoaded", () => {
    const user = getUserFromSession();
    if (!user) return;
    const fileName = planilhaNome; // Certifique-se de que o nome da planilha está correto
    compareTimestamps(user, fileName);
});

