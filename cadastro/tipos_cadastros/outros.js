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

    const tipo = "Outros";

    // Validações básicas
    if (senha !== confirmaSenha) {
        Swal.fire({
            icon: "error",
            title: "As senhas não coincidem!"
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
        });

        await Swal.fire({
            icon: "success",
            title: "Sucesso",
            text: "Cadastro realizado com sucesso!",
        });
        form.reset(); // Reseta o formulário
        window.location.href = "../../index.html";
    // ... (código anterior do try)
} catch (error) {
    console.error("Erro detalhado do Firebase:", error); // Adicione isso para ver o erro completo no console
    
    // Mapeia os códigos de erro do Firebase para mensagens amigáveis
    let mensagemErro = "Não foi possível realizar o cadastro. Tente novamente.";
    switch (error.code) {
        case 'auth/email-already-in-use':
            mensagemErro = "Este endereço de e-mail já está em uso por outra conta.";
            break;
        case 'auth/invalid-email':
            mensagemErro = "O endereço de e-mail fornecido não é válido.";
            break;
        case 'auth/weak-password':
            mensagemErro = "A senha é muito fraca. Ela deve ter no mínimo 6 caracteres.";
            break;
        case 'auth/network-request-failed':
            mensagemErro = "Houve um problema de conexão com a internet. Verifique sua rede.";
            break;
    }

    Swal.fire({
        icon: "error",
        title: "Erro ao Cadastrar",
        text: mensagemErro, // Exibe a mensagem específica do erro
    });
}
});