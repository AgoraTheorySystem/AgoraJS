"use strict";

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.9.3/firebase-app.js";
import { getDatabase, ref, set, get } from "https://www.gstatic.com/firebasejs/9.9.3/firebase-database.js";
import firebaseConfig from '/firebase.js';

// Inicializar o Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

/**
 * Recupera e valida os dados do usuário armazenados no sessionStorage.
 * Caso não haja dados válidos, exibe uma mensagem de erro.
 */
function getUserFromSession() {
  try {
    const userData = sessionStorage.getItem('user');
    if (!userData) {
      throw new Error("Dados do usuário não encontrados na sessão.");
    }
    const parsedData = JSON.parse(userData);
    if (!parsedData.uid) {
      throw new Error("Dados do usuário inválidos.");
    }
    return { uid: parsedData.uid };
  } catch (error) {
    console.error("Erro ao recuperar dados do usuário:", error);
    Swal.fire({
      icon: 'error',
      title: 'Erro',
      text: 'Não foi possível recuperar os dados do usuário. Faça login novamente.',
    });
    return null;
  }
}

/**
 * Extrai o nome do arquivo sem a extensão.
 * Utiliza expressão regular para remover apenas a última extensão.
 */
function extractFileName(fullName) {
  return fullName.replace(/\.[^/.]+$/, "");
}

/**
 * Função para verificar se a planilha já existe no Firebase.
 */
async function checkIfFileExists(user, fileName) {
  const fileRef = ref(database, `/users/${user.uid}/planilhas/${fileName}`);
  try {
    const snapshot = await get(fileRef);
    return snapshot.exists();
  } catch (error) {
    console.error("Erro ao verificar existência do arquivo:", error);
    // Em caso de erro, trata como se o arquivo não existisse para permitir o upload.
    return false;
  }
}

/**
 * Lê o arquivo Excel e converte-o em um array de arrays.
 */
async function readExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const binaryStr = event.target.result;
        // Verifica se a biblioteca XLSX está disponível
        if (typeof XLSX === 'undefined') {
          throw new Error("Biblioteca XLSX não encontrada.");
        }
        const workbook = XLSX.read(binaryStr, { type: 'binary' });
        const sheetName = workbook.SheetNames[0]; // Pega a primeira aba
        const sheet = workbook.Sheets[sheetName];
        // Converte a planilha para um array de arrays
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

/**
 * Preenche células vazias ou nulas com a string "Vazio".
 */
function fillEmptyCellsWithVazio(data) {
  const maxColumns = Math.max(...data.map(row => row.length));
  return data.map(row => {
    return Array.from({ length: maxColumns }, (_, i) => {
      const cell = row[i];
      return (cell === undefined || cell === null || (typeof cell === 'string' && cell.trim() === ''))
        ? "Vazio"
        : cell;
    });
  });
}

/**
 * Converte todas as strings da planilha para maiúsculas.
 */
function convertToUppercase(data) {
  return data.map(row =>
    row.map(cell => (typeof cell === 'string' ? cell.toUpperCase() : cell))
  );
}

/**
 * Envia os dados para o Firebase em chunks (blocos) de tamanho definido.
 */
async function sendInChunks(user, data, fileName) {
  const chunkSize = 500;
  const totalRows = data.length;
  let chunkIndex = 0;

  for (let i = 0; i < totalRows; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize);
    const chunkRef = ref(database, `/users/${user.uid}/planilhas/${fileName}/chunk_${chunkIndex}`);
    try {
      await set(chunkRef, chunk);
      console.log(`Chunk ${chunkIndex} enviado com sucesso para a planilha ${fileName}!`);
      chunkIndex++;
    } catch (error) {
      throw new Error(`Erro ao enviar o chunk ${chunkIndex}: ${error.message}`);
    }
  }
}

/**
 * Salva os dados processados no LocalStorage.
 */
function saveToLocalStorage(fileName, data) {
  try {
    const key = `planilha_${fileName}`;
    localStorage.setItem(key, JSON.stringify(data));
    console.log(`Planilha "${fileName}" salva no LocalStorage.`);
  } catch (error) {
    console.error("Erro ao salvar no LocalStorage:", error);
  }
}

/**
 * Exibe ou oculta o spinner de carregamento.
 */
function toggleLoading(show) {
  const loadingElement = document.getElementById('loading');
  if (loadingElement) {
    loadingElement.style.display = show ? 'block' : 'none';
  }
}

/**
 * Função principal que lida com o fluxo de upload.
 */
async function handleFileUpload(user) {
  const fileInput = document.getElementById('fileInput');
  const file = fileInput.files[0];

  if (!file) {
    await Swal.fire({
      icon: 'warning',
      title: 'Atenção',
      text: 'Por favor, selecione um arquivo para importar!',
    });
    return;
  }

  const fileName = extractFileName(file.name);

  // Verifica se o arquivo já existe no Firebase
  const fileExists = await checkIfFileExists(user, fileName);
  if (fileExists) {
    const result = await Swal.fire({
      icon: 'warning',
      title: 'Arquivo já existe',
      text: `A planilha "${fileName}" já existe no sistema. Deseja substituí-la?`,
      showCancelButton: true,
      confirmButtonText: 'Substituir',
      cancelButtonText: 'Cancelar',
    });

    if (!result.isConfirmed) {
      await Swal.fire({
        icon: 'info',
        title: 'Operação cancelada',
        text: 'A planilha não foi enviada.',
      });
      return;
    }
  }

  toggleLoading(true);

  try {
    // Lê e processa o arquivo Excel
    const rawData = await readExcelFile(file);
    const processedData = convertToUppercase(fillEmptyCellsWithVazio(rawData));

    // Salva os dados localmente
    saveToLocalStorage(fileName, processedData);

    // Envia os dados ao Firebase em chunks
    await sendInChunks(user, processedData, fileName);

    toggleLoading(false);
    await Swal.fire({
      icon: 'success',
      title: 'Sucesso',
      text: 'A planilha foi enviada com sucesso!',
    });
    window.location.href = `/home/SuasAnalises/suas_analises.html`;
  } catch (error) {
    toggleLoading(false);
    await Swal.fire({
      icon: 'error',
      title: 'Erro',
      text: 'Houve um erro ao enviar a planilha. Tente novamente.',
    });
    console.error("Erro ao processar e enviar o arquivo:", error);
  }
}

// Aguarda o carregamento completo do DOM para configurar os listeners
document.addEventListener("DOMContentLoaded", () => {
  const user = getUserFromSession();
  if (!user) {
    // Se os dados do usuário não estiverem disponíveis, interrompe a execução.
    return;
  }

  const uploadButton = document.getElementById('uploadButton');
  uploadButton.addEventListener('click', async () => {
    try {
      await handleFileUpload(user);
    } catch (error) {
      console.error("Erro inesperado na operação de upload:", error);
    }
  });
});
