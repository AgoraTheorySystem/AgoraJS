import { initializeApp } from "https://www.gstatic.com/firebasejs/9.9.3/firebase-app.js";
import { getDatabase, ref, set, get } from "https://www.gstatic.com/firebasejs/9.9.3/firebase-database.js";
import firebaseConfig from '/firebase.js';

// Inicializar o Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

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
  const maxColumns = Math.max(...data.map(row => row.length));
  return data.map(row => Array.from({ length: maxColumns }, (_, i) => row[i] || "Vazio"));
}

function convertToUppercase(data) {
  return data.map(row => row.map(cell => (typeof cell === 'string' ? cell.toUpperCase() : cell)));
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
      console.log(`Chunk ${chunkIndex} salvo para ${fileName}`);
      chunkIndex++;
    } catch (error) {
      throw new Error(`Erro ao salvar chunk ${chunkIndex}: ${error.message}`);
    }
  }

  saveToLocalStorage(fileName, data);
}

function saveToLocalStorage(fileName, data) {
  try {
    const key = `planilha_${fileName}`;
    localStorage.setItem(key, JSON.stringify(data));
    console.log(`Planilha "${fileName}" salva no LocalStorage.`);
  } catch (error) {
    console.error("Erro ao salvar no LocalStorage:", error);
  }
}

function toggleLoading(show) {
  const loadingElement = document.getElementById('loading');
  if (loadingElement) loadingElement.style.display = show ? 'block' : 'none';
}

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
      icon: 'warning', title: 'Arquivo já existe', text: `Substituir ${fileName}?`,
      showCancelButton: true, confirmButtonText: 'Substituir', cancelButtonText: 'Cancelar'
    });
    if (!result.isConfirmed) return;
  }

  toggleLoading(true);
  try {
    const rawData = await readExcelFile(file);
    const processedData = convertToUppercase(fillEmptyCellsWithVazio(rawData));
    await saveData(user, processedData, fileName);
    toggleLoading(false);
    await Swal.fire({ icon: 'success', title: 'Sucesso', text: 'Planilha enviada!' });
    window.location.href = `/home/SuasAnalises/suas_analises.html`;
  } catch (error) {
    toggleLoading(false);
    await Swal.fire({ icon: 'error', title: 'Erro', text: 'Falha ao enviar planilha.' });
    console.error("Erro ao processar e enviar o arquivo:", error);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const user = getUserFromSession();
  if (!user) return;
  document.getElementById('uploadButton').addEventListener('click', async () => {
    try {
      await handleFileUpload(user);
    } catch (error) {
      console.error("Erro inesperado na operação de upload:", error);
    }
  });
});
