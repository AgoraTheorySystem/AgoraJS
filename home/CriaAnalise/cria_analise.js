import { initializeApp } from "https://www.gstatic.com/firebasejs/9.9.3/firebase-app.js";
import { getDatabase, ref, set, get } from "https://www.gstatic.com/firebasejs/9.9.3/firebase-database.js";
import firebaseConfig from '/firebase.js';

// 1. Inicializar o Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

const DB_NAME = 'agoraDB';
const STORE_NAME = 'planilhas';

// --- FUNÇÕES DE BANCO DE DADOS LOCAL (INDEXEDDB) ---

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

async function setItemInDB(key, data) {
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
            transaction.onerror = (event) => reject(event.target.error);
        });
    } catch (error) {
        console.error("Erro ao abrir o banco de dados para escrita:", error);
    }
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
                console.error(`Erro ao remover chave do IndexedDB:`, event.target.error);
                resolve(); // Resolve mesmo em caso de erro para não travar o fluxo
            };
        });
    } catch (error) {
        console.error("Erro ao abrir o banco de dados para exclusão:", error);
    }
}

// --- FUNÇÕES AUXILIARES ---

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

function extractFileName(fullName) {
  return fullName.replace(/\.[^/.]+$/, "");
}

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

function fillEmptyCellsWithVazio(data) {
  if (!data || data.length === 0) return [];
  const maxColumns = Math.max(...data.map(row => row ? row.length : 0));
  return data.map(row => {
      const newRow = Array.from({ length: maxColumns });
      if (row) {
          for (let i = 0; i < maxColumns; i++) {
              newRow[i] = row[i] || "Vazio";
          }
      } else {
          newRow.fill("Vazio");
      }
      return newRow;
  });
}

function convertToUppercase(data) {
  return data.map(row => row.map(cell => (typeof cell === 'string' ? cell.toUpperCase() : cell)));
}

function toggleLoading(show) {
  const loadingElement = document.getElementById('loading');
  if (loadingElement) {
    loadingElement.style.display = show ? 'block' : 'none';
  }
}

// --- LÓGICA DE UPLOAD E PROCESSAMENTO ---

async function limparDadosLocaisAntigos(planilhaNome) {
    console.log(`Limpando dados locais antigos para a planilha: ${planilhaNome}`);
    const keysToRemove = [
        `planilha_${planilhaNome}`,
        `lemas_${planilhaNome}`,
        `timestamp_local_change_${planilhaNome}`,
        `pending_changes_${planilhaNome}`
    ];
    await Promise.all(keysToRemove.map(key => deleteItemFromDB(key)));
    console.log(`Limpeza local para "${planilhaNome}" concluída.`);
}

async function saveData(user, data, fileName) {
  const chunkSize = 500;
  const totalRows = data.length;
  let chunkIndex = 0;

  for (let i = 0; i < totalRows; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize);
    const chunkRef = ref(database, `/users/${user.uid}/planilhas/${fileName}/chunk_${chunkIndex}`);
    try {
      await set(chunkRef, chunk);
      console.log(`Chunk ${chunkIndex} salvo para planilha "${fileName}".`);
      chunkIndex++;
    } catch (error) {
      throw new Error(`Erro ao salvar chunk ${chunkIndex}: ${error.message}`);
    }
  }
  await setItemInDB(`planilha_${fileName}`, data);
}

async function saveLastModification(user, fileName) {
  const today = new Date();
  const timestamp = today.getTime();
  const modRef = ref(database, `/users/${user.uid}/UltimasAlteracoes/${fileName}/${timestamp}`);
  try {
    await set(modRef, timestamp);
    console.log(`Data de última alteração registrada para "${fileName}" em ${timestamp}.`);
  } catch (error) {
    throw new Error(`Erro ao salvar data de última alteração: ${error.message}`);
  }
  await setItemInDB(`timestamp_local_change_${fileName}`, timestamp);
}

async function handleFileUpload(user) {
  const fileInput = document.getElementById('fileInput');
  const file = fileInput.files[0];

  if (!file) {
    await Swal.fire({ icon: 'warning', title: await window.getTranslation('attention'), text: await window.getTranslation('select_arch') });
    return;
  }

  const fileName = extractFileName(file.name);
  const fileExists = await checkIfFileExists(user, fileName);
  
  if (fileExists) {
    const result = await Swal.fire({
      icon: 'warning',
      title: await window.getTranslation('exist_arch'),
      text: (await window.getTranslation('subs_arch')).replace('${fileName}', fileName),
      showCancelButton: true,
      confirmButtonText: await window.getTranslation('confirm_button'),
      cancelButtonText: await window.getTranslation('cancel_button')
    });
    if (!result.isConfirmed) return;
  }

  // Limpa os dados locais antigos ANTES de começar o upload
  await limparDadosLocaisAntigos(fileName);

  toggleLoading(true);
  try {
    const rawData = await readExcelFile(file);
    const processedData = convertToUppercase(fillEmptyCellsWithVazio(rawData));
    
    await saveData(user, processedData, fileName);
    await saveLastModification(user, fileName);

    // Limpa o nó de lematizações e histórico no Firebase ao substituir.
    if(fileExists) {
        await set(ref(database, `/users/${user.uid}/lematizacoes/${fileName}`), null);
        await set(ref(database, `/users/${user.uid}/historico_alteracoes/${fileName}`), null);
    }

    toggleLoading(false);
    await Swal.fire({ icon: 'success', title: await window.getTranslation('success'), text: await window.getTranslation('send_spreedsheet') });
    window.location.href = `/home/SuasAnalises/suas_analises.html`;

  } catch (error) {
    toggleLoading(false);
    await Swal.fire({ icon: 'error', title: await window.getTranslation('error'), text: await window.getTranslation('error_spreedsheet') });
    console.error("Erro ao processar e enviar o arquivo:", error);
  }
}

// --- EVENTO DE INICIALIZAÇÃO ---
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
