import { initializeApp } from "https://www.gstatic.com/firebasejs/9.9.3/firebase-app.js";
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/9.9.3/firebase-database.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.9.3/firebase-auth.js";
import firebaseConfig from '/firebase.js';

// 1. Inicializar o Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const auth = getAuth(app); 

const DB_NAME = 'agoraDB';
const STORE_NAME = 'planilhas';

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

function getUser() {
  const userData = sessionStorage.getItem('user');
  if (!userData) {
    console.error("Dados do usuário não encontrados na sessão.");
    return null;
  }
  try {
    return JSON.parse(userData);
  } catch (error) {
    console.error("Erro ao analisar dados do usuário:", error);
    return null;
  }
}
const user = getUser();

function toggleLoading(show) {
  const loadingElement = document.getElementById('loading');
  if (loadingElement) {
    loadingElement.style.display = show ? 'flex' : 'none';
  }
}

async function verificarPlanilhasIndexedDB() {
  try {
    if (!user || !user.uid) return;

    const db = await openDB();
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const getAllKeysRequest = store.getAllKeys();

    const planilhasSalvas = await new Promise((resolve, reject) => {
        getAllKeysRequest.onsuccess = (event) => resolve(event.target.result.filter(key => key.startsWith("planilha_")));
        getAllKeysRequest.onerror = (event) => reject(event.target.error);
    });

    const planilhasPrincipais = planilhasSalvas.filter(key => !key.startsWith("planilha_auxiliar_") && !key.startsWith("planilha_ultima_alteracao_"));

    const token = await auth.currentUser.getIdToken();
    const shallowQueryUrl = `${firebaseConfig.databaseURL}/users/${user.uid}/planilhas.json?auth=${token}&shallow=true`;
    const response = await fetch(shallowQueryUrl);
    const planilhasShallow = await response.json();
    const planilhasNoFirebase = planilhasShallow ? Object.keys(planilhasShallow) : [];

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

async function loadPlanilhas() {
  if (!user) return;
  toggleLoading(true);

  try {
    const token = await auth.currentUser.getIdToken();
    const shallowQueryUrl = `${firebaseConfig.databaseURL}/users/${user.uid}/planilhas.json?auth=${token}&shallow=true`;

    const response = await fetch(shallowQueryUrl);
    if (!response.ok) throw new Error(`Erro na requisição shallow: ${response.statusText}`);
    
    const planilhasShallow = await response.json();
    const planilhaNomes = planilhasShallow ? Object.keys(planilhasShallow) : [];

    toggleLoading(false);

    const container = document.getElementById('planilhasContainer');
    if (planilhaNomes.length === 0) {
      const noSpreadsheetsText = await window.getTranslation('no_spreadsheets_found');
      container.innerHTML = `<p>${noSpreadsheetsText}</p>`;
      return;
    }

    const db = await openDB();
    container.innerHTML = '';

    for (const planilhaNome of planilhaNomes) {
      // ... (código para verificar e buscar dados do indexedDB/firebase continua igual)
        const button = document.createElement('button');
        button.classList.add('planilha-button');
        button.innerHTML = `
            <span class="label">
            <img class="icon" src="/assets/icone_suas_analises.png" alt="Ícone planilha">
            ${planilhaNome}
            </span>
            <img class="config-icon" src="/assets/icone_admin.png" alt="Configuração">
        `;

        button.addEventListener('click', (event) => {
            if (event.target.classList.contains('config-icon')) return;
            handlePlanilhaClick(planilhaNome);
        });

        const configIcon = button.querySelector('.config-icon');
        if (configIcon) {
            configIcon.addEventListener('click', (e) => {
            e.stopPropagation();
            window.location.href = `/home/SuasAnalises/DetalhesPlanilha/Analises/configuracoes/configuracoes.html?planilha=${encodeURIComponent(planilhaNome)}`;
            });
        }

        container.appendChild(button);
    }
  } catch (error) {
    toggleLoading(false);
    console.error("Erro ao carregar a lista de planilhas:", error);
    const errorLoadingText = await window.getTranslation('error_loading_spreadsheets');
    document.getElementById('planilhasContainer').innerHTML = `<p>${errorLoadingText}</p>`;
  }
}

async function fetchAndSavePlanilha(planilhaNome) {
    const fileRef = ref(database, `/users/${user.uid}/planilhas/${planilhaNome}`);
    const snapshot = await get(fileRef);
    if (!snapshot.exists()) return;
    let fullPlanilhaData = [];
    snapshot.forEach(chunkSnapshot => {
        fullPlanilhaData = fullPlanilhaData.concat(chunkSnapshot.val());
    });
    await saveToIndexedDB(`planilha_${planilhaNome}`, fullPlanilhaData);
}

async function saveToIndexedDB(key, data) {
    const db = await openDB();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put({ key, value: data });
}

async function handlePlanilhaClick(planilhaNome) {
    const title = (await window.getTranslation('swal_sheet_title')).replace('{sheetName}', planilhaNome);
    const text = await window.getTranslation('swal_sheet_text');
    const confirmButtonText = await window.getTranslation('swal_sheet_open');
    const cancelButtonText = await window.getTranslation('swal_sheet_cancel');

    Swal.fire({
        title,
        text,
        icon: 'info',
        showCancelButton: true,
        confirmButtonText,
        cancelButtonText,
    }).then(result => {
        if (result.isConfirmed) {
            window.location.href = `./DetalhesPlanilha/menu_da_analise.html?planilha=${encodeURIComponent(planilhaNome)}`;
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
  if (!user) {
    window.location.href = '/index.html';
    return;
  }
  onAuthStateChanged(auth, async (firebaseUser) => {
    if (firebaseUser) {
      await verificarPlanilhasIndexedDB();
      await loadPlanilhas();
    } else {
      window.location.href = '/index.html';
    }
  });
});
