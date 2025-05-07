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

    const nomeInstituicao = document.getElementById("nome-instituicao").value;
    const cnpj = document.getElementById("cnpj").value;
    const pais = document.getElementById("pais").value;
    const cidade = document.getElementById("cidade").value;
    const nomelab = document.getElementById("nome-lab").value;
    const niveisEnsino = document.getElementById("niveis-ensino").value;

    const representanteNome = document.getElementById("representante-nome").value;
    const representanteCpf = document.getElementById("representante-cpf").value;
    const representanteCargo = document.getElementById("representante-cargo").value;
    const representanteContato = document.getElementById("representante-contato").value;

    const telefone = document.getElementById("telefone").value;
    const endereco = document.getElementById("endereco").value;
    const website = document.getElementById("website").value;

    const numeroEstudantes = document.getElementById("numero-estudantes").value;
    const associacao = document.getElementById("associacao").value;

    const tipo = "Universidade/Escola";

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

    if (nomeInstituicao == vazio) {
        Swal.fire({
            icon: "error",
            title: "Por favor informe o nome da sua instituição"
        });
        return;
    }

    if (pais == vazio) {
        Swal.fire({
            icon: "error",
            title: "Por favor informe o pais da sua instituição"
        });
        return;
    }

    if (cidade == vazio) {
        Swal.fire({
            icon: "error",
            title: "Por favor informe a cidade da sua instituição"
        });
        return;
    }

    if (telefone == vazio) {
        Swal.fire({
            icon: "error",
            title: "Por favor informe o telefone da sua instituição"
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
            nomeInstituicao,
            cnpj,
            pais,
            cidade,
            nomelab,
            niveisEnsino,
            representanteNome,
            representanteCpf,
            representanteCargo,
            representanteContato,
            telefone,
            endereco,
            website,
            numeroEstudantes,
            associacao,
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