import firebaseConfig from '../firebase.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, signOut } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

// Inicializa Firebase
const app = initializeApp(firebaseConfig);

// Autenticação do usuário
function autenticacao() {
    const userData = sessionStorage.getItem('user');
    if (userData) {
        const user = JSON.parse(userData);
        console.log('Usuário Logado:', user);
        fetchUserEmail(user.email);
    } else {
        console.log('Nenhum usuário logado.');
        window.location.href = '/index.html';
    }
}

// Exibir e-mail
function fetchUserEmail(email) {
    const userEmailElement = document.getElementById('menu-user-email');
    if (userEmailElement) {
        userEmailElement.textContent = email;
    }
}

// Alternar menu lateral
function toggleSidebar() {
    const checkbox = document.getElementById('menu-burger');
    const sidebar = document.getElementById('menu-sidebar');
    if (checkbox && sidebar) {
        sidebar.style.left = checkbox.checked ? '0' : '-100%';
    }
}

// Logout
function logout() {
    const auth = getAuth();
    signOut(auth).then(() => {
        sessionStorage.clear();
        localStorage.clear();
        window.location.href = '/index.html';
    }).catch((error) => {
        console.error('Erro ao deslogar:', error);
    });
}

// Construir o menu lateral
function generateSidebarMenu() {
    const body = document.body;

    const html = `
    <input type="checkbox" id="menu-burger" hidden>
    <label id="menu-burger-label" for="menu-burger">
        <span id="bar1"></span>
        <span id="bar2"></span>
        <span id="bar3"></span>
    </label>

    <div id="menu-sidebar">
        <ul>
            <li id="menu-link-inicio"><a href="/Home/home.html">MENU INICIAL</a></li>
            <hr id="menu-divider">
            <div id="menu-box">
                <div id="menu-user-picture">
                    <svg viewBox="0 0 448 512" xmlns="http://www.w3.org/2000/svg">
                        <path d="M224 256c70.7 0 128-57.3 128-128S294.7 0 224 0 96 57.3 96 128s57.3 128 128 128zM274.7 304H173.3C77.6 304 0 381.6 0 477.3 0 496.5 15.5 512 34.7 512h378.6c19.2 0 34.7-15.5 34.7-34.7C448 381.6 370.4 304 274.7 304z"/>
                    </svg>
                </div>
                <div id="menu-user-info">
                    <h2>Bem-Vindo</h2>
                    <h2 id="menu-user-email"></h2>
                    <a href="/home/Perfil/perfil.html">Seu Perfil</a>
                </div>
            </div>
            <li id="menu-btn1">Criar Análise</li>
            <li id="menu-btn2">Suas Análises</li>
            <li id="menu-btn3" style="display: none;">ADM</li>
            <button id="menu-logout">
                <div id="menu-logout-icon">
                    <svg viewBox="0 0 512 512">
                        <path d="M377.9 105.9L500.7 228.7c7.2 7.2 11.3 17.1 11.3 27.3s-4.1 20.1-11.3 27.3L377.9 406.1c-6.4 6.4-15 9.9-24 9.9-18.7 0-33.9-15.2-33.9-33.9v-62.1H192c-17.7 0-32-14.3-32-32v-64c0-17.7 14.3-32 32-32h128V129.9c0-18.7 15.2-33.9 33.9-33.9 9 0 17.6 3.6 24 9.9zM160 96H96c-17.7 0-32 14.3-32 32v256c0 17.7 14.3 32 32 32h64c17.7 0 32 14.3 32 32s-14.3 32-32 32H96c-53 0-96-43-96-96V128C0 75 43 32 96 32h64c17.7 0 32 14.3 32 32s-14.3 32-32 32z"/>
                    </svg>
                </div>
                <div id="menu-logout-text">Logout</div>
            </button>
            <img src="/assets/Logo_Agora.png" alt="Ágora Logo" id="menu-logo">
        </ul>
    </div>
    `;

    body.insertAdjacentHTML('beforeend', html);

    document.getElementById('menu-burger').addEventListener('change', toggleSidebar);
    document.getElementById('menu-logout').addEventListener('click', logout);

    // Verifica admin
    const userData = sessionStorage.getItem('user');
    if (userData) {
        const user = JSON.parse(userData);
        const adminEmails = [
            'williamfunk.11@gmail.com',
            'williamgame.11@gmail.com',
            'joao.falves07@gmail.com'
        ];
        if (adminEmails.includes(user.email)) {
            const btn3 = document.getElementById('menu-btn3');
            if (btn3) btn3.style.display = 'block';
        }
    }

    addNavigationListeners();
}

// Ações de navegação
function addNavigationListeners() {
    const nav = {
        'menu-btn1': '/home/CriaAnalise/cria_analise.html',
        'menu-btn2': '/home/SuasAnalises/suas_analises.html',
        'menu-btn3': '/home/adm/adm.html'
    };

    Object.entries(nav).forEach(([id, url]) => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('click', () => {
                window.location.href = url;
            });
        }
    });
}

// Inicializa
generateSidebarMenu();
autenticacao();
