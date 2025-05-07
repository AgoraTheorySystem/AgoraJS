import firebaseConfig from "../../firebase.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.21.0/firebase-app.js";
import {
    getAuth,
    createUserWithEmailAndPassword,
} from "https://www.gstatic.com/firebasejs/9.21.0/firebase-auth.js";
import {
    getDatabase,
    ref,
    set
} from "https://www.gstatic.com/firebasejs/9.21.0/firebase-database.js";

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// Referência ao formulário
const form = document.querySelector(".cadastro-form");

// Manipula o envio do formulário
form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Coleta os valores dos campos do formulário
    const email = document.getElementById("email").value;
    const senha = document.getElementById("senha").value;
    const confirmaSenha = document.getElementById("confirma_senha").value;

    const nomeOng = document.getElementById("nome-ong").value;
    const cnpj = document.getElementById("cnpj").value;
    const pais = document.getElementById("pais").value;
    const cidade = document.getElementById("cidade").value;
    const areaAtuacao = document.getElementById("area-atuacao").value;
    const missao = document.getElementById("missao").value;

    const representanteNome = document.getElementById("representante-nome").value;
    const representanteCpf = document.getElementById("representante-cpf").value;
    const representanteCargo = document.getElementById("representante-cargo").value;
    const representanteContato = document.getElementById("representante-contato").value;

    const telefone = document.getElementById("telefone").value;
    const endereco = document.getElementById("endereco").value;

    const atividades = document.getElementById("atividades").value;
    const projetos = document.getElementById("projetos").value;

    const tipo = "ONG";

    //Variável para os campos obrigatórios
    const vazio = ""

    // Validações básicas
    if (senha !== confirmaSenha) {
        Swal.fire({
            icon: "error",
            title: "As senhas não coincidem!"
        });
        return;
    }

    if (nomeOng == vazio) {
        Swal.fire({
            icon: "error",
            title: "Por favor informe o nome da sua ONG"
        });
        return;
    }

    if (pais == vazio) {
        Swal.fire({
            icon: "error",
            title: "Por favor informe o pais da sua ONG"
        });
        return;
    }

    if (cidade == vazio) {
        Swal.fire({
            icon: "error",
            title: "Por favor informe a cidade da sua ONG"
        });
        return;
    }

    if (telefone == vazio) {
        Swal.fire({
            icon: "error",
            title: "Por favor informe o telefone da sua ONG"
        });
        return;
    }

    try {
        // Cria o usuário no Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(auth, email, senha);
        const user = userCredential.user;

        // Salva os dados no Realtime Database
        await set(ref(db, "users/" + user.uid), {
            tipo,
            email,
            nomeOng,
            cnpj,
            pais,
            cidade,
            areaAtuacao,
            missao,
            representanteNome,
            representanteCpf,
            representanteCargo,
            representanteContato,
            telefone,
            endereco,
            atividades,
            projetos,
        });

        await Swal.fire({
            icon: "success",
            title: "Sucesso",
            text: "Cadastro realizado com sucesso!",
        });
        form.reset(); // Reseta o formulário
        window.location.href = "../../index.html";
    } catch (error) {
        Swal.fire({
            icon: "error",
            title: "Erro ao cadastrar",
            text: "Devido a algum motivo, não foi possível realizar o cadastro",
        });
    }
});