import { initializeApp } from "https://www.gstatic.com/firebasejs/9.9.3/firebase-app.js";
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/9.9.3/firebase-database.js";
import firebaseConfig from '/firebase.js';

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

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

function toggleLoading(show) {
  const loadingElement = document.getElementById('loading');
  if (loadingElement) {
    loadingElement.style.display = show ? 'flex' : 'none';
  }
}

async function verificarPlanilhasLocalStorage() {
  try {
    if (!user || !user.uid) {
      console.error("Usuário não autenticado.");
      return;
    }

    const planilhasSalvas = Object.keys(localStorage).filter(key => key.startsWith("planilha_"));
    const planilhasPrincipais = planilhasSalvas
      .filter(key => !key.startsWith("planilha_auxiliar_") && !key.startsWith("planilha_ultima_alteracao_"));

    const planilhasRef = ref(database, `/users/${user.uid}/planilhas`);
    const snapshot = await get(planilhasRef);
    const planilhasNoFirebase = snapshot.exists() ? Object.keys(snapshot.val()) : [];

    planilhasPrincipais.forEach(planilhaKey => {
      const nomePlanilha = planilhaKey.replace("planilha_", "");
      if (!planilhasNoFirebase.includes(nomePlanilha)) {
        localStorage.removeItem(planilhaKey);
        localStorage.removeItem(`planilha_auxiliar_${nomePlanilha}`);
        localStorage.removeItem(`planilha_ultima_alteracao_${nomePlanilha}`);
      }
    });
  } catch (error) {
    console.error("Erro ao verificar planilhas no Firebase:", error);
  }
}

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

    const planilhas = snapshot.val();
    const planilhaNomes = Object.keys(planilhas);

    container.innerHTML = '';
    planilhaNomes.forEach(planilhaNome => {
      if (!localStorage.getItem(`planilha_${planilhaNome}`)) {
        fetchAndSavePlanilha(planilhaNome);
      }

      if (!localStorage.getItem(`planilha_auxiliar_${planilhaNome}`)) {
        fetchAndSaveAuxiliaryTable(planilhaNome);
      }

      if (!localStorage.getItem(`planilha_ultima_alteracao_${planilhaNome}`)) {
        fetchAndSaveLastModification(planilhaNome);
      }

      const button = document.createElement('div');
      button.classList.add('planilha-button');

      button.innerHTML = `
        <span class="label">
          <img class="icon" src="/assets/icone_suas_analises.png" alt="Ícone planilha">
          ${planilhaNome}
        </span>
        <img class="config-icon" src="/assets/icone_admin.png" alt="Configuração" style="cursor:pointer;">
      `;

      button.querySelector('.label').addEventListener('click', () => {
        handlePlanilhaClick(planilhaNome);
      });

      button.querySelector('.config-icon').addEventListener('click', () => {
        Swal.fire({
          title: 'Ir para Configurações?',
          text: `Você quer mesmo abrir a tela de configurações para "${planilhaNome}"?`,
          icon: 'question',
          showCancelButton: true,
          confirmButtonText: 'Sim',
          cancelButtonText: 'Cancelar',
        }).then(result => {
          if (result.isConfirmed) {
            window.location.href = `./DetalhesPlanilha/Analises/configuracoes/configuracoes.html?planilha=${encodeURIComponent(planilhaNome)}`;
          }
        });
      });

      container.appendChild(button);
    });
  } catch (error) {
    toggleLoading(false);
    console.error("Erro ao carregar as planilhas:", error);
    document.getElementById('planilhasContainer').innerHTML = "<p>Erro ao carregar as planilhas.</p>";
  }
}

async function fetchAndSavePlanilha(planilhaNome) {
  const fileRef = ref(database, `/users/${user.uid}/planilhas/${planilhaNome}`);
  try {
    const snapshot = await get(fileRef);
    if (!snapshot.exists()) return;
    const planilhaChunks = snapshot.val();
    let fullPlanilhaData = [];
    Object.keys(planilhaChunks).forEach(chunkKey => {
      const chunkData = planilhaChunks[chunkKey];
      fullPlanilhaData = fullPlanilhaData.concat(chunkData);
    });
    saveToLocalStorage(`planilha_${planilhaNome}`, fullPlanilhaData);
  } catch (error) {
    console.error("Erro ao buscar a planilha:", error);
  }
}

async function fetchAndSaveAuxiliaryTable(fileName) {
  const auxiliaryRef = ref(database, `/users/${user.uid}/tabelasAuxiliares/${fileName}`);
  try {
    const snapshot = await get(auxiliaryRef);
    if (!snapshot.exists()) return;
    const auxiliaryChunks = snapshot.val();
    let fullAuxiliaryData = [];
    Object.keys(auxiliaryChunks).forEach(chunkKey => {
      const chunkData = auxiliaryChunks[chunkKey];
      fullAuxiliaryData = fullAuxiliaryData.concat(chunkData);
    });
    saveToLocalStorage(`planilha_auxiliar_${fileName}`, fullAuxiliaryData);
  } catch (error) {
    console.error(`Erro ao buscar a tabela auxiliar "${fileName}":`, error);
  }
}

async function fetchAndSaveLastModification(fileName) {
  const modRef = ref(database, `/users/${user.uid}/UltimasAlteracoes/${fileName}`);
  try {
    const snapshot = await get(modRef);
    if (!snapshot.exists()) return;
    const modifications = snapshot.val();
    const modificationsArray = Object.values(modifications);
    modificationsArray.sort((a, b) => b.timestamp - a.timestamp);
    const latestModification = modificationsArray[0];
    saveToLocalStorage(`planilha_ultima_alteracao_${fileName}`, latestModification);
  } catch (error) {
    console.error(`Erro ao buscar data de última alteração para "${fileName}":`, error);
  }
}

function saveToLocalStorage(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error("Erro ao salvar no LocalStorage:", error);
  }
}

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
      toggleLoading(true);
      setTimeout(() => {
        window.location.href = `./DetalhesPlanilha/menu_da_analise.html?planilha=${encodeURIComponent(planilhaNome)}`;
      }, 1000);
    }
  });
}

function exibirPlanilhaLocal(fileName) {
  const key = `planilha_${fileName}`;
  const planilha = localStorage.getItem(key);
  if (planilha) {
    console.table(JSON.parse(planilha));
  }
}

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

document.addEventListener('DOMContentLoaded', async () => {
  if (!user) return;
  await verificarPlanilhasLocalStorage();
  await loadPlanilhas();
});

obterPlanilhasLocalStorage();
