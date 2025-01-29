import { initializeApp } from "https://www.gstatic.com/firebasejs/9.9.3/firebase-app.js";
import { getDatabase, ref, set, get } from "https://www.gstatic.com/firebasejs/9.9.3/firebase-database.js";
import firebaseConfig from '/firebase.js';

// Inicializar o Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// Obter informações do usuário armazenadas no sessionStorage
const userData = sessionStorage.getItem('user');
const userUid = JSON.parse(userData);
const user = {
  uid: userUid.uid // UID real do usuário
};

document.getElementById('uploadButton').addEventListener('click', async () => {
  const fileInput = document.getElementById('fileInput');
  if (!fileInput.files[0]) {
    Swal.fire({
      icon: 'warning',
      title: 'Atenção',
      text: 'Por favor, selecione um arquivo para importar!',
    });
    return;
  }

  const file = fileInput.files[0];
  const fileName = file.name.split('.')[0]; // Extrair o nome do arquivo sem a extensão

  // Verificar se o arquivo já existe no Firebase
  const fileExists = await checkIfFileExists(fileName);
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
      Swal.fire({
        icon: 'info',
        title: 'Operação cancelada',
        text: 'A planilha não foi enviada.',
      });
      return;
    }
  }

  // Exibir o símbolo de carregamento
  toggleLoading(true);

  const data = await readExcelFile(file);
  const processedData = convertToUppercase(fillEmptyCellsWithNull(data)); // Processar os dados

  try {
    // Salvar no LocalStorage
    saveToLocalStorage(fileName, processedData);

    // Enviar os dados ao Firebase
    await sendInChunks(processedData, fileName);

    // Ocultar o símbolo de carregamento após o envio
    toggleLoading(false);

    // Exibir o alerta de sucesso
    Swal.fire({
      icon: 'success',
      title: 'Sucesso',
      text: 'A planilha foi enviada com sucesso!',
    }).then((result) => {
      // Esta função será executada quando o alerta for fechado
      window.location.href = `/home/SuasAnalises/suas_analises.html`;
    });

  } catch (error) {
    // Ocultar o símbolo de carregamento
    toggleLoading(false);

    // Exibir alerta de erro
    await Swal.fire({
      icon: 'error',
      title: 'Erro',
      text: 'Houve um erro ao enviar a planilha. Tente novamente.',
    });
    console.error(error);
  }
});

// Função para verificar se a planilha já existe no Firebase
async function checkIfFileExists(fileName) {
  const fileRef = ref(database, `/users/${user.uid}/planilhas/${fileName}`);
  try {
    const snapshot = await get(fileRef);
    return snapshot.exists();
  } catch (error) {
    console.error("Erro ao verificar existência do arquivo:", error);
    return false; // Caso ocorra erro, tratamos como se o arquivo não existisse
  }
}

// Função para ler o arquivo Excel
async function readExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const binaryStr = event.target.result;
      const workbook = XLSX.read(binaryStr, { type: 'binary' });
      const sheetName = workbook.SheetNames[0]; // Pegar a primeira aba
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }); // Converter para array
      resolve(jsonData);
    };
    reader.onerror = (error) => reject(error);
    reader.readAsBinaryString(file);
  });
}

// Função para preencher células vazias com NULL
function fillEmptyCellsWithNull(data) {
  return data.map(row =>
    row.map(cell => (cell === undefined || cell === null || cell === '') ? null : cell)
  );
}

// Função para converter toda a planilha para maiúsculas
function convertToUppercase(data) {
  return data.map(row =>
    row.map(cell =>
      typeof cell === 'string' ? cell.toUpperCase() : cell // Converter apenas strings para maiúsculas
    )
  );
}

// Função para enviar os dados em chunks
async function sendInChunks(data, fileName) {
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

// Função para salvar os dados no LocalStorage
function saveToLocalStorage(fileName, data) {
  try {
    const key = `planilha_${fileName}`;
    localStorage.setItem(key, JSON.stringify(data));
    console.log(`Planilha "${fileName}" salva no LocalStorage.`);
  } catch (error) {
    console.error("Erro ao salvar no LocalStorage:", error);
  }
}

// Função para exibir ou ocultar o símbolo de carregamento
function toggleLoading(show) {
  const loadingElement = document.getElementById('loading');
  if (show) {
    loadingElement.style.display = 'block'; // Mostrar o spinner
  } else {
    loadingElement.style.display = 'none'; // Ocultar o spinner
  }
}
