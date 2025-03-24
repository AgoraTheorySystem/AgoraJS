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

      // Se a planilha principal não existir no Firebase, remove todas as suas versões do LocalStorage
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
      // Se não estiver salvo, busca e salva a planilha original
      if (!localStorage.getItem(`planilha_${planilhaNome}`)) {
        fetchAndSavePlanilha(planilhaNome);
      }

      // Se não estiver salvo, busca e salva a tabela auxiliar
      if (!localStorage.getItem(`planilha_auxiliar_${planilhaNome}`)) {
        fetchAndSaveAuxiliaryTable(planilhaNome);
      }

      // Se não estiver salvo, busca e salva a data de última alteração
      if (!localStorage.getItem(`planilha_ultima_alteracao_${planilhaNome}`)) {
        fetchAndSaveLastModification(planilhaNome);
      }

      // Cria botão para acessar a planilha
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

// 6. Buscar e salvar planilha original no LocalStorage (juntando chunks)
async function fetchAndSavePlanilha(planilhaNome) {
  const fileRef = ref(database, `/users/${user.uid}/planilhas/${planilhaNome}`);
  try {
    const snapshot = await get(fileRef);
    if (!snapshot.exists()) {
      console.warn(`A planilha "${planilhaNome}" não foi encontrada no Firebase.`);
      return;
    }
    // Ex.: { chunk_0: [...], chunk_1: [...], ... }
    const planilhaChunks = snapshot.val();
    let fullPlanilhaData = [];
    Object.keys(planilhaChunks).forEach(chunkKey => {
      const chunkData = planilhaChunks[chunkKey];
      fullPlanilhaData = fullPlanilhaData.concat(chunkData);
    });
    // Salva a planilha original no LocalStorage com a chave "planilha_{planilhaNome}"
    saveToLocalStorage(`planilha_${planilhaNome}`, fullPlanilhaData);
  } catch (error) {
    console.error("Erro ao buscar a planilha:", error);
  }
}

// 7. Buscar e salvar tabela auxiliar (juntando chunks)
async function fetchAndSaveAuxiliaryTable(fileName) {
  const auxiliaryRef = ref(database, `/users/${user.uid}/tabelasAuxiliares/${fileName}`);
  try {
    const snapshot = await get(auxiliaryRef);
    if (!snapshot.exists()) {
      console.warn(`Tabela auxiliar "${fileName}" não encontrada no Firebase.`);
      return;
    }
    const auxiliaryChunks = snapshot.val();
    let fullAuxiliaryData = [];
    Object.keys(auxiliaryChunks).forEach(chunkKey => {
      const chunkData = auxiliaryChunks[chunkKey];
      fullAuxiliaryData = fullAuxiliaryData.concat(chunkData);
    });
    // Salva a tabela auxiliar no LocalStorage com a chave "planilha_auxiliar_{fileName}"
    saveToLocalStorage(`planilha_auxiliar_${fileName}`, fullAuxiliaryData);
  } catch (error) {
    console.error(`Erro ao buscar a tabela auxiliar "${fileName}":`, error);
  }
}

// 8. Buscar e salvar data de última alteração
async function fetchAndSaveLastModification(fileName) {
  const modRef = ref(database, `/users/${user.uid}/UltimasAlteracoes/${fileName}`);
  try {
    const snapshot = await get(modRef);
    if (!snapshot.exists()) {
      console.warn(`Data de última alteração para "${fileName}" não encontrada no Firebase.`);
      return;
    }
    const modifications = snapshot.val();
    // Se houver mais de uma data, seleciona a mais recente (maior timestamp)
    const modificationsArray = Object.values(modifications);
    modificationsArray.sort((a, b) => b.timestamp - a.timestamp);
    const latestModification = modificationsArray[0];
    // Salva no LocalStorage com a chave "planilha_ultima_alteracao_{fileName}"
    saveToLocalStorage(`planilha_ultima_alteracao_${fileName}`, latestModification);
  } catch (error) {
    console.error(`Erro ao buscar data de última alteração para "${fileName}":`, error);
  }
}

// 9. Função genérica para salvar dados no LocalStorage
function saveToLocalStorage(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    console.log(`Dados salvos no LocalStorage com a chave "${key}".`);
  } catch (error) {
    console.error("Erro ao salvar no LocalStorage:", error);
  }
}

// 10. Clique em uma planilha
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
      window.location.href = `./DetalhesPlanilha/menu_da_analise.html?planilha=${encodeURIComponent(planilhaNome)}`;
    }
  });
}

// 11. (Opcional) Exibir planilha local para debug
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

// 12. Função para obter e exibir todas as planilhas do LocalStorage (para teste)
function obterPlanilhasLocalStorage() {
  const planilhas = {};
  const planilhasAuxiliares = {};
  const planilhasUltimaAlteracao = {};

  Object.keys(localStorage).forEach(key => {
    try {
      if (key.startsWith("planilha_")) {
        const nomePlanilha = key.replace("planilha_", "");
        if (key.startsWith("planilha_auxiliar_")) {
          planilhasAuxiliares[nomePlanilha] = JSON.parse(localStorage.getItem(key));
        } else if (key.startsWith("planilha_ultima_alteracao_")) {
          planilhasUltimaAlteracao[nomePlanilha] = JSON.parse(localStorage.getItem(key));
        } else {
          planilhas[nomePlanilha] = JSON.parse(localStorage.getItem(key));
        }
      }
    } catch (error) {
      console.error(`Erro ao ler a chave "${key}" do LocalStorage:`, error);
    }
  });

  console.log("Planilhas principais:", planilhas);
  console.log("Planilhas auxiliares:", planilhasAuxiliares);
  console.log("Planilhas últimas alterações:", planilhasUltimaAlteracao);

  return { planilhas, planilhasAuxiliares, planilhasUltimaAlteracao };
}

// 13. Evento de inicialização
document.addEventListener('DOMContentLoaded', async () => {
  if (!user) return;
  // Primeiro, verifica e limpa os itens que não existem mais no Firebase
  await verificarPlanilhasLocalStorage();
  // Depois, carrega e exibe a lista de planilhas
  await loadPlanilhas();
});

// Exemplo de uso para debug:
obterPlanilhasLocalStorage();
