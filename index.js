import firebaseConfig from './firebase.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.17.2/firebase-app.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.17.2/firebase-auth.js";

// Inicializar o Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Manipulação do formulário de login
const loginForm = document.querySelector('.login-form');

loginForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    signInWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
            // Login bem-sucedido
            const user = userCredential.user;
            // Armazenando o usuário no sessionStorage
            sessionStorage.setItem('user', JSON.stringify({
                uid: user.uid,
                email: user.email
            }));
            window.location.href = '/home/home.html';
        })
        .catch((error) => {
            const errorCode = error.code;
            let message;
        
            switch (errorCode) {
                case 'auth/wrong-password':
                    message = 'Senha incorreta. Tente novamente.';
                    break;
                case 'auth/user-not-found':
                    message = 'Usuário não encontrado. Verifique o e-mail.';
                    break;
                case 'auth/invalid-email':
                    message = 'E-mail inválido.';
                    break;
                default:
                    message = 'Erro desconhecido. Tente novamente mais tarde.';
            }
        
            alert(message);
        });
});
