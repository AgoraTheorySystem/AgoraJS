import { initializeApp } from "https://www.gstatic.com/firebasejs/9.9.3/firebase-app.js";
import { getDatabase, ref, set, get } from "https://www.gstatic.com/firebasejs/9.9.3/firebase-database.js";
import firebaseConfig from '/firebase.js';

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// Pega o nome da planilha a partir da URL
const urlParams = new URLSearchParams(window.location.search);
const planilhaNome = urlParams.get("planilha");

// Recupera o usuário da sessão
function getUserFromSession() {
    try {
        const userData = sessionStorage.getItem('user');
        if (!userData) throw new Error("Dados do usuário não encontrados.");
        const parsedData = JSON.parse(userData);
        if (!parsedData.uid) throw new Error("Usuário inválido.");
        return { uid: parsedData.uid };
    } catch (error) {
        console.error("Erro ao recuperar usuário:", error);
        Swal.fire({ icon: 'error', title: 'Erro', text: 'Faça login novamente.' });
        return null;
    }
}

// Variável global para controlar o modo de remoção
let removalMode = false;

// Função para ativar o modo de remoção e exibir as instruções
function removerFuncao() {
    removalMode = true;
    Swal.fire({
      toast: true,
      position: 'top',
      icon: 'info',
      title: '',
      html: 'Clique na linha que deseja remover. <br><button id="cancelRemovalBtn" class="swal2-styled">Clique aqui para cancelar</button>',
      showConfirmButton: false,
      timer: false,
      allowOutsideClick: true,
      didOpen: () => {
        const cancelBtn = document.getElementById('cancelRemovalBtn');
        if (cancelBtn) {
          cancelBtn.addEventListener('click', () => {
            removalMode = false;
            Swal.close();
          });
        }
      }
    });
}

// Evento global para processar o clique em linhas da tabela no modo remoção
document.addEventListener("click", async function (e) {
    if (removalMode) {
        // Verifica se o clique foi em uma linha do corpo da tabela
        const row = e.target.closest("#data-table tbody tr");
        if (row) {
            e.stopPropagation();

            // Fecha o alerta de instrução
            Swal.close();

            // Obtém todas as linhas para identificar o índice da linha clicada
            const rows = Array.from(document.querySelectorAll("#data-table tbody tr"));
            const rowIndex = rows.indexOf(row);

            // Solicita confirmação para remoção
            const result = await Swal.fire({
                title: 'Deseja remover esta linha?',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Excluir',
                cancelButtonText: 'Cancelar'
            });

            if (result.isConfirmed) {
                // Remove a linha da exibição
                row.remove();

                // Determina em qual chunk e posição a linha se encontra
                const chunkSize = 500;
                const chunkIndex = Math.floor(rowIndex / chunkSize);
                const indexWithinChunk = rowIndex % chunkSize;

                // Recupera os dados do usuário para acessar o Firebase
                const user = getUserFromSession();
                if (!user) return;

                // Cria a referência para o chunk correspondente no Firebase
                const chunkRef = ref(database, `/users/${user.uid}/tabelasAuxiliares/${planilhaNome}/chunk_${chunkIndex}`);

                try {
                    // Recupera os dados do chunk
                    const snapshot = await get(chunkRef);
                    if (snapshot.exists()) {
                        const chunkData = snapshot.val();
                        // Remove a linha do array (baseado no índice)
                        chunkData.splice(indexWithinChunk + 1, 1);
                        // Atualiza o chunk no Firebase
                        updateTimestamp();
                        await set(chunkRef, chunkData);
                        Swal.fire({
                            icon: 'success',
                            title: 'Excluído!',
                            text: 'A linha foi removida do Firebase também.'
                        });
                    } else {
                        Swal.fire({
                            icon: 'error',
                            title: 'Erro',
                            text: 'Dados do Firebase não encontrados para a linha.'
                        });
                    }
                } catch (error) {
                    console.error("Erro ao remover linha do Firebase:", error);
                    Swal.fire({
                        icon: 'error',
                        title: 'Erro',
                        text: 'Falha ao remover a linha do Firebase.'
                    });
                }
            }
            // Desativa o modo de remoção
            removalMode = false;
        }
    }
});

// Outras funções para os demais botões
function mostrarFuncao() {
    console.log("Função MOSTRAR executada");
}

function egoFuncao() {
    console.log("Função EGO executada");
}

function fundirFuncao() {
    console.log("Função FUNDIR executada");
}

// Função para criar o menu lateral
export function criarMenuLateral() {
    const menuLateral = document.createElement("div");
    menuLateral.classList.add("menu-lateral");

    const botoes = [
      { texto: "REMOVER", icone: "fa-trash", funcao: removerFuncao },
      { texto: "MOSTRAR", icone: "fa-eye", funcao: mostrarFuncao },
      { texto: "EGO", icone: "fa-user", funcao: egoFuncao },
      { texto: "FUNDIR", icone: "fa-circle-plus", funcao: fundirFuncao },
    ];

    botoes.forEach(({ texto, icone, funcao }) => {
        const botao = document.createElement("button");
        botao.classList.add("menu-botao");

        const circulo = document.createElement("div");
        circulo.classList.add("icone-circulo");

        const icon = document.createElement("i");
        icon.classList.add("fa-solid", icone);
        circulo.appendChild(icon);

        const label = document.createElement("span");
        label.textContent = texto;

        botao.appendChild(circulo);
        botao.appendChild(label);

        // Associa a função específica ao botão
        botao.addEventListener("click", funcao);

        menuLateral.appendChild(botao);
    });

    document.body.appendChild(menuLateral);
}

// Função para atualizar o timestamp no Firebase
async function updateTimestamp() {
    const user = getUserFromSession();
    if (!user) return;
  
    // Gera a data no formato YYYY-MM-DD
    const dataAtual = new Date().toISOString().slice(0, 10);
  
    try {
      // Referência ao nó que você deseja atualizar
      const caminho = `users/${user.uid}/UltimasAlteracoes/Teste_Pequeno/${dataAtual}`;
  
      // Atualiza o nó com a data e o timestamp atual
      await set(ref(database, caminho), {
        date: dataAtual,
        timestamp: Date.now()
      });
  
      console.log("Timestamp atualizado com sucesso!");
    } catch (error) {
      console.error("Erro ao atualizar timestamp:", error);
    }
  }
  

document.addEventListener("DOMContentLoaded", criarMenuLateral);
