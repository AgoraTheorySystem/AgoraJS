import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getDatabase, ref, update, get, remove } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-database.js";
import firebaseConfig from '/firebase.js';

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// 🔹 PEGAR O NOME DA PLANILHA ATUAL PELA URL
const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);
const planilhaNome = urlParams.get("planilha"); // Nome original da planilha

document.querySelector(".menu-bar").innerHTML += ` - ${planilhaNome}`;

const userData = sessionStorage.getItem('user');
const user = JSON.parse(userData);
const userId = user.uid; // ID do usuário no Firebase

// 🔹 Criar o elemento de loading (oculto inicialmente)
const loadingContainer = document.createElement("div");
loadingContainer.id = "loading-container";
loadingContainer.innerHTML = `
  <div class="loader">
    <div class="dot"></div>
    <div class="dot"></div>
    <div class="dot"></div>
    <div class="dot"></div>
    <div class="dot"></div>
  </div>
  <p>Aguarde... alterando a planilha.</p>
`;
loadingContainer.style.display = "none"; // Começa invisível
document.body.appendChild(loadingContainer);

// 🔹 FUNÇÃO PARA ALTERAR O NOME
window.alterarNome = async function () {
    let novoNome = document.getElementById("nome").value.trim();
    let botao = document.querySelector("button");

    if (!novoNome) {
        Swal.fire({
            icon: "warning",
            title: "Nome inválido",
            text: "Digite um nome válido para a planilha!",
            confirmButtonColor: "#3085d6",
        });
        return;
    }

    loadingContainer.style.display = "block";
    botao.disabled = true;
    botao.innerText = "Alterando...";

    const oldKey = `planilha_${planilhaNome}`;
    const newKey = `planilha_${novoNome}`;
    let planilhaData = localStorage.getItem(oldKey);

    if (planilhaData) {
        localStorage.setItem(newKey, planilhaData);
        localStorage.removeItem(oldKey);
        console.log(`Planilha renomeada no LocalStorage: ${oldKey} → ${newKey}`);
    } else {
        Swal.fire({
            icon: "error",
            title: "Erro",
            text: "Planilha não encontrada no LocalStorage.",
            confirmButtonColor: "#d33",
        });
        loadingContainer.style.display = "none";
        botao.disabled = false;
        botao.innerText = "Enviar";
        return;
    }

    // 🔹 Caminhos no Firebase a atualizar
    const paths = [
        "planilhas",
        "UltimasAlteracoes",
        "tabelasAuxiliares"
    ];

    try {
        for (const path of paths) {
            const oldRef = ref(db, `users/${userId}/${path}/${planilhaNome}`);
            const newRef = ref(db, `users/${userId}/${path}/${novoNome}`);
            const snapshot = await get(oldRef);

            if (snapshot.exists()) {
                const data = snapshot.val();
                await update(newRef, data);
                await remove(oldRef);
                console.log(`Renomeado: ${path}/${planilhaNome} → ${path}/${novoNome}`);
            } else {
                console.warn(`Não encontrado: ${path}/${planilhaNome}`);
            }
        }

        Swal.fire({
            icon: "success",
            title: "Nome alterado!",
            text: "A planilha foi renomeada com sucesso.",
            confirmButtonColor: "#28a745",
        }).then(() => {
            window.location.href = `?planilha=${novoNome}`;
        });

    } catch (error) {
        console.error("Erro ao atualizar Firebase:", error);
        Swal.fire({
            icon: "error",
            title: "Erro no Firebase",
            text: "Houve um erro ao atualizar a planilha. Tente novamente.",
            confirmButtonColor: "#d33",
        });
    } finally {
        loadingContainer.style.display = "none";
        botao.disabled = false;
        botao.innerText = "Enviar";
    }
};

// 🔹 FUNÇÃO PARA EXCLUIR A PLANILHA
window.excluirAnalise = async function () {
    Swal.fire({
        title: "Tem certeza?",
        text: `Deseja excluir permanentemente a planilha "${planilhaNome}"? Esta ação não pode ser desfeita.`,
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#d33",
        cancelButtonColor: "#3085d6",
        confirmButtonText: "Sim, excluir",
        cancelButtonText: "Cancelar"
    }).then(async (result) => {
        if (result.isConfirmed) {
            loadingContainer.style.display = "block";

            // 🔹 Remover do LocalStorage
            const planilhaKey = `planilha_${planilhaNome}`;
            if (localStorage.getItem(planilhaKey)) {
                localStorage.removeItem(planilhaKey);
                console.log(`Planilha "${planilhaNome}" removida do LocalStorage.`);
            }

            try {
                // 🔹 Referências no Firebase
                const pathsToDelete = [
                    `users/${userId}/planilhas/${planilhaNome}`,
                    `users/${userId}/UltimasAlteracoes/${planilhaNome}`,
                    `users/${userId}/tabelasAuxiliares/${planilhaNome}`
                ];

                for (const path of pathsToDelete) {
                    await remove(ref(db, path));
                    console.log(`Removido: ${path}`);
                }

                loadingContainer.style.display = "none";

                Swal.fire({
                    icon: "success",
                    title: "Excluído!",
                    text: `A planilha "${planilhaNome}" foi removida com sucesso.`,
                    confirmButtonColor: "#28a745",
                }).then(() => {
                    window.location.href = "/home/SuasAnalises/suas_analises.html";
                });

            } catch (error) {
                console.error("Erro ao excluir no Firebase:", error);
                Swal.fire({
                    icon: "error",
                    title: "Erro ao excluir",
                    text: "Houve um problema ao excluir a planilha. Tente novamente.",
                    confirmButtonColor: "#d33",
                });
                loadingContainer.style.display = "none";
            }
        }
    });
};

const menuAnalisesBtn = document.querySelector(".btn_menu_analises");
    if (menuAnalisesBtn) {
      menuAnalisesBtn.addEventListener("click", () => {
        // Ajuste o caminho abaixo conforme a estrutura do seu projeto
        const targetUrl = `/home/SuasAnalises/DetalhesPlanilha/menu_da_analise.html?planilha=${encodeURIComponent(planilhaNome)}`;
        window.location.href = targetUrl;
      });
    }