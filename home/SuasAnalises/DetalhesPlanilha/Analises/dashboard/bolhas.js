import { gerarBolhasSocioeconomica } from './bolha_socioeconomica.js';
import { gerarBolhasConectividade } from './bolha_conectividade.js';

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

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

// Pega um item do IndexedDB
async function getItem(key) {
    const db = await openDB();
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(key);

    return new Promise((resolve, reject) => {
        request.onsuccess = (event) => {
            resolve(event.target.result ? event.target.result.value : null);
        };
        request.onerror = (event) => {
            reject(event.target.error);
        };
    });
}


window.gerarBolhas = async function(parametros) {
  const existing = document.getElementById("bolhasContainer");
  if (existing) existing.remove();

  const planilhasContainer = document.getElementById("planilhasContainer");
  const bolhasContainer = document.createElement("div");
  bolhasContainer.id = "bolhasContainer";
  bolhasContainer.style.marginTop = "2rem";
  planilhasContainer.insertAdjacentElement("afterend", bolhasContainer);

  const urlParams = new URLSearchParams(window.location.search);
  const planilhaNome = urlParams.get("planilha");
  const raw = await getItem(`planilha_${planilhaNome}`);
  if (!raw) {
    bolhasContainer.innerHTML += "<p>Erro: planilha não encontrada no IndexedDB.</p>";
    return;
  }

  const data = raw;
  const headers = data[0];
  const rows = data.slice(1);

  if (parametros.analise === "Conectividade") {
    gerarBolhasConectividade(parametros, headers, rows, bolhasContainer);
  } else {
    gerarBolhasSocioeconomica(parametros, headers, rows);
  }
};