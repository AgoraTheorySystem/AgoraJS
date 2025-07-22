import { initializeApp } from "https://www.gstatic.com/firebasejs/9.9.3/firebase-app.js";
import { getDatabase, ref, set, get } from "https://www.gstatic.com/firebasejs/9.9.3/firebase-database.js";
import firebaseConfig from '/firebase.js';

// 1. Inicializar o Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

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

/* ==============================
   FUNÇÕES AUXILIARES
============================== */

// Recupera o usuário da sessão
function getUserFromSession() {
  try {
    const userData = sessionStorage.getItem('user');
    if (!userData) throw new Error("Dados do usuário não encontrados na sessão.");
    const parsedData = JSON.parse(userData);
    if (!parsedData.uid) throw new Error("Dados do usuário inválidos.");
    return { uid: parsedData.uid };
  } catch (error) {
    console.error("Erro ao recuperar dados do usuário:", error);
    Swal.fire({ icon: 'error', title: 'Erro', text: 'Faça login novamente.' });
    return null;
  }
}

// Extrai o nome do arquivo sem extensão
function extractFileName(fullName) {
  return fullName.replace(/\.[^/.]+$/, "");
}

// Verifica se uma planilha com o mesmo nome já existe no Firebase
async function checkIfFileExists(user, fileName) {
  const fileRef = ref(database, `/users/${user.uid}/planilhas/${fileName}`);
  try {
    const snapshot = await get(fileRef);
    return snapshot.exists();
  } catch (error) {
    console.error("Erro ao verificar existência do arquivo:", error);
    return false;
  }
}

// Lê o arquivo Excel e converte para array de arrays
async function readExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const binaryStr = event.target.result;
        if (typeof XLSX === 'undefined') throw new Error("Biblioteca XLSX não encontrada.");
        const workbook = XLSX.read(binaryStr, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        resolve(jsonData);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsBinaryString(file);
  });
}

// Preenche células vazias com "Vazio"
function fillEmptyCellsWithVazio(data) {
  const maxColumns = Math.max(...data.map(row => row.length));
  return data.map(row => Array.from({ length: maxColumns }, (_, i) => row[i] || "Vazio"));
}

// Converte tudo para maiúsculas
function convertToUppercase(data) {
  return data.map(row => row.map(cell => (typeof cell === 'string' ? cell.toUpperCase() : cell)));
}

// Salva dados no IndexedDB
async function saveToIndexedDB(key, data) {
    try {
        const db = await openDB();
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        store.put({ key, value: data });

        return new Promise((resolve, reject) => {
            transaction.oncomplete = () => {
                console.log(`Dados salvos no IndexedDB com a chave "${key}".`);
                resolve();
            };
            transaction.onerror = (event) => {
                console.error("Erro ao salvar no IndexedDB:", event.target.error);
                reject(event.target.error);
            };
        });
    } catch (error) {
        console.error("Erro ao abrir o banco de dados:", error);
    }
}


// Mostra ou oculta o "loading"
function toggleLoading(show) {
  const loadingElement = document.getElementById('loading');
  if (loadingElement) {
    loadingElement.style.display = show ? 'block' : 'none';
  }
}

/* ==============================
   1) SALVAR PLANILHA ORIGINAL
============================== */
async function saveData(user, data, fileName) {
  const chunkSize = 500;
  const totalRows = data.length;
  let chunkIndex = 0;

  for (let i = 0; i < totalRows; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize);
    // Exemplo: /users/uid/planilhas/500/chunk_0
    const chunkRef = ref(database, `/users/${user.uid}/planilhas/${fileName}/chunk_${chunkIndex}`);
    try {
      await set(chunkRef, chunk);
      console.log(`Chunk ${chunkIndex} salvo para planilha "${fileName}".`);
      chunkIndex++;
    } catch (error) {
      throw new Error(`Erro ao salvar chunk ${chunkIndex}: ${error.message}`);
    }
  }

  // Salva no IndexedDB com a chave "planilha_{fileName}"
  await saveToIndexedDB(`planilha_${fileName}`, data);
}

/* ==============================
   2) CRIAR E SALVAR TABELA AUXILIAR
============================== */
function processEvocData(rawData) {
  const header = rawData[0];
  const rows = rawData.slice(1);

  // Identifica colunas evoc1..evoc5 => EGO, evoc6..evoc10 => ALTER
  const evocEgoIndices = [];
  const evocAlterIndices = [];

  header.forEach((colName, idx) => {
    const colNameLower = colName.toLowerCase();
    if (/^evoc[1-5]$/.test(colNameLower)) {
      evocEgoIndices.push(idx);
    } else if (/^evoc(6|7|8|9|10)$/.test(colNameLower)) {
      evocAlterIndices.push(idx);
    }
  });

  // Dicionário para contar ocorrências
  const wordCounts = {};
  rows.forEach((row) => {
    // EGO
    evocEgoIndices.forEach((colIdx) => {
      const word = (row[colIdx] || "").trim();
      if (word) {
        if (!wordCounts[word]) wordCounts[word] = { ego: 0, alter: 0 };
        wordCounts[word].ego++;
      }
    });
    // ALTER
    evocAlterIndices.forEach((colIdx) => {
      const word = (row[colIdx] || "").trim();
      if (word) {
        if (!wordCounts[word]) wordCounts[word] = { ego: 0, alter: 0 };
        wordCounts[word].alter++;
      }
    });
  });

  // Monta array final: cabeçalho + linhas
  const bodyTable = [];
  Object.keys(wordCounts).forEach((word) => {
    if (word.toUpperCase() !== "VAZIO") {
      const { ego, alter } = wordCounts[word];
      bodyTable.push([word, ego, alter, ego + alter]);
    }
  });
  // Ordena decrescentemente
  bodyTable.sort((a, b) => b[3] - a[3]);

  return [
    ["PALAVRA", "QUANTIDADE_EGO", "QUANTIDADE_ALTER", "QUANTIDADE_TOTAL"],
    ...bodyTable
  ];
}

/* ==============================
   3) SALVAR DATA DE ÚLTIMA ALTERAÇÃO
============================== */
async function saveLastModification(user, fileName) {
  const today = new Date();
  const formattedDate = today.toISOString().split("T")[0]; // YYYY-MM-DD
  const modificationData = {
    date: formattedDate,
    timestamp: today.getTime()
  };
  // Exemplo: /users/uid/UltimasAlteracoes/500/2023-05-01
  const modRef = ref(database, `/users/${user.uid}/UltimasAlteracoes/${fileName}/${today.getTime()}`);
  try {
    await set(modRef, today.getTime());
    console.log(`Data de última alteração registrada para "${fileName}" em ${today.getTime()}.`);
  } catch (error) {
    throw new Error(`Erro ao salvar data de última alteração: ${error.message}`);
  }
  // Salva no IndexedDB => "planilha_ultima_alteracao_500"
  await saveToIndexedDB(`planilha_ultima_alteracao_${fileName}`, today.getTime());
}

/* ==============================
   4) UPLOAD DA PLANILHA
============================== */
async function handleFileUpload(user) {
  const fileInput = document.getElementById('fileInput');
  const file = fileInput.files[0];

  if (!file) {
    await Swal.fire({ icon: 'warning', title: 'Atenção', text: 'Selecione um arquivo!' });
    return;
  }

  const fileName = extractFileName(file.name);
  const fileExists = await checkIfFileExists(user, fileName);
  if (fileExists) {
    const result = await Swal.fire({
      icon: 'warning',
      title: 'Arquivo já existe',
      text: `Substituir ${fileName}?`,
      showCancelButton: true,
      confirmButtonText: 'Substituir',
      cancelButtonText: 'Cancelar'
    });
    if (!result.isConfirmed) return;
  }

  toggleLoading(true);
  try {
    // Lê e processa o arquivo Excel
    const rawData = await readExcelFile(file);
    const processedData = convertToUppercase(fillEmptyCellsWithVazio(rawData));
    
    // 1) Salva a planilha original
    await saveData(user, processedData, fileName);

    /* 2) Cria e salva a tabela auxiliar
    const auxiliaryData = processEvocData(processedData);
    await saveAuxiliaryTable(user, auxiliaryData, fileName);
    */
   
    // 3) Registra a data de última alteração
    await saveLastModification(user, fileName);

    toggleLoading(false);
    await Swal.fire({ icon: 'success', title: 'Sucesso', text: 'Planilha enviada!' });
    // Redireciona para a página de listagem
    window.location.href = `/home/SuasAnalises/suas_analises.html`;
  } catch (error) {
    toggleLoading(false);
    await Swal.fire({ icon: 'error', title: 'Erro', text: 'Falha ao enviar planilha.' });
    console.error("Erro ao processar e enviar o arquivo:", error);
  }
}

/* ==============================
   EVENTO DE INICIALIZAÇÃO
============================== */
document.addEventListener("DOMContentLoaded", () => {
  const user = getUserFromSession();
  if (!user) return;
  const uploadBtn = document.getElementById('uploadButton');
  if (uploadBtn) {
    uploadBtn.addEventListener('click', async () => {
      try {
        await handleFileUpload(user);
      } catch (error) {
        console.error("Erro inesperado na operação de upload:", error);
      }
    });
  }
});