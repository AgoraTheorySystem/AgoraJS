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

    // 🔹 Exibir o loader animado e desativar botão
    loadingContainer.style.display = "block";
    botao.disabled = true;
    botao.innerText = "Alterando...";

    // 🔹 Atualizar LocalStorage com a chave correta
    const oldKey = `planilha_${planilhaNome}`;
    const newKey = `planilha_${novoNome}`;

    let planilhaData = localStorage.getItem(oldKey);

    if (planilhaData) {
        localStorage.setItem(newKey, planilhaData); // Criar nova chave com o novo nome
        localStorage.removeItem(oldKey); // Remover a antiga
        console.log(`Planilha renomeada no LocalStorage: ${oldKey} → ${newKey}`);
    } else {
        Swal.fire({
            icon: "error",
            title: "Erro",
            text: "Planilha não encontrada no LocalStorage.",
            confirmButtonColor: "#d33",
        });
        loadingContainer.style.display = "none"; // Ocultar loader
        botao.disabled = false;
        botao.innerText = "Enviar";
        return;
    }

    // 🔹 Atualizar Firebase (Banco de Dados)
    const planilhaRef = ref(db, `users/${userId}/planilhas/${planilhaNome}`);
    const novoPlanilhaRef = ref(db, `users/${userId}/planilhas/${novoNome}`);

    try {
        // 🔹 Obter os dados atuais da planilha no Firebase
        const snapshot = await get(planilhaRef);

        if (snapshot.exists()) {
            const planilhaData = snapshot.val();

            // 🔹 Atualizar Firebase com o novo nome
            await update(novoPlanilhaRef, planilhaData);
            await remove(planilhaRef); // Remove a entrada antiga

            loadingContainer.style.display = "none"; // Oculta o loading

            Swal.fire({
                icon: "success",
                title: "Nome alterado!",
                text: "A planilha foi renomeada com sucesso.",
                confirmButtonColor: "#28a745",
            }).then(() => {
                window.location.href = `?planilha=${novoNome}`; // Atualiza a URL
            });

        } else {
            Swal.fire({
                icon: "error",
                title: "Erro no Firebase",
                text: "Planilha não encontrada no banco de dados.",
                confirmButtonColor: "#d33",
            });
        }
    } catch (error) {
        console.error("Erro ao atualizar Firebase:", error);
        Swal.fire({
            icon: "error",
            title: "Erro no Firebase",
            text: "Houve um erro ao atualizar a planilha. Tente novamente.",
            confirmButtonColor: "#d33",
        });
    } finally {
        loadingContainer.style.display = "none"; // Oculta o loading
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
            // 🔹 Exibir o loader animado
            loadingContainer.style.display = "block";

            // 🔹 Remover do LocalStorage
            const planilhaKey = `planilha_${planilhaNome}`;
            if (localStorage.getItem(planilhaKey)) {
                localStorage.removeItem(planilhaKey);
                console.log(`Planilha "${planilhaNome}" removida do LocalStorage.`);
            }

            // 🔹 Remover do Firebase
            const planilhaRef = ref(db, `users/${userId}/planilhas/${planilhaNome}`);

            try {
                await remove(planilhaRef);
                console.log(`Planilha "${planilhaNome}" removida do Firebase.`);

                // 🔹 Ocultar loader e mostrar alerta de sucesso
                loadingContainer.style.display = "none";

                Swal.fire({
                    icon: "success",
                    title: "Excluído!",
                    text: `A planilha "${planilhaNome}" foi removida com sucesso.`,
                    confirmButtonColor: "#28a745",
                }).then(() => {
                    window.location.href = "/home/SuasAnalises/suas_analises.html"; // Redirecionar para outra página
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