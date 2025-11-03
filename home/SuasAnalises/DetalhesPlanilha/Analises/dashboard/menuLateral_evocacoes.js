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
        // Garante que retornamos null se o item não existir, em vez de undefined
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
  // Adiciona verificação para uid
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
  console.error("Usuário não encontrado ou inválido na sessão.");
  // Considerar redirecionar para login ou mostrar erro
  // window.location.href = '/index.html'; // Exemplo
  return null;
}


function setUnsavedChanges(status) {
    hasUnsavedChanges = status;
    const elements = {
        botaoSalvar: document.getElementById('botao-salvar'),
        popup: document.getElementById('popup-salvar'),
        seta: document.getElementById('seta-salvar')
    };
    // Verifica se todos os elementos existem antes de manipulá-los
    if (!elements.botaoSalvar || !elements.popup || !elements.seta) {
        // console.warn("Elementos da UI de 'salvar pendente' não encontrados."); // Comentado para evitar poluir console
        return;
    }

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
 * Salva as alterações pendentes (ações e dados) no Firebase.
 */
async function salvarAlteracoes() {
    // Traduz mensagens de alerta
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
    // Adiciona verificação robusta
    if (!planilhaNome || !user || !user.uid) {
        console.error("Nome da planilha ou UID do usuário ausente. Abortando salvamento.");
        Swal.fire(errorTitle, "Não foi possível identificar a análise ou o usuário.", "error");
        return;
    }


    Swal.fire({ title: savingTitle, text: savingText, didOpen: () => Swal.showLoading(), allowOutsideClick: false });

    try {
        const pendingChanges = await getItem(`pending_changes_${planilhaNome}`) || [];
        if (pendingChanges.length === 0) {
            Swal.fire(warningTitle, noPendingChangesFoundMsg, "info");
            setUnsavedChanges(false); // Garante que o estado seja resetado
            return;
        }

        console.log("Alterações pendentes a serem salvas:", JSON.stringify(pendingChanges, null, 2)); // Log detalhado

        const updatesForFirebase = {};
        const historyChangesForPush = {}; // Mantém todas as alterações para o histórico

        pendingChanges.forEach(change => {
            // Atualiza diretamente apenas nós de 'lematizacoes'
            if (change.path.startsWith(`lematizacoes/${planilhaNome}/`)) {
                 const firebasePath = change.path; // Usar path direto se não houver '___'
                 updatesForFirebase[firebasePath] = change.value; // value pode ser null para exclusão
            }
             // Todas as alterações (incluindo ações) vão para o histórico
             // Usar '___' para evitar que o Firebase interprete como caminhos aninhados na chave do histórico
             const historyPathKey = change.path.replace(/\//g, '___');
             historyChangesForPush[historyPathKey] = { value: change.value, type: change.type }; // Inclui o tipo no histórico
        });

        // Aplica as atualizações diretas (lematizações)
        if (Object.keys(updatesForFirebase).length > 0) {
            console.log("Atualizando nós de lematização diretamente:", updatesForFirebase);
            await update(ref(database, `users/${user.uid}`), updatesForFirebase);
        }

        // Adiciona um único registro no histórico com todas as alterações deste lote
        const timestamp = Date.now();
        const historyRef = ref(database, `users/${user.uid}/historico_alteracoes/${planilhaNome}`);
        console.log("Registrando no histórico:", { timestamp, changes: historyChangesForPush });
        await push(historyRef, { timestamp, changes: historyChangesForPush });


        // Atualiza o timestamp geral de modificação da planilha
        const timestampRef = ref(database, `users/${user.uid}/UltimasAlteracoes/${planilhaNome}`);
         // Usa set para garantir que apenas o último timestamp exista
        await set(timestampRef, { [timestamp]: timestamp });


        // Limpa as alterações pendentes locais e atualiza o timestamp local
        await deleteItem(`pending_changes_${planilhaNome}`);
        await setItem(`timestamp_local_change_${planilhaNome}`, timestamp); // Atualiza timestamp local APÓS sucesso

        setUnsavedChanges(false); // Reseta o estado da UI
        Swal.fire(successTitle, saveSuccessMsg, "success");

    } catch (error) {
        console.error("Erro detalhado ao salvar alterações no Firebase:", error); // Log detalhado do erro
        Swal.fire(errorTitle, saveErrorMsg, "error");
    }
}


/**
 * Registra uma alteração localmente no IndexedDB para envio posterior.
 */
async function logLocalChange(planilhaNome, path, value, type = 'data') {
    if (!planilhaNome || !path) {
        console.error("Tentativa de logar alteração local sem nome da planilha ou caminho.");
        return;
    }
    try {
        const changesKey = `pending_changes_${planilhaNome}`;
        const changes = await getItem(changesKey) || [];

        // Verifica se já existe uma alteração pendente para o mesmo path
        const existingIndex = changes.findIndex(c => c.path === path);

        const newChange = { path, value, type, timestamp: Date.now() }; // Adiciona timestamp local

        if (existingIndex > -1) {
            // Se já existe, substitui pela mais recente
            changes[existingIndex] = newChange;
            console.log(`Alteração local substituída para path: ${path}`);
        } else {
            // Se não existe, adiciona
            changes.push(newChange);
            console.log(`Alteração local adicionada: ${type} em ${path}`);
        }

        await setItem(changesKey, changes);
        setUnsavedChanges(true); // Marca que há alterações não salvas
    } catch (error) {
        console.error("Erro ao logar alteração local no IndexedDB:", error);
    }
}


// --- Funções de Ação do Usuário (Remover, Fundir) ---

async function removerPalavrasSelecionadas() {
    // Traduções
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


    const palavrasParaRemover = window.selectedEvocacoes || [];
    if (palavrasParaRemover.length === 0) {
        Swal.fire(attentionTitle, selectWordMsg, "warning");
        return;
    }
    const urlParams = new URLSearchParams(window.location.search);
    const planilhaNome = urlParams.get("planilha");
    if (!planilhaNome) {
         console.error("Nome da planilha não encontrado na URL para remover palavras.");
         Swal.fire(errorTitle, "Não foi possível identificar a análise ativa.", "error");
         return;
    }


    Swal.fire({ title: processingTitle, text: removingText, didOpen: () => Swal.showLoading(), allowOutsideClick: false });

    try {
        const storedDataKey = `planilha_${planilhaNome}`;
        const storedData = await getItem(storedDataKey);
        if (!storedData || !Array.isArray(storedData) || storedData.length === 0) {
           throw new Error(`Planilha "${planilhaNome}" não encontrada ou vazia no armazenamento local.`);
        }


        let hasChanges = false;
        const logPromises = [];
        const lemasKey = `lemas_${planilhaNome}`;
        const lemasAtuais = await getItem(lemasKey) || {};

        const updatedData = storedData.map((row, rowIndex) => {
            if (rowIndex === 0) return row; // Manter o cabeçalho
             if (!Array.isArray(row)) return row;
            return row.map(cell => {
                const valor = String(cell || "").trim().toUpperCase();
                if (palavrasParaRemover.includes(valor)) {
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

        const remocaoPath = `remocoes/${planilhaNome}/${Date.now()}`;
        logPromises.push(logLocalChange(planilhaNome, remocaoPath, [...palavrasParaRemover], 'action'));


        palavrasParaRemover.forEach(palavra => {
            if(lemasAtuais.hasOwnProperty(palavra)) {
                delete lemasAtuais[palavra];
                const lemaPath = `lematizacoes/${planilhaNome}/${palavra}`;
                logPromises.push(logLocalChange(planilhaNome, lemaPath, null, 'data'));
            }
        });

        await Promise.all(logPromises);
        await setItem(storedDataKey, updatedData);
        await setItem(lemasKey, lemasAtuais);

        // Limpa a seleção local após a operação
        window.selectedEvocacoes = [];

        Swal.fire({
            title: removedTitle, text: wordsRemovedMsg,
            icon: 'success', confirmButtonText: understoodBtn
        }).then(() => {
            // Recarrega a página para mostrar o estado atualizado do IndexedDB
            location.reload();
             // Alternativa sem reload (se evocacoes.js estiver ouvindo):
             // window.dispatchEvent(new CustomEvent("atualizarTabelaEvocacoes"));
        });

    } catch (error) {
        console.error("Erro detalhado ao remover palavras:", error);
        Swal.fire(errorTitle, `${removeErrorMsg} Detalhes: ${error.message}`, "error");
    } finally {
         if (Swal.isLoading()) {
            Swal.close();
         }
    }
}


async function fundirPalavrasSelecionadas() {
  // Traduções
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
    if (!planilhaNome) {
        console.error("Nome da planilha não encontrado na URL para fundir palavras.");
        Swal.fire(errorTitle, "Não foi possível identificar a análise ativa.", "error");
        return;
    }


  Swal.fire({ title: processingTitle, text: mergingText, didOpen: () => Swal.showLoading(), allowOutsideClick: false });

  try {
    const storedDataKey = `planilha_${planilhaNome}`;
    const storedData = await getItem(storedDataKey);
     if (!storedData || !Array.isArray(storedData) || storedData.length === 0) {
        throw new Error(`Planilha "${planilhaNome}" não encontrada ou vazia no armazenamento local.`);
     }


    let hasChanges = false;
    const logPromises = [];
    const lemasKey = `lemas_${planilhaNome}`;

    const counts = {};
    palavrasSelecionadas.forEach(p => counts[p] = 0);

    // --- CÁLCULO DAS CONTAGENS TOTAIS DAS PALAVRAS ORIGINAIS ---
    const header = storedData[0];
    const rows = storedData.slice(1);
    const contagensOriginais = {};
    palavrasSelecionadas.forEach(p => {
        contagensOriginais[p] = { total: 0, ego: 0, alter: 0 };
    });

    for (const row of rows) {
        if (!Array.isArray(row)) continue;
        for (let j = 0; j < header.length; j++) {
            const coluna = String(header[j] || "").toUpperCase();
            if (/^EVOC[1-9]$|^EVOC10$/.test(coluna)) {
                const palavra = String(row[j] || "").trim().toUpperCase();
                if (palavrasSelecionadas.includes(palavra)) {
                    contagensOriginais[palavra].total++;
                    if (/^EVOC[1-5]$/.test(coluna)) {
                        contagensOriginais[palavra].ego++;
                    } else {
                        contagensOriginais[palavra].alter++;
                    }
                }
            }
        }
    }
    const newCounts = { total: 0, ego: 0, alter: 0 };
    palavrasSelecionadas.forEach(p => {
        newCounts.total += contagensOriginais[p].total;
        newCounts.ego += contagensOriginais[p].ego;
        newCounts.alter += contagensOriginais[p].alter;
    });
    // --- FIM DO CÁLCULO ---

    const updatedData = storedData.map((row, rowIndex) => {
        if (rowIndex === 0) return row;
         if (!Array.isArray(row)) return row;
        return row.map(cell => {
            const valor = String(cell || "").trim().toUpperCase();
            if (palavrasSelecionadas.includes(valor)) {
                hasChanges = true;
                counts[valor]++;
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

    const lemasAtuais = await getItem(lemasKey) || {};

    const fusaoPath = `fusao_evocacao/${planilhaNome}/${Date.now()}`;
    const fusaoValue = {
        novoNome: novoNome,
        palavrasOrigem: [...palavrasSelecionadas]
    };
    logPromises.push(logLocalChange(planilhaNome, fusaoPath, fusaoValue, 'action'));

    const novoLemaValor = {
        origem: palavrasSelecionadas.map(p => `${p} (${contagensOriginais[p].total || 0})`),
        total: newCounts.total,
        ego: newCounts.ego,
        alter: newCounts.alter
    };
    lemasAtuais[novoNome] = novoLemaValor;

    palavrasSelecionadas.forEach(p => {
        if(lemasAtuais.hasOwnProperty(p)){
            delete lemasAtuais[p];
            const lemaRemovalPath = `lematizacoes/${planilhaNome}/${p}`;
            logPromises.push(logLocalChange(planilhaNome, lemaRemovalPath, null, 'data'));
        }
    });

    const lemaCreationPath = `lematizacoes/${planilhaNome}/${novoNome}`;
    logPromises.push(logLocalChange(planilhaNome, lemaCreationPath, novoLemaValor, 'data'));

    await Promise.all(logPromises);
    await setItem(storedDataKey, updatedData);
    await setItem(lemasKey, lemasAtuais);

    // Limpa a seleção local após a operação
    window.selectedEvocacoes = [];

    Swal.fire({
        title: mergedTitle, text: wordsMergedMsg,
        icon: 'success', confirmButtonText: understoodBtn
    }).then(() => {
        // Recarrega a página para mostrar o estado atualizado do IndexedDB
        location.reload();
         // Alternativa sem reload (se evocacoes.js estiver ouvindo):
         // window.dispatchEvent(new CustomEvent("atualizarTabelaEvocacoes"));
    });

  } catch (error) {
    console.error("Erro detalhado ao fundir palavras:", error);
    Swal.fire(errorTitle, `${mergeErrorMsg} Detalhes: ${error.message}`, "error");
  } finally {
      if (Swal.isLoading()) {
          Swal.close();
      }
  }
}


// --- Construção do Menu e Event Listeners ---
async function criarMenuLateral() {
    const menu = document.createElement("div");
    menu.classList.add("menu-lateral");

    // Obter traduções para os botões
    const saveLabel = await window.getTranslation('menu_save');
    const removeLabel = await window.getTranslation('menu_remove');
    const mergeLabel = await window.getTranslation('menu_merge');
    const showMergesLabel = await window.getTranslation('menu_show_merges');
    const showAllLabel = await window.getTranslation('menu_show_all');


    const makeBtn = (label, iconClass, onClick, id = null) => {
        const btn = document.createElement("button");
        btn.type = "button"; btn.className = "menu-botao";
        if (id) btn.id = id;
        const circle = document.createElement("div"); circle.className = "icone-circulo";
        const icon = document.createElement("i"); icon.className = iconClass;
        circle.appendChild(icon);
        const text = document.createElement("span"); text.textContent = label;
        btn.appendChild(circle); btn.appendChild(text); btn.onclick = onClick;
        return btn;
    };

    const botaoSalvar = makeBtn(saveLabel, "fa-solid fa-cloud-arrow-up", salvarAlteracoes, 'botao-salvar');
    const botaoRemover = makeBtn(removeLabel, "fas fa-trash", removerPalavrasSelecionadas);
    const botaoFundir = makeBtn(mergeLabel, "fas fa-compress", fundirPalavrasSelecionadas);
    const botaoFusoes = makeBtn(showMergesLabel, "fas fa-random", () => {
        window.filtroFusoes = true;
        // Mudar para reload para simplicidade e garantir consistência com o pedido do usuário
        location.reload();
        // window.dispatchEvent(new CustomEvent("atualizarTabelaEvocacoes"));
    });
    const botaoExibir = makeBtn(showAllLabel, "fas fa-eye", () => {
        window.filtroFusoes = false;
         // Mudar para reload para simplicidade e garantir consistência com o pedido do usuário
        location.reload();
        // window.dispatchEvent(new CustomEvent("atualizarTabelaEvocacoes"));
    });

    menu.appendChild(botaoSalvar);
    menu.appendChild(botaoRemover);
    menu.appendChild(botaoFundir);
    menu.appendChild(botaoFusoes);
    menu.appendChild(botaoExibir);

     // Cria os elementos de popup e seta (inicialmente ocultos)
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


    document.body.appendChild(menu);
    document.body.appendChild(setaSalvar);
    document.body.appendChild(popupSalvar);

    // Inicializa o estado visual do botão Salvar
    setTimeout(() => setUnsavedChanges(false), 150);
}


async function checarAlteracoesPendentes(planilhaNome) {
    if (!planilhaNome) return;
    try {
        const changes = await getItem(`pending_changes_${planilhaNome}`);
        setUnsavedChanges(changes && changes.length > 0);
    } catch (error) {
        console.error("Erro ao checar alterações pendentes no IndexedDB:", error);
        setUnsavedChanges(false);
    }
}


window.addEventListener("DOMContentLoaded", async () => {
  await criarMenuLateral();
  const urlParams = new URLSearchParams(window.location.search);
  const planilhaNome = urlParams.get("planilha");

  // Checa alterações pendentes ao carregar a página
  await checarAlteracoesPendentes(planilhaNome);

  // Escuta o evento de 'atualizacao.js' para checar as alterações locais APÓS sincronização
  window.addEventListener('checarAlteracoesLocais', () => {
      checarAlteracoesPendentes(planilhaNome);
  });
});

