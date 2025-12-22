import { initializeApp } from "https://www.gstatic.com/firebasejs/9.9.3/firebase-app.js";
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/9.9.3/firebase-database.js";
import firebaseConfig from '/firebase.js';

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

const DB_NAME = 'agoraDB';
const STORE_NAME = 'planilhas';

// --- Funções Auxiliares de IndexedDB ---
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
            if (parsedData && parsedData.uid) return parsedData;
        } catch (e) {
            console.error("Erro ao parsear dados do usuário:", e);
        }
    }
    return null;
}

async function getWordCounts(palavrasList, storedData) {
    const contagens = {};
    palavrasList.forEach(p => { contagens[p] = { total: 0, ego: 0, alter: 0 }; });
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
                    if (/^EVOC[1-5]$/.test(coluna)) contagens[palavra].ego++;
                    else contagens[palavra].alter++;
                }
            }
        }
    }
    return contagens;
}

async function fetchCategorias(user, planilhaNome) {
    try {
        const categoriasRef = ref(database, `users/${user.uid}/categorias/${planilhaNome}`);
        const snapshot = await get(categoriasRef);
        if (snapshot.exists()) return Object.keys(snapshot.val());
    } catch (error) {
        console.warn("Erro ao buscar categorias do Firebase, tentando local...");
    }
    const pendingChanges = await getItem(`pending_changes_${planilhaNome}`) || [];
    const localCategorias = new Set();
    pendingChanges.forEach(change => {
        if (change.path.startsWith(`categorias/${planilhaNome}/`)) {
            const catName = change.path.split('/').pop();
            if (change.value !== null) localCategorias.add(catName);
            else localCategorias.delete(catName);
        }
    });
    return [...localCategorias];
}

// --- Funções Principais Exportadas ---

/**
 * Alerta exclusivo para definir a Positividade.
 */
export async function adicionarPositividade(logLocalChangeFn) {
    const selecao = window.selectedEvocacoes || [];
    if (selecao.length === 0) {
        Swal.fire({ icon: 'warning', title: 'Atenção', text: 'Selecione pelo menos uma palavra para definir a positividade.', confirmButtonColor: '#0e6f66' });
        return;
    }

    const { value: valor } = await Swal.fire({
        title: 'Definir Positividade',
        html: `
            <div class="swal-custom-container">
                <p style="margin-bottom: 15px;">Escolha o sentimento para as <strong>${selecao.length}</strong> palavras selecionadas:</p>
                <div class="positivity-grid">
                    <button class="pos-btn pos-green" data-val="Positivo">
                        <i class="fas fa-smile"></i> <span>Positivo</span>
                    </button>
                    <button class="pos-btn pos-red" data-val="Negativo">
                        <i class="fas fa-frown"></i> <span>Negativo</span>
                    </button>
                    <button class="pos-btn pos-gray" data-val="Neutro">
                        <i class="fas fa-meh"></i> <span>Neutro</span>
                    </button>
                    <button class="pos-btn pos-clear" data-val="">
                        <i class="fas fa-eraser"></i> <span>Limpar</span>
                    </button>
                </div>
            </div>
        `,
        showConfirmButton: false,
        showCancelButton: true,
        cancelButtonText: 'Cancelar',
        didOpen: () => {
            const btns = Swal.getHtmlContainer().querySelectorAll('.pos-btn');
            btns.forEach(btn => {
                btn.onclick = () => {
                    Swal.close({ isConfirmed: true, value: btn.dataset.val });
                };
            });
        }
    });

    if (valor !== undefined) {
        await aplicarMetadadoLote('positividade', valor, selecao, logLocalChangeFn);
    }
}

/**
 * Alerta exclusivo para Atribuir e Gerenciar Categorias.
 */
export async function adicionarCategoria(logLocalChangeFn, salvarAlteracoesFn) {
    const selecao = window.selectedEvocacoes || [];
    const user = getUserFromSession();
    const urlParams = new URLSearchParams(window.location.search);
    const planilhaNome = urlParams.get("planilha");
    if (!user || !planilhaNome) return;

    await Swal.fire({
        title: 'Atribuir Categoria',
        width: '600px',
        html: `
            <div class="swal-categorize-container">
                <div class="tabs-control">
                    <button class="tab-btn active" data-target="assign-tab">Escolher Categoria</button>
                    <button class="tab-btn" data-target="manage-tab">Gerenciar Lista</button>
                </div>

                <div id="assign-tab" class="tab-content active">
                    <p class="section-hint">${selecao.length > 0 ? `Selecione uma categoria para <b>${selecao.length}</b> palavras.` : 'Nenhuma palavra selecionada para atribuição.'}</p>
                    <div class="search-box">
                        <i class="fas fa-search"></i>
                        <input type="text" id="cat-search" placeholder="Filtrar categorias...">
                    </div>
                    <div id="cat-list-assign" class="modern-list"></div>
                    ${selecao.length > 0 ? '<button id="btn-apply-cat" class="apply-main-btn">Aplicar na Seleção</button>' : ''}
                </div>

                <div id="manage-tab" class="tab-content">
                    <div class="create-box" style="margin-top: 10px;">
                        <input type="text" id="new-cat-input" placeholder="Novo nome de categoria...">
                        <button id="btn-create-cat"><i class="fas fa-plus"></i> Criar</button>
                    </div>
                    <div id="cat-list-manage" class="modern-list"></div>
                </div>
            </div>
        `,
        showConfirmButton: false,
        showCancelButton: true,
        cancelButtonText: 'Fechar',
        didOpen: async () => {
            const assignList = document.getElementById('cat-list-assign');
            const manageList = document.getElementById('cat-list-manage');
            const searchInput = document.getElementById('cat-search');
            const createInput = document.getElementById('new-cat-input');
            const createBtn = document.getElementById('btn-create-cat');
            const applyCatBtn = document.getElementById('btn-apply-cat');

            // --- Lógica de Troca de Abas ---
            document.querySelectorAll('.tab-btn').forEach(btn => {
                btn.onclick = () => {
                    document.querySelectorAll('.tab-btn, .tab-content').forEach(el => el.classList.remove('active'));
                    btn.classList.add('active');
                    document.getElementById(btn.dataset.target).classList.add('active');
                };
            });

            const render = async () => {
                const categorias = await fetchCategorias(user, planilhaNome);
                const filter = (searchInput?.value || "").toUpperCase();
                
                // Lista de Atribuição
                if (assignList) {
                    const filtered = categorias.filter(c => c.includes(filter));
                    assignList.innerHTML = filtered.map(cat => `
                        <label class="list-item-radio">
                            <input type="radio" name="cat-radio" value="${cat}">
                            <div class="item-content">
                                <span class="name">${cat}</span>
                                <i class="fas fa-check-circle check-icon"></i>
                            </div>
                        </label>
                    `).join('') + `
                        <label class="list-item-radio clear-item">
                            <input type="radio" name="cat-radio" value="">
                            <div class="item-content">
                                <span class="name">Nenhuma (Limpar)</span>
                                <i class="fas fa-times-circle check-icon"></i>
                            </div>
                        </label>
                    `;
                }

                // Lista de Gerenciamento
                if (manageList) {
                    manageList.innerHTML = categorias.map(cat => `
                        <div class="list-item-manage">
                            <span class="name-text">${cat}</span>
                            <div class="actions">
                                <button class="edit-cat" data-name="${cat}"><i class="fas fa-edit"></i></button>
                                <button class="delete-cat" data-name="${cat}"><i class="fas fa-trash"></i></button>
                            </div>
                        </div>
                    `).join('') || '<p class="empty-msg">Nenhuma categoria cadastrada.</p>';
                }
            };

            await render();

            if (searchInput) searchInput.oninput = render;

            if (applyCatBtn) {
                applyCatBtn.onclick = async () => {
                    const selected = document.querySelector('input[name="cat-radio"]:checked');
                    if (!selected) return Swal.showValidationMessage('Selecione uma categoria da lista!');
                    await aplicarMetadadoLote('categoria', selected.value, selecao, logLocalChangeFn);
                };
            }

            if (createBtn) {
                createBtn.onclick = async () => {
                    const val = createInput.value.trim().toUpperCase();
                    if (!val) return;
                    createBtn.disabled = true;
                    await logLocalChangeFn(planilhaNome, `categorias/${planilhaNome}/${val}`, true, 'data');
                    await salvarAlteracoesFn();
                    createInput.value = '';
                    createBtn.disabled = false;
                    await render();
                };
            }

            if (manageList) {
                manageList.onclick = async (e) => {
                    const btn = e.target.closest('button');
                    if (!btn) return;
                    const name = btn.dataset.name;

                    if (btn.classList.contains('edit-cat')) {
                        const { value: newName } = await Swal.fire({
                            title: 'Renomear Categoria',
                            input: 'text',
                            inputValue: name,
                            showCancelButton: true,
                            inputValidator: v => !v && 'O nome não pode ser vazio'
                        });
                        if (newName && newName.toUpperCase() !== name) {
                            Swal.showLoading();
                            const val = newName.toUpperCase();
                            const lemasKey = `lemas_${planilhaNome}`;
                            const lemasAtuais = await getItem(lemasKey) || {};
                            await logLocalChangeFn(planilhaNome, `categorias/${planilhaNome}/${val}`, true, 'data');
                            await logLocalChangeFn(planilhaNome, `categorias/${planilhaNome}/${name}`, null, 'data');
                            for (const [p, l] of Object.entries(lemasAtuais)) {
                                if (l.categoria === name) {
                                    l.categoria = val;
                                    await logLocalChangeFn(planilhaNome, `lematizacoes/${planilhaNome}/${p}`, l, 'data');
                                }
                            }
                            await setItem(lemasKey, lemasAtuais);
                            await salvarAlteracoesFn();
                            await render();
                            Swal.hideLoading();
                        }
                    } else if (btn.classList.contains('delete-cat')) {
                        const confirm = await Swal.fire({ title: 'Excluir?', text: `Remover "${name}" permanentemente?`, icon: 'warning', showCancelButton: true });
                        if (confirm.isConfirmed) {
                            Swal.showLoading();
                            const lemasKey = `lemas_${planilhaNome}`;
                            const lemasAtuais = await getItem(lemasKey) || {};
                            await logLocalChangeFn(planilhaNome, `categorias/${planilhaNome}/${name}`, null, 'data');
                            for (const [p, l] of Object.entries(lemasAtuais)) {
                                if (l.categoria === name) {
                                    l.categoria = "";
                                    await logLocalChangeFn(planilhaNome, `lematizacoes/${planilhaNome}/${p}`, l, 'data');
                                }
                            }
                            await setItem(lemasKey, lemasAtuais);
                            await salvarAlteracoesFn();
                            await render();
                            Swal.hideLoading();
                        }
                    }
                };
            }
        }
    });
}

async function aplicarMetadadoLote(campo, valor, palavras, logLocalChangeFn) {
    const urlParams = new URLSearchParams(window.location.search);
    const planilhaNome = urlParams.get("planilha");
    if (!planilhaNome) return;

    Swal.fire({ title: 'Salvando...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {
        const lemasKey = `lemas_${planilhaNome}`;
        const storedDataKey = `planilha_${planilhaNome}`;
        let lemasAtuais = await getItem(lemasKey) || {};
        const storedData = await getItem(storedDataKey);

        const palavrasNovas = palavras.filter(p => !lemasAtuais[p]);
        let contagens = palavrasNovas.length > 0 ? await getWordCounts(palavrasNovas, storedData) : {};

        for (const p of palavras) {
            if (!lemasAtuais[p]) {
                const c = contagens[p] || { total: 0, ego: 0, alter: 0 };
                lemasAtuais[p] = { total: c.total, ego: c.ego, alter: c.alter, origem: [`${p} (${c.total})`], positividade: '', categoria: '' };
            }
            lemasAtuais[p][campo] = valor;
            await logLocalChangeFn(planilhaNome, `lematizacoes/${planilhaNome}/${p}`, lemasAtuais[p], 'data');
        }

        await setItem(lemasKey, lemasAtuais);
        Swal.fire({ icon: 'success', title: 'Sucesso!', text: 'Alterações aplicadas.', timer: 1200, showConfirmButton: false })
            .then(() => location.reload());
    } catch (err) {
        console.error(err);
        Swal.fire("Erro", "Falha ao salvar metadados.", "error");
    }
}

// Estilos Compartilhados
const style = document.createElement('style');
style.innerHTML = `
    .swal-categorize-container { text-align: left; font-family: 'Inter', sans-serif; }
    .section-hint { font-size: 13px; color: #777; margin-bottom: 15px; background: #fdf8e4; padding: 10px; border-left: 4px solid #ffc107; border-radius: 4px; }
    
    /* Grid de Positividade */
    .positivity-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-top: 10px; }
    .pos-btn { display: flex; align-items: center; gap: 10px; padding: 15px; border-radius: 12px; border: 1.5px solid #eee; background: white; cursor: pointer; transition: 0.2s; }
    .pos-btn i { font-size: 20px; }
    .pos-btn span { font-weight: 600; font-size: 14px; }
    .pos-btn:hover { border-color: #0e6f66; background: #f0f7f6; transform: translateY(-2px); box-shadow: 0 4px 10px rgba(0,0,0,0.05); }
    .pos-green { color: #2e7d32; } .pos-red { color: #d32f2f; } .pos-gray { color: #616161; }
    .pos-clear { color: #9e9e9e; border-style: dashed; }

    /* Abas de Categoria */
    .tabs-control { display: flex; background: #f4f4f4; padding: 4px; border-radius: 8px; margin-bottom: 20px; }
    .tab-btn { flex: 1; padding: 10px; border: none; border-radius: 6px; background: none; cursor: pointer; font-size: 14px; font-weight: 600; color: #666; transition: 0.2s; }
    .tab-btn.active { background: white; color: #0e6f66; box-shadow: 0 2px 4px rgba(0,0,0,0.08); }
    
    .tab-content { display: none; }
    .tab-content.active { display: block; }

    .search-box, .create-box { display: flex; align-items: center; background: #f9f9f9; border: 1px solid #ddd; border-radius: 8px; padding: 0 10px; margin-bottom: 15px; }
    .search-box i { color: #aaa; }
    .search-box input, .create-box input { border: none; background: none; padding: 12px; width: 100%; outline: none; font-size: 14px; }
    .create-box button { background: #0e6f66; color: white; border: none; padding: 8px 15px; border-radius: 6px; cursor: pointer; white-space: nowrap; font-weight: 600; }

    .modern-list { max-height: 200px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; padding-right: 5px; margin-bottom: 15px; }
    .list-item-radio { cursor: pointer; display: block; }
    .list-item-radio input { display: none; }
    .item-content { display: flex; justify-content: space-between; align-items: center; padding: 12px 15px; background: #fff; border: 1px solid #eee; border-radius: 10px; transition: 0.2s; }
    .list-item-radio:hover .item-content { border-color: #0e6f66; }
    .list-item-radio input:checked + .item-content { border-color: #0e6f66; background: #e0f2f1; }
    .check-icon { color: #0e6f66; opacity: 0; transition: 0.2s; }
    .list-item-radio input:checked + .item-content .check-icon { opacity: 1; }
    
    .list-item-manage { display: flex; justify-content: space-between; align-items: center; padding: 10px 15px; background: #fff; border: 1px solid #eee; border-radius: 10px; margin-bottom: 6px; }
    .list-item-manage .name-text { font-size: 14px; font-weight: 500; }
    .list-item-manage .actions { display: flex; gap: 8px; }
    .list-item-manage button { background: none; border: none; cursor: pointer; padding: 8px; border-radius: 5px; transition: 0.2s; }
    .edit-cat { color: #1976d2; } .edit-cat:hover { background: #e3f2fd; }
    .delete-cat { color: #d32f2f; } .delete-cat:hover { background: #ffebee; }

    .apply-main-btn { width: 100%; background: #0e6f66; color: white; border: none; padding: 14px; border-radius: 12px; font-weight: 700; cursor: pointer; transition: 0.2s; font-size: 15px; }
    .apply-main-btn:hover { background: #0a5a54; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(14, 111, 102, 0.2); }
    .empty-msg { text-align: center; color: #999; font-size: 13px; margin: 30px 0; font-style: italic; }
`;
document.head.appendChild(style);