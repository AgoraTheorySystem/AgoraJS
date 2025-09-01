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

// --- NOVA FUNÇÃO ---
// Compara o timestamp da última alteração local com o do servidor
// para determinar se há alterações não salvas.
async function verificarAlteracoesPendentes(user, fileName) {
    try {
        // 1. Pega o timestamp da última alteração local. Este timestamp é salvo
        //    pelas funções de 'fundir' ou 'remover' no arquivo do menu lateral.
        const localChangeTimestampKey = `timestamp_local_change_${fileName}`;
        const localChangeTimestamp = await getItem(localChangeTimestampKey);

        // Se não houver timestamp de alteração local, não há alterações pendentes.
        if (!localChangeTimestamp) {
            console.log("Nenhum timestamp de alteração local encontrado. Nada a fazer.");
            return;
        }

        // 2. Pega o timestamp da última sincronização bem-sucedida do Firebase.
        const firebaseRef = ref(database, `/users/${user.uid}/UltimasAlteracoes/${fileName}`);
        const snapshot = await get(firebaseRef);

        if (!snapshot.exists()) {
            console.warn("Nenhum timestamp encontrado no Firebase. Assumindo que há alterações a salvar.");
            // Se não há timestamp no servidor, qualquer alteração local é considerada nova e pendente.
            window.dispatchEvent(new CustomEvent('alteracoesPendentesDetectadas'));
            return;
        }

        const firebaseData = snapshot.val();
        const serverSyncTimestamp = Object.keys(firebaseData)[0]; // O timestamp é a chave do objeto.

        console.log(`Timestamp Local...: ${new Date(localChangeTimestamp).toLocaleString()}`);
        console.log(`Timestamp Servidor: ${new Date(parseInt(serverSyncTimestamp, 10)).toLocaleString()}`);

        // 3. Compara os timestamps.
        // Se o timestamp da alteração local for mais recente que o do servidor,
        // significa que fizemos modificações que ainda não foram enviadas.
        if (localChangeTimestamp > parseInt(serverSyncTimestamp, 10)) {
            console.log("Alterações locais pendentes detectadas. Habilitando o botão Salvar.");
            // Dispara um evento global que o menu lateral irá escutar para ativar o botão.
            window.dispatchEvent(new CustomEvent('alteracoesPendentesDetectadas'));
        } else {
            console.log("Dados estão em sincronia com o servidor.");
        }

    } catch (error) {
        console.error("Erro ao verificar alterações pendentes:", error);
    }
}


// Evento ao carregar a página
document.addEventListener("DOMContentLoaded", async () => {
    // A lógica foi reativada, mas agora com o propósito de verificar se o botão "Salvar"
    // deve ser ativado, em vez de baixar ou sincronizar dados automaticamente.
    const user = getUserFromSession();
    if (!user || !planilhaNome) return;

    // Atrasamos a execução para garantir que todos os outros scripts,
    // incluindo o do menu lateral que escuta o evento, já tenham sido carregados.
    setTimeout(() => {
        verificarAlteracoesPendentes(user, planilhaNome);
    }, 500); // Atraso de 500ms
});


// As funções abaixo não são mais chamadas diretamente neste script ao carregar a página,
// mas as mantemos caso sejam necessárias para outras funcionalidades futuras.

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
        await setItem(`planilha_${fileName}`, fullPlanilhaData);
        console.log(`Planilha "${fileName}" baixada e salva no IndexedDB.`);
    } catch (error) {
        console.error("Erro ao buscar planilha:", error);
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
        await setItem(`auxiliar_${fileName}`, fullAuxData);
        console.log(`Tabela auxiliar "${fileName}" salva no IndexedDB.`);
    } catch (error) {
        console.error("Erro ao buscar tabela auxiliar:", error);
    }
}

