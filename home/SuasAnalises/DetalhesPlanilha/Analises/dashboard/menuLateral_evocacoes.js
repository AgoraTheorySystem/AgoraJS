// menuLateral_evocacoes.js

import { getDatabase, ref, get, set, update, push } from "https://www.gstatic.com/firebasejs/9.9.3/firebase-database.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.9.3/firebase-app.js";
import firebaseConfig from '/firebase.js';
// IMPORTAÇÃO DAS FUNÇÕES DE CATEGORIAS
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
    
    // Seleciona ambos os botões (desktop e mobile)
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

        // *** INÍCIO DA OTIMIZAÇÃO (Multi-Path Update) ***

        // 1. Objeto único para a atualização atômica (multi-path update)
        const allUpdatesInOne = {};
        const historyChangesForPush = {}; 
        const timestamp = Date.now();
        const uid = user.uid;

        pendingChanges.forEach(change => {
            // Adiciona alterações de 'lematizacoes' E 'categorias' ao objeto de update
            if (change.type === 'data' && 
               (change.path.startsWith(`lematizacoes/${planilhaNome}/`) || change.path.startsWith(`categorias/${planilhaNome}/`))
            ) {
                 // O 'change.path' já é 'lematizacoes/planilhaNome/PALAVRA' ou 'categorias/planilhaNome/CATEGORIA'
                 // O caminho completo no Firebase será 'users/UID/...'
                 allUpdatesInOne[`users/${uid}/${change.path}`] = change.value; 
            }
            
             // Adiciona *todas* as alterações ao objeto de histórico
             const historyPathKey = change.path.replace(/\//g, '___');
             historyChangesForPush[historyPathKey] = { value: change.value, type: change.type };
        });

        // 2. Gera uma nova chave ÚNICA para o histórico
        const historyRef = ref(database, `users/${uid}/historico_alteracoes/${planilhaNome}`);
        const newHistoryKey = push(historyRef).key; // Pega a chave SEM enviar dados

        // Adiciona o novo nó de histórico ao objeto de update
        allUpdatesInOne[`users/${uid}/historico_alteracoes/${planilhaNome}/${newHistoryKey}`] = { 
            timestamp: timestamp, 
            changes: historyChangesForPush 
        };

        // 3. Adiciona a atualização do timestamp principal ao objeto de update
        //    (Isto substitui qualquer nó existente em UltimasAlteracoes, que é o correto)
        allUpdatesInOne[`users/${uid}/UltimasAlteracoes/${planilhaNome}`] = { 
            [timestamp]: timestamp 
        };

        // 4. Executa UMA ÚNICA operação de 'update' atômica na raiz
        console.log("Executando atualização atômica (multi-path) no Firebase...");
        await update(ref(database), allUpdatesInOne);
        console.log("Atualização atômica concluída.");

        // *** FIM DA OTIMIZAÇÃO ***


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

/**
 * LÓGICA ATUALIZADA (V2 - Recursiva)
 * Remove as palavras selecionadas.
 * Se uma palavra selecionada for uma fusão, remove recursivamente ela e todas as suas palavras de origem.
 */
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

    const selecaoInicial = window.selectedEvocacoes || [];
    if (selecaoInicial.length === 0) {
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

        const lemasKey = `lemas_${planilhaNome}`;
        const lemasAtuais = await getItem(lemasKey) || {};

        // --- INÍCIO DA LÓGICA MODIFICADA (V2) ---
        // 1. Criar uma lista expandida de todas as palavras a serem removidas (incluindo originais de fusões)
        const todasPalavrasParaRemover = new Set(selecaoInicial); // Começa com o que o usuário selecionou
        
        // Usamos um array como fila para processar recursivamente as fusões
        const filaParaProcessar = [...selecaoInicial]; 

        while (filaParaProcessar.length > 0) {
            const palavra = filaParaProcessar.shift(); // Pega o próximo item da fila

            // Verifica se a palavra (seja a inicial ou uma original) é uma fusão
            if (lemasAtuais.hasOwnProperty(palavra)) {
                const lema = lemasAtuais[palavra];

                // Se for fusão, adiciona suas palavras de origem à lista de remoção E à fila de processamento
                if (lema && lema.origem && Array.isArray(lema.origem)) {
                    lema.origem.forEach(palavraOriginalComContagem => {
                        // Extrai apenas o nome da palavra (ex: "OPORTUNIDADE" de "OPORTUNIDADE (159)")
                        const nomeOriginal = palavraOriginalComContagem.split(' (')[0].trim().toUpperCase();
                        if (nomeOriginal && !todasPalavrasParaRemover.has(nomeOriginal)) {
                            todasPalavrasParaRemover.add(nomeOriginal); // Adiciona à lista de remoção
                            filaParaProcessar.push(nomeOriginal);   // Adiciona à fila para checar se *ela* é uma fusão
                        }
                    });
                }
                
                // Agenda a remoção desta fusão (que acabamos de processar) do objeto de lemas
                delete lemasAtuais[palavra]; // Remove a fusão do objeto de lemas
                const lemaPath = `lematizacoes/${planilhaNome}/${palavra}`;
                // *** CORREÇÃO: Await sequencial para evitar race condition ***
                await logLocalChange(planilhaNome, lemaPath, null, 'data'); // Loga a deleção do lema
            }
        }
        // --- FIM DA LÓGICA MODIFICADA (V2) ---

        const listaFinalParaRemover = [...todasPalavrasParaRemover]; // Converte o Set para Array
        let hasChanges = false;

        // 2. Atualiza a planilha, removendo TODAS as palavras da lista expandida
        const updatedData = storedData.map((row, rowIndex) => {
            if (rowIndex === 0) return row; // Manter o cabeçalho
             if (!Array.isArray(row)) return row;
            return row.map(cell => {
                const valor = String(cell || "").trim().toUpperCase();
                // Usa a lista expandida para verificar a remoção
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

        // 3. Loga a ação de remoção com a lista expandida
        // *** CORREÇÃO AQUI: Usando crypto.randomUUID() para garantir path único ***
        const remocaoPath = `remocoes/${planilhaNome}/${crypto.randomUUID()}`;
        // *** CORREÇÃO: Await sequencial para evitar race condition ***
        await logLocalChange(planilhaNome, remocaoPath, listaFinalParaRemover, 'action');

        // 4. Salva os dados atualizados (planilha e lemas)
        // await Promise.all(logPromises); // <-- REMOVIDO
        await setItem(storedDataKey, updatedData); // Salva a planilha com todas as palavras removidas
        await setItem(lemasKey, lemasAtuais); // Salva os lemas (sem a fusão "Teste 2")

        // Limpa a seleção local após a operação
        window.selectedEvocacoes = [];

        Swal.fire({
            title: removedTitle, text: wordsRemovedMsg,
            icon: 'success', confirmButtonText: understoodBtn
        }).then(() => {
            // Recarrega a página para mostrar o estado atualizado do IndexedDB
            location.reload();
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
    const lemasAtuais = await getItem(lemasKey) || {}; // Carrega lemas

    const counts = {};
    palavrasSelecionadas.forEach(p => counts[p] = 0);

    // --- CÁLCULO DAS CONTAGENS TOTAIS DAS PALAVRAS ORIGINAIS ---
    const header = storedData[0];
    const rows = storedData.slice(1);
    const contagensOriginais = {};
    palavrasSelecionadas.forEach(p => {
        // MODIFICADO: Adiciona positividade e categoria
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
                    if (/^EVOC[1-5]$/.test(coluna)) {
                        contagensOriginais[palavra].ego++;
                    } else {
                        contagensOriginais[palavra].alter++;
                    }
                }
            }
        }
    }
    
    // MODIFICADO: lógica de soma de contagens
    const newCounts = { total: 0, ego: 0, alter: 0 };
    
    palavrasSelecionadas.forEach(p => {
        let contagem = contagensOriginais[p]; 
        
        // Se a palavra selecionada JÁ ERA UMA FUSÃO, busca seus dados de 'lemasAtuais'
        if (lemasAtuais[p] && lemasAtuais[p].total !== undefined) {
            contagem.total = lemasAtuais[p].total;
            contagem.ego = lemasAtuais[p].ego;
            contagem.alter = lemasAtuais[p].alter;
            // Importante: Traz a positividade/categoria da fusão anterior
            contagem.positividade = lemasAtuais[p].positividade || '';
            contagem.categoria = lemasAtuais[p].categoria || '';
        }

        newCounts.total += contagem.total;
        newCounts.ego += contagem.ego;
        newCounts.alter += contagem.alter;
        // Positividade e Categoria da nova fusão serão vazias
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

    // *** CORREÇÃO AQUI: Usando crypto.randomUUID() para garantir path único ***
    const fusaoPath = `fusao_evocacao/${planilhaNome}/${crypto.randomUUID()}`;
    const fusaoValue = {
        novoNome: novoNome,
        palavrasOrigem: [...palavrasSelecionadas]
    };
    logPromises.push(logLocalChange(planilhaNome, fusaoPath, fusaoValue, 'action'));

    // MODIFICADO: Adiciona positividade e categoria (vazias) ao novo lema
    const novoLemaValor = {
        origem: palavrasSelecionadas.map(p => `${p} (${contagensOriginais[p].total || 0})`),
        total: newCounts.total,
        ego: newCounts.ego,
        alter: newCounts.alter,
        positividade: '', // Inicia vazio
        categoria: ''  // Inicia vazio
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
    // Obter traduções para os botões
    const saveLabel = await window.getTranslation('menu_save');
    const removeLabel = await window.getTranslation('menu_remove');
    const mergeLabel = await window.getTranslation('menu_merge');
    const showMergesLabel = await window.getTranslation('menu_show_merges');
    const showAllLabel = await window.getTranslation('menu_show_all');
    // NOVOS LABELS
    const positividadeLabel = "+ Positividade";
    const categoriaLabel = "Categorias"; 

    /**
     * Cria o HTML para um único botão
     * @param {string} label - O texto do botão
     * @param {string} iconClass - Classes do Font Awesome (ex: "fas fa-trash")
     * @param {string} id - O ID do elemento
     * @returns {string} - O HTML do botão
     */
    const createButtonHTML = (label, iconClass, id) => `
        <button type="button" class="menu-botao" id="${id}">
            <div class="icone-circulo">
                <i class="${iconClass}"></i>
            </div>
            <span class="menu-texto">${label}</span>
        </button>
    `;

    // --- CRIA MENU DESKTOP ---
    const menuDesktop = document.createElement("div");
    menuDesktop.className = "menu-lateral"; // Classe principal para desktop
    menuDesktop.innerHTML = [
        createButtonHTML(saveLabel, "fa-solid fa-cloud-arrow-up", 'botao-salvar-desktop'),
        createButtonHTML(removeLabel, "fas fa-trash", 'botao-remover-desktop'),
        createButtonHTML(mergeLabel, "fas fa-compress", 'botao-fundir-desktop'),
        createButtonHTML(positividadeLabel, "fa-solid fa-plus", 'botao-positividade-desktop'),
        createButtonHTML(categoriaLabel, "fa-solid fa-tags", 'botao-categoria-desktop'), 
        createButtonHTML(showMergesLabel, "fas fa-random", 'botao-fusoes-desktop'),
        createButtonHTML(showAllLabel, "fas fa-eye", 'botao-exibir-desktop')
    ].join('');
    document.body.appendChild(menuDesktop);
    
    // --- NOVA LÓGICA DE EXPANSÃO (JS) ---
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
    // --- FIM DA NOVA LÓGICA ---

    // --- CRIA MENU MOBILE ---
    const menuMobile = document.createElement("div");
    menuMobile.className = "menu-lateral-mobile"; // Classe separada para mobile
    menuMobile.innerHTML = [
        createButtonHTML(saveLabel, "fa-solid fa-cloud-arrow-up", 'botao-salvar-mobile'),
        createButtonHTML(removeLabel, "fas fa-trash", 'botao-remover-mobile'),
        createButtonHTML(mergeLabel, "fas fa-compress", 'botao-fundir-mobile'),
        createButtonHTML(positividadeLabel, "fa-solid fa-plus", 'botao-positividade-mobile'),
        createButtonHTML(categoriaLabel, "fa-solid fa-tags", 'botao-categoria-mobile'),
        createButtonHTML(showMergesLabel, "fas fa-random", 'botao-fusoes-mobile'),
        createButtonHTML(showAllLabel, "fas fa-eye", 'botao-exibir-mobile')
    ].join('');
    document.body.appendChild(menuMobile);

    // --- ADICIONA LISTENERS (PARA AMBOS OS MENUS) ---
    const addListeners = (desktopId, mobileId, callback) => {
        const desktopBtn = document.getElementById(desktopId);
        const mobileBtn = document.getElementById(mobileId);
        if (desktopBtn) desktopBtn.onclick = callback;
        if (mobileBtn) mobileBtn.onclick = callback;
    };

    addListeners('botao-salvar-desktop', 'botao-salvar-mobile', salvarAlteracoes);
    addListeners('botao-remover-desktop', 'botao-remover-mobile', removerPalavrasSelecionadas);
    addListeners('botao-fundir-desktop', 'botao-fundir-mobile', fundirPalavrasSelecionadas);
    
    // MODIFICADO: Passa logLocalChange e salvarAlteracoes como dependências
    addListeners('botao-positividade-desktop', 'botao-positividade-mobile', () => adicionarPositividade(logLocalChange));
    addListeners('botao-categoria-desktop', 'botao-categoria-mobile', () => adicionarCategoria(logLocalChange, salvarAlteracoes));

    const fusoesCallback = () => {
        window.filtroFusoes = true;
        location.reload();
    };
    addListeners('botao-fusoes-desktop', 'botao-fusoes-mobile', fusoesCallback);

    const exibirCallback = () => {
        window.filtroFusoes = false;
        location.reload();
    };
    addListeners('botao-exibir-desktop', 'botao-exibir-mobile', exibirCallback);


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