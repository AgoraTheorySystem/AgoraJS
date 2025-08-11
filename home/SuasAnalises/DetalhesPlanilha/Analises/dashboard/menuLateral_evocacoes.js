// menuLateral_evocacoes.js

import { getDatabase, ref, get, set, update } from "https://www.gstatic.com/firebasejs/9.9.3/firebase-database.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.9.3/firebase-app.js";
import firebaseConfig from '/firebase.js';

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

const DB_NAME = 'agoraDB';
const STORE_NAME = 'planilhas';

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

// Funções de utilidade (sem alterações)
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

async function updateTimestamp(planilhaNome) {
  const user = getUserFromSession();
  if (!user) return;
  const timestamp = Date.now();
  const caminho = `users/${user.uid}/UltimasAlteracoes/${planilhaNome}`;
  await set(ref(database, caminho), { [timestamp]: timestamp });
  console.log("Novo timestamp registrado com sucesso.");
}


// A função removerPalavrasSelecionadas foi otimizada para usar a mesma lógica eficiente
async function removerPalavrasSelecionadas() {
    const palavrasParaRemover = window.selectedEvocacoes || [];
    if (palavrasParaRemover.length === 0) {
        Swal.fire("Atenção", "Selecione pelo menos uma palavra para remover.", "warning");
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const planilhaNome = urlParams.get("planilha");
    const user = getUserFromSession();

    if (!planilhaNome || !user) {
        Swal.fire("Erro", "Não foi possível identificar a planilha ou o usuário.", "error");
        return;
    }

    Swal.fire({ title: 'Processando...', text: 'Removendo palavras, por favor aguarde.', didOpen: () => Swal.showLoading() });

    try {
        const storedData = await getItem(`planilha_${planilhaNome}`);
        if (!storedData) throw new Error("Planilha não encontrada no armazenamento local.");

        const updates = {};
        const chunkSize = 500;
        let hasChanges = false;

        const updatedData = storedData.map((row, rowIndex) => {
            return row.map((cell, cellIndex) => {
                const valor = String(cell || "").trim().toUpperCase();
                if (palavrasParaRemover.includes(valor)) {
                    hasChanges = true;
                    const chunkIndex = Math.floor(rowIndex / chunkSize);
                    const rowIndexInChunk = rowIndex % chunkSize;
                    const path = `users/${user.uid}/planilhas/${planilhaNome}/chunk_${chunkIndex}/${rowIndexInChunk}/${cellIndex}`;
                    updates[path] = "VAZIO";
                    return "VAZIO"; // Atualiza a cópia local também
                }
                return cell;
            });
        });

        if (!hasChanges) {
            Swal.fire("Aviso", "Nenhuma das palavras selecionadas foi encontrada na planilha.", "info");
            return;
        }

        await update(ref(database), updates); // Envia todas as atualizações de uma vez para o Firebase
        await setItem(`planilha_${planilhaNome}`, updatedData); // Salva a planilha atualizada no IndexedDB
        await updateTimestamp(planilhaNome); // Atualiza o timestamp

        Swal.close();
        Swal.fire("Sucesso!", "Palavras removidas. A página será recarregada.", "success").then(() => location.reload());

    } catch (error) {
        console.error("Erro ao remover palavras:", error);
        Swal.fire("Erro", "Ocorreu um problema ao remover as palavras. Verifique o console.", "error");
    }
}


// ===== FUNÇÃO FUNDIRPALAVRASSELECIONADAS (TOTALMENTE OTIMIZADA) =====
async function fundirPalavrasSelecionadas() {
  const palavrasSelecionadas = window.selectedEvocacoes || [];
  if (palavrasSelecionadas.length < 2) {
    Swal.fire("Atenção", "Selecione pelo menos duas palavras para fundir.", "warning");
    return;
  }

  const { value: novoNomeRaw } = await Swal.fire({
      title: 'Fundir Palavras',
      input: 'text',
      inputLabel: 'Digite o nome para a nova palavra fundida',
      inputPlaceholder: 'Ex: TRANSPORTE PÚBLICO',
      showCancelButton: true,
      inputValidator: (value) => !value && 'Você precisa digitar um nome!'
  });

  if (!novoNomeRaw) return;
  const novoNome = novoNomeRaw.trim().toUpperCase();

  const urlParams = new URLSearchParams(window.location.search);
  const planilhaNome = urlParams.get("planilha");
  const user = getUserFromSession();

  if (!planilhaNome || !user) {
    Swal.fire("Erro", "Não foi possível identificar a planilha ou o usuário.", "error");
    return;
  }

  Swal.fire({ title: 'Processando...', text: 'Fundindo palavras e atualizando os dados. Isso pode levar um momento.', didOpen: () => Swal.showLoading() });

  try {
    // 1. Pega a planilha do armazenamento local (IndexedDB), que é mais rápido
    const storedData = await getItem(`planilha_${planilhaNome}`);
    if (!storedData) {
      throw new Error("Planilha não encontrada no armazenamento local.");
    }

    // 2. Prepara o objeto para a atualização multi-caminho do Firebase
    const updates = {};
    const chunkSize = 500; // Deve ser o mesmo chunk size usado no upload
    let hasChanges = false;
    const counts = {};
    palavrasSelecionadas.forEach(p => counts[p] = 0);

    // 3. Itera sobre a cópia dos dados para encontrar as células a serem alteradas
    const updatedData = storedData.map((row, rowIndex) => {
      return row.map((cell, cellIndex) => {
        const valor = String(cell || "").trim().toUpperCase();

        if (palavrasSelecionadas.includes(valor)) {
            hasChanges = true;
            counts[valor] = (counts[valor] || 0) + 1; // Conta ocorrências para a lematização

            // Calcula o caminho exato da célula no Firebase
            const chunkIndex = Math.floor(rowIndex / chunkSize);
            const rowIndexInChunk = rowIndex % chunkSize;
            const path = `users/${user.uid}/planilhas/${planilhaNome}/chunk_${chunkIndex}/${rowIndexInChunk}/${cellIndex}`;
            
            // Adiciona a alteração ao objeto de updates
            updates[path] = novoNome;
            
            return novoNome; // Retorna o novo valor para a cópia atualizada
        }
        return cell; // Mantém o valor original
      });
    });

    if (!hasChanges) {
        Swal.fire("Aviso", "Nenhuma das palavras selecionadas foi encontrada para fusão.", "info");
        return;
    }

    // 4. Executa todas as operações de uma vez
    await update(ref(database), updates); // Envia todas as atualizações de uma vez para o Firebase
    await setItem(`planilha_${planilhaNome}`, updatedData); // Salva a planilha inteira e atualizada no IndexedDB

    // 5. Atualiza a lematização
    const lemaRef = ref(database, `users/${user.uid}/lematizacoes/${planilhaNome}`);
    const lemaSnapshot = await get(lemaRef);
    const lemaAtual = lemaSnapshot.exists() ? lemaSnapshot.val() : {};
    // O formato de lematização desejado
    lemaAtual[novoNome] = palavrasSelecionadas.map(palavra => `${palavra} (${counts[palavra] || 0})`);
    await set(lemaRef, lemaAtual);

    // 6. Atualiza o timestamp e recarrega a página
    await updateTimestamp(planilhaNome);
    
    Swal.close();
    Swal.fire("Sucesso!", "Palavras fundidas com sucesso. A página será recarregada.", "success").then(() => {
        location.reload();
    });

  } catch (error) {
    console.error("Erro ao fundir palavras:", error);
    Swal.fire("Erro", "Ocorreu um problema ao fundir as palavras. Verifique o console.", "error");
  }
}

function criarMenuLateral() {
  const menu = document.createElement("div");
  menu.classList.add("menu-lateral");

  const makeBtn = (label, iconClass, onClick) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "menu-botao";
    
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

  // Botão fusão
  const botaoFusao = makeBtn("Fusão", "fas fa-object-group", () => {
  });

  menu.appendChild(botaoRemover);
  menu.appendChild(botaoFundir);
  menu.appendChild(botaoFusoes);
  menu.appendChild(botaoExibir);
  menu.appendChild(botaoFusao);

  document.body.appendChild(menu);
}


window.addEventListener("DOMContentLoaded", () => {
  criarMenuLateral();
});