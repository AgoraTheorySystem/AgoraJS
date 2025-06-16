// menuLateral_evocacoes.js

import { getDatabase, ref, get, set } from "https://www.gstatic.com/firebasejs/9.9.3/firebase-database.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.9.3/firebase-app.js";
import firebaseConfig from '/firebase.js';

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

function getUserFromSession() {
  const userData = sessionStorage.getItem('user');
  if (!userData) return null;
  try {
    return JSON.parse(userData);
  } catch (error) {
    console.error("Erro ao parsear usuário da sessão", error);
    return null;
  }
}

async function updateTimestamp(planilhaNome) {
  const user = getUserFromSession();
  if (!user) return;
  const timestamp = Date.now();
  const caminho = `users/${user.uid}/UltimasAlteracoes/${planilhaNome}`;

  try {
    await set(ref(database, `${caminho}`), null);
    await set(ref(database, `${caminho}/${timestamp}`), timestamp);
    console.log("Novo timestamp registrado com sucesso.");
  } catch (error) {
    console.error("Erro ao atualizar timestamp:", error);
  }
}

async function removerPalavrasSelecionadas() {
  const palavrasParaRemover = window.selectedEvocacoes || [];
  if (palavrasParaRemover.length === 0) {
    alert("Selecione pelo menos uma palavra para remover.");
    return;
  }

  const urlParams = new URLSearchParams(window.location.search);
  const planilhaNome = urlParams.get("planilha");
  if (!planilhaNome) {
    alert("Planilha não especificada na URL.");
    return;
  }

  const user = getUserFromSession();
  if (!user) {
    alert("Usuário não encontrado. Faça login novamente.");
    return;
  }

  const planilhaRef = ref(database, `/users/${user.uid}/planilhas/${planilhaNome}`);
  try {
    const snapshot = await get(planilhaRef);
    if (!snapshot.exists()) {
      alert("Planilha não encontrada no Firebase.");
      return;
    }

    const chunks = snapshot.val();
    const novosChunks = {};

    Object.keys(chunks).forEach(chunkKey => {
      const chunkData = chunks[chunkKey].map(row => {
        return row.map(cell => {
          const valor = (typeof cell === "string" ? cell.trim().toUpperCase() : "");
          return palavrasParaRemover.includes(valor) ? "VAZIO" : cell;
        });
      });
      novosChunks[chunkKey] = chunkData;
    });

    await set(planilhaRef, novosChunks);

    const storedData = JSON.parse(localStorage.getItem(`planilha_${planilhaNome}`));
    const updatedData = storedData.map(row =>
      row.map(cell => {
        const valor = (typeof cell === "string" ? cell.trim().toUpperCase() : "");
        return palavrasParaRemover.includes(valor) ? "VAZIO" : cell;
      })
    );
    localStorage.setItem(`planilha_${planilhaNome}`, JSON.stringify(updatedData));

    await updateTimestamp(planilhaNome);
    location.reload();

  } catch (error) {
    console.error("Erro ao remover palavras:", error);
    alert("Erro ao remover palavras. Verifique o console.");
  }
}

async function fundirPalavrasSelecionadas() {
  const palavrasSelecionadas = window.selectedEvocacoes || [];
  if (palavrasSelecionadas.length < 2) {
    alert("Selecione pelo menos duas palavras para fundir.");
    return;
  }

  const novoNome = prompt("Digite o nome da nova palavra fundida:").trim().toUpperCase();
  if (!novoNome) {
    alert("Nome inválido.");
    return;
  }

  const urlParams = new URLSearchParams(window.location.search);
  const planilhaNome = urlParams.get("planilha");
  if (!planilhaNome) {
    alert("Planilha não especificada na URL.");
    return;
  }

  const user = getUserFromSession();
  if (!user) {
    alert("Usuário não encontrado. Faça login novamente.");
    return;
  }

  const planilhaRef = ref(database, `/users/${user.uid}/planilhas/${planilhaNome}`);
  let originalChunks = {};
  try {
    const snapshot = await get(planilhaRef);
    originalChunks = snapshot.exists() ? snapshot.val() : {};
  } catch (error) {
    console.error("Erro ao ler dados originais:", error);
    return;
  }

  const rawData = JSON.parse(localStorage.getItem(`planilha_${planilhaNome}`)) || [];
  const header = rawData[0] || [];
  const evocCols = header.reduce((acc, col, idx) => {
    if (/^EVOC[1-9]$|^EVOC10$/.test(col.toUpperCase())) acc.push(idx);
    return acc;
  }, []);

  const counts = {};
  palavrasSelecionadas.forEach(p => counts[p] = 0);
  rawData.slice(1).forEach(row => {
    evocCols.forEach(idx => {
      const val = (row[idx] || '').trim().toUpperCase();
      if (palavrasSelecionadas.includes(val)) counts[val]++;
    });
  });

  const novosChunks = {};
  Object.keys(originalChunks).forEach(chunkKey => {
    novosChunks[chunkKey] = originalChunks[chunkKey].map(row =>
      row.map(cell => {
        const valor = (typeof cell === "string" ? cell.trim().toUpperCase() : "");
        return palavrasSelecionadas.includes(valor) ? novoNome : cell;
      })
    );
  });
  try {
    await set(planilhaRef, novosChunks);
  } catch (error) {
    console.error("Erro ao gravar dados fundidos:", error);
    alert("Erro ao fundir palavras. Verifique o console.");
    return;
  }

  const storedData = JSON.parse(localStorage.getItem(`planilha_${planilhaNome}`));
  const updatedData = storedData.map(row =>
    row.map(cell => {
      const valor = (typeof cell === "string" ? cell.trim().toUpperCase() : "");
      return palavrasSelecionadas.includes(valor) ? novoNome : cell;
    })
  );
  localStorage.setItem(`planilha_${planilhaNome}`, JSON.stringify(updatedData));

  const lemaRef = ref(database, `/users/${user.uid}/lematizacoes/${planilhaNome}`);
  let lemaAtual = {};
  try {
    const lemaSnap = await get(lemaRef);
    lemaAtual = lemaSnap.exists() ? lemaSnap.val() : {};
  } catch (error) {
    console.error("Erro ao ler lematizações existentes:", error);
  }

  const novasLematizacoesArr = palavrasSelecionadas.map(palavra => `${palavra} (${counts[palavra]})`);
  lemaAtual[novoNome] = novasLematizacoesArr;

  try {
    await set(lemaRef, lemaAtual);
  } catch (error) {
    console.error("Erro ao gravar lematizações:", error);
  }

  await updateTimestamp(planilhaNome);
  location.reload();
}

function criarMenuLateral() {
  const menu = document.createElement("div");
  menu.classList.add("menu-lateral");

  const botaoRemover = document.createElement("button");
  botaoRemover.innerText = "Remover";
  botaoRemover.classList.add("menu-botao");
  botaoRemover.onclick = removerPalavrasSelecionadas;

  const botaoFundir = document.createElement("button");
  botaoFundir.innerText = "Fundir";
  botaoFundir.classList.add("menu-botao");
  botaoFundir.onclick = fundirPalavrasSelecionadas;

  const botaoFusoes = document.createElement("button");
  botaoFusoes.innerText = "Fusões";
  botaoFusoes.classList.add("menu-botao");
  botaoFusoes.onclick = () => {
    window.filtroFusoes = true;
    window.dispatchEvent(new CustomEvent("atualizarTabelaEvocacoes"));
  };

  const botaoExibirTodas = document.createElement("button");
  botaoExibirTodas.innerText = "Exibir todas";
  botaoExibirTodas.classList.add("menu-botao");
  botaoExibirTodas.onclick = () => {
    window.filtroFusoes = false;
    window.dispatchEvent(new CustomEvent("atualizarTabelaEvocacoes"));
  };

  menu.appendChild(botaoRemover);
  menu.appendChild(botaoFundir);
  menu.appendChild(botaoFusoes);
  menu.appendChild(botaoExibirTodas);

  document.body.appendChild(menu);
}

window.addEventListener("DOMContentLoaded", () => {
  criarMenuLateral();
});
