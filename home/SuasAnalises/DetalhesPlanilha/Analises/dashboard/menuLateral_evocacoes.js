// menuLateral_evocacoes.js

import { getDatabase, ref, get, set, update, push } from "https://www.gstatic.com/firebasejs/9.9.3/firebase-database.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.9.3/firebase-app.js";
import firebaseConfig from '/firebase.js';
import { adicionarPositividade, adicionarCategoria } from './categorias.js';

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


function setUnsavedChanges(status) {
    hasUnsavedChanges = status;
    
    const botaoSalvarDesktop = document.getElementById('botao-salvar-desktop');
    const botaoSalvarMobile = document.getElementById('botao-salvar-mobile');
    
    const elements = {
        popup: document.getElementById('popup-salvar'),
        seta: document.getElementById('seta-salvar')
    };

    if (status) {
        if(botaoSalvarDesktop) botaoSalvarDesktop.classList.add('salvar-pendente');
        if(botaoSalvarMobile) botaoSalvarMobile.classList.add('salvar-pendente');
        
        if(elements.popup) elements.popup.classList.add('show');
        if(elements.seta) elements.seta.classList.add('show');
    } else {
        if(botaoSalvarDesktop) botaoSalvarDesktop.classList.remove('salvar-pendente');
        if(botaoSalvarMobile) botaoSalvarMobile.classList.remove('salvar-pendente');

        if(elements.popup) elements.popup.classList.remove('show');
        if(elements.seta) elements.seta.classList.remove('show');
    }
}

async function salvarAlteracoes() {
    const warningTitle = await window.getTranslation('swal_warning_title');
    const noPendingChangesMsg = await window.getTranslation('swal_no_pending_changes');
    const noPendingChangesFoundMsg = await window.getTranslation('swal_no_pending_changes_found');
    const savingTitle = await window.getTranslation('swal_saving_title');
    const savingText = await window.getTranslation('swal_saving_text');
    const successTitle = await window.getTranslation('swal_success_title');
    const saveSuccessMsg = await window.getTranslation('swal_save_success_text');
    const errorTitle = await window.getTranslation('swal_error_title');
    const saveErrorMsg = await window.getTranslation('swal_save_error_text');


    if (!hasUnsavedChanges) {
        Swal.fire(warningTitle, noPendingChangesMsg, "info");
        return;
    }
    const urlParams = new URLSearchParams(window.location.search);
    const planilhaNome = urlParams.get("planilha");
    const user = getUserFromSession();
    if (!planilhaNome || !user || !user.uid) {
        Swal.fire(errorTitle, "Não foi possível identificar a análise ou o usuário.", "error");
        return;
    }


    Swal.fire({ title: savingTitle, text: savingText, didOpen: () => Swal.showLoading(), allowOutsideClick: false });

    try {
        const pendingChanges = await getItem(`pending_changes_${planilhaNome}`) || [];
        if (pendingChanges.length === 0) {
            Swal.fire(warningTitle, noPendingChangesFoundMsg, "info");
            setUnsavedChanges(false);
            return;
        }

        const allUpdatesInOne = {};
        const historyChangesForPush = {}; 
        const timestamp = Date.now();
        const uid = user.uid;

        pendingChanges.forEach(change => {
            if (change.type === 'data' && 
               (change.path.startsWith(`lematizacoes/${planilhaNome}/`) || change.path.startsWith(`categorias/${planilhaNome}/`))
            ) {
                 allUpdatesInOne[`users/${uid}/${change.path}`] = change.value; 
            }
            
             const historyPathKey = change.path.replace(/\//g, '___');
             historyChangesForPush[historyPathKey] = { value: change.value, type: change.type };
        });

        const historyRef = ref(database, `users/${uid}/historico_alteracoes/${planilhaNome}`);
        const newHistoryKey = push(historyRef).key;

        allUpdatesInOne[`users/${uid}/historico_alteracoes/${planilhaNome}/${newHistoryKey}`] = { 
            timestamp: timestamp, 
            changes: historyChangesForPush 
        };

        allUpdatesInOne[`users/${uid}/UltimasAlteracoes/${planilhaNome}`] = { 
            [timestamp]: timestamp 
        };

        await update(ref(database), allUpdatesInOne);

        await deleteItem(`pending_changes_${planilhaNome}`);
        await setItem(`timestamp_local_change_${planilhaNome}`, timestamp);

        setUnsavedChanges(false);
        Swal.fire(successTitle, saveSuccessMsg, "success");

    } catch (error) {
        console.error("Erro detalhado ao salvar alterações no Firebase:", error);
        Swal.fire(errorTitle, saveErrorMsg, "error");
    }
}


async function logLocalChange(planilhaNome, path, value, type = 'data') {
    if (!planilhaNome || !path) return;
    try {
        const changesKey = `pending_changes_${planilhaNome}`;
        const changes = await getItem(changesKey) || [];
        const existingIndex = changes.findIndex(c => c.path === path);
        const newChange = { path, value, type, timestamp: Date.now() };

        if (existingIndex > -1) {
            changes[existingIndex] = newChange;
        } else {
            changes.push(newChange);
        }

        await setItem(changesKey, changes);
        setUnsavedChanges(true);
    } catch (error) {
        console.error("Erro ao logar alteração local no IndexedDB:", error);
    }
}


async function removerPalavrasSelecionadas() {
    const attentionTitle = await window.getTranslation('swal_attention_title');
    const selectWordMsg = await window.getTranslation('swal_select_word_to_remove_text');
    const processingTitle = await window.getTranslation('swal_processing_title');
    const removingText = await window.getTranslation('swal_removing_words_text');
    const warningTitle = await window.getTranslation('swal_warning_title');
    const noWordsFoundMsg = await window.getTranslation('swal_no_words_found_to_remove');
    const removedTitle = await window.getTranslation('swal_removed_title');
    const wordsRemovedMsg = await window.getTranslation('swal_words_removed_text');
    const understoodBtn = await window.getTranslation('swal_understood_button');
    const errorTitle = await window.getTranslation('swal_error_title');
    const removeErrorMsg = await window.getTranslation('swal_remove_error_text');

    const selecaoInicial = window.selectedEvocacoes || [];
    if (selecaoInicial.length === 0) {
        Swal.fire(attentionTitle, selectWordMsg, "warning");
        return;
    }
    const urlParams = new URLSearchParams(window.location.search);
    const planilhaNome = urlParams.get("planilha");
    if (!planilhaNome) return;

    Swal.fire({ title: processingTitle, text: removingText, didOpen: () => Swal.showLoading(), allowOutsideClick: false });

    try {
        const storedDataKey = `planilha_${planilhaNome}`;
        const storedData = await getItem(storedDataKey);
        const lemasKey = `lemas_${planilhaNome}`;
        const lemasAtuais = await getItem(lemasKey) || {};

        const todasPalavrasParaRemover = new Set(selecaoInicial);
        const filaParaProcessar = [...selecaoInicial]; 

        while (filaParaProcessar.length > 0) {
            const palavra = filaParaProcessar.shift();
            if (lemasAtuais.hasOwnProperty(palavra)) {
                const lema = lemasAtuais[palavra];
                if (lema && lema.origem && Array.isArray(lema.origem)) {
                    lema.origem.forEach(palavraOriginalComContagem => {
                        const nomeOriginal = palavraOriginalComContagem.split(' (')[0].trim().toUpperCase();
                        if (nomeOriginal && !todasPalavrasParaRemover.has(nomeOriginal)) {
                            todasPalavrasParaRemover.add(nomeOriginal);
                            filaParaProcessar.push(nomeOriginal);
                        }
                    });
                }
                delete lemasAtuais[palavra];
                const lemaPath = `lematizacoes/${planilhaNome}/${palavra}`;
                await logLocalChange(planilhaNome, lemaPath, null, 'data');
            }
        }

        const listaFinalParaRemover = [...todasPalavrasParaRemover];
        let hasChanges = false;

        const updatedData = storedData.map((row, rowIndex) => {
            if (rowIndex === 0 || !Array.isArray(row)) return row;
            return row.map(cell => {
                const valor = String(cell || "").trim().toUpperCase();
                if (listaFinalParaRemover.includes(valor)) {
                    hasChanges = true;
                    return "VAZIO";
                }
                return cell;
            });
        });

        if (!hasChanges) {
            Swal.close();
            Swal.fire(warningTitle, noWordsFoundMsg, "info");
            return;
        }

        const remocaoPath = `remocoes/${planilhaNome}/${crypto.randomUUID()}`;
        await logLocalChange(planilhaNome, remocaoPath, listaFinalParaRemover, 'action');

        await setItem(storedDataKey, updatedData);
        await setItem(lemasKey, lemasAtuais);

        window.selectedEvocacoes = [];

        Swal.fire({
            title: removedTitle, text: wordsRemovedMsg,
            icon: 'success', confirmButtonText: understoodBtn
        }).then(() => location.reload());

    } catch (error) {
        Swal.fire(errorTitle, `${removeErrorMsg} Detalhes: ${error.message}`, "error");
    } finally {
         if (Swal.isLoading()) Swal.close();
    }
}


async function fundirPalavrasSelecionadas() {
    const attentionTitle = await window.getTranslation('swal_attention_title');
    const selectWordsMsg = await window.getTranslation('swal_select_words_to_merge_text');
    const mergeTitle = await window.getTranslation('swal_merge_words_title');
    const inputLabel = await window.getTranslation('swal_merge_input_label');
    const inputPlaceholder = await window.getTranslation('swal_merge_input_placeholder');
    const validationMsg = await window.getTranslation('swal_validation_name_required');
    const processingTitle = await window.getTranslation('swal_processing_title');
    const mergingText = await window.getTranslation('swal_merging_words_text');
    const warningTitle = await window.getTranslation('swal_warning_title');
    const noWordsFoundMsg = await window.getTranslation('swal_no_words_found_to_merge');
    const mergedTitle = await window.getTranslation('swal_merged_title');
    const wordsMergedMsg = await window.getTranslation('swal_words_merged_text');
    const understoodBtn = await window.getTranslation('swal_understood_button');
    const errorTitle = await window.getTranslation('swal_error_title');
    const mergeErrorMsg = await window.getTranslation('swal_merge_error_text');


  const palavrasSelecionadas = window.selectedEvocacoes || [];
  if (palavrasSelecionadas.length < 2) {
    Swal.fire(attentionTitle, selectWordsMsg, "warning");
    return;
  }

  const { value: novoNomeRaw } = await Swal.fire({
      title: mergeTitle, input: 'text', inputLabel: inputLabel,
      inputPlaceholder: inputPlaceholder, showCancelButton: true,
      inputValidator: (value) => !value && validationMsg
  });

   if (!novoNomeRaw) return;
   const novoNome = novoNomeRaw.trim().toUpperCase();

  const urlParams = new URLSearchParams(window.location.search);
  const planilhaNome = urlParams.get("planilha");
  if (!planilhaNome) return;

  Swal.fire({ title: processingTitle, text: mergingText, didOpen: () => Swal.showLoading(), allowOutsideClick: false });

  try {
    const storedDataKey = `planilha_${planilhaNome}`;
    const storedData = await getItem(storedDataKey);
    let hasChanges = false;
    const logPromises = [];
    const lemasKey = `lemas_${planilhaNome}`;
    const lemasAtuais = await getItem(lemasKey) || {};

    const header = storedData[0];
    const rows = storedData.slice(1);
    const contagensOriginais = {};
    palavrasSelecionadas.forEach(p => {
        contagensOriginais[p] = { total: 0, ego: 0, alter: 0, positividade: '', categoria: '' };
    });

    for (const row of rows) {
        if (!Array.isArray(row)) continue;
        for (let j = 0; j < header.length; j++) {
            const coluna = String(header[j] || "").toUpperCase();
            if (/^EVOC[1-9]$|^EVOC10$/.test(coluna)) {
                const palavra = String(row[j] || "").trim().toUpperCase();
                if (palavrasSelecionadas.includes(palavra)) {
                    contagensOriginais[palavra].total++;
                    if (/^EVOC[1-5]$/.test(coluna)) contagensOriginais[palavra].ego++;
                    else contagensOriginais[palavra].alter++;
                }
            }
        }
    }
    
    const newCounts = { total: 0, ego: 0, alter: 0 };
    const listaOrigensFinal = [];

    palavrasSelecionadas.forEach(p => {
        let contagem = contagensOriginais[p]; 
        if (lemasAtuais[p] && lemasAtuais[p].total !== undefined) {
            contagem.total = lemasAtuais[p].total;
            contagem.ego = lemasAtuais[p].ego;
            contagem.alter = lemasAtuais[p].alter;
            contagem.positividade = lemasAtuais[p].positividade || '';
            contagem.categoria = lemasAtuais[p].categoria || '';
            
            // Melhoria: Se já tinha composição, herda as origens antigas (achatamento)
            if (lemasAtuais[p].origem && Array.isArray(lemasAtuais[p].origem)) {
                listaOrigensFinal.push(...lemasAtuais[p].origem);
            } else {
                listaOrigensFinal.push(`${p} (${contagem.total})`);
            }
        } else {
            listaOrigensFinal.push(`${p} (${contagem.total})`);
        }
        newCounts.total += contagem.total;
        newCounts.ego += contagem.ego;
        newCounts.alter += contagem.alter;
    });

    const updatedData = storedData.map((row, rowIndex) => {
        if (rowIndex === 0 || !Array.isArray(row)) return row;
        return row.map(cell => {
            const valor = String(cell || "").trim().toUpperCase();
            if (palavrasSelecionadas.includes(valor)) {
                hasChanges = true;
                return novoNome;
            }
            return cell;
        });
    });

    if (!hasChanges) {
         Swal.close();
         Swal.fire(warningTitle, noWordsFoundMsg, "info");
         return;
    }

    const fusaoPath = `fusao_evocacao/${planilhaNome}/${crypto.randomUUID()}`;
    const fusaoValue = { novoNome: novoNome, palavrasOrigem: [...palavrasSelecionadas] };
    logPromises.push(logLocalChange(planilhaNome, fusaoPath, fusaoValue, 'action'));

    const novoLemaValor = {
        origem: listaOrigensFinal,
        total: newCounts.total,
        ego: newCounts.ego,
        alter: newCounts.alter,
        positividade: '',
        categoria: ''
    };
    lemasAtuais[novoNome] = novoLemaValor;

    palavrasSelecionadas.forEach(p => {
        if(lemasAtuais.hasOwnProperty(p) && p !== novoNome){
            delete lemasAtuais[p];
            logPromises.push(logLocalChange(planilhaNome, `lematizacoes/${planilhaNome}/${p}`, null, 'data'));
        }
    });

    logPromises.push(logLocalChange(planilhaNome, `lematizacoes/${planilhaNome}/${novoNome}`, novoLemaValor, 'data'));

    await Promise.all(logPromises);
    await setItem(storedDataKey, updatedData);
    await setItem(lemasKey, lemasAtuais);

    window.selectedEvocacoes = [];
    Swal.fire({
        title: mergedTitle, text: wordsMergedMsg,
        icon: 'success', confirmButtonText: understoodBtn
    }).then(() => location.reload());

  } catch (error) {
    Swal.fire(errorTitle, `${mergeErrorMsg} Detalhes: ${error.message}`, "error");
  } finally {
      if (Swal.isLoading()) Swal.close();
  }
}


async function criarMenuLateral() {
    const saveLabel = await window.getTranslation('menu_save');
    const removeLabel = await window.getTranslation('menu_remove');
    const mergeLabel = await window.getTranslation('menu_merge');
    const positividadeLabel = "Positividade";
    const categoriaLabel = "Categorias"; 

    // Lógica do botão de Filtro
    const urlParams = new URLSearchParams(window.location.search);
    const filtroAtivo = urlParams.get("fusoes") === "true";
    const filtroLabel = filtroAtivo ? "Exibir Tudo" : "Ver Fusões";
    const filtroIcone = filtroAtivo ? "fa-solid fa-eye" : "fa-solid fa-filter";

    const createButtonHTML = (label, iconClass, id) => `
        <button type="button" class="menu-botao" id="${id}">
            <div class="icone-circulo">
                <i class="${iconClass}"></i>
            </div>
            <span class="menu-texto">${label}</span>
        </button>
    `;

    const menuDesktop = document.createElement("div");
    menuDesktop.className = "menu-lateral"; 
    menuDesktop.innerHTML = [
        createButtonHTML(saveLabel, "fa-solid fa-cloud-arrow-up", 'botao-salvar-desktop'),
        createButtonHTML(removeLabel, "fas fa-trash", 'botao-remover-desktop'),
        createButtonHTML(mergeLabel, "fas fa-compress", 'botao-fundir-desktop'),
        createButtonHTML(filtroLabel, filtroIcone, 'botao-filtro-desktop'), // BOTÃO DE FILTRO
        createButtonHTML(positividadeLabel, "fa-solid fa-plus", 'botao-positividade-desktop'),
        createButtonHTML(categoriaLabel, "fa-solid fa-tags", 'botao-categoria-desktop'), 
    ].join('');
    document.body.appendChild(menuDesktop);
    
    if (menuDesktop) {
        menuDesktop.addEventListener('mouseenter', () => {
            menuDesktop.classList.add('expanded');
            document.body.classList.add('evocacoes-menu-expanded');
        });
        menuDesktop.addEventListener('mouseleave', () => {
            menuDesktop.classList.remove('expanded');
            document.body.classList.remove('evocacoes-menu-expanded');
        });
    }

    const menuMobile = document.createElement("div");
    menuMobile.className = "menu-lateral-mobile"; 
    menuMobile.innerHTML = [
        createButtonHTML(saveLabel, "fa-solid fa-cloud-arrow-up", 'botao-salvar-mobile'),
        createButtonHTML(removeLabel, "fas fa-trash", 'botao-remover-mobile'),
        createButtonHTML(mergeLabel, "fas fa-compress", 'botao-fundir-mobile'),
        createButtonHTML(filtroLabel, filtroIcone, 'botao-filtro-mobile'), // BOTÃO DE FILTRO
        createButtonHTML(positividadeLabel, "fa-solid fa-plus", 'botao-positividade-mobile'),
        createButtonHTML(categoriaLabel, "fa-solid fa-tags", 'botao-categoria-mobile'),
    ].join('');
    document.body.appendChild(menuMobile);

    const addListeners = (desktopId, mobileId, callback) => {
        const desktopBtn = document.getElementById(desktopId);
        const mobileBtn = document.getElementById(mobileId);
        if (desktopBtn) desktopBtn.onclick = callback;
        if (mobileBtn) mobileBtn.onclick = callback;
    };

    addListeners('botao-salvar-desktop', 'botao-salvar-mobile', salvarAlteracoes);
    addListeners('botao-remover-desktop', 'botao-remover-mobile', removerPalavrasSelecionadas);
    addListeners('botao-fundir-desktop', 'botao-fundir-mobile', fundirPalavrasSelecionadas);
    addListeners('botao-positividade-desktop', 'botao-positividade-mobile', () => adicionarPositividade(logLocalChange));
    addListeners('botao-categoria-desktop', 'botao-categoria-mobile', () => adicionarCategoria(logLocalChange, salvarAlteracoes));

    // Lógica de alternância do filtro
    const toggleFiltro = () => {
        const url = new URL(window.location.href);
        if (filtroAtivo) url.searchParams.delete("fusoes");
        else url.searchParams.set("fusoes", "true");
        url.searchParams.set("page", "1"); 
        window.location.href = url.toString();
    };
    addListeners('botao-filtro-desktop', 'botao-filtro-mobile', toggleFiltro);

    const setaSalvar = document.createElement('i');
    setaSalvar.id = 'seta-salvar';
    setaSalvar.className = 'fas fa-arrow-left';

    const popupSalvar = document.createElement('div');
    popupSalvar.id = 'popup-salvar';
    const popupIcon = document.createElement('i');
    popupIcon.className = 'fas fa-info-circle';
    const popupSpan = document.createElement('span');
    popupSpan.setAttribute('data-translate', 'unsaved_changes_popup');
    popupSpan.textContent = await window.getTranslation('unsaved_changes_popup');
    popupSalvar.appendChild(popupIcon);
    popupSalvar.appendChild(popupSpan);

    document.body.appendChild(setaSalvar);
    document.body.appendChild(popupSalvar);

    setTimeout(() => setUnsavedChanges(false), 150);
}


async function checarAlteracoesPendentes(planilhaNome) {
    if (!planilhaNome) return;
    try {
        const changes = await getItem(`pending_changes_${planilhaNome}`);
        setUnsavedChanges(changes && changes.length > 0);
    } catch (error) {
        setUnsavedChanges(false);
    }
}


window.addEventListener("DOMContentLoaded", async () => {
  await criarMenuLateral();
  const urlParams = new URLSearchParams(window.location.search);
  const planilhaNome = urlParams.get("planilha");
  await checarAlteracoesPendentes(planilhaNome);

  window.addEventListener('checarAlteracoesLocais', () => {
      checarAlteracoesPendentes(planilhaNome);
  });
});