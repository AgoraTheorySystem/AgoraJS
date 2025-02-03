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
  if (show) {
    loadingElement.style.display = 'flex'; // Mostrar o spinner
  } else {
    loadingElement.style.display = 'none'; // Ocultar o spinner
  }
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

exibirPlanilhaLocal("30");