import { initializeApp } from "https://www.gstatic.com/firebasejs/9.9.3/firebase-app.js";
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/9.9.3/firebase-database.js";
import firebaseConfig from '/firebase.js';

// Inicialização do Firebase para este módulo
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

const DB_NAME = 'agoraDB';
const STORE_NAME = 'planilhas';

// --- Funções Auxiliares de IndexedDB (Locais para este módulo) ---
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = event => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'key' });
            }
        };
        request.onsuccess = event => resolve(event.target.result);
        request.onerror = event => reject(event.target.error);
    });
}

async function getItem(key) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const request = transaction.objectStore(STORE_NAME).get(key);
        request.onsuccess = event => resolve(event.target.result ? event.target.result.value : null);
        request.onerror = event => reject(event.target.error);
    });
}

async function setItem(key, value) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        transaction.objectStore(STORE_NAME).put({ key, value });
        transaction.oncomplete = () => resolve();
        transaction.onerror = event => reject(event.target.error);
    });
}

// --- Funções de Utilidade ---

function getUserFromSession() {
    const userData = sessionStorage.getItem('user');
    if (userData) {
        try {
            const parsedData = JSON.parse(userData);
            if (parsedData && parsedData.uid) {
                return parsedData;
            }
        } catch (e) {
            console.error("Erro ao parsear dados do usuário da sessão:", e);
        }
    }
    return null;
}

/**
 * Busca as contagens (total, ego, alter) para uma lista de palavras.
 * Necessário para criar "lemas" para palavras não fundidas.
 */
async function getWordCounts(palavrasList, storedData) {
    const contagens = {};
    palavrasList.forEach(p => {
        contagens[p] = { total: 0, ego: 0, alter: 0 };
    });

    const header = storedData[0];
    const rows = storedData.slice(1);

    for (const row of rows) {
        if (!Array.isArray(row)) continue;
        for (let j = 0; j < header.length; j++) {
            const coluna = String(header[j] || "").toUpperCase();
            if (/^EVOC[1-9]$|^EVOC10$/.test(coluna)) {
                const palavra = String(row[j] || "").trim().toUpperCase();
                if (palavrasList.includes(palavra)) {
                    contagens[palavra].total++;
                    if (/^EVOC[1-5]$/.test(coluna)) {
                        contagens[palavra].ego++;
                    } else {
                        contagens[palavra].alter++;
                    }
                }
            }
        }
    }
    return contagens;
}

/**
 * Busca a lista de categorias do Firebase ou Localmente.
 */
async function fetchCategorias(user, planilhaNome) {
    // Tenta buscar no Firebase primeiro
    try {
        const categoriasRef = ref(database, `users/${user.uid}/categorias/${planilhaNome}`);
        const snapshot = await get(categoriasRef);
        if (snapshot.exists()) {
            const data = snapshot.val();
            return Object.keys(data); // Retorna um array de nomes de categorias
        }
    } catch (error) {
        console.warn("Não foi possível buscar categorias do Firebase (offline?), tentando local...", error);
    }
    
    // Fallback: Tenta buscar as categorias logadas localmente (pending changes)
    const pendingChanges = await getItem(`pending_changes_${planilhaNome}`) || [];
    const localCategorias = new Set();
    pendingChanges.forEach(change => {
        if (change.path.startsWith(`categorias/${planilhaNome}/`)) {
            const catName = change.path.split('/').pop();
            if (change.value !== null) {
                localCategorias.add(catName);
            } else {
                localCategorias.delete(catName);
            }
        }
    });
    
    return [...localCategorias];
}

// --- Funções Principais Exportadas ---

/**
 * Função principal para adicionar Positividade.
 * @param {Function} logLocalChangeFn - Função para registrar a alteração localmente.
 */
export async function adicionarPositividade(logLocalChangeFn) {
    await adicionarMetadado('positividade', logLocalChangeFn, null);
}

/**
 * Função principal para adicionar Categoria.
 * @param {Function} logLocalChangeFn - Função para registrar a alteração localmente.
 * @param {Function} salvarAlteracoesFn - Função para salvar alterações no servidor (necessário para o CRUD).
 */
export async function adicionarCategoria(logLocalChangeFn, salvarAlteracoesFn) {
    await abrirModalCategorias(logLocalChangeFn, salvarAlteracoesFn);
}

/**
 * Função genérica para adicionar um metadado (positividade ou categoria)
 */
async function adicionarMetadado(tipoMetadado, logLocalChangeFn, salvarAlteracoesFn) {
    const selecao = window.selectedEvocacoes || [];
    if (selecao.length === 0 && tipoMetadado !== 'categoria') { 
        Swal.fire("Atenção", `Selecione pelo menos uma palavra para definir a ${tipoMetadado}.`, "warning");
        return;
    }

    // Se for categoria, redireciona para o modal específico
    if (tipoMetadado === 'categoria') {
        await abrirModalCategorias(logLocalChangeFn, salvarAlteracoesFn);
        return;
    }

    // --- LÓGICA DO POP-UP (Positividade) ---
    let swalOptions = {
        title: `Definir ${tipoMetadado}`,
        showCancelButton: true,
        confirmButtonText: 'Aplicar',
        cancelButtonText: 'Cancelar',
        customClass: {
            popup: 'swal2-radio-popup',
            htmlContainer: 'swal2-radio-container'
        }
    };

    if (tipoMetadado === 'positividade') {
        swalOptions.html = `
            <p style="margin-bottom: 1.5em;">Selecione a positividade para as <strong>${selecao.length}</strong> palavras:</p>
            <div class="swal-radio-group">
                <label>
                    <input type="radio" name="swal-radio" value="Positivo">
                    <span>Positivo</span>
                </label>
                <label>
                    <input type="radio" name="swal-radio" value="Negativo">
                    <span>Negativo</span>
                </label>
                <label>
                    <input type="radio" name="swal-radio" value="Neutro">
                    <span>Neutro</span>
                </label>
                <label style="color: #d33;">
                    <input type="radio" name="swal-radio" value="">
                    <span>(Limpar)</span>
                </label>
            </div>
        `;
        swalOptions.preConfirm = () => {
            const selected = document.querySelector('input[name="swal-radio"]:checked');
            // Permite retornar string vazia para limpar
            if (!selected) {
               return null; // Retorna null se nada foi clicado (apenas para cancelar)
            }
            return selected.value;
        };
    }
    
    // CSS temporário para o swal
    const style = document.createElement('style');
    style.innerHTML = `
        .swal-radio-group { display: flex; flex-direction: column; align-items: flex-start; gap: 10px; margin: 0 1.5em; }
        .swal-radio-group label { display: flex; align-items: center; cursor: pointer; font-size: 1.1em; }
        .swal-radio-group input { margin-right: 10px; width: 1.2em; height: 1.2em; accent-color: #0e6f66; }
    `;
    document.head.appendChild(style);

    const { value: valor } = await Swal.fire(swalOptions);
    
    document.head.removeChild(style);

    // Se valor for null ou undefined, usuário cancelou ou não escolheu nada.
    // Se for "" (string vazia), usuário escolheu limpar.
    if (valor === null || valor === undefined) return; 

    await aplicarMetadadoLote(tipoMetadado, valor, selecao, logLocalChangeFn);
}

/**
 * Abre o modal principal para ATRIBUIR ou GERENCIAR categorias.
 */
async function abrirModalCategorias(logLocalChangeFn, salvarAlteracoesFn) {
    const selecao = window.selectedEvocacoes || [];
    
    const user = getUserFromSession();
    const urlParams = new URLSearchParams(window.location.search);
    const planilhaNome = urlParams.get("planilha");
    if (!user || !planilhaNome) return;

    // --- NOVA LÓGICA DE UI UNIFICADA ---
    
    const { value: valorSelecionado } = await Swal.fire({
        title: 'Atribuir & Gerenciar Categorias',
        width: '600px',
        html: `
            <div id="swal-category-main-content" style="text-align: left;">
                ${selecao.length > 0 ? 
                    `<p style="margin-bottom: 10px;">Atribuir categoria para <strong>${selecao.length}</strong> palavras:</p>` : 
                    `<p style="margin-bottom: 10px; color: #666; font-style: italic;">Nenhuma palavra selecionada (apenas gerenciamento).</p>`
                }
                
                <div id="swal-radio-group-container" class="swal-radio-group">
                    <!-- Radio buttons serão carregados aqui -->
                    <p>Carregando categorias...</p>
                </div>
                
                <hr style="margin: 20px 0;">
                
                <details class="swal-manage-toggle">
                    <summary>Gerenciar Categorias</summary>
                    <div id="category-manager">
                        <div class="swal-category-creator">
                            <input type="text" id="swal-new-cat-name" class="swal2-input" placeholder="Nome da Nova Categoria">
                            <button id="swal-create-cat-btn" class="swal2-styled" style="margin-left: 10px; background-color: #28a745 !important;">Criar</button>
                        </div>
                        <p style="margin-top: 1em; margin-bottom: 0.5em;">Categorias existentes:</p>
                        <div id="swal-category-list-container">
                            <!-- Lista de gerenciamento será carregada aqui -->
                        </div>
                    </div>
                </details>
            </div>
        `,
        confirmButtonText: selecao.length > 0 ? 'Aplicar Seleção' : 'Fechar',
        showCancelButton: true,
        cancelButtonText: 'Cancelar',
        didOpen: async () => {
            const style = document.createElement('style');
            style.innerHTML = `
                .swal-radio-group { display: flex; flex-direction: column; align-items: flex-start; gap: 10px; margin: 0; max-height: 150px; overflow-y: auto; background: #f9f9f9; padding: 10px; border-radius: 5px; }
                .swal-radio-group label { display: flex; align-items: center; cursor: pointer; font-size: 1.1em; }
                .swal-radio-group input { margin-right: 10px; width: 1.2em; height: 1.2em; accent-color: #0e6f66; }
                
                .swal-manage-toggle { margin-top: 10px; border: 1px solid #ddd; border-radius: 5px; padding: 10px; }
                .swal-manage-toggle summary { font-weight: 500; cursor: pointer; }
                #category-manager { margin-top: 15px; }
                .swal-category-creator { display: flex; align-items: center; }
                #swal-new-cat-name { flex: 1; margin: 0 !important; }
                #swal-category-list-container { max-height: 150px; overflow-y: auto; background: #f9f9f9; padding: 10px; border-radius: 5px; margin-top: 10px; }
                .category-item { display: flex; justify-content: space-between; align-items: center; padding: 8px; border-bottom: 1px solid #eee; }
                .category-item:last-child { border-bottom: none; }
                .category-item-name { font-weight: 500; }
                .category-item-actions button { font-size: 12px; padding: 4px 8px; margin-left: 5px; }
            `;
            document.head.appendChild(style);

            const radioContainer = document.getElementById('swal-radio-group-container');
            const managerListContainer = document.getElementById('swal-category-list-container');
            const createBtn = document.getElementById('swal-create-cat-btn');
            const createInput = document.getElementById('swal-new-cat-name');
            
            // --- Função para ATUALIZAR AMBAS as listas (Radio e Manager) ---
            const atualizarListas = async () => {
                const categorias = await fetchCategorias(user, planilhaNome);
                
                // Atualiza lista de Rádios (Atribuição)
                if (categorias.length > 0) {
                    radioContainer.innerHTML = categorias.map(cat => `
                        <label>
                            <input type="radio" name="swal-radio-categoria" value="${cat}">
                            <span>${cat}</span>
                        </label>
                    `).join('') + `
                        <label style="color: #d33; margin-top: 5px; border-top: 1px dashed #ccc; padding-top: 5px; width: 100%;">
                            <input type="radio" name="swal-radio-categoria" value="">
                            <span>(Remover Categoria)</span>
                        </label>
                    `;
                } else {
                    radioContainer.innerHTML = `
                        <p style="color: #6c757d; margin: 5px;">Nenhuma categoria criada.</p>
                        <label style="color: #d33;">
                            <input type="radio" name="swal-radio-categoria" value="" checked>
                            <span>(Remover Categoria)</span>
                        </label>
                    `;
                }
                
                // Atualiza lista do Gerenciador (CRUD)
                if (categorias.length > 0) {
                    managerListContainer.innerHTML = categorias.map(cat => `
                        <div class="category-item">
                            <span class="category-item-name">${cat}</span>
                            <div class="category-item-actions">
                                <button class="swal2-styled swal2-default-outline edit-cat-btn" data-name="${cat}">Editar</button>
                                <button class="swal2-styled swal2-deny delete-cat-btn" data-name="${cat}">Excluir</button>
                            </div>
                        </div>
                    `).join('');
                } else {
                    managerListContainer.innerHTML = '<p style="text-align: center; color: #6c757d;">Nenhuma categoria criada.</p>';
                }
            };
            
            // Carrega as listas iniciais
            await atualizarListas();

            // --- Listeners do CRUD (não fecham o modal) ---
            
            // Listener para CRIAR
            createBtn.addEventListener('click', async () => {
                const newName = createInput.value.trim().toUpperCase();
                if (!newName) return;
                
                // Salva a nova categoria
                await logLocalChangeFn(planilhaNome, `categorias/${planilhaNome}/${newName}`, true, 'data');
                await salvarAlteracoesFn(); // Salva imediatamente
                
                createInput.value = '';
                await atualizarListas(); // Recarrega as listas
            });
            
            // Listeners para EDITAR e EXCLUIR
            managerListContainer.addEventListener('click', async (e) => {
                const target = e.target;
                const oldName = target.dataset.name;
                if (!oldName) return;

                if (target.classList.contains('edit-cat-btn')) {
                    const { value: newNameRaw } = await Swal.fire({
                        title: `Editar Categoria`,
                        input: 'text',
                        inputValue: oldName,
                        showCancelButton: true,
                        inputValidator: (v) => !v && "O nome não pode ser vazio!"
                    });
                    
                    const newName = newNameRaw ? newNameRaw.trim().toUpperCase() : null;
                    if (!newName || newName === oldName) return;
                    
                    Swal.showLoading();
                    const lemasKey = `lemas_${planilhaNome}`;
                    const lemasAtuais = await getItem(lemasKey) || {};
                    
                    // Atualiza a lista de categorias e todas as palavras que a usam
                    await logLocalChangeFn(planilhaNome, `categorias/${planilhaNome}/${newName}`, true, 'data');
                    await logLocalChangeFn(planilhaNome, `categorias/${planilhaNome}/${oldName}`, null, 'data');
                    
                    for (const [palavra, lema] of Object.entries(lemasAtuais)) {
                        if (lema.categoria === oldName) {
                            lema.categoria = newName;
                            await logLocalChangeFn(planilhaNome, `lematizacoes/${planilhaNome}/${palavra}`, lema, 'data');
                        }
                    }
                    
                    await setItem(lemasKey, lemasAtuais);
                    await salvarAlteracoesFn();
                    await atualizarListas();
                    Swal.close(); 
                
                } else if (target.classList.contains('delete-cat-btn')) {
                    const { isConfirmed } = await Swal.fire({
                        title: `Excluir "${oldName}"?`,
                        text: "Isso também removerá esta categoria de todas as palavras associadas.",
                        icon: 'warning',
                        showCancelButton: true,
                        confirmButtonColor: '#d33'
                    });
                    
                    if (isConfirmed) {
                        Swal.showLoading();
                        const lemasKey = `lemas_${planilhaNome}`;
                        const lemasAtuais = await getItem(lemasKey) || {};
                        
                        await logLocalChangeFn(planilhaNome, `categorias/${planilhaNome}/${oldName}`, null, 'data');
                        
                        for (const [palavra, lema] of Object.entries(lemasAtuais)) {
                            if (lema.categoria === oldName) {
                                lema.categoria = "";
                                await logLocalChangeFn(planilhaNome, `lematizacoes/${planilhaNome}/${palavra}`, lema, 'data');
                            }
                        }
                        
                        await setItem(lemasKey, lemasAtuais);
                        await salvarAlteracoesFn();
                        await atualizarListas();
                        Swal.close();
                    }
                }
            });
        },
        willClose: () => {
            const style = document.head.querySelector('style');
            if(style && style.innerHTML.includes('#swal-category-main-content')) {
                document.head.removeChild(style);
            }
        },
        preConfirm: () => {
            // Apenas retorna o valor do radio button selecionado
            const selected = document.querySelector('input[name="swal-radio-categoria"]:checked');
            return selected ? selected.value : undefined;
        }
    });

    // Se o usuário clicou em "Aplicar Seleção" (e não cancelou)
    if (valorSelecionado !== undefined) {
        await aplicarMetadadoLote('categoria', valorSelecionado, selecao, logLocalChangeFn);
    }
}


/**
 * Aplica a alteração em lote no IndexedDB e enfileira para o Firebase.
 */
async function aplicarMetadadoLote(campo, valor, palavras, logLocalChangeFn) {
    const urlParams = new URLSearchParams(window.location.search);
    const planilhaNome = urlParams.get("planilha");
    if (!planilhaNome) return;

    Swal.fire({ title: 'Salvando...', didOpen: () => Swal.showLoading(), allowOutsideClick: false });

    try {
        const lemasKey = `lemas_${planilhaNome}`;
        const storedDataKey = `planilha_${planilhaNome}`;
        
        let lemasAtuais = await getItem(lemasKey) || {};
        const storedData = await getItem(storedDataKey);

        // Identifica quais palavras ainda não têm entrada em 'lemas'
        // (Ou seja, são palavras puras que ainda não receberam metadados ou fusão)
        const palavrasNovas = palavras.filter(p => !lemasAtuais[p]);
        
        // Calcula contagens para essas palavras novas para preservar dados
        let contagens = {};
        if (palavrasNovas.length > 0) {
            contagens = await getWordCounts(palavrasNovas, storedData);
        }

        // --- CORREÇÃO DE RACE CONDITION ---
        // Executa os logs SEQUENCIALMENTE para garantir que a lista de pendências
        // seja lida e atualizada atomicamente a cada iteração.
        for (const p of palavras) {
            // Se não existe, cria a estrutura básica
            if (!lemasAtuais[p]) {
                const c = contagens[p] || { total: 0, ego: 0, alter: 0 };
                lemasAtuais[p] = {
                    total: c.total,
                    ego: c.ego,
                    alter: c.alter,
                    origem: [`${p} (${c.total})`], // Marca a própria origem
                    positividade: '',
                    categoria: ''
                };
            }

            // Atualiza o campo específico
            lemasAtuais[p][campo] = valor;

            // Loga a mudança para sincronização. AWAIT É ESSENCIAL AQUI.
            const path = `lematizacoes/${planilhaNome}/${p}`;
            await logLocalChangeFn(planilhaNome, path, lemasAtuais[p], 'data');
        }

        // Salva lemas locais atualizados
        await setItem(lemasKey, lemasAtuais);

        Swal.fire({
            icon: 'success',
            title: 'Salvo!',
            text: `${campo === 'categoria' ? 'Categorias' : 'Positividade'} atualizada para ${palavras.length} palavras.`,
            timer: 1500,
            showConfirmButton: false
        }).then(() => {
            location.reload(); // Recarrega para ver na tabela
        });

    } catch (err) {
        console.error("Erro ao aplicar lote:", err);
        Swal.fire("Erro", "Falha ao salvar dados.", "error");
    }
}