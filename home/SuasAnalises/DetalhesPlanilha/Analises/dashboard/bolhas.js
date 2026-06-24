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
  const lemas = await getItem(`lemas_${planilhaNome}`) || {};

  if (!raw) {
    const errorMessage = await window.getTranslation('bolhas_sheet_not_found_error');
    bolhasContainer.innerHTML = `<p>${errorMessage}</p>`;
    return;
  }

  function applyLemas(sheetData, lemasDict) {
    if (!lemasDict || Object.keys(lemasDict).length === 0) return sheetData;
    const reverseLemaMap = {};
    const deletedWords = new Set();

    for (const [palavraFundida, dataLema] of Object.entries(lemasDict)) {
      const palavraFundidaUpper = palavraFundida.toUpperCase();
      if (dataLema === null) {
        deletedWords.add(palavraFundidaUpper);
        continue;
      }
      const isNewFormat = dataLema && typeof dataLema === 'object' && !Array.isArray(dataLema) && dataLema.origem;
      if (isNewFormat) {
        dataLema.origem.forEach(origemStr => {
          const palavraOriginal = origemStr.split(' (')[0].trim().toUpperCase();
          if (palavraOriginal) reverseLemaMap[palavraOriginal] = palavraFundidaUpper;
        });
      }
    }

    return sheetData.map((row, rowIndex) => {
      if (rowIndex === 0 || !Array.isArray(row)) return row;
      return row.map(cell => {
        const valor = String(cell || "").trim().toUpperCase();
        if (!valor) return cell;
        if (reverseLemaMap[valor]) return reverseLemaMap[valor];
        if (deletedWords.has(valor)) return "VAZIO";
        return cell;
      });
    });
  }

  const data = applyLemas(raw, lemas);
  const headers = data[0];
  const rows = data.slice(1);

  if (parametros.analise === "Conectividade") {
    gerarBolhasConectividade(parametros, headers, rows, bolhasContainer);
  } else {
    gerarBolhasSocioeconomica(parametros, headers, rows);
  }
};
