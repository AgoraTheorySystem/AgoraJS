import { initializeApp } from "https://www.gstatic.com/firebasejs/9.9.3/firebase-app.js";
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/9.9.3/firebase-database.js";
import firebaseConfig from '/firebase.js';

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// Pega o nome da planilha a partir da URL
const urlParams = new URLSearchParams(window.location.search);
const planilhaNome = urlParams.get("planilha");

// Recupera o usuário da sessão
function getUserFromSession() {
    try {
        const userData = sessionStorage.getItem('user');
        if (!userData) throw new Error("Dados do usuário não encontrados.");

        const parsedData = JSON.parse(userData);
        if (!parsedData.uid) throw new Error("Usuário inválido.");

        return { uid: parsedData.uid };
    } catch (error) {
        console.error("Erro ao recuperar usuário:", error);
        Swal.fire({ icon: 'error', title: 'Erro', text: 'Faça login novamente.' });
        return null;
    }
}

const planilhasUltimaAlteracao = {};

Object.keys(localStorage).forEach(key => {
    try {
        if (key.startsWith("planilha_") && key.startsWith("planilha_ultima_alteracao_")) {
            const nomePlanilha = key.replace("planilha_ultima_alteracao_", "");
            planilhasUltimaAlteracao[nomePlanilha] = JSON.parse(localStorage.getItem(key));
        }
    } catch (error) {
        console.error(`Erro ao ler a chave "${key}" do LocalStorage:`, error);
    }
});

// Compara os valores do localStorage e Firebase (agora usando números, não mais timestamp)
async function compareData(user, fileName) {
    try {
        // A chave no localStorage que contém o número da última alteração
        const localStorageKey = `planilha_ultima_alteracao_${fileName}`;
        const today = new Date();

        // Recupera o valor salvo no localStorage (número da última alteração)
        const localStorageData = localStorage.getItem(localStorageKey);

        if (!localStorageData) {
            console.warn("Dado do localStorage não encontrado.");
            return;
        }

        const localStorageValue = localStorageData;
        console.log("Valor do localStorage:", localStorageValue);

        // A referência no Firebase que contém o número da última alteração
        const firebaseRef = ref(database, `/users/${user.uid}/UltimasAlteracoes/${fileName}`);
        const snapshot = await get(firebaseRef);

        if (!snapshot.exists()) {
            console.warn("Dado não encontrado no Firebase.");
            return;
        }

        const firebaseData = snapshot.val();
        const firebaseValue = Object.keys(firebaseData)[0]; // O número da última alteração no Firebase

        console.log("Valor do Firebase:", firebaseValue);

        if (localStorageValue === firebaseValue) {
            console.log("Valores IGUAIS.");
        } else {
            console.log("Valores DIFERENTES.");
            await fetchAndSavePlanilha(user, fileName);
            await fetchAndSaveAuxiliaryTable(user, fileName);
            saveTimestampToLocalStorage(`${fileName}`, firebaseValue);
        }

    } catch (error) {
        console.error("Erro ao comparar dados:", error);
    }
}

// Busca a planilha do Firebase e salva no localStorage
async function fetchAndSavePlanilha(user, fileName) {
    const fileRef = ref(database, `/users/${user.uid}/planilhas/${fileName}`);

    try {
        const snapshot = await get(fileRef);

        if (!snapshot.exists()) {
            console.warn(`Planilha "${fileName}" não encontrada no Firebase.`);
            return;
        }

        const planilhaChunks = snapshot.val();
        let fullPlanilhaData = [];

        Object.keys(planilhaChunks).forEach(chunkKey => {
            fullPlanilhaData = fullPlanilhaData.concat(planilhaChunks[chunkKey]);
        });

        saveToLocalStorage(fileName, fullPlanilhaData);
    } catch (error) {
        console.error("Erro ao buscar planilha:", error);
    }
}

// Salva a planilha no localStorage
function saveToLocalStorage(fileName, data) {
    try {
        const key = `planilha_${fileName}`;
        localStorage.setItem(key, JSON.stringify(data));
        console.log(`Planilha "${fileName}" salva no localStorage.`);
    } catch (error) {
        console.error("Erro ao salvar no localStorage:", error);
    }
}

// Evento ao carregar a página
document.addEventListener("DOMContentLoaded", async () => {
    const user = getUserFromSession();
    if (!user || !planilhaNome) return;

    await compareData(user, planilhaNome);
});

// Salva o número no localStorage
function saveTimestampToLocalStorage(fileName, value) {
    try {
        const key = `planilha_ultima_alteracao_${fileName}`;
        localStorage.setItem(key, value);
        console.log(`Número salvo no localStorage para "${fileName}":`, value);
        setTimeout(location.reload(),1000);
    } catch (error) {
        console.error("Erro ao salvar o número no localStorage:", error);
    }
}

async function fetchAndSaveAuxiliaryTable(user, fileName) {
    const auxRef = ref(database, `/users/${user.uid}/tabelasAuxiliares/${fileName}`);

    try {
        const snapshot = await get(auxRef);

        if (!snapshot.exists()) {
            console.warn(`Tabela auxiliar "${fileName}" não encontrada no Firebase.`);
            return;
        }

        const auxChunks = snapshot.val();
        let fullAuxData = [];

        Object.keys(auxChunks).forEach(chunkKey => {
            fullAuxData = fullAuxData.concat(auxChunks[chunkKey]);
        });

        // Salva no localStorage com a mesma chave usada originalmente
        saveToLocalStorage(`auxiliar_${fileName}`, fullAuxData);
        console.log(`Tabela auxiliar "${fileName}" salva no localStorage.`);

    } catch (error) {
        console.error("Erro ao buscar tabela auxiliar:", error);
    }
}

