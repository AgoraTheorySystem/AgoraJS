import { initializeApp } from "https://www.gstatic.com/firebasejs/9.9.3/firebase-app.js";
import { getDatabase, ref, set, get } from "https://www.gstatic.com/firebasejs/9.9.3/firebase-database.js";
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

// Compara os timestamps do localStorage e Firebase
async function compareTimestamps(user, fileName) {
    try {
        const localStorageKey = `planilha_ultima_alteracao_${fileName}`;
        const localStorageData = JSON.parse(localStorage.getItem(localStorageKey));

        if (!localStorageData?.timestamp) {
            console.warn("Timestamp do localStorage não encontrado.");
            return;
        }

        const localStorageTimestamp = localStorageData.timestamp;
        console.log("Timestamp do localStorage:", localStorageTimestamp);

        const firebaseRef = ref(database, `/users/${user.uid}/UltimasAlteracoes/${fileName}`);
        const snapshot = await get(firebaseRef);

        if (!snapshot.exists()) {
            console.warn("Timestamp não encontrado no Firebase.");
            return;
        }

        const firebaseData = snapshot.val();
        const firebaseTimestamp = firebaseData?.[Object.keys(firebaseData)[0]]?.timestamp;

        if (firebaseTimestamp === undefined) {
            console.warn("Timestamp ausente nos dados do Firebase.");
            return;
        }

        console.log("Timestamp do Firebase:", firebaseTimestamp);

        if (localStorageTimestamp === firebaseTimestamp) {
            console.log("Timestamps IGUAIS.");
        } else {
            console.log("Timestamps DIFERENTES.");
            await fetchAndSavePlanilha(user, fileName);
            await fetchAndSaveAuxiliaryTable(user, fileName);
            saveTimestampToLocalStorage(fileName, firebaseTimestamp);

        }

    } catch (error) {
        console.error("Erro ao comparar timestamps:", error);
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

    await compareTimestamps(user, planilhaNome);
});

function saveTimestampToLocalStorage(fileName, timestamp) {
    try {
        const key = `planilha_ultima_alteracao_${fileName}`;
        const data = { timestamp };
        localStorage.setItem(key, JSON.stringify(data));
        console.log(`Timestamp atualizado no localStorage para "${fileName}":`, timestamp);
    } catch (error) {
        console.error("Erro ao salvar o timestamp no localStorage:", error);
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
