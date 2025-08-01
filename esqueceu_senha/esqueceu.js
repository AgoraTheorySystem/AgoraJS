import firebaseConfig from '../firebase.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

// Inicializar o Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

document.getElementById("forgotPasswordForm").addEventListener("submit", async (event) => {
    event.preventDefault(); // Prevenir o envio do formulário
    const email = document.getElementById("email").value;
    const messageDiv = document.getElementById("message");

    try {
        await sendPasswordResetEmail(auth, email);
        messageDiv.textContent = "E-mail de redefinição de senha enviado com sucesso. Verifique sua caixa de entrada!";
        messageDiv.style.color = "green";
    } catch (error) {
        console.error("Erro ao enviar e-mail de redefinição:", error);
        messageDiv.textContent = "Erro ao enviar o e-mail. Verifique se o endereço está correto.";
        messageDiv.style.color = "red";
    }
});