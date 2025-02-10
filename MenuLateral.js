import firebaseConfig from '../firebase.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, signOut } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

// Inicialize o Firebase com o Modular SDK
const app = initializeApp(firebaseConfig);

// Função de autenticação
function autenticacao() {
    const userData = sessionStorage.getItem('user');
    if (userData) {
        const user = JSON.parse(userData);
        console.log('Usuário Logado:', user);

        // Exibir o e-mail no menu
        fetchUserEmail();
    } else {
        console.log('Nenhum usuário logado.');
        window.location.href = '/index.html';
    }
}

// Adicionar event listeners ao menu
function addMenuEventListeners() {
    const burger = document.getElementById('burger');
    const logoutButton = document.getElementById('logout');

    if (burger) {
        burger.addEventListener('click', toggleMenu);
    }

    if (logoutButton) {
        logoutButton.addEventListener('click', logout);
    }
}

// Função para alternar o menu lateral
function toggleMenu() {
    const sidebar = document.getElementById('sidebar');

    if (sidebar) {
        // Verifica se o menu está aberto ou fechado e alterna
        if (sidebar.style.left === '0px') {
            sidebar.style.left = '-1000px'; // Fecha o menu
        } else {
            sidebar.style.left = '0'; // Abre o menu
        }
    }
}

// Função para logout
function logout() {
    const auth = getAuth();
    signOut(auth)
        .then(() => {
            console.log('Usuário deslogado com sucesso.');
            sessionStorage.clear();
            console.log('SessionStorage limpo.');
            localStorage.clear();
            console.log('LocalStorage limpo.');
            window.location.href = '/index.html';
        })
        .catch((error) => {
            console.error('Erro ao deslogar:', error);
        });
}

// Função para buscar o e-mail do usuário e exibi-lo no menu
function fetchUserEmail() {
    const userData = sessionStorage.getItem('user');
    if (userData) {
        const user = JSON.parse(userData);
        const userEmailElement = document.querySelector('.userEmail');
        if (userEmailElement) {
            userEmailElement.textContent = user.email;
        } else {
            console.error('Elemento .userEmail não encontrado no DOM.');
        }
    } else {
        console.error('Nenhum dado de usuário encontrado no sessionStorage.');
    }
}

// Função para gerar o menu lateral
function generateSidebarMenu() {
    const body = document.body;

    const html = `
    <!-- Menu Lateral -->
    <label class="burger" for="burger">
        <input type="checkbox" id="burger">
        <span></span>
        <span></span>
        <span></span>
    </label>
    <div class="sidebar" id="sidebar">
        <ul>
            <li id="espaco"><a href="/Home/home.html">MENU INICIAL</a></li>
            <hr style="border: 1px solid #ccc; width: 90%; margin: 20px auto;">
            <div class="box">
                <div class="user-picture">
                  <svg viewBox="0 0 448 512" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M224 256c70.7 0 128-57.31 128-128s-57.3-128-128-128C153.3 0 96 57.31 96 128S153.3 256 224 256zM274.7 304H173.3C77.61 304 0 381.6 0 477.3c0 19.14 15.52 34.67 34.66 34.67h378.7C432.5 512 448 496.5 448 477.3C448 381.6 370.4 304 274.7 304z">
                    </path>
                  </svg>
                </div>
                <div class="user-info">
                  <h2>Bem-Vindo</h2>
                  <h2 class="userEmail"></h2>
                </div>
            </div>
            <li id="espaco"></li>           
            <li class="btnmenu" id="btn1">Criar Análise</li>
            <li class="btnmenu" id="btn2">Suas Análises</li>
            <!-- O btn3 será inserido aqui se o usuário for admin -->
            <button class="Btn" id="logout">
                <div class="sign">
                    <svg viewBox="0 0 512 512">
                        <path
                            d="M377.9 105.9L500.7 228.7c7.2 7.2 11.3 17.1 11.3 27.3s-4.1 20.1-11.3 27.3L377.9 406.1c-6.4 6.4-15 9.9-24 9.9c-18.7 0-33.9-15.2-33.9-33.9l0-62.1-128 0c-17.7 0-32-14.3-32-32l0-64c0-17.7 14.3-32 32-32l128 0 0-62.1c0-18.7 15.2-33.9 33.9-33.9c9 0 17.6 3.6 24 9.9zM160 96L96 96c-17.7 0-32 14.3-32 32l0 256c0 17.7 14.3 32 32 32l64 0c17.7 0 32 14.3 32 32s-14.3 32-32 32l-64 0c-53 0-96-43-96-96L0 128C0 75 43 32 96 32l64 0c17.7 0 32 14.3 32 32s-14.3 32-32 32z">
                        </path>
                    </svg>
                </div>
                <div class="text">Logout</div>
            </button>
            <img src="/assets/Logo_Agora.png" alt="Ágora Logo" class="logo">
        </ul>
    </div>
    <!-- Menu Lateral -->
    `;

    body.insertAdjacentHTML('beforeend', html);
    addMenuEventListeners(); // Adiciona os event listeners do menu

    // Verifica se há dados de usuário e se ele é admin para criar o btn3
    const userData = sessionStorage.getItem('user');
    if (userData) {
        const user = JSON.parse(userData);
        const adminEmails = [
            'williamfunk.11@gmail.com',
            'williamgame.11@gmail.com'
            // Adicione outros e-mails conforme necessário
        ];

        if (adminEmails.includes(user.email)) {
            // Seleciona a lista do menu
            const sidebarUl = document.querySelector('#sidebar ul');
            if (sidebarUl) {
                // Cria o novo item de menu (btn3)
                const li = document.createElement('li');
                li.className = 'btnmenu';
                li.id = 'btn3';
                li.textContent = 'ADM'; // Label do botão admin

                // Insere o btn3 após o btn2
                const btn2 = document.getElementById('btn2');
                if (btn2) {
                    btn2.insertAdjacentElement('afterend', li);
                } else {
                    sidebarUl.appendChild(li);
                }
            }
        }
    }
}

// Função para adicionar redirecionamento aos botões
function addNavigationListeners() {
    const btn1 = document.getElementById('btn1'); // Botão "Criar Análise"
    const btn2 = document.getElementById('btn2'); // Botão "Suas Análises"
    const btn3 = document.getElementById('btn3'); // Botão "ADM" (apenas para administradores)

    if (btn1) {
        btn1.addEventListener('click', () => {
            window.location.href = '/home/CriaAnalise/cria_analise.html';
        });
    }

    if (btn2) {
        btn2.addEventListener('click', () => {
            window.location.href = '/home/SuasAnalises/suas_analises.html';
        });
    }

    if (btn3) {
        btn3.addEventListener('click', () => {
            window.location.href = '/home/adm/adm.html';
        });
    }
}

// Chamada das funções
generateSidebarMenu();
addNavigationListeners();
autenticacao();
