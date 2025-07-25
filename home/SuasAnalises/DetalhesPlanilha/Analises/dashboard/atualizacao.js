import { initializeApp } from "https://www.gstatic.com/firebasejs/9.9.3/firebase-app.js";
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/9.9.3/firebase-database.js";
import firebaseConfig from '/firebase.js';

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

const DB_NAME = 'agoraDB';
const STORE_NAME = 'planilhas';

// Abre ou cria o banco de dados IndexedDB
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

// Pega um item do IndexedDB
async function getItem(key) {
    const db = await openDB();
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(key);

    return new Promise((resolve, reject) => {
        request.onsuccess = (event) => {
            resolve(event.target.result ? event.target.result.value : null);
        };
        request.onerror = (event) => {
            reject(event.target.error);
        };
    });
}

// Adiciona ou atualiza um item no IndexedDB
async function setItem(key, value) {
    const db = await openDB();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put({ key, value });

    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => {
            resolve();
        };
        transaction.onerror = (event) => {
            reject(event.target.error);
        };
    });
}

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

async function getAllAlteracaoKeys() {
    const db = await openDB();
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const getAllKeysRequest = store.getAllKeys();

    return new Promise((resolve, reject) => {
        getAllKeysRequest.onsuccess = (event) => {
            resolve(event.target.result.filter(key => key.startsWith("planilha_ultima_alteracao_")));
        };
        getAllKeysRequest.onerror = (event) => {
            reject(event.target.error);
        };
    });
}


async function loadAlteracoes() {
    const planilhasUltimaAlteracao = {};
    const keys = await getAllAlteracaoKeys();

    for (const key of keys) {
        try {
            const nomePlanilha = key.replace("planilha_ultima_alteracao_", "");
            planilhasUltimaAlteracao[nomePlanilha] = await getItem(key);
        } catch (error) {
            console.error(`Erro ao ler a chave "${key}" do IndexedDB:`, error);
        }
    }
    return planilhasUltimaAlteracao;
}


// Compara os valores do IndexedDB e Firebase (agora usando números, não mais timestamp)
async function compareData(user, fileName) {
    try {
        // A chave no IndexedDB que contém o número da última alteração
        const indexedDBKey = `planilha_ultima_alteracao_${fileName}`;

        // Recupera o valor salvo no IndexedDB (número da última alteração)
        const indexedDBData = await getItem(indexedDBKey);

        if (!indexedDBData) {
            console.warn("Dado do IndexedDB não encontrado.");
            return;
        }

        const indexedDBValue = indexedDBData;
        console.log("Valor do IndexedDB:", indexedDBValue);

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

        if (indexedDBValue === firebaseValue) {
            console.log("Valores IGUAIS.");
        } else {
            console.log("Valores DIFERENTES.");
            await fetchAndSavePlanilha(user, fileName);
            await fetchAndSaveAuxiliaryTable(user, fileName);
            saveTimestampToIndexedDB(`${fileName}`, firebaseValue);
        }

    } catch (error) {
        console.error("Erro ao comparar dados:", error);
    }
}

// Busca a planilha do Firebase e salva no IndexedDB
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

        saveToIndexedDB(fileName, fullPlanilhaData);
    } catch (error) {
        console.error("Erro ao buscar planilha:", error);
    }
}

// Salva a planilha no IndexedDB
async function saveToIndexedDB(fileName, data) {
    try {
        const key = `planilha_${fileName}`;
        await setItem(key, data);
        console.log(`Planilha "${fileName}" salva no IndexedDB.`);
    } catch (error) {
        console.error("Erro ao salvar no IndexedDB:", error);
    }
}

// Evento ao carregar a página
document.addEventListener("DOMContentLoaded", async () => {
    const user = getUserFromSession();
    if (!user || !planilhaNome) return;

    // Atrasamos a execução para dar tempo da página renderizar completamente
    setTimeout(() => {
        compareData(user, planilhaNome);
    }, 500); // Atraso de 500ms (meio segundo)
});

// Salva o número no IndexedDB
async function saveTimestampToIndexedDB(fileName, value) {
    try {
        const key = `planilha_ultima_alteracao_${fileName}`;
        await setItem(key, value);
        console.log(`Número salvo no IndexedDB para "${fileName}":`, value);
        setTimeout(location.reload(),1000);
    } catch (error) {
        console.error("Erro ao salvar o número no IndexedDB:", error);
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

        // Salva no IndexedDB com a mesma chave usada originalmente
        await saveToIndexedDB(`auxiliar_${fileName}`, fullAuxData);
        console.log(`Tabela auxiliar "${fileName}" salva no IndexedDB.`);

    } catch (error) {
        console.error("Erro ao buscar tabela auxiliar:", error);
    }
}