import { initializeApp } from "https://www.gstatic.com/firebasejs/9.9.3/firebase-app.js";
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/9.9.3/firebase-database.js";
// Adicionada a importação do 'onAuthStateChanged'
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.9.3/firebase-auth.js";
import firebaseConfig from '/firebase.js';

// 1. Inicializar o Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const auth = getAuth(app); // Inicializa o Auth para usar o observador

const DB_NAME = 'agoraDB';
const STORE_NAME = 'planilhas';

// Abre ou cria o banco de dados IndexedDB
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

// 2. Recuperar o usuário da sessão
function getUser() {
  const userData = sessionStorage.getItem('user');
  if (!userData) {
    console.error("Dados do usuário não encontrados na sessão.");
    return null;
  }
  try {
    const parsed = JSON.parse(userData);
    return { uid: parsed.uid };
  } catch (error) {
    console.error("Erro ao analisar dados do usuário:", error);
    return null;
  }
}
const user = getUser();

// 3. Exibir ou ocultar "loading"
function toggleLoading(show) {
  const loadingElement = document.getElementById('loading');
  if (loadingElement) {
    loadingElement.style.display = show ? 'flex' : 'none';
  }
}

// 4. Verificar planilhas no IndexedDB e remover as que não existem mais no Firebase
async function verificarPlanilhasIndexedDB() {
  try {
    if (!user || !user.uid) {
      console.error("Usuário não autenticado.");
      return;
    }

    const db = await openDB();
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const getAllKeysRequest = store.getAllKeys();

    const planilhasSalvas = await new Promise((resolve, reject) => {
        getAllKeysRequest.onsuccess = (event) => {
            resolve(event.target.result.filter(key => key.startsWith("planilha_")));
        };
        getAllKeysRequest.onerror = (event) => reject(event.target.error);
    });

    const planilhasPrincipais = planilhasSalvas
      .filter(key => !key.startsWith("planilha_auxiliar_") && !key.startsWith("planilha_ultima_alteracao_"));

    const token = await auth.currentUser.getIdToken();
    const shallowQueryUrl = `${firebaseConfig.databaseURL}/users/${user.uid}/planilhas.json?auth=${token}&shallow=true`;
    const response = await fetch(shallowQueryUrl);
    const planilhasShallow = await response.json();
    const planilhasNoFirebase = planilhasShallow ? Object.keys(planilhasShallow) : [];

    console.log("Planilhas no Firebase (verificação):", planilhasNoFirebase);

    const deleteTransaction = db.transaction(STORE_NAME, 'readwrite');
    const deleteStore = deleteTransaction.objectStore(STORE_NAME);

    planilhasPrincipais.forEach(planilhaKey => {
      const nomePlanilha = planilhaKey.replace("planilha_", "");
      if (!planilhasNoFirebase.includes(nomePlanilha)) {
        deleteStore.delete(planilhaKey);
        deleteStore.delete(`planilha_auxiliar_${nomePlanilha}`);
        deleteStore.delete(`planilha_ultima_alteracao_${nomePlanilha}`);
        console.log(`Planilha "${nomePlanilha}" e seus dados auxiliares foram removidos do IndexedDB.`);
      }
    });

  } catch (error) {
    console.error("Erro ao verificar planilhas no IndexedDB:", error);
  }
}

// 5. Carregar e exibir a lista de planilhas
async function loadPlanilhas() {
  if (!user) return;
  toggleLoading(true);

  try {
    const token = await auth.currentUser.getIdToken();
    const shallowQueryUrl = `${firebaseConfig.databaseURL}/users/${user.uid}/planilhas.json?auth=${token}&shallow=true`;

    const response = await fetch(shallowQueryUrl);
    if (!response.ok) {
      throw new Error(`Erro na requisição shallow: ${response.statusText}`);
    }
    const planilhasShallow = await response.json();
    const planilhaNomes = planilhasShallow ? Object.keys(planilhasShallow) : [];

    toggleLoading(false);

    const container = document.getElementById('planilhasContainer');
    if (planilhaNomes.length === 0) {
      container.innerHTML = "<p>Nenhuma planilha encontrada.</p>";
      return;
    }

    const db = await openDB();
    container.innerHTML = '';

    for (const planilhaNome of planilhaNomes) {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);

      const planilhaReq = store.get(`planilha_${planilhaNome}`);
      const auxiliarReq = store.get(`planilha_auxiliar_${planilhaNome}`);
      const modReq = store.get(`planilha_ultima_alteracao_${planilhaNome}`);

      const [planilhaData, auxiliarData, modData] = await Promise.all([
          new Promise(r => { planilhaReq.onsuccess = e => r(e.target.result); }),
          new Promise(r => { auxiliarReq.onsuccess = e => r(e.target.result); }),
          new Promise(r => { modReq.onsuccess = e => r(e.target.result); })
      ]);

      if (!planilhaData) await fetchAndSavePlanilha(planilhaNome);
      if (!auxiliarData) await fetchAndSaveAuxiliaryTable(planilhaNome);
      if (!modData) await fetchAndSaveLastModification(planilhaNome);

      const button = document.createElement('button');
      button.classList.add('planilha-button');
      button.innerHTML = `
        <span class="label">
          <img class="icon" src="/assets/icone_suas_analises.png" alt="Ícone planilha">
          ${planilhaNome}
        </span>
        <img class="config-icon" src="/assets/icone_admin.png" alt="Configuração">
      `;
      button.addEventListener('click', () => handlePlanilhaClick(planilhaNome));
      container.appendChild(button);
    }
  } catch (error) {
    toggleLoading(false);
    console.error("Erro ao carregar a lista de planilhas:", error);
    document.getElementById('planilhasContainer').innerHTML = "<p>Erro ao carregar as planilhas.</p>";
  }
}

// 6. Buscar e salvar planilha no IndexedDB
async function fetchAndSavePlanilha(planilhaNome) {
    const fileRef = ref(database, `/users/${user.uid}/planilhas/${planilhaNome}`);
    try {
        const snapshot = await get(fileRef);
        if (!snapshot.exists()) {
            console.warn(`A planilha "${planilhaNome}" não foi encontrada no Firebase.`);
            return;
        }
        const planilhaChunks = snapshot.val();
        let fullPlanilhaData = [];
        Object.keys(planilhaChunks).forEach(chunkKey => {
            fullPlanilhaData = fullPlanilhaData.concat(planilhaChunks[chunkKey]);
        });
        await saveToIndexedDB(`planilha_${planilhaNome}`, fullPlanilhaData);
    } catch (error) {
        console.error("Erro ao buscar a planilha:", error);
    }
}

// 7. Buscar e salvar tabela auxiliar
async function fetchAndSaveAuxiliaryTable(fileName) {
  const auxiliaryRef = ref(database, `/users/${user.uid}/tabelasAuxiliares/${fileName}`);
  try {
    const snapshot = await get(auxiliaryRef);
    if (!snapshot.exists()) {
      console.warn(`Tabela auxiliar "${fileName}" não encontrada.`);
      return;
    }
    const auxiliaryChunks = snapshot.val();
    let fullAuxiliaryData = [];
    Object.keys(auxiliaryChunks).forEach(chunkKey => {
      fullAuxiliaryData = fullAuxiliaryData.concat(auxiliaryChunks[chunkKey]);
    });
    await saveToIndexedDB(`planilha_auxiliar_${fileName}`, fullAuxiliaryData);
  } catch (error) {
    console.error(`Erro ao buscar a tabela auxiliar "${fileName}":`, error);
  }
}

// 8. Buscar e salvar data de última alteração
async function fetchAndSaveLastModification(fileName) {
  const modRef = ref(database, `/users/${user.uid}/UltimasAlteracoes/${fileName}`);
  try {
    const snapshot = await get(modRef);
    if (!snapshot.exists()) {
      console.warn(`Data de última alteração para "${fileName}" não encontrada.`);
      return;
    }
    const modifications = snapshot.val();
    const latestModification = Object.values(modifications).sort((a, b) => b.timestamp - a.timestamp)[0];
    await saveToIndexedDB(`planilha_ultima_alteracao_${fileName}`, latestModification);
  } catch (error) {
    console.error(`Erro ao buscar data de última alteração para "${fileName}":`, error);
  }
}

// 9. Função genérica para salvar dados no IndexedDB
async function saveToIndexedDB(key, data) {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.put({ key, value: data });
    console.log(`Dados salvos no IndexedDB com a chave "${key}".`);
  } catch (error) {
    console.error("Erro ao salvar no IndexedDB:", error);
  }
}

// 10. Clique em uma planilha
function handlePlanilhaClick(planilhaNome) {
  Swal.fire({
    title: `Planilha: ${planilhaNome}`,
    text: 'O que você deseja fazer?',
    icon: 'info',
    showCancelButton: true,
    confirmButtonText: 'Abrir',
    cancelButtonText: 'Cancelar',
  }).then(result => {
    if (result.isConfirmed) {
      console.log(`Abrindo a planilha: ${planilhaNome}`);
      window.location.href = `./DetalhesPlanilha/menu_da_analise.html?planilha=${encodeURIComponent(planilhaNome)}`;
    }
  });
}

// ... (as funções de debug podem ser mantidas, mas não são essenciais para a funcionalidade)

// 13. Evento de inicialização (MODIFICADO)
document.addEventListener('DOMContentLoaded', () => {
  // Verifica o usuário da sessão primeiro
  if (!user) {
    console.log("Nenhum usuário na sessão, redirecionando...");
    window.location.href = '/index.html';
    return;
  }

  // Usa o onAuthStateChanged para garantir que o Firebase Auth está inicializado
  onAuthStateChanged(auth, async (firebaseUser) => {
    if (firebaseUser) {
      // O usuário está logado e o objeto auth está pronto.
      console.log("Estado de autenticação do Firebase confirmado. Usuário:", firebaseUser.uid);
      
      // Agora é seguro chamar as funções que dependem da autenticação
      await verificarPlanilhasIndexedDB();
      await loadPlanilhas();
    } else {
      // O usuário não está logado.
      console.log("Usuário não está autenticado no Firebase. Redirecionando...");
      window.location.href = '/index.html';
    }
  });
});