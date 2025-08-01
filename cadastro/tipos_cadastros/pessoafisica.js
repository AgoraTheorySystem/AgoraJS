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

// pessoafisica.js
document.addEventListener('DOMContentLoaded', () => {
    const generoSelect = document.getElementById('genero');
    const outroInputContainer = document.getElementById('outro-input-container');
    const outroGeneroInput = document.getElementById('outro-genero');

    // Esconde o campo de especificação de gênero inicialmente
    outroInputContainer.style.display = 'none';

    // Adiciona um ouvinte de eventos para quando o valor do select for alterado
    generoSelect.addEventListener('change', () => {
        if (generoSelect.value === 'outro') {
            outroInputContainer.style.display = 'block'; // Mostra o campo
            outroGeneroInput.required = true; // Torna o campo obrigatório
        } else {
            outroInputContainer.style.display = 'none'; // Esconde o campo
            outroGeneroInput.required = false; // Remove a obrigatoriedade
            outroGeneroInput.value = ''; // Reseta o valor do campo
        }
    });
});

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
    const nome = document.getElementById("nome").value;
    const dataNascimento = document.getElementById("data-nascimento").value;
    const cpf = document.getElementById("cpf").value;
    const rg = document.getElementById("rg").value;
    const genero = document.getElementById("genero").value;
    const outroGenero = document.getElementById("outro-genero").value;
    const nacionalidade = document.getElementById("nacionalidade").value;
    const cidade = document.getElementById("cidade").value;
    const pais = document.getElementById("pais").value;
    const telefone = document.getElementById("telefone").value;
    const endereco = document.getElementById("endereco").value;
    const ocupacao = document.getElementById("ocupacao").value;
    const escolaridade = document.getElementById("escolaridade").value;
    const formacao = document.getElementById("formacao").value;
    const tipo = "PessoaFisica";

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

    if (nome == vazio) {
        Swal.fire({
            icon: "error",
            title: "Por favor informe seu nome"
        });
        return;
    }

    if (dataNascimento == vazio) {
        Swal.fire({
            icon: "error",
            title: "Por favor informe sua data de nascimento"
        });
        return;
    }

    if (cidade == vazio) {
        Swal.fire({
            icon: "error",
            title: "Por favor informe sua cidade"
        });
        return;
    }

    if (pais == vazio) {
        Swal.fire({
            icon: "error",
            title: "Por favor informe seu país"
        });
        return;
    }

    if (telefone == vazio) {
        Swal.fire({
            icon: "error",
            title: "Por favor informe seu telefone"
        });
        return;
    }

    try {
        // Cria o usuário no Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(auth, email, senha);
        const user = userCredential.user;

        // Adiciona os dados do usuário ao Realtime Database
        await set(ref(db, "users/" + user.uid), {
            tipo,
            email,
            nome,
            dataNascimento,
            cpf,
            rg,
            genero: genero === "outro" ? outroGenero : genero,
            nacionalidade,
            cidade,
            pais,
            telefone,
            endereco,
            ocupacao,
            escolaridade,
            formacao,
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
