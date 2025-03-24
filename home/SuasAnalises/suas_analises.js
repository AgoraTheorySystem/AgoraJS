import { initializeApp } from "https://www.gstatic.com/firebasejs/9.9.3/firebase-app.js";
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/9.9.3/firebase-database.js";
import firebaseConfig from '/firebase.js';

// 1. Inicializar o Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// 2. Recuperar o usuário da sessão
function getUser() {
  const userData = sessionStorage.getItem('user');
  if (!userData) {
    console.error("Dados do usuário não encontrados na sessão.");
    return null;
  }
  try {
    const parsed = JSON.parse(userData);
    return { uid: parsed.uid };
  } catch (error) {
    console.error("Erro ao analisar dados do usuário:", error);
    return null;
  }
}
const user = getUser();

// 3. Exibir ou ocultar "loading"
function toggleLoading(show) {
  const loadingElement = document.getElementById('loading');
  if (loadingElement) {
    loadingElement.style.display = show ? 'flex' : 'none';
  }
}

// 4. Verificar planilhas (originais, auxiliares, última alteração) no LocalStorage
//    e remover as que não existirem mais no Firebase
async function verificarPlanilhasLocalStorage() {
  try {
    if (!user || !user.uid) {
      console.error("Usuário não autenticado.");
      return;
    }

    // Obtém todas as chaves do LocalStorage que começam com "planilha_"
    const planilhasSalvas = Object.keys(localStorage).filter(key => key.startsWith("planilha_"));
    
    // Filtra apenas as planilhas principais (exclui auxiliares e metadados)
    const planilhasPrincipais = planilhasSalvas
      .filter(key => !key.startsWith("planilha_auxiliar_") && !key.startsWith("planilha_ultima_alteracao_"));

    const planilhasRef = ref(database, `/users/${user.uid}/planilhas`);
    const snapshot = await get(planilhasRef);
    const planilhasNoFirebase = snapshot.exists() ? Object.keys(snapshot.val()) : [];

    console.log("Planilhas no Firebase:", planilhasNoFirebase);

    planilhasPrincipais.forEach(planilhaKey => {
      const nomePlanilha = planilhaKey.replace("planilha_", ""); 

      console.log(`Verificando: ${nomePlanilha}`);

      // Se a planilha principal não existir no Firebase, remover todas as suas versões do LocalStorage
      if (!planilhasNoFirebase.includes(nomePlanilha)) {
        localStorage.removeItem(planilhaKey);
        localStorage.removeItem(`planilha_auxiliar_${nomePlanilha}`);
        localStorage.removeItem(`planilha_ultima_alteracao_${nomePlanilha}`);

        console.log(`Planilha "${nomePlanilha}" e suas versões auxiliares foram removidas do LocalStorage.`);
      }
    });
  } catch (error) {
    console.error("Erro ao verificar planilhas no Firebase:", error);
  }
}

// 5. Carregar e exibir a lista de planilhas originais
async function loadPlanilhas() {
  if (!user) return;
  toggleLoading(true);

  const planilhasRef = ref(database, `/users/${user.uid}/planilhas`);
  try {
    const snapshot = await get(planilhasRef);
    toggleLoading(false);

    const container = document.getElementById('planilhasContainer');
    if (!snapshot.exists()) {
      container.innerHTML = "<p>Nenhuma planilha encontrada.</p>";
      return;
    }

    // snapshot.val() => { "500": {...}, "501": {...} }
    const planilhas = snapshot.val();
    const planilhaNomes = Object.keys(planilhas); // ["500", "501", ...]

    container.innerHTML = '';
    planilhaNomes.forEach(planilhaNome => {
      const key = `planilha_${planilhaNome}`;
      // Se não está no localStorage, buscar e salvar
      if (!localStorage.getItem(key)) {
        fetchAndSavePlanilha(planilhaNome);
      }

      // Criar botão
      const button = document.createElement('button');
      button.textContent = planilhaNome;
      button.classList.add('planilha-button');
      button.addEventListener('click', () => handlePlanilhaClick(planilhaNome));
      container.appendChild(button);
    });
  } catch (error) {
    toggleLoading(false);
    console.error("Erro ao carregar as planilhas:", error);
    document.getElementById('planilhasContainer').innerHTML = "<p>Erro ao carregar as planilhas.</p>";
  }
}

// 6. Buscar e salvar planilha no LocalStorage (juntando chunks)
async function fetchAndSavePlanilha(planilhaNome) {
  const fileRef = ref(database, `/users/${user.uid}/planilhas/${planilhaNome}`);
  try {
    const snapshot = await get(fileRef);
    if (!snapshot.exists()) {
      console.warn(`A planilha "${planilhaNome}" não foi encontrada no Firebase.`);
      return;
    }
    // ex.: { chunk_0: [...], chunk_1: [...], ... }
    const planilhaChunks = snapshot.val();
    let fullPlanilhaData = [];
    Object.keys(planilhaChunks).forEach(chunkKey => {
      const chunkData = planilhaChunks[chunkKey];
      fullPlanilhaData = fullPlanilhaData.concat(chunkData);
    });
    // Salvar localmente => "planilha_500"
    saveToLocalStorage(planilhaNome, fullPlanilhaData);
  } catch (error) {
    console.error("Erro ao buscar a planilha:", error);
  }
}

// 7. Salvar planilha original no LocalStorage
function saveToLocalStorage(fileName, data) {
  try {
    const key = `planilha_${fileName}`;
    localStorage.setItem(key, JSON.stringify(data));
    console.log(`Planilha "${fileName}" salva no LocalStorage.`);
  } catch (error) {
    console.error("Erro ao salvar no LocalStorage:", error);
  }
}

// 8. Clique em uma planilha
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
      console.log(`Abrindo a planilha: ${planilhaNome}`);
      // Exemplo de redirecionamento
      window.location.href = `./DetalhesPlanilha/menu_da_analise.html?planilha=${encodeURIComponent(planilhaNome)}`;
    }
  });
}

// 9. (Opcional) Exibir planilha local para debug
function exibirPlanilhaLocal(fileName) {
  const key = `planilha_${fileName}`;
  const planilha = localStorage.getItem(key);
  if (planilha) {
    console.log(`Conteúdo da planilha "${fileName}":`);
    console.table(JSON.parse(planilha));
  } else {
    console.warn(`Nenhuma planilha com o nome "${fileName}" foi encontrada no LocalStorage.`);
  }
}

// 10. Evento de inicialização
document.addEventListener('DOMContentLoaded', async () => {
  if (!user) return;
  // 1) Primeiro, verifica e limpa itens inexistentes no Firebase
  await verificarPlanilhasLocalStorage();
  // 2) Depois, carrega a lista de planilhas
  await loadPlanilhas();
});

//teste
function obterPlanilhasLocalStorage() {
  const planilhas = {};
  const planilhasAuxiliares = {};
  const planilhasUltimaAlteracao = {};

  // Percorre todas as chaves do LocalStorage
  Object.keys(localStorage).forEach(key => {
    try {
      if (key.startsWith("planilha_")) {
        const nomePlanilha = key.replace("planilha_", ""); // Extrai o nome da planilha
        
        if (key.startsWith("planilha_auxiliar_")) {
          // Adiciona às planilhas auxiliares
          planilhasAuxiliares[nomePlanilha] = JSON.parse(localStorage.getItem(key));
        } else if (key.startsWith("planilha_ultima_alteracao_")) {
          // Adiciona às planilhas de última alteração
          planilhasUltimaAlteracao[nomePlanilha] = JSON.parse(localStorage.getItem(key));
        } else {
          // Adiciona às planilhas principais
          planilhas[nomePlanilha] = JSON.parse(localStorage.getItem(key));
        }
      }
    } catch (error) {
      console.error(`Erro ao ler a chave "${key}" do LocalStorage:`, error);
    }
  });

  // Exibe as planilhas no console
  console.log("Planilhas principais:", planilhas);
  console.log("Planilhas auxiliares:", planilhasAuxiliares);
  console.log("Planilhas últimas alterações:", planilhasUltimaAlteracao);

  return { planilhas, planilhasAuxiliares, planilhasUltimaAlteracao };
}


// Exemplo de uso:
obterPlanilhasLocalStorage();

