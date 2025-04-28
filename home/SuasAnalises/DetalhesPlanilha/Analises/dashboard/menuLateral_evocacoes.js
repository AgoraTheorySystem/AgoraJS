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
      // Remove o dado anterior
      await set(ref(database, `${caminho}`), null);  // Apaga os dados anteriores
  
      // Grava o novo timestamp
      await set(ref(database, `${caminho}/${timestamp}`), timestamp);
      console.log("Novo timestamp registrado com sucesso.");
    } catch (error) {
      console.error("Erro ao atualizar timestamp:", error);
    }
  }
  

async function removerPalavrasSelecionadas() {
  const checkboxes = document.querySelectorAll("tbody input[type='checkbox']:checked");
  if (checkboxes.length === 0) {
    alert("Selecione pelo menos uma palavra para remover.");
    return;
  }

  const palavrasParaRemover = Array.from(checkboxes).map(checkbox =>
    checkbox.closest("tr").children[1].innerText.trim().toUpperCase()
  );

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
  const checkboxes = document.querySelectorAll("tbody input[type='checkbox']:checked");
  if (checkboxes.length < 2) {
    alert("Selecione pelo menos duas palavras para fundir.");
    return;
  }

  const palavrasSelecionadas = Array.from(checkboxes).map(checkbox =>
    checkbox.closest("tr").children[1].innerText.trim().toUpperCase()
  );

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
  const lemaRef = ref(database, `/users/${user.uid}/lematizacoes/${planilhaNome}`);

  try {
    const snapshot = await get(planilhaRef);
    const lemaSnapshot = await get(lemaRef);

    const chunks = snapshot.exists() ? snapshot.val() : {};
    const lemaAtual = lemaSnapshot.exists() ? lemaSnapshot.val() : {};

    const novosChunks = {};

    Object.keys(chunks).forEach(chunkKey => {
      const chunkData = chunks[chunkKey].map(row => {
        return row.map(cell => {
          const valor = (typeof cell === "string" ? cell.trim().toUpperCase() : "");
          return palavrasSelecionadas.includes(valor) ? novoNome : cell;
        });
      });
      novosChunks[chunkKey] = chunkData;
    });

    await set(planilhaRef, novosChunks);

    const storedData = JSON.parse(localStorage.getItem(`planilha_${planilhaNome}`));
    const updatedData = storedData.map(row =>
      row.map(cell => {
        const valor = (typeof cell === "string" ? cell.trim().toUpperCase() : "");
        return palavrasSelecionadas.includes(valor) ? novoNome : cell;
      })
    );
    localStorage.setItem(`planilha_${planilhaNome}`, JSON.stringify(updatedData));

    // Atualiza lematizações
    const tbody = document.querySelector("tbody");
    const novasLematizacoes = palavrasSelecionadas.map(palavra => {
      const row = Array.from(tbody.rows).find(r => r.children[1].innerText.trim().toUpperCase() === palavra);
      if (row) {
        const total = parseInt(row.children[2].innerText.trim(), 10) || 0;
        return `${palavra} (${total})`;
      }
      return "";
    }).filter(text => text !== "").join(", ");

    lemaAtual[novoNome] = novasLematizacoes.split(", ");
    await set(lemaRef, lemaAtual);

    await updateTimestamp(planilhaNome);

    location.reload();

  } catch (error) {
    console.error("Erro ao fundir palavras:", error);
    alert("Erro ao fundir palavras. Verifique o console.");
  }
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

  menu.appendChild(botaoRemover);
  menu.appendChild(botaoFundir);

  document.body.appendChild(menu);
}

window.addEventListener("DOMContentLoaded", () => {
  criarMenuLateral();
});