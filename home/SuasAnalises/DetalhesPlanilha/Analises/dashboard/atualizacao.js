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
    // Garante retorno null se não existir
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
                console.error(`Erro ao remover chave "${key}" do IndexedDB:`, event.target.error);
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
     // Adiciona verificação de UID
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
    return null; // Retorna null se inválido
}

async function limparDadosLocaisAntigos(planilhaNome) {
    console.log(`Limpando dados locais antigos para a planilha: ${planilhaNome}`);
    const keysToRemove = [
        `planilha_${planilhaNome}`,
        `lemas_${planilhaNome}`,
        `timestamp_local_change_${planilhaNome}`,
        `pending_changes_${planilhaNome}` // Garante que alterações pendentes antigas sejam limpas
    ];
    await Promise.all(keysToRemove.map(key => deleteItemFromDB(key)));
    console.log(`Limpeza local para "${planilhaNome}" concluída.`);
}


async function baixarPlanilhaInicial(user, planilhaNome) {
    await ensureSwalIsLoaded();
    console.log(`Planilha "${planilhaNome}" não encontrada localmente. Iniciando download limpo...`);

    // Limpa qualquer dado local antigo ANTES de baixar
    await limparDadosLocaisAntigos(planilhaNome);

    // Traduções
    const preparingTitle = await window.getTranslation('preparing_analy');
    const downloadingText = await window.getTranslation('download_analy');
    const readyTitle = await window.getTranslation('ready');
    const loadedTextKey = 'data_loaded'; // Chave para tradução
    const downloadErrorKey = 'download_error'; // Chave para tradução


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
            planilhaCompleta = planilhaCompleta.concat(chunkSnapshot.val() || []); // Garante que seja array
        });
        // Validação básica dos dados baixados
        if (!Array.isArray(planilhaCompleta) || planilhaCompleta.length === 0) {
           throw new Error(`Dados da planilha "${planilhaNome}" baixados estão vazios ou em formato inválido.`);
        }
        await setItem(`planilha_${planilhaNome}`, planilhaCompleta);
        console.log(`Planilha "${planilhaNome}" salva localmente.`);

        // 2. Baixar dados de lematizações/fusões
        const lemasRef = ref(database, `/users/${user.uid}/lematizacoes/${planilhaNome}`);
        const snapshotLemas = await get(lemasRef);
        const lemasData = snapshotLemas.exists() ? snapshotLemas.val() : {}; // Padrão objeto vazio
        await setItem(`lemas_${planilhaNome}`, lemasData);
        console.log(`Lematizações de "${planilhaNome}" salvas localmente.`);


        // 3. Baixar o timestamp mais recente
        const remoteTimestampRef = ref(database, `/users/${user.uid}/UltimasAlteracoes/${planilhaNome}`);
        const snapshotTimestamp = await get(remoteTimestampRef);
        let remoteTimestamp = 0; // Padrão 0 se não existir
        if (snapshotTimestamp.exists()) {
            const remoteData = snapshotTimestamp.val();
            // Pega a chave (timestamp) do primeiro (e único) item
            const timestampKey = Object.keys(remoteData)[0];
            remoteTimestamp = parseInt(timestampKey, 10) || 0; // Converte para número, fallback 0
        }
         // Salva o timestamp local APENAS se ele foi encontrado remotamente
         if (remoteTimestamp > 0) {
            await setItem(`timestamp_local_change_${planilhaNome}`, remoteTimestamp);
            console.log(`Timestamp inicial (${remoteTimestamp}) de "${planilhaNome}" salvo localmente.`);
         } else {
            console.log(`Nenhum timestamp remoto encontrado para "${planilhaNome}". Timestamp local não definido.`);
            // Opcional: remover timestamp local se não houver remoto? Ou manter 0? Manter 0 é mais seguro.
            await setItem(`timestamp_local_change_${planilhaNome}`, 0);
         }


        Swal.close();
        // Obtém a tradução ANTES de exibir
        const loadedText = (await window.getTranslation(loadedTextKey)).replace('{planilhaNome}', planilhaNome);


        await Swal.fire({
            title: readyTitle,
            text: loadedText, // Usa o texto original que menciona o reload
            icon: "success",
        }).then(() => {
            location.reload(); // REINTRODUZIDO: Recarrega a página após download inicial
        });

    } catch (error) {
        console.error("Erro detalhado ao baixar dados iniciais:", error); // Log detalhado
        const errorText = (await window.getTranslation(downloadErrorKey)).replace('{errorMessage}', error.message);
        Swal.fire("Erro no Download", errorText, "error");
    }
}

// Verifica se há dados mais recentes no servidor e aplica as diferenças localmente.
async function sincronizarDados(user, planilhaNome) {
    if (!user || !user.uid || !planilhaNome) {
        console.error("UID do usuário ou nome da planilha ausente para sincronização.");
        return;
    }
    try {
        // Obtém o timestamp da última alteração local conhecida
        const localTimestamp = await getItem(`timestamp_local_change_${planilhaNome}`) || 0;
        console.log(`[Sync ${planilhaNome}] Timestamp local: ${localTimestamp}`);

        // Busca o timestamp da última alteração no Firebase
        const remoteTimestampRef = ref(database, `/users/${user.uid}/UltimasAlteracoes/${planilhaNome}`);
        const snapshot = await get(remoteTimestampRef);

        if (!snapshot.exists()) {
            console.log(`[Sync ${planilhaNome}] Nenhum timestamp remoto encontrado. Verificando alterações locais pendentes.`);
            window.dispatchEvent(new Event('checarAlteracoesLocais')); // Informa para verificar se há algo a enviar
            return;
        }

        const remoteData = snapshot.val();
        const remoteTimestampKey = Object.keys(remoteData)[0]; // A chave é o timestamp
        const remoteTimestamp = parseInt(remoteTimestampKey, 10) || 0;
        console.log(`[Sync ${planilhaNome}] Timestamp remoto: ${remoteTimestamp}`);

        if (remoteTimestamp > localTimestamp) {
            console.log(`[Sync ${planilhaNome}] Dados remotos (${remoteTimestamp}) mais recentes que locais (${localTimestamp}). Aplicando alterações...`);
            await aplicarAlteracoesRemotas(user, planilhaNome, localTimestamp, remoteTimestamp);
        } else {
            console.log(`[Sync ${planilhaNome}] Dados locais estão atualizados ou mais recentes. Verificando alterações locais pendentes.`);
            window.dispatchEvent(new Event('checarAlteracoesLocais')); // Informa para verificar se há algo a enviar
        }

    } catch (error) {
        console.error(`[Sync ${planilhaNome}] Erro durante a sincronização:`, error);
        await ensureSwalIsLoaded();
        // Considerar tradução para a mensagem de erro
        Swal.fire("Erro de Sincronização", "Não foi possível verificar as atualizações do servidor.", "error");
    }
}

// Aplica as alterações do histórico do Firebase ao estado local (IndexedDB).
async function aplicarAlteracoesRemotas(user, planilhaNome, localTimestamp, remoteTimestamp) {
    await ensureSwalIsLoaded();
    console.log(`[Apply ${planilhaNome}] Buscando histórico a partir de ${localTimestamp + 1}`);

    // Traduções
    const updatedTitle = await window.getTranslation('update_spreedsheet');
    const updatedText = await window.getTranslation('update_spreedsheet_text'); // Usa texto original que menciona reload

    try {
        // Busca entradas no histórico que ocorreram DEPOIS do timestamp local
        const historyRef = ref(database, `users/${user.uid}/historico_alteracoes/${planilhaNome}`);
        const q = query(historyRef, orderByChild('timestamp'), startAt(localTimestamp + 1));

        const snapshot = await get(q);
        if (!snapshot.exists()) {
            console.warn(`[Apply ${planilhaNome}] Timestamp remoto (${remoteTimestamp}) é mais novo, mas não foram encontradas alterações no histórico após ${localTimestamp}. Atualizando apenas o timestamp local.`);
            await setItem(`timestamp_local_change_${planilhaNome}`, remoteTimestamp); // Atualiza timestamp local mesmo assim
            window.dispatchEvent(new Event('checarAlteracoesLocais')); // Verifica se há algo local para enviar
            return;
        }

        console.log(`[Apply ${planilhaNome}] ${snapshot.size} entrada(s) de histórico encontradas para aplicar.`);

        // Carrega o estado atual da planilha e lemas locais
        const localSheetKey = `planilha_${planilhaNome}`;
        const localLemasKey = `lemas_${planilhaNome}`;
        let localSheet = await getItem(localSheetKey);
        let localLemas = await getItem(localLemasKey) || {};

        // Verifica se a planilha local existe. Se não, algo deu errado antes.
        if (!localSheet || !Array.isArray(localSheet)) {
             console.error(`[Apply ${planilhaNome}] Planilha local não encontrada ou inválida. Forçando redownload.`);
             // Força um redownload completo se a base local estiver faltando
             await baixarPlanilhaInicial(user, planilhaNome);
             return; // Interrompe a aplicação de alterações parciais
        }


        let changesApplied = false;

        // Itera sobre cada PUSH no histórico (cada um contém um lote de alterações)
        snapshot.forEach(childSnapshot => {
            const entry = childSnapshot.val();
            const entryTimestamp = entry.timestamp; // Timestamp do lote de alterações
            const changes = entry.changes; // Objeto com as alterações (pathKey: {value, type})

            console.log(`[Apply ${planilhaNome}] Processando lote do histórico com timestamp: ${entryTimestamp}`);

            // Itera sobre CADA alteração DENTRO do lote do histórico
            for (const pathKey in changes) {
                const changeData = changes[pathKey];
                const value = changeData.value;
                const type = changeData.type; // Tipo da alteração ('data', 'action')
                const pathParts = pathKey.split('___'); // Reverte a substituição de '/'
                const nodeType = pathParts[0]; // Tipo de nó (lematizacoes, remocoes, fusao_evocacao)

                console.log(`[Apply ${planilhaNome}] - Alteração: tipo=${type}, nó=${nodeType}, pathKey=${pathKey}`);
                changesApplied = true; // Marca que houve alterações a aplicar

                // Aplica alterações de DADOS (lematizações)
                if (type === 'data' && nodeType === 'lematizacoes') {
                    const lemaKey = pathParts.slice(2).join('/'); // Recria a chave do lema
                    if (value === null) { // Deleção
                        delete localLemas[lemaKey];
                        console.log(`[Apply ${planilhaNome}] -- Lema removido: ${lemaKey}`);
                    } else { // Criação/Atualização
                        localLemas[lemaKey] = value;
                        console.log(`[Apply ${planilhaNome}] -- Lema atualizado/criado: ${lemaKey}`);
                    }
                }
                // Aplica AÇÕES (remoções) na planilha local
                else if (type === 'action' && nodeType === 'remocoes') {
                    const palavrasRemovidas = value; // 'value' aqui é a lista de palavras removidas
                    if (Array.isArray(palavrasRemovidas)) {
                        console.log(`[Apply ${planilhaNome}] -- Aplicando ação de remoção:`, palavrasRemovidas);
                        localSheet = localSheet.map((row, rowIndex) => {
                            if (rowIndex === 0 || !Array.isArray(row)) return row; // Mantém cabeçalho e linhas inválidas
                            return row.map(cell => {
                                const valor = String(cell || "").trim().toUpperCase();
                                return palavrasRemovidas.includes(valor) ? "VAZIO" : cell;
                            });
                        });
                    } else {
                         console.warn(`[Apply ${planilhaNome}] -- Ignorando ação de remoção inválida:`, value);
                    }
                }
                // Aplica AÇÕES (fusões) na planilha local
                else if (type === 'action' && nodeType === 'fusao_evocacao') {
                    const { novoNome, palavrasOrigem } = value; // 'value' é o objeto {novoNome, palavrasOrigem}
                    if (novoNome && Array.isArray(palavrasOrigem)) {
                        console.log(`[Apply ${planilhaNome}] -- Aplicando ação de fusão: ${palavrasOrigem.join(', ')} -> ${novoNome}`);
                        localSheet = localSheet.map((row, rowIndex) => {
                            if (rowIndex === 0 || !Array.isArray(row)) return row; // Mantém cabeçalho e linhas inválidas
                            return row.map(cell => {
                                const valor = String(cell || "").trim().toUpperCase();
                                return palavrasOrigem.includes(valor) ? novoNome : cell;
                            });
                        });
                    } else {
                         console.warn(`[Apply ${planilhaNome}] -- Ignorando ação de fusão inválida:`, value);
                    }
                } else {
                     console.warn(`[Apply ${planilhaNome}] -- Tipo/Nó de alteração não reconhecido ou não aplicável: tipo=${type}, nó=${nodeType}`);
                }
            }
        });

        // Se alguma alteração foi aplicada, salva o novo estado local e atualiza o timestamp
        if (changesApplied) {
            console.log(`[Apply ${planilhaNome}] Salvando planilha e lemas atualizados localmente.`);
            await setItem(localSheetKey, localSheet);
            await setItem(localLemasKey, localLemas);
            await setItem(`timestamp_local_change_${planilhaNome}`, remoteTimestamp); // Atualiza para o timestamp mais recente recebido

            console.log(`[Apply ${planilhaNome}] Disparando alerta de atualização.`);
            Swal.fire({
                title: updatedTitle,
                text: updatedText, // Usa o texto original que menciona reload
                icon: "info",
                confirmButtonText: "Ok",
                allowOutsideClick: false
            }).then(() => location.reload()); // REINTRODUZIDO: Recarrega para refletir as mudanças

        } else {
             // Mesmo se nenhuma alteração específica foi aplicada (ex: histórico vazio ou só ações não reconhecidas),
             // atualiza o timestamp local para evitar reprocessar o mesmo histórico.
            console.log(`[Apply ${planilhaNome}] Nenhuma alteração aplicável encontrada, atualizando apenas timestamp local para ${remoteTimestamp}.`);
            await setItem(`timestamp_local_change_${planilhaNome}`, remoteTimestamp);
            window.dispatchEvent(new Event('checarAlteracoesLocais')); // Verifica se há algo local para enviar
        }
    } catch (error) {
        console.error(`[Apply ${planilhaNome}] Erro ao aplicar alterações remotas:`, error);
        // Considerar tradução para a mensagem de erro
        Swal.fire("Erro ao Atualizar", "Ocorreu um problema ao aplicar as alterações do servidor.", "error");
    }
}

/**
 * Função principal exportada: verifica se a planilha existe localmente,
 * baixa se não existir, ou sincroniza se existir.
 */
export async function verificarEProcessarPlanilha() {
    const user = getUserFromSession();
    const urlParams = new URLSearchParams(window.location.search);
    const planilhaNome = urlParams.get("planilha");

    if (!user || !planilhaNome) {
        console.log("Usuário não logado ou nome da planilha ausente na URL. Verificação de dados não iniciada.");
        return;
    }

    console.log(`Iniciando verificação/processamento para planilha: ${planilhaNome}`);

    try {
        const dadosLocais = await getItem(`planilha_${planilhaNome}`);
        if (!dadosLocais) {
            await baixarPlanilhaInicial(user, planilhaNome);
        } else {
            await sincronizarDados(user, planilhaNome);
        }
    } catch (error) {
        console.error("Erro crítico no processo de verificação/processamento da planilha:", error);
        await ensureSwalIsLoaded();
        Swal.fire("Erro Crítico", "Ocorreu um problema ao acessar ou sincronizar os dados da análise.", "error");
    }
}

