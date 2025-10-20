import { initializeApp } from "https://www.gstatic.com/firebasejs/9.9.3/firebase-app.js";
import { getDatabase, ref, get, query, orderByChild, startAt } from "https://www.gstatic.com/firebasejs/9.9.3/firebase-database.js";
import firebaseConfig from '/firebase.js';

// Inicialização do Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// Constantes para o IndexedDB
const DB_NAME = 'agoraDB';
const STORE_NAME = 'planilhas';

// --- Funções do IndexedDB (Banco de Dados Local) ---

/**
 * Abre e, se necessário, cria a base de dados local IndexedDB.
 * @returns {Promise<IDBDatabase>} A instância da base de dados.
 */
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

/**
 * Obtém um item do IndexedDB.
 * @param {string} key A chave do item a ser obtido.
 * @returns {Promise<any>} O valor do item ou null se não for encontrado.
 */
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

/**
 * Define um item no IndexedDB.
 * @param {string} key A chave do item.
 * @param {any} value O valor a ser guardado.
 * @returns {Promise<void>}
 */
async function setItem(key, value) {
    const db = await openDB();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put({ key, value });
    return new Promise((resolve) => {
        transaction.oncomplete = () => resolve();
    });
}

// --- Lógica Principal de Sincronização ---

/**
 * Obtém os dados do utilizador a partir da sessionStorage.
 * @returns {object|null} O objeto do utilizador ou null.
 */
function getUserFromSession() {
    const userData = sessionStorage.getItem('user');
    return userData ? JSON.parse(userData) : null;
}

/**
 * Função principal que compara timestamps e inicia a sincronização de diferenças.
 * @param {object} user O objeto do utilizador autenticado.
 * @param {string} planilhaNome O nome da planilha a ser sincronizada.
 */
async function sincronizarDados(user, planilhaNome) {
    try {
        const localTimestamp = await getItem(`timestamp_local_change_${planilhaNome}`) || 0;
        const remoteTimestampRef = ref(database, `/users/${user.uid}/UltimasAlteracoes/${planilhaNome}`);
        const snapshot = await get(remoteTimestampRef);

        if (!snapshot.exists()) {
            console.log("Nenhum timestamp remoto encontrado. Sem necessidade de sincronizar.");
            // Mesmo sem timestamp remoto, precisamos checar se há alterações locais para enviar
            window.dispatchEvent(new Event('checarAlteracoesLocais'));
            return;
        }

        const remoteData = snapshot.val();
        const remoteTimestamp = parseInt(Object.keys(remoteData)[0]);

        if (remoteTimestamp > localTimestamp) {
            console.log("Dados remotos mais recentes. Sincronizando diferenças...");
            await aplicarAlteracoesRemotas(user, planilhaNome, localTimestamp, remoteTimestamp);
        } else {
            console.log("Dados locais estão atualizados.");
            window.dispatchEvent(new Event('checarAlteracoesLocais'));
        }

    } catch (error) {
        console.error("Erro ao sincronizar dados:", error);
        Swal.fire("Erro de Sincronização", "Não foi possível verificar as atualizações do servidor.", "error");
    }
}

/**
 * Busca apenas as alterações no histórico do Firebase e as aplica localmente.
 * @param {object} user O objeto do utilizador.
 * @param {string} planilhaNome O nome da planilha.
 * @param {number} localTimestamp O último timestamp registado localmente.
 * @param {number} remoteTimestamp O timestamp mais recente do servidor.
 */
async function aplicarAlteracoesRemotas(user, planilhaNome, localTimestamp, remoteTimestamp) {
    try {
        const historyRef = ref(database, `users/${user.uid}/historico_alteracoes/${planilhaNome}`);
        const q = query(historyRef, orderByChild('timestamp'), startAt(localTimestamp + 1));
        
        const snapshot = await get(q);
        if (!snapshot.exists()) {
            console.warn("Timestamp remoto é mais novo, mas não foram encontradas alterações no histórico.");
            await setItem(`timestamp_local_change_${planilhaNome}`, remoteTimestamp);
            return;
        }

        let localSheet = await getItem(`planilha_${planilhaNome}`);
        let localLemas = await getItem(`lemas_${planilhaNome}`) || {};

        let changesApplied = false;
        const CHUNK_SIZE = 500;

        snapshot.forEach(childSnapshot => {
            const entry = childSnapshot.val();
            const changes = entry.changes;

            // **CORREÇÃO DA LEITURA DO HISTÓRICO**
            for (const pathKey in changes) {
                changesApplied = true;
                const value = changes[pathKey];
                // Decodifica o caminho, trocando o separador '___' de volta para '/'
                const pathParts = pathKey.split('___');
                
                const type = pathParts[0];

                if (type === 'planilhas' && localSheet) {
                    const [, , chunkName, rowIndexInChunk, cellIndex] = pathParts;
                    if(!chunkName || !rowIndexInChunk || !cellIndex) continue;

                    const chunkIndex = parseInt(chunkName.split('_')[1]);
                    const overallRowIndex = chunkIndex * CHUNK_SIZE + parseInt(rowIndexInChunk);
                    
                    if (localSheet[overallRowIndex] && localSheet[overallRowIndex][parseInt(cellIndex)] !== undefined) {
                        localSheet[overallRowIndex][parseInt(cellIndex)] = value;
                    }

                } else if (type === 'lematizacoes') {
                    // Reconstrói a chave do lema, que pode conter '/'
                    const lemaKey = pathParts.slice(2).join('/');
                    localLemas[lemaKey] = value;
                }
            }
        });

        if (changesApplied) {
            await setItem(`planilha_${planilhaNome}`, localSheet);
            await setItem(`lemas_${planilhaNome}`, localLemas);
            await setItem(`timestamp_local_change_${planilhaNome}`, remoteTimestamp);

            Swal.fire({
                title: "Planilha Atualizada!",
                text: "Novas alterações do servidor foram aplicadas. A página será recarregada.",
                icon: "info",
                confirmButtonText: "Ok"
            }).then(() => location.reload());
        } else {
            await setItem(`timestamp_local_change_${planilhaNome}`, remoteTimestamp);
        }
    } catch (error) {
        console.error("Erro ao aplicar alterações remotas:", error);
        Swal.fire("Erro ao Atualizar", "Ocorreu um problema ao aplicar as alterações do servidor.", "error");
    }
}


document.addEventListener("DOMContentLoaded", async () => {
    const user = getUserFromSession();
    const urlParams = new URLSearchParams(window.location.search);
    const planilhaNome = urlParams.get("planilha");

    if (!user || !planilhaNome) {
        console.log("Utilizador ou nome da planilha não encontrado. A sincronização não será iniciada.");
        return;
    }
    
    setTimeout(() => {
        sincronizarDados(user, planilhaNome);
    }, 500);
});