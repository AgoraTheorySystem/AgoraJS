// menuLateral_evocacoes.js

import { getDatabase, ref, get, set, update, push } from "https://www.gstatic.com/firebasejs/9.9.3/firebase-database.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.9.3/firebase-app.js";
import firebaseConfig from '/firebase.js';

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

const DB_NAME = 'agoraDB';
const STORE_NAME = 'planilhas';

let hasUnsavedChanges = false;

// --- Funções do IndexedDB ---
async function openDB() {
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

async function deleteItem(key) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const request = transaction.objectStore(STORE_NAME).delete(key);
        transaction.oncomplete = () => resolve();
        transaction.onerror = event => reject(event.target.error);
    });
}

// --- Funções de Utilidade e Controle de UI ---
function getUserFromSession() {
  const userData = sessionStorage.getItem('user');
  return userData ? JSON.parse(userData) : null;
}

function setUnsavedChanges(status) {
    hasUnsavedChanges = status;
    const elements = {
        botaoSalvar: document.getElementById('botao-salvar'),
        popup: document.getElementById('popup-salvar'),
        seta: document.getElementById('seta-salvar')
    };
    if (!elements.botaoSalvar || !elements.popup || !elements.seta) return;
    
    if (status) {
        elements.botaoSalvar.classList.add('salvar-pendente');
        elements.botaoSalvar.classList.remove('sem-alteracoes');
        elements.popup.classList.add('show');
        elements.seta.classList.add('show');
    } else {
        elements.botaoSalvar.classList.remove('salvar-pendente');
        elements.botaoSalvar.classList.add('sem-alteracoes');
        elements.popup.classList.remove('show');
        elements.seta.classList.remove('show');
    }
}

// --- Lógica de Modificação e Sincronização ---

/**
 * Salva as alterações pendentes no Firebase.
 */
async function salvarAlteracoes() {
    if (!hasUnsavedChanges) {
        Swal.fire(await window.getTranslation('swal_warning_title'), await window.getTranslation('swal_no_pending_changes'), "info");
        return;
    }
    const urlParams = new URLSearchParams(window.location.search);
    const planilhaNome = urlParams.get("planilha");
    const user = getUserFromSession();
    if (!planilhaNome || !user) return;

    Swal.fire({ 
        title: await window.getTranslation('swal_saving_title'), 
        text: await window.getTranslation('swal_saving_text'), 
        didOpen: () => Swal.showLoading() 
    });

    try {
        const pendingChanges = await getItem(`pending_changes_${planilhaNome}`) || [];
        if (pendingChanges.length === 0) {
            Swal.fire(await window.getTranslation('swal_warning_title'), await window.getTranslation('swal_no_pending_changes_found'), "info");
            setUnsavedChanges(false);
            return;
        }

        const updatesForFirebase = {};
        const historyChangesForPush = {};

        pendingChanges.forEach(change => {
            updatesForFirebase[change.path] = change.value;
            const historyPathKey = change.path.replace(/\//g, '___');
            historyChangesForPush[historyPathKey] = change.value;
        });

        await update(ref(database, `users/${user.uid}`), updatesForFirebase);

        const timestamp = Date.now();
        const historyRef = ref(database, `users/${user.uid}/historico_alteracoes/${planilhaNome}`);
        await push(historyRef, { timestamp, changes: historyChangesForPush });

        const timestampRef = ref(database, `users/${user.uid}/UltimasAlteracoes/${planilhaNome}`);
        await set(timestampRef, { [timestamp]: timestamp });

        await deleteItem(`pending_changes_${planilhaNome}`);
        await setItem(`timestamp_local_change_${planilhaNome}`, timestamp);

        setUnsavedChanges(false);
        Swal.fire(await window.getTranslation('swal_success_title'), await window.getTranslation('swal_save_success_text'), "success");

    } catch (error) {
        console.error("Erro ao salvar alterações no Firebase:", error);
        Swal.fire(await window.getTranslation('swal_error_title'), await window.getTranslation('swal_save_error_text'), "error");
    }
}


/**
 * Registra uma alteração para ser enviada posteriormente.
 */
async function logLocalChange(planilhaNome, path, value) {
    const changes = await getItem(`pending_changes_${planilhaNome}`) || [];
    const existingIndex = changes.findIndex(c => c.path === path);
    if (existingIndex > -1) {
        changes[existingIndex].value = value;
    } else {
        changes.push({ path, value });
    }
    await setItem(`pending_changes_${planilhaNome}`, changes);
    setUnsavedChanges(true);
}

// --- Funções de Ação do Usuário (Remover, Fundir) ---

async function removerPalavrasSelecionadas() {
    const palavrasParaRemover = window.selectedEvocacoes || [];
    if (palavrasParaRemover.length === 0) {
        Swal.fire(await window.getTranslation('swal_attention_title'), await window.getTranslation('swal_select_word_to_remove_text'), "warning");
        return;
    }
    const urlParams = new URLSearchParams(window.location.search);
    const planilhaNome = urlParams.get("planilha");
    if (!planilhaNome) return;
    const user = getUserFromSession();
    const CHUNK_SIZE = 500;

    Swal.fire({ 
        title: await window.getTranslation('swal_processing_title'), 
        text: await window.getTranslation('swal_removing_words_text'), 
        didOpen: () => Swal.showLoading() 
    });

    try {
        const storedData = await getItem(`planilha_${planilhaNome}`);
        if (!storedData) throw new Error("Planilha não encontrada.");

        let hasChanges = false;
        const logPromises = [];

        const updatedData = storedData.map((row, rowIndex) => {
            return row.map((cell, cellIndex) => {
                const valor = String(cell || "").trim().toUpperCase();
                if (palavrasParaRemover.includes(valor)) {
                    hasChanges = true;
                    const chunkIndex = Math.floor(rowIndex / CHUNK_SIZE);
                    const rowIndexInChunk = rowIndex % CHUNK_SIZE;
                    const path = `planilhas/${planilhaNome}/chunk_${chunkIndex}/${rowIndexInChunk}/${cellIndex}`;
                    logPromises.push(logLocalChange(planilhaNome, path, "VAZIO"));
                    return "VAZIO";
                }
                return cell;
            });
        });

        if (!hasChanges) {
            Swal.fire(await window.getTranslation('swal_warning_title'), await window.getTranslation('swal_no_words_found_to_remove'), "info");
            return;
        }
        
        await Promise.all(logPromises);
        await setItem(`planilha_${planilhaNome}`, updatedData);
        
        Swal.fire({
            title: await window.getTranslation('swal_removed_title'), 
            text: await window.getTranslation('swal_words_removed_text'),
            icon: 'success', 
            confirmButtonText: await window.getTranslation('swal_understood_button')
        }).then(() => location.reload());

    } catch (error) {
        console.error("Erro ao remover palavras:", error);
        Swal.fire(await window.getTranslation('swal_error_title'), await window.getTranslation('swal_remove_error_text'), "error");
    }
}

async function fundirPalavrasSelecionadas() {
  const palavrasSelecionadas = window.selectedEvocacoes || [];
  if (palavrasSelecionadas.length < 2) {
    Swal.fire(await window.getTranslation('swal_attention_title'), await window.getTranslation('swal_select_words_to_merge_text'), "warning");
    return;
  }
  
  // CORREÇÃO: Busca as traduções ANTES de chamar o Swal.fire
  const title = await window.getTranslation('swal_merge_words_title');
  const inputLabel = await window.getTranslation('swal_merge_input_label');
  const inputPlaceholder = await window.getTranslation('swal_merge_input_placeholder');
  const validationMessage = await window.getTranslation('swal_validation_name_required');

  const { value: novoNomeRaw } = await Swal.fire({
      title: title,
      input: 'text',
      inputLabel: inputLabel,
      inputPlaceholder: inputPlaceholder,
      showCancelButton: true,
      inputValidator: (value) => {
        if (!value) {
            return validationMessage;
        }
      }
  });

  if (!novoNomeRaw) return;
  const novoNome = novoNomeRaw.trim().toUpperCase();
  const urlParams = new URLSearchParams(window.location.search);
  const planilhaNome = urlParams.get("planilha");
  const user = getUserFromSession();
  if (!planilhaNome || !user) return;
  const CHUNK_SIZE = 500;

  Swal.fire({ 
      title: await window.getTranslation('swal_processing_title'), 
      text: await window.getTranslation('swal_merging_words_text'), 
      didOpen: () => Swal.showLoading() 
    });

  try {
    const storedData = await getItem(`planilha_${planilhaNome}`);
    if (!storedData) throw new Error("Planilha não encontrada.");

    let hasChanges = false;
    const counts = {};
    palavrasSelecionadas.forEach(p => counts[p] = 0);
    const logPromises = [];

    const updatedData = storedData.map((row, rowIndex) => {
      return row.map((cell, cellIndex) => {
        const valor = String(cell || "").trim().toUpperCase();
        if (palavrasSelecionadas.includes(valor)) {
            hasChanges = true;
            counts[valor]++;
            const chunkIndex = Math.floor(rowIndex / CHUNK_SIZE);
            const rowIndexInChunk = rowIndex % CHUNK_SIZE;
            const path = `planilhas/${planilhaNome}/chunk_${chunkIndex}/${rowIndexInChunk}/${cellIndex}`;
            logPromises.push(logLocalChange(planilhaNome, path, novoNome));
            return novoNome;
        }
        return cell;
      });
    });

    if (!hasChanges) {
        Swal.fire(await window.getTranslation('swal_warning_title'), await window.getTranslation('swal_no_words_found_to_merge'), "info");
        return;
    }

    const lemasAtuais = await getItem(`lemas_${planilhaNome}`) || {};
    const novoLemaValor = palavrasSelecionadas.map(p => `${p} (${counts[p] || 0})`);
    lemasAtuais[novoNome] = novoLemaValor;

    const lemaPath = `lematizacoes/${planilhaNome}/${novoNome}`;
    logPromises.push(logLocalChange(planilhaNome, lemaPath, novoLemaValor));
    
    await Promise.all(logPromises);
    await setItem(`planilha_${planilhaNome}`, updatedData);
    await setItem(`lemas_${planilhaNome}`, lemasAtuais);
    
    Swal.fire({
        title: await window.getTranslation('swal_merged_title'), 
        text: await window.getTranslation('swal_words_merged_text'),
        icon: 'success', 
        confirmButtonText: await window.getTranslation('swal_understood_button')
    }).then(() => location.reload());

  } catch (error) {
    console.error("Erro ao fundir palavras:", error);
    Swal.fire(await window.getTranslation('swal_error_title'), await window.getTranslation('swal_merge_error_text'), "error");
  }
}

// --- Construção do Menu e Event Listeners ---
async function criarMenuLateral() {
  const menu = document.createElement("div");
  menu.classList.add("menu-lateral");
  const makeBtn = (label, iconClass, onClick) => {
    const btn = document.createElement("button");
    btn.type = "button"; btn.className = "menu-botao";
    const circle = document.createElement("div"); circle.className = "icone-circulo";
    const icon = document.createElement("i"); icon.className = iconClass;
    circle.appendChild(icon);
    const text = document.createElement("span"); text.textContent = label;
    btn.appendChild(circle); btn.appendChild(text); btn.onclick = onClick;
    return btn;
  };

  const botaoSalvar = makeBtn(await window.getTranslation('menu_save'), "fa-solid fa-cloud-arrow-up", salvarAlteracoes);
  botaoSalvar.id = 'botao-salvar';
  const botaoRemover = makeBtn(await window.getTranslation('menu_remove'), "fas fa-trash", removerPalavrasSelecionadas);
  const botaoFundir  = makeBtn(await window.getTranslation('menu_merge'),  "fas fa-compress", fundirPalavrasSelecionadas);
  const botaoFusoes  = makeBtn(await window.getTranslation('menu_show_merges'),  "fas fa-random", () => {
    window.filtroFusoes = true;
    window.dispatchEvent(new CustomEvent("atualizarTabelaEvocacoes"));
  });
  const botaoExibir  = makeBtn(await window.getTranslation('menu_show_all'), "fas fa-eye", () => {
    window.filtroFusoes = false;
    window.dispatchEvent(new CustomEvent("atualizarTabelaEvocacoes"));
  });

  menu.appendChild(botaoSalvar);
  menu.appendChild(botaoRemover);
  menu.appendChild(botaoFundir);
  menu.appendChild(botaoFusoes);
  menu.appendChild(botaoExibir);
  
  document.body.appendChild(menu);
  setTimeout(() => setUnsavedChanges(false), 100);
}

async function checarAlteracoesPendentes(planilhaNome) {
    const changes = await getItem(`pending_changes_${planilhaNome}`);
    if (changes && changes.length > 0) {
        setUnsavedChanges(true);
    }
}

window.addEventListener("DOMContentLoaded", () => {
  criarMenuLateral();
  const urlParams = new URLSearchParams(window.location.search);
  const planilhaNome = urlParams.get("planilha");

  // Escuta o evento de 'atualizacao.js' para checar as alterações locais
  window.addEventListener('checarAlteracoesLocais', () => {
      if(planilhaNome) checarAlteracoesPendentes(planilhaNome);
  });
});

