import { initializeApp } from "https://www.gstatic.com/firebasejs/9.9.3/firebase-app.js";
import { getDatabase, ref, get, query, orderByChild, startAt } from "https://www.gstatic.com/firebasejs/9.9.3/firebase-database.js";
import firebaseConfig from '/firebase.js';

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const DB_NAME = 'agoraDB';
const STORE_NAME = 'planilhas';

// --- Lógica para Carregamento Seguro do SweetAlert2 ---
let swalPromise = null;
function ensureSwalIsLoaded() {
    if (window.Swal) return Promise.resolve();
    if (swalPromise) return swalPromise;
    swalPromise = new Promise((resolve, reject) => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.min.css';
        document.head.appendChild(link);
        const script = document.createElement('script');
        script.src = "https://cdn.jsdelivr.net/npm/sweetalert2@11";
        script.onload = resolve;
        script.onerror = () => {
            console.error("Falha ao carregar o script do SweetAlert2.");
            reject("Falha ao carregar o SweetAlert2.");
        };
        document.head.appendChild(script);
    });
    return swalPromise;
}

// --- Funções do IndexedDB ---

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
    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = (event) => reject(event.target.error);
    });
}

async function deleteItemFromDB(key) {
    try {
        const db = await openDB();
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        store.delete(key);
        return new Promise((resolve) => {
            transaction.oncomplete = () => {
                console.log(`Chave "${key}" removida do IndexedDB.`);
                resolve();
            };
            transaction.onerror = (event) => {
                console.error(`Erro ao remover chave do IndexedDB:`, event.target.error);
                resolve(); // Resolve mesmo em caso de erro para não travar o fluxo
            };
        });
    } catch (error) {
        console.error("Erro ao abrir o banco de dados para exclusão:", error);
    }
}


// --- Funções de Lógica ---

function getUserFromSession() {
    const userData = sessionStorage.getItem('user');
    return userData ? JSON.parse(userData) : null;
}

async function limparDadosLocaisAntigos(planilhaNome) {
    console.log(`Limpando dados locais antigos para a planilha: ${planilhaNome}`);
    const keysToRemove = [
        `planilha_${planilhaNome}`,
        `lemas_${planilhaNome}`,
        `timestamp_local_change_${planilhaNome}`,
        `pending_changes_${planilhaNome}`
    ];
    await Promise.all(keysToRemove.map(key => deleteItemFromDB(key)));
    console.log(`Limpeza local para "${planilhaNome}" concluída.`);
}

async function baixarPlanilhaInicial(user, planilhaNome) {
    await ensureSwalIsLoaded();
    console.log(`Planilha "${planilhaNome}" não encontrada localmente. Iniciando download limpo...`);

    // **CORREÇÃO: Limpa qualquer dado antigo local antes de baixar**
    await limparDadosLocaisAntigos(planilhaNome);
    
    const preparingTitle = await window.getTranslation('preparing_analy');
    const downloadingText = await window.getTranslation('download_analy');

    Swal.fire({
        title: preparingTitle,
        text: downloadingText,
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });

    try {
        // 1. Baixar dados da planilha (chunks)
        const planilhaRef = ref(database, `/users/${user.uid}/planilhas/${planilhaNome}`);
        const snapshotPlanilha = await get(planilhaRef);
        if (!snapshotPlanilha.exists()) {
            throw new Error(`Planilha "${planilhaNome}" não encontrada no Firebase.`);
        }
        let planilhaCompleta = [];
        snapshotPlanilha.forEach(chunkSnapshot => {
            planilhaCompleta = planilhaCompleta.concat(chunkSnapshot.val());
        });
        await setItem(`planilha_${planilhaNome}`, planilhaCompleta);
        console.log(`Planilha "${planilhaNome}" salva localmente.`);

        // 2. Baixar dados de lematizações/fusões
        const lemasRef = ref(database, `/users/${user.uid}/lematizacoes/${planilhaNome}`);
        const snapshotLemas = await get(lemasRef);
        if (snapshotLemas.exists()) {
            await setItem(`lemas_${planilhaNome}`, snapshotLemas.val());
            console.log(`Lematizações de "${planilhaNome}" salvas localmente.`);
        } else {
             // Garante que se não houver lemas no firebase, o local também fique limpo.
            await setItem(`lemas_${planilhaNome}`, {});
        }

        // 3. Baixar o timestamp mais recente
        const remoteTimestampRef = ref(database, `/users/${user.uid}/UltimasAlteracoes/${planilhaNome}`);
        const snapshotTimestamp = await get(remoteTimestampRef);
        if (snapshotTimestamp.exists()) {
            const remoteData = snapshotTimestamp.val();
            const remoteTimestamp = parseInt(Object.keys(remoteData)[0]);
            await setItem(`timestamp_local_change_${planilhaNome}`, remoteTimestamp);
            console.log(`Timestamp inicial de "${planilhaNome}" salvo localmente.`);
        }
        
        Swal.close();
        const readyTitle = await window.getTranslation('ready');
        const loadedText = (await window.getTranslation('data_loaded')).replace('${planilhaNome}', planilhaNome);
        
        await Swal.fire({
            title: readyTitle,
            text: loadedText,
            icon: "success",
        }).then(() => {
            location.reload();
        });

    } catch (error) {
        console.error("Erro ao baixar dados iniciais:", error);
        const errorText = (await window.getTranslation('download_error')).replace('${error.message}', error.message);
        Swal.fire("Erro no Download", errorText, "error");
    }
}

async function sincronizarDados(user, planilhaNome) {
    try {
        const localTimestamp = await getItem(`timestamp_local_change_${planilhaNome}`) || 0;
        const remoteTimestampRef = ref(database, `/users/${user.uid}/UltimasAlteracoes/${planilhaNome}`);
        const snapshot = await get(remoteTimestampRef);

        if (!snapshot.exists()) {
            console.log("Nenhum timestamp remoto encontrado. Sem necessidade de sincronizar.");
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
        await ensureSwalIsLoaded();
        Swal.fire("Erro de Sincronização", "Não foi possível verificar as atualizações do servidor.", "error");
    }
}

async function aplicarAlteracoesRemotas(user, planilhaNome, localTimestamp, remoteTimestamp) {
    await ensureSwalIsLoaded();
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

            for (const pathKey in changes) {
                changesApplied = true;
                const value = changes[pathKey];
                const pathParts = pathKey.split('___');
                const type = pathParts[0];

                if (type === 'planilhas' && localSheet) {
                    const [, , chunkName, rowIndexInChunk, cellIndex] = pathParts;
                    if(!chunkName || !rowIndexInChunk || !cellIndex) continue;
                    const chunkIndex = parseInt(chunkName.split('_')[1]);
                    const overallRowIndex = chunkIndex * CHUNK_SIZE + parseInt(rowIndexInChunk);
                    
                    if (!localSheet[overallRowIndex]) {
                        localSheet[overallRowIndex] = [];
                    }
                    localSheet[overallRowIndex][parseInt(cellIndex)] = value;

                } else if (type === 'lematizacoes') {
                    const lemaKey = pathParts.slice(2).join('/');
                    localLemas[lemaKey] = value;
                }
            }
        });

        if (changesApplied) {
            await setItem(`planilha_${planilhaNome}`, localSheet);
            await setItem(`lemas_${planilhaNome}`, localLemas);
            await setItem(`timestamp_local_change_${planilhaNome}`, remoteTimestamp);
            
            const updatedTitle = await window.getTranslation('update_spreedsheet');
            const updatedText = await window.getTranslation('update_spreedsheet_text');

            Swal.fire({
                title: updatedTitle,
                text: updatedText,
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

export async function verificarEProcessarPlanilha() {
    const user = getUserFromSession();
    const urlParams = new URLSearchParams(window.location.search);
    const planilhaNome = urlParams.get("planilha");

    if (!user || !planilhaNome) {
        console.log("Usuário ou nome da planilha não encontrado. A verificação não será iniciada.");
        return;
    }

    try {
        const dadosLocais = await getItem(`planilha_${planilhaNome}`);
        if (!dadosLocais) {
            await baixarPlanilhaInicial(user, planilhaNome);
        } else {
            await sincronizarDados(user, planilhaNome);
        }
    } catch (error) {
        console.error("Erro no processo de verificação da planilha:", error);
        await ensureSwalIsLoaded();
        Swal.fire("Erro Crítico", "Ocorreu um problema ao acessar os dados da análise.", "error");
    }
}

