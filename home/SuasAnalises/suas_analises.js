import { initializeApp } from "https://www.gstatic.com/firebasejs/9.9.3/firebase-app.js";
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/9.9.3/firebase-database.js";
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

// Função para carregar e exibir a lista de planilhas
async function loadPlanilhas() {
  toggleLoading(true); // Mostrar o símbolo de carregamento

  const planilhasRef = ref(database, `/users/${user.uid}/planilhas`);

  try {
    // Obter dados do Firebase
    const snapshot = await get(planilhasRef);
    toggleLoading(false); // Ocultar o símbolo de carregamento após carregar os dados

    if (snapshot.exists()) {
      const planilhas = snapshot.val();

      // Obter os nomes das planilhas
      const planilhaNomes = Object.keys(planilhas);

      // Exibir os botões na página
      const listElement = document.getElementById('planilhasContainer');
      listElement.innerHTML = ''; // Limpar antes de preencher

      planilhaNomes.forEach(planilhaNome => {
        const key = `planilha_${planilhaNome}`;

        // Verificar se a planilha já está no LocalStorage
        if (!localStorage.getItem(key)) {
          fetchAndSavePlanilha(planilhaNome);
        }

        // Criar botão para a planilha
        const button = document.createElement('button');
        button.textContent = planilhaNome; // Nome da planilha no botão
        button.classList.add('planilha-button'); // Classe para estilização (opcional)
        button.addEventListener('click', () => handlePlanilhaClick(planilhaNome)); // Adicionar evento de clique
        listElement.appendChild(button);
      });
    } else {
      document.getElementById('planilhasContainer').innerHTML = "<p>Nenhuma planilha encontrada.</p>";
    }
  } catch (error) {
    toggleLoading(false); // Ocultar o símbolo de carregamento em caso de erro
    console.error("Erro ao carregar as planilhas:", error);
    document.getElementById('planilhasContainer').innerHTML = "<p>Erro ao carregar as planilhas.</p>";
  }
}

// Função para buscar e salvar a planilha no LocalStorage, unindo os chunks
async function fetchAndSavePlanilha(planilhaNome) {
  const fileRef = ref(database, `/users/${user.uid}/planilhas/${planilhaNome}`);

  try {
    const snapshot = await get(fileRef);

    if (snapshot.exists()) {
      const planilhaChunks = snapshot.val(); // Pega os chunks da planilha
      let fullPlanilhaData = [];

      // Reunir os chunks em um único array
      Object.keys(planilhaChunks).forEach(chunkKey => {
        const chunkData = planilhaChunks[chunkKey];
        fullPlanilhaData = fullPlanilhaData.concat(chunkData); // Concatenar os pedaços
      });

      saveToLocalStorage(planilhaNome, fullPlanilhaData); // Salvar no LocalStorage
    } else {
      console.warn(`A planilha "${planilhaNome}" não foi encontrada.`);
    }
  } catch (error) {
    console.error("Erro ao buscar a planilha:", error);
  }
}

// Função para salvar dados no LocalStorage de forma consistente
function saveToLocalStorage(fileName, data) {
  try {
    const key = `planilha_${fileName}`; // Usar o nome da planilha como chave
    localStorage.setItem(key, JSON.stringify(data)); // Salvar no localStorage
    console.log(`Planilha "${fileName}" salva no LocalStorage.`);
  } catch (error) {
    console.error("Erro ao salvar no LocalStorage:", error);
  }
}


// Função para tratar o clique em uma planilha
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
      // Aqui você pode redirecionar o usuário ou carregar dados da planilha
      console.log(`Abrindo a planilha: ${planilhaNome}`);
      window.location.href = `./DetalhesPlanilha/menu_da_analise.html?planilha=${encodeURIComponent(planilhaNome)}`;
    }
  });
}

// Função para exibir ou ocultar o símbolo de carregamento
function toggleLoading(show) {
  const loadingElement = document.getElementById('loading');
  loadingElement.style.display = show ? 'flex' : 'none';
}

// Chamar a função para carregar as planilhas ao carregar a página
document.addEventListener('DOMContentLoaded', loadPlanilhas);

// Função para exibir a planilha salva no LocalStorage
function exibirPlanilhaLocal(fileName) {
  const key = `planilha_${fileName}`; // Gerar a chave usada no LocalStorage
  const planilha = localStorage.getItem(key);

  if (planilha) {
    console.log(`Conteúdo da planilha "${fileName}":`);
    console.table(JSON.parse(planilha)); // Exibir os dados formatados no console
  } else {
    console.warn(`Nenhuma planilha com o nome "${fileName}" foi encontrada no LocalStorage.`);
  }
}

async function verificarPlanilhasLocalStorage() {
  const planilhasSalvas = Object.keys(localStorage).filter(key => key.startsWith("planilha_"));
  const planilhasRef = ref(database, `/users/${user.uid}/planilhas`);

  try {
    const snapshot = await get(planilhasRef);
    const planilhasNoFirebase = snapshot.exists() ? Object.keys(snapshot.val()) : [];

    planilhasSalvas.forEach(planilhaKey => {
      const nomePlanilha = planilhaKey.replace("planilha_", "");
      if (!planilhasNoFirebase.includes(nomePlanilha)) {
        localStorage.removeItem(planilhaKey);
        console.log(`Planilha "${nomePlanilha}" removida do LocalStorage.`);
      }
    });
  } catch (error) {
    console.error("Erro ao verificar planilhas no Firebase:", error);
  }
}

// Chamar a função ao carregar a página
document.addEventListener('DOMContentLoaded', verificarPlanilhasLocalStorage);


// Teste para exibir a planilha salva localmente
exibirPlanilhaLocal("TesteBom");
