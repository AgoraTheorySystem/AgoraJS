import { initializeApp } from "https://www.gstatic.com/firebasejs/9.9.3/firebase-app.js";
import { getDatabase, ref, get, set, remove } from "https://www.gstatic.com/firebasejs/9.9.3/firebase-database.js";
import firebaseConfig from '/firebase.js';

// =================================================================
// INICIALIZAÇÃO E CONFIGURAÇÃO
// =================================================================

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Constantes do IndexedDB
const DB_NAME = 'agoraDB';
const STORE_NAME = 'planilhas';

// =================================================================
// FUNÇÕES AUXILIARES (IndexedDB e Sessão)
// =================================================================

/**
 * Abre ou cria o banco de dados IndexedDB.
 * @returns {Promise<IDBDatabase>}
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
 * Pega um item do IndexedDB pela chave.
 * @param {string} key - A chave do item a ser recuperado.
 * @returns {Promise<any|null>} O valor do item ou nulo se não encontrado.
 */
async function getItem(key) {
    const db = await openDB();
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(key);

    return new Promise((resolve, reject) => {
        request.onsuccess = (event) => {
            resolve(event.target.result ? event.target.result.value : null);
        };
        request.onerror = (event) => reject(event.target.error);
    });
}

/**
 * Salva ou atualiza um item no IndexedDB.
 * @param {string} key - A chave do item.
 * @param {any} value - O valor a ser salvo.
 * @returns {Promise<void>}
 */
async function setItem(key, value) {
    const db = await openDB();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.put({ key, value });

    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = (event) => reject(event.target.error);
    });
}

/**
 * Remove um item do IndexedDB pela chave.
 * @param {string} key - A chave do item a ser removido.
 * @returns {Promise<void>}
 */
async function removeItem(key) {
    const db = await openDB();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.delete(key);

    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = (event) => reject(event.target.error);
    });
}

/**
 * Recupera os dados do usuário da sessionStorage.
 * @returns {{uid: string}|null} Objeto com o UID do usuário ou nulo em caso de erro.
 */
function getUserFromSession() {
    try {
        const userData = sessionStorage.getItem('user');
        if (!userData) throw new Error("Dados do usuário não encontrados na sessão.");
        const parsedData = JSON.parse(userData);
        if (!parsedData.uid) throw new Error("UID do usuário inválido.");
        return { uid: parsedData.uid };
    } catch (error) {
        console.error("Erro ao recuperar dados do usuário:", error);
        Swal.fire({ icon: 'error', title: 'Erro de Autenticação', text: 'Por favor, faça login novamente.' });
        return null;
    }
}

/**
 * Mostra ou esconde o elemento de loading.
 * @param {boolean} show - True para mostrar, false para esconder.
 */
function toggleLoading(show) {
    const loadingElement = document.getElementById('loading-container');
    if (loadingElement) {
        loadingElement.style.display = show ? 'flex' : 'none';
    }
}


// =================================================================
// LÓGICA PRINCIPAL (Alterar Nome e Excluir)
// =================================================================

/**
 * Renomeia uma análise no Firebase e no IndexedDB.
 */
window.alterarNome = async function () {
    const user = getUserFromSession();
    if (!user) return;

    const novoNome = document.getElementById("nome").value.trim();
    const urlParams = new URLSearchParams(window.location.search);
    const nomeAntigo = urlParams.get("planilha");

    if (!novoNome) {
        Swal.fire("Atenção", "O novo nome não pode estar vazio.", "warning");
        return;
    }
    if (novoNome === nomeAntigo) {
        Swal.fire("Informação", "O novo nome é igual ao antigo.", "info");
        return;
    }

    toggleLoading(true);

    try {
        // --- 1. Renomear no Firebase ---
        const pathsToProcess = ["planilhas", "UltimasAlteracoes", "tabelasAuxiliares", "lematizacoes"];
        
        const firebasePromises = pathsToProcess.map(async (path) => {
            const oldRef = ref(db, `users/${user.uid}/${path}/${nomeAntigo}`);
            const snapshot = await get(oldRef);

            if (snapshot.exists()) {
                // Para 'planilhas', copia em chunks para evitar erro de "Write too large".
                // Para outros paths, copia o nó inteiro.
                if (path === 'planilhas') {
                    const chunkPromises = [];
                    snapshot.forEach((chunkSnapshot) => {
                        const chunkKey = chunkSnapshot.key;
                        const chunkData = chunkSnapshot.val();
                        const newChunkRef = ref(db, `users/${user.uid}/${path}/${novoNome}/${chunkKey}`);
                        chunkPromises.push(set(newChunkRef, chunkData));
                    });
                    await Promise.all(chunkPromises);
                } else {
                    const data = snapshot.val();
                    const newRef = ref(db, `users/${user.uid}/${path}/${novoNome}`);
                    await set(newRef, data);
                }
                
                // Após a cópia bem-sucedida, remove os dados antigos.
                await remove(oldRef);
                console.log(`Firebase: '${path}/${nomeAntigo}' renomeado para '${path}/${novoNome}'.`);
            }
        });

        // --- 2. Renomear no IndexedDB ---
        const indexedDBKeys = {
            main: `planilha_${nomeAntigo}`,
            modificacao: `planilha_ultima_alteracao_${nomeAntigo}`,
            // auxiliar: `planilha_auxiliar_${nomeAntigo}` // Descomente se usar
        };
        const indexedDBPromises = Object.entries(indexedDBKeys).map(async ([, oldKey]) => {
            const data = await getItem(oldKey);
            if (data !== null) {
                const newKey = oldKey.replace(nomeAntigo, novoNome);
                await setItem(newKey, data);
                await removeItem(oldKey);
                console.log(`IndexedDB: '${oldKey}' renomeado para '${newKey}'.`);
            }
        });

        // Aguarda a conclusão de todas as operações
        await Promise.all([...firebasePromises, ...indexedDBPromises]);

        Swal.fire({
            icon: "success",
            title: "Sucesso!",
            text: "A análise foi renomeada.",
        }).then(() => {
            // Redireciona para a página de listagem de análises
            window.location.href = "/home/SuasAnalises/suas_analises.html";
        });

    } catch (error) {
        console.error("Erro ao renomear a análise:", error);
        Swal.fire("Erro", `Não foi possível renomear a análise. Verifique sua conexão e tente novamente. Detalhes: ${error.message}`, "error");
    } finally {
        toggleLoading(false);
    }
};

/**
 * Exclui permanentemente uma análise do Firebase e do IndexedDB.
 */
window.excluirAnalise = async function () {
    const user = getUserFromSession();
    if (!user) return;

    const urlParams = new URLSearchParams(window.location.search);
    const nomePlanilha = urlParams.get("planilha");

    const result = await Swal.fire({
        title: "Você tem certeza?",
        text: `Esta ação excluirá permanentemente a análise "${nomePlanilha}". Isso não pode ser desfeito.`,
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#d33",
        cancelButtonColor: "#3085d6",
        confirmButtonText: "Sim, excluir!",
        cancelButtonText: "Cancelar",
    });

    if (result.isConfirmed) {
        toggleLoading(true);
        try {
            // --- 1. Excluir do Firebase ---
            const pathsToDelete = ["planilhas", "UltimasAlteracoes", "tabelasAuxiliares", "lematizacoes"];
            const firebasePromises = pathsToDelete.map(path => {
                const dataRef = ref(db, `users/${user.uid}/${path}/${nomePlanilha}`);
                return remove(dataRef);
            });

            // --- 2. Excluir do IndexedDB ---
            const keysToRemove = [
                `planilha_${nomePlanilha}`,
                `planilha_ultima_alteracao_${nomePlanilha}`,
                // `planilha_auxiliar_${nomePlanilha}` // Descomente se usar
            ];
            const indexedDBPromises = keysToRemove.map(key => removeItem(key));

            await Promise.all([...firebasePromises, ...indexedDBPromises]);

            Swal.fire({
                icon: "success",
                title: "Excluído!",
                text: `A análise "${nomePlanilha}" foi removida com sucesso.`,
            }).then(() => {
                window.location.href = "/home/SuasAnalises/suas_analises.html";
            });

        } catch (error) {
            console.error("Erro ao excluir a análise:", error);
            Swal.fire("Erro", `Não foi possível excluir a análise. Verifique sua conexão e tente novamente. Detalhes: ${error.message}`, "error");
        } finally {
            toggleLoading(false);
        }
    }
};

// =================================================================
// INICIALIZAÇÃO DA PÁGINA
// =================================================================

document.addEventListener("DOMContentLoaded", () => {
    // Pega o nome da planilha da URL para exibir no título
    const urlParams = new URLSearchParams(window.location.search);
    const planilhaNome = urlParams.get("planilha");

    if (planilhaNome) {
        const titleElement = document.querySelector(".Title_Menu_da_análise");
        if (titleElement) {
            titleElement.textContent = `Menu da análise: ${planilhaNome}`;
        }
    }
    
    // Configura o botão de voltar
    const menuAnalisesBtn = document.querySelector(".btn_menu_analises");
    if (menuAnalisesBtn) {
        menuAnalisesBtn.addEventListener("click", () => {
            const targetUrl = `/home/SuasAnalises/DetalhesPlanilha/menu_da_analise.html?planilha=${encodeURIComponent(planilhaNome)}`;
            window.location.href = targetUrl;
        });
    }

    // Cria o elemento de loading e o adiciona ao body
    const loadingContainer = document.createElement("div");
    loadingContainer.id = "loading-container";
    loadingContainer.style.display = "none"; // Começa oculto
    loadingContainer.style.position = "fixed";
    loadingContainer.style.top = "0";
    loadingContainer.style.left = "0";
    loadingContainer.style.width = "100%";
    loadingContainer.style.height = "100%";
    loadingContainer.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
    loadingContainer.style.justifyContent = "center";
    loadingContainer.style.alignItems = "center";
    loadingContainer.style.zIndex = "1000";
    loadingContainer.style.flexDirection = "column";
    loadingContainer.innerHTML = `
      <div class="loader">
        <div class="dot"></div><div class="dot"></div><div class="dot"></div><div class="dot"></div><div class="dot"></div>
      </div>
      <p style="color: white; margin-top: 20px;">Processando sua solicitação...</p>
    `;
    document.body.appendChild(loadingContainer);
});
