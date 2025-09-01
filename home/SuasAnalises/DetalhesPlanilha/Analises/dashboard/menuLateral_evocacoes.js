// menuLateral_evocacoes.js

import { getDatabase, ref, get, set, update } from "https://www.gstatic.com/firebasejs/9.9.3/firebase-database.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.9.3/firebase-app.js";
import firebaseConfig from '/firebase.js';

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

const DB_NAME = 'agoraDB';
const STORE_NAME = 'planilhas';

let hasUnsavedChanges = false;

// Funções de interação com IndexedDB (sem alterações)
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

// Funções de utilidade
function getUserFromSession() {
  const userData = sessionStorage.getItem('user');
  if (!userData) return null;
  try {
    return JSON.parse(userData);
  } catch (error) {
    console.error("Erro ao parsear usuário da sessão", error);
    return null;
  }
}

// Atualiza o timestamp no Firebase e retorna o valor para sincronia local
async function updateTimestamp(planilhaNome) {
  const user = getUserFromSession();
  if (!user) return null;
  const timestamp = Date.now();
  const caminho = `users/${user.uid}/UltimasAlteracoes/${planilhaNome}`;
  await set(ref(database, caminho), { [timestamp]: timestamp });
  console.log("Novo timestamp de sincronização registrado no Firebase.");
  return timestamp;
}

// --- FUNÇÃO PARA CONTROLAR O ESTADO VISUAL DO BOTÃO E POPUP ---
function setUnsavedChanges(status) {
    hasUnsavedChanges = status;
    const botaoSalvar = document.getElementById('botao-salvar');
    const popup = document.getElementById('popup-salvar');
    const seta = document.getElementById('seta-salvar'); // Pega a seta

    if (!botaoSalvar || !popup || !seta) return; // Verifica se a seta existe

    if (status) {
        botaoSalvar.classList.add('salvar-pendente');
        botaoSalvar.classList.remove('sem-alteracoes');
        popup.classList.add('show');
        seta.classList.add('show'); // Mostra a seta
    } else {
        botaoSalvar.classList.remove('salvar-pendente');
        botaoSalvar.classList.add('sem-alteracoes');
        popup.classList.remove('show');
        seta.classList.remove('show'); // Esconde a seta
    }
}

// --- FUNÇÃO DE SALVAMENTO (UPLOAD) NO FIREBASE ---
async function salvarAlteracoes() {
    if (!hasUnsavedChanges) {
        Swal.fire("Aviso", "Não há alterações pendentes para salvar.", "info");
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const planilhaNome = urlParams.get("planilha");
    const user = getUserFromSession();
    if (!planilhaNome || !user) {
        Swal.fire("Erro", "Não foi possível identificar a planilha ou o usuário.", "error");
        return;
    }

    Swal.fire({
        title: 'Salvando no Servidor...',
        text: 'Suas alterações estão sendo sincronizadas. Por favor, aguarde.',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    try {
        // 1. Pega a planilha inteira e atualizada do armazenamento local
        const dadosPlanilha = await getItem(`planilha_${planilhaNome}`);
        if (!dadosPlanilha) throw new Error("Dados da planilha local não encontrados.");

        // 2. Divide em chunks para o Firebase
        const chunkSize = 500;
        const chunks = {};
        for (let i = 0; i < dadosPlanilha.length; i += chunkSize) {
            chunks[`chunk_${i / chunkSize}`] = dadosPlanilha.slice(i, i + chunkSize);
        }

        // 3. Pega os dados de lematização atualizados do armazenamento local
        const dadosLemas = await getItem(`lemas_${planilhaNome}`);

        // 4. Envia tudo para o Firebase (sobrescrevendo os dados antigos)
        const planilhaRef = ref(database, `users/${user.uid}/planilhas/${planilhaNome}`);
        await set(planilhaRef, chunks);

        if (dadosLemas) {
            const lemaRef = ref(database, `users/${user.uid}/lematizacoes/${planilhaNome}`);
            await set(lemaRef, dadosLemas);
        }

        // 5. Atualiza o timestamp no Firebase para indicar que a sincronização foi concluída
        const syncedTimestamp = await updateTimestamp(planilhaNome);

        // 6. Atualiza o timestamp local para corresponder ao do servidor
        await setItem(`timestamp_local_change_${planilhaNome}`, syncedTimestamp);
        
        // 7. Limpa o estado de "pendente" na interface
        setUnsavedChanges(false);

        Swal.fire("Sucesso!", "Suas alterações foram salvas com sucesso no servidor.", "success");

    } catch (error) {
        console.error("Erro ao salvar alterações no Firebase:", error);
        Swal.fire("Erro", "Ocorreu um problema ao salvar suas alterações. Tente novamente.", "error");
    }
}


// --- FUNÇÕES DE MODIFICAÇÃO LOCAL ---

async function removerPalavrasSelecionadas() {
    const palavrasParaRemover = window.selectedEvocacoes || [];
    if (palavrasParaRemover.length === 0) {
        Swal.fire("Atenção", "Selecione pelo menos uma palavra para remover.", "warning");
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const planilhaNome = urlParams.get("planilha");
    if (!planilhaNome) return;

    Swal.fire({ title: 'Processando...', text: 'Removendo palavras localmente.', didOpen: () => Swal.showLoading() });

    try {
        const storedData = await getItem(`planilha_${planilhaNome}`);
        if (!storedData) throw new Error("Planilha não encontrada no armazenamento local.");

        let hasChanges = false;
        const updatedData = storedData.map(row => {
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
            Swal.fire("Aviso", "Nenhuma das palavras selecionadas foi encontrada na planilha.", "info");
            return;
        }

        // Salva a planilha modificada e o timestamp da alteração localmente
        await setItem(`planilha_${planilhaNome}`, updatedData);
        await setItem(`timestamp_local_change_${planilhaNome}`, Date.now());
        
        Swal.fire({
            title: 'Removido!',
            text: 'As palavras foram removidas localmente. A página será atualizada.',
            icon: 'success',
            confirmButtonText: 'Entendido'
        }).then(() => {
            location.reload();
        });

    } catch (error) {
        console.error("Erro ao remover palavras localmente:", error);
        Swal.fire("Erro", "Ocorreu um problema ao remover as palavras.", "error");
    }
}

async function fundirPalavrasSelecionadas() {
  const palavrasSelecionadas = window.selectedEvocacoes || [];
  if (palavrasSelecionadas.length < 2) {
    Swal.fire("Atenção", "Selecione pelo menos duas palavras para fundir.", "warning");
    return;
  }

  const { value: novoNomeRaw } = await Swal.fire({
      title: 'Fundir Palavras', input: 'text', inputLabel: 'Digite o nome para a nova palavra fundida',
      inputPlaceholder: 'Ex: TRANSPORTE PÚBLICO', showCancelButton: true,
      inputValidator: (value) => !value && 'Você precisa digitar um nome!'
  });

  if (!novoNomeRaw) return;
  const novoNome = novoNomeRaw.trim().toUpperCase();

  const urlParams = new URLSearchParams(window.location.search);
  const planilhaNome = urlParams.get("planilha");
  const user = getUserFromSession();
  if (!planilhaNome || !user) return;

  Swal.fire({ title: 'Processando...', text: 'Fundindo palavras localmente.', didOpen: () => Swal.showLoading() });

  try {
    const storedData = await getItem(`planilha_${planilhaNome}`);
    if (!storedData) throw new Error("Planilha não encontrada no armazenamento local.");

    let hasChanges = false;
    const counts = {};
    palavrasSelecionadas.forEach(p => counts[p] = 0);

    const updatedData = storedData.map(row => {
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
        Swal.fire("Aviso", "Nenhuma das palavras selecionadas foi encontrada para fusão.", "info");
        return;
    }

    // Atualiza os dados de lematização localmente
    const lemasAtuais = await getItem(`lemas_${planilhaNome}`) || {};
    lemasAtuais[novoNome] = palavrasSelecionadas.map(p => `${p} (${counts[p] || 0})`);
    
    // Salva a planilha, os lemas e o timestamp da alteração localmente
    await setItem(`planilha_${planilhaNome}`, updatedData);
    await setItem(`lemas_${planilhaNome}`, lemasAtuais);
    await setItem(`timestamp_local_change_${planilhaNome}`, Date.now());
    
    Swal.fire({
        title: 'Fundido!',
        text: 'As palavras foram fundidas localmente. A página será atualizada.',
        icon: 'success',
        confirmButtonText: 'Entendido'
    }).then(() => {
        location.reload();
    });

  } catch (error) {
    console.error("Erro ao fundir palavras localmente:", error);
    Swal.fire("Erro", "Ocorreu um problema ao fundir as palavras.", "error");
  }
}

// --- CRIAÇÃO DO MENU E EVENT LISTENERS ---

function criarMenuLateral() {
  const menu = document.createElement("div");
  menu.classList.add("menu-lateral");

  const makeBtn = (label, iconClass, onClick) => {
    const btn = document.createElement("button");
    btn.type = "button"; btn.className = "menu-botao";
    const circle = document.createElement("div");
    circle.className = "icone-circulo";
    const icon = document.createElement("i");
    icon.className = iconClass;
    circle.appendChild(icon);
    const text = document.createElement("span");
    text.textContent = label;
    btn.appendChild(circle);
    btn.appendChild(text);
    btn.onclick = onClick;
    return btn;
  };

  const botaoSalvar = makeBtn("Salvar", "fa-solid fa-cloud-arrow-up", salvarAlteracoes);
  botaoSalvar.id = 'botao-salvar';

  const botaoRemover = makeBtn("Remover", "fas fa-trash", removerPalavrasSelecionadas);
  const botaoFundir  = makeBtn("Fundir",  "fas fa-compress", fundirPalavrasSelecionadas);
  const botaoFusoes  = makeBtn("Fusões",  "fas fa-random", () => {
    window.filtroFusoes = true;
    window.dispatchEvent(new CustomEvent("atualizarTabelaEvocacoes"));
  });
  const botaoExibir  = makeBtn("Exibir todas", "fas fa-eye", () => {
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

window.addEventListener("DOMContentLoaded", () => {
  criarMenuLateral();
  // Escuta o evento disparado por 'atualizacao.js'
  window.addEventListener('alteracoesPendentesDetectadas', () => {
      setUnsavedChanges(true);
  });
});

