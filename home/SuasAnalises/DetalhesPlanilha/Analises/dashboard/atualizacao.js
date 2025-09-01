import { initializeApp } from "https://www.gstatic.com/firebasejs/9.9.3/firebase-app.js";
import { getDatabase, ref, get, query, orderByChild, startAt } from "https://www.gstatic.com/firebasejs/9.9.3/firebase-database.js";
import firebaseConfig from '/firebase.js';

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

const DB_NAME = 'agoraDB';
const STORE_NAME = 'planilhas';

// --- Funções do IndexedDB (Banco de Dados Local) ---
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(event.target.error);
  });
}

async function getItem(key) {
    const db = await openDB();
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(key);
    return new Promise((resolve, reject) => {
        request.onsuccess = (event) => resolve(event.target.result ? event.target.result.value : null);
        request.onerror = (event) => reject(event.target.error);
    });
}

async function setItem(key, value) {
    const db = await openDB();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put({ key, value });
    return new Promise((resolve) => {
        transaction.oncomplete = () => resolve();
    });
}

// --- Lógica Principal de Sincronização ---

function getUserFromSession() {
    const userData = sessionStorage.getItem('user');
    return userData ? JSON.parse(userData) : null;
}

/**
 * Função principal que compara timestamps e inicia a sincronização de diferenças.
 */
async function sincronizarDados(user, planilhaNome) {
    try {
        const localTimestamp = await getItem(`timestamp_local_change_${planilhaNome}`) || 0;
        const remoteTimestampRef = ref(database, `/users/${user.uid}/UltimasAlteracoes/${planilhaNome}`);
        const snapshot = await get(remoteTimestampRef);

        if (!snapshot.exists()) {
            console.log("Nenhum timestamp remoto encontrado. Sem necessidade de sincronizar.");
            return;
        }

        const remoteData = snapshot.val();
        const remoteTimestamp = parseInt(Object.keys(remoteData)[0]);

        if (remoteTimestamp > localTimestamp) {
            console.log("Dados remotos mais recentes. Sincronizando diferenças...");
            await aplicarAlteracoesRemotas(user, planilhaNome, localTimestamp, remoteTimestamp);
        } else {
            console.log("Dados locais estão atualizados.");
            // Dispara evento para checar se existem alterações locais não salvas
            window.dispatchEvent(new Event('checarAlteracoesLocais'));
        }

    } catch (error) {
        console.error("Erro ao sincronizar dados:", error);
        Swal.fire("Erro de Sincronização", "Não foi possível verificar as atualizações do servidor.", "error");
    }
}

/**
 * Busca apenas as alterações no histórico do Firebase e as aplica localmente.
 */
async function aplicarAlteracoesRemotas(user, planilhaNome, localTimestamp, remoteTimestamp) {
    const historyRef = ref(database, `users/${user.uid}/historico_alteracoes/${planilhaNome}`);
    const q = query(historyRef, orderByChild('timestamp'), startAt(localTimestamp + 1));
    
    const snapshot = await get(q);
    if (!snapshot.exists()) {
        console.warn("Timestamp remoto é mais novo, mas não foram encontradas alterações no histórico. Pode ser um erro de sincronia.");
        return;
    }

    // Pega os dados locais atuais para aplicar as mudanças
    let localSheet = await getItem(`planilha_${planilhaNome}`);
    let localLemas = await getItem(`lemas_${planilhaNome}`) || {};

    let changesApplied = false;
    const CHUNK_SIZE = 500; // O mesmo usado no upload

    snapshot.forEach(childSnapshot => {
        const entry = childSnapshot.val();
        const changes = entry.changes;

        for (const path in changes) {
            changesApplied = true;
            const value = changes[path];
            const pathParts = path.split('/'); // Ex: 'planilhas/NOME/chunk_0/10/5' ou 'lematizacoes/NOME/LEMA'
            
            const type = pathParts[0];
            const name = pathParts[1]; // O nome da planilha

            if (type === 'planilhas' && localSheet) {
                const [chunkName, rowIndexInChunk, cellIndex] = pathParts.slice(2);
                const chunkIndex = parseInt(chunkName.split('_')[1]);
                const overallRowIndex = chunkIndex * CHUNK_SIZE + parseInt(rowIndexInChunk);
                if (localSheet[overallRowIndex]) {
                    localSheet[overallRowIndex][parseInt(cellIndex)] = value;
                }
            } else if (type === 'lematizacoes') {
                const lemaKey = pathParts.slice(2).join('/');
                localLemas[lemaKey] = value;
            }
        }
    });

    if (changesApplied) {
        // Salva os dados atualizados localmente
        await setItem(`planilha_${planilhaNome}`, localSheet);
        await setItem(`lemas_${planilhaNome}`, localLemas);
        await setItem(`timestamp_local_change_${planilhaNome}`, remoteTimestamp);

        Swal.fire({
            title: "Planilha Atualizada!",
            text: "Novas alterações do servidor foram aplicadas. A página será recarregada.",
            icon: "info",
            confirmButtonText: "Ok"
        }).then(() => location.reload());
    }
}


document.addEventListener("DOMContentLoaded", async () => {
    const user = getUserFromSession();
    const urlParams = new URLSearchParams(window.location.search);
    const planilhaNome = urlParams.get("planilha");

    if (!user || !planilhaNome) return;

    // Atraso para garantir que a interface principal carregue primeiro
    setTimeout(() => {
        sincronizarDados(user, planilhaNome);
    }, 500);
});

