import { initializeApp } from "https://www.gstatic.com/firebasejs/9.9.3/firebase-app.js";
import { getDatabase, ref, get, set, remove } from "https://www.gstatic.com/firebasejs/9.9.3/firebase-database.js";
import firebaseConfig from '/firebase.js';

// =================================================================
// INICIALIZAÇÃO E CONFIGURAÇÃO
// =================================================================

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const DB_NAME = 'agoraDB';
const STORE_NAME = 'planilhas';

// =================================================================
// FUNÇÕES AUXILIARES (IndexedDB e Sessão)
// =================================================================

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
    const store = transaction.objectStore(STORE_NAME);
    store.put({ key, value });
    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = (event) => reject(event.target.error);
    });
}

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

async function getUserFromSession() {
    try {
        const userData = sessionStorage.getItem('user');
        if (!userData) throw new Error("User data not found in session.");
        const parsedData = JSON.parse(userData);
        if (!parsedData.uid) throw new Error("Invalid user UID.");
        return { uid: parsedData.uid };
    } catch (error) {
        console.error("Error retrieving user data:", error);
        Swal.fire({
            icon: 'error',
            title: await window.getTranslation('auth_error_title'),
            text: await window.getTranslation('auth_error_text')
        });
        return null;
    }
}

function toggleLoading(show) {
    const loadingElement = document.getElementById('loading-container');
    if (loadingElement) {
        loadingElement.style.display = show ? 'flex' : 'none';
    }
}

// =================================================================
// LÓGICA PRINCIPAL (Alterar Nome e Excluir)
// =================================================================

window.alterarNome = async function () {
    const user = await getUserFromSession();
    if (!user) return;

    const novoNome = document.getElementById("nome").value.trim();
    const urlParams = new URLSearchParams(window.location.search);
    const nomeAntigo = urlParams.get("planilha");

    if (!novoNome) {
        Swal.fire(await window.getTranslation('settings_alert_attention'), await window.getTranslation('settings_alert_name_empty'), "warning");
        return;
    }
    if (novoNome === nomeAntigo) {
        Swal.fire(await window.getTranslation('settings_alert_info'), await window.getTranslation('settings_alert_name_same'), "info");
        return;
    }

    const result = await Swal.fire({
        title: await window.getTranslation('settings_confirm_rename_title'),
        text: (await window.getTranslation('settings_confirm_rename_text')).replace('{oldName}', nomeAntigo).replace('{newName}', novoNome),
        icon: "question",
        showCancelButton: true,
        confirmButtonColor: "#3085d6",
        cancelButtonColor: "#d33",
        confirmButtonText: await window.getTranslation('settings_confirm_rename_button'),
        cancelButtonText: await window.getTranslation('settings_cancel_button')
    });

    if (result.isConfirmed) {
        toggleLoading(true);
        try {
            const pathsToProcess = ["planilhas", "UltimasAlteracoes", "tabelasAuxiliares", "lematizacoes"];
            const firebasePromises = pathsToProcess.map(async (path) => {
                const oldRef = ref(db, `users/${user.uid}/${path}/${nomeAntigo}`);
                const snapshot = await get(oldRef);
                if (snapshot.exists()) {
                    if (path === 'planilhas') {
                        const chunkPromises = [];
                        snapshot.forEach((chunkSnapshot) => {
                            const newChunkRef = ref(db, `users/${user.uid}/${path}/${novoNome}/${chunkSnapshot.key}`);
                            chunkPromises.push(set(newChunkRef, chunkSnapshot.val()));
                        });
                        await Promise.all(chunkPromises);
                    } else {
                        await set(ref(db, `users/${user.uid}/${path}/${novoNome}`), snapshot.val());
                    }
                    await remove(oldRef);
                }
            });

            const indexedDBKeys = { main: `planilha_${nomeAntigo}`, modificacao: `planilha_ultima_alteracao_${nomeAntigo}` };
            const indexedDBPromises = Object.entries(indexedDBKeys).map(async ([, oldKey]) => {
                const data = await getItem(oldKey);
                if (data !== null) {
                    const newKey = oldKey.replace(nomeAntigo, novoNome);
                    await setItem(newKey, data);
                    await removeItem(oldKey);
                }
            });

            await Promise.all([...firebasePromises, ...indexedDBPromises]);

            await Swal.fire({
                icon: "success",
                title: await window.getTranslation('settings_success_title'),
                text: await window.getTranslation('settings_rename_success_text'),
            });
            window.location.href = `/home/SuasAnalises/DetalhesPlanilha/menu_da_analise.html?planilha=${encodeURIComponent(novoNome)}`;

        } catch (error) {
            console.error("Erro ao renomear a análise:", error);
            const errorText = (await window.getTranslation('settings_rename_error_text')).replace('{errorMessage}', error.message);
            Swal.fire(await window.getTranslation('settings_error_title'), errorText, "error");
        } finally {
            toggleLoading(false);
        }
    }
};

window.excluirAnalise = async function () {
    const user = await getUserFromSession();
    if (!user) return;

    const urlParams = new URLSearchParams(window.location.search);
    const nomePlanilha = urlParams.get("planilha");

    const result = await Swal.fire({
        title: await window.getTranslation('settings_confirm_delete_title'),
        text: (await window.getTranslation('settings_confirm_delete_text')).replace('{sheetName}', nomePlanilha),
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#d33",
        cancelButtonColor: "#3085d6",
        confirmButtonText: await window.getTranslation('settings_confirm_delete_button'),
        cancelButtonText: await window.getTranslation('settings_cancel_button'),
    });

    if (result.isConfirmed) {
        toggleLoading(true);
        try {
            const pathsToDelete = ["planilhas", "UltimasAlteracoes", "tabelasAuxiliares", "lematizacoes"];
            const firebasePromises = pathsToDelete.map(path => remove(ref(db, `users/${user.uid}/${path}/${nomePlanilha}`)));
            const keysToRemove = [`planilha_${nomePlanilha}`, `planilha_ultima_alteracao_${nomePlanilha}`];
            const indexedDBPromises = keysToRemove.map(key => removeItem(key));

            await Promise.all([...firebasePromises, ...indexedDBPromises]);

            await Swal.fire({
                icon: "success",
                title: await window.getTranslation('settings_deleted_title'),
                text: (await window.getTranslation('settings_delete_success_text')).replace('{sheetName}', nomePlanilha),
            });
            window.location.href = "/home/SuasAnalises/suas_analises.html";

        } catch (error) {
            console.error("Erro ao excluir a análise:", error);
            const errorText = (await window.getTranslation('settings_delete_error_text')).replace('{errorMessage}', error.message);
            Swal.fire(await window.getTranslation('settings_error_title'), errorText, "error");
        } finally {
            toggleLoading(false);
        }
    }
};

// =================================================================
// INICIALIZAÇÃO DA PÁGINA
// =================================================================

document.addEventListener("DOMContentLoaded", async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const planilhaNome = urlParams.get("planilha");

    if (planilhaNome) {
        const titleElement = document.querySelector(".Title_Menu_da_análise");
        if (titleElement) {
            titleElement.textContent = (await window.getTranslation('settings_menu_title')).replace('{sheetName}', planilhaNome);
        }
    }

    const menuAnalisesBtn = document.querySelector(".btn_menu_analises");
    if (menuAnalisesBtn) {
        menuAnalisesBtn.addEventListener("click", () => {
            window.location.href = `/home/SuasAnalises/DetalhesPlanilha/menu_da_analise.html?planilha=${encodeURIComponent(planilhaNome)}`;
        });
    }

    const loadingContainer = document.createElement("div");
    loadingContainer.id = "loading-container";
    loadingContainer.style.display = "none";
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
    
    // Adiciona o texto traduzido ao loader
    const loadingText = await window.getTranslation('settings_loading_text');
    loadingContainer.innerHTML = `
      <div class="loader">
        <div class="dot"></div><div class="dot"></div><div class="dot"></div><div class="dot"></div><div class="dot"></div>
      </div>
      <p style="color: white; margin-top: 20px;">${loadingText}</p>
    `;
    document.body.appendChild(loadingContainer);

    // Aplica a tradução para placeholders
    document.querySelectorAll('[data-translate-placeholder]').forEach(async element => {
        const key = element.getAttribute('data-translate-placeholder');
        if(key) {
            element.placeholder = await window.getTranslation(key) || key;
        }
    });
});