import { initializeApp } from "https://www.gstatic.com/firebasejs/9.9.3/firebase-app.js";
import { getDatabase, ref, set, get, remove } from "https://www.gstatic.com/firebasejs/9.9.3/firebase-database.js";
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
let mergeMode = false;  // Adiciona uma variável global para controle do modo de fusão

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

            // Marca a linha com fundo vermelho
            row.style.backgroundColor = "red";

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
            } else {
                // Se o usuário cancelar, retira a cor de fundo vermelha
                row.style.backgroundColor = "";
            }

            // Desativa o modo de remoção
            removalMode = false;
        }
    }
    if (e.target.closest("#data-table tbody tr")) {
        const row = e.target.closest("#data-table tbody tr");
        row.classList.toggle("selected"); // Alterna a classe "selected"
    }
});

// Função para fundir as linhas selecionadas
function fundirFuncao() {
    Swal.fire({
        title: 'Deseja fundir as linhas selecionadas?',
        icon: 'info',
        showCancelButton: true,
        confirmButtonText: 'Fundir',
        cancelButtonText: 'Cancelar',
        position: 'top'
    }).then((result) => {
        if (result.isConfirmed) {
            mergeMode = true;  // Ativa o modo de fusão
            const selectedRows = document.querySelectorAll("#data-table tbody tr.selected");

            if (selectedRows.length < 2) {
                Swal.fire({
                    icon: 'error',
                    title: 'Erro',
                    text: 'Selecione pelo menos duas linhas para fundir.'
                });
                mergeMode = false;  // Desativa o modo de fusão
                return;
            }

            // Exibe o alerta para confirmar a fusão
            const mergedData = [];
            selectedRows.forEach(row => {
                const cells = row.querySelectorAll("td");
                cells.forEach((cell, index) => {
                    const cellText = cell.innerText.trim();
                    // Verifica se o conteúdo da célula pode ser convertido para número
                    const cellValue = parseFloat(cellText.replace(",", "."));

                    if (!mergedData[index]) {
                        mergedData[index] = { sum: 0, texts: [] }; // Armazenará a soma e os textos
                    }

                    if (!isNaN(cellValue)) {
                        // Se for numérico, soma ao valor acumulado
                        mergedData[index].sum += cellValue;
                    } else {
                        // Se não for numérico, concatena o texto
                        mergedData[index].texts.push(cellText);
                    }
                });
            });

            // Cria a nova estrutura de dados para o Firebase, com chave 141 e dados fundidos
            const finalMergedData = {};
            mergedData.forEach((data, index) => {
                const textValue = data.texts.length > 0 ? data.texts.join(" + ") : "";
                const numericValue = data.sum !== 0 ? data.sum : "";

                finalMergedData[index] = textValue || numericValue; // Usa texto ou soma numérica
            });

            // Adiciona a nova linha fundida na tabela
            const newRow = document.createElement("tr");
            Object.values(finalMergedData).forEach(cellData => {
                const cell = document.createElement("td");
                cell.textContent = cellData;
                newRow.appendChild(cell);
            });
            document.querySelector("#data-table tbody").appendChild(newRow);

            // Atualiza os dados no Firebase com a chave correta (exemplo: 141)
            const user = getUserFromSession();
            if (!user) return;

            const chunkSize = 500;
            const chunkIndex = Math.floor(selectedRows[0].rowIndex / chunkSize); // Considera o primeiro índice como base
            const chunkRef = ref(database, `/users/${user.uid}/tabelasAuxiliares/${planilhaNome}/chunk_${chunkIndex}`);

            get(chunkRef).then(snapshot => {
                if (snapshot.exists()) {
                    const chunkData = snapshot.val();
                    
                    // Atualiza o Firebase com a chave 141 e os dados fundidos
                    chunkData[141] = finalMergedData; // Salva diretamente na chave 141

                    set(chunkRef, chunkData);
                    updateTimestamp();
                    Swal.fire({
                        icon: 'success',
                        title: 'Sucesso!',
                        text: 'Linhas fundidas e salvas no Firebase.'
                    });
                }
            });
        }
    });
}

// Função para criar o menu lateral
export function criarMenuLateral() {
    const menuLateral = document.createElement("div");
    menuLateral.classList.add("menu-lateral");

    const botoes = [
      { texto: "REMOVER", icone: "fa-trash", funcao: removerFuncao },
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

// Função para atualizar a data de última modificação no Firebase
async function updateTimestamp() {
    const user = getUserFromSession();
    if (!user) return;
  
    // Gera o timestamp atual
    const timestamp = Date.now();
    const today = new Date();
  
    try {
      // Referência ao nó que você deseja atualizar
      const caminho = `users/${user.uid}/UltimasAlteracoes/${planilhaNome}`;
  
      // Apaga todas as informações dentro do caminho especificado
      await remove(ref(database, caminho));
  
      // Agora grava o novo timestamp com a estrutura desejada
      await set(ref(database, `${caminho}/${timestamp}`), timestamp);
  
      console.log("Todas as informações apagadas e novo timestamp gravado com sucesso!");
    } catch (error) {
      console.error("Erro ao atualizar timestamp:", error);
    }
}

document.addEventListener("DOMContentLoaded", criarMenuLateral);
