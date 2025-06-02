import firebaseConfig from '../firebase.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, signOut } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getDatabase, ref, get, child } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

// Inicializa Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Autenticação do usuário
function autenticacao() {
    const userData = sessionStorage.getItem('user');
    if (userData) {
        const user = JSON.parse(userData);
        console.log('Usuário Logado:', user);
        fetchUserEmail(user.email);
        carregarTipoUsuarioEAtualizarIcone(user.uid);
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

// Carregar tipo do usuário do Firebase e atualizar ícone
function carregarTipoUsuarioEAtualizarIcone(uid) {
    const dbRef = ref(db);
    get(child(dbRef, `users/${uid}`))
        .then(snapshot => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                if (data.tipo) {
                    atualizarIconeUsuarioMenuLateral(data.tipo);
                }
            } else {
                console.log("Dados do usuário não encontrados no banco.");
            }
        })
        .catch(error => {
            console.error("Erro ao buscar dados do usuário:", error);
        });
}

// Atualiza o ícone do usuário conforme tipo de login no menu lateral
function atualizarIconeUsuarioMenuLateral(tipo) {
    const icone = document.getElementById('menu-user-icon');
    if (!icone) return;

    const tipoNormalizado = tipo.trim().toLowerCase();

    const mapaIcones = {
      "pessoafisica": "/home/Perfil/assets_perfil/icone_login_pessoa_fisica.png",
      "empresa": "/home/Perfil/assets_perfil/icone_empresas.png",
      "universidade/escola": "/home/Perfil/assets_perfil/icone_instituicao_de_ensino.png",
      "ong": "/home/Perfil/assets_perfil/icone_ong.png",
      "outros": "/home/Perfil/assets_perfil/icone_login_pessoa_fisica.png"
    };

    icone.src = mapaIcones[tipoNormalizado] || "/home/Perfil/assets_perfil/user.png";
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
            <div id="menu-box">
                <div id="menu-user-picture">
                    <img id="menu-user-icon" src="/home/Perfil/assets_perfil/user.png" alt="Ícone do Usuário" />
                </div>
                <div id="menu-user-info">
                    <h2>Bem-vindo</h2>
                    <p id="menu-user-email"></p>
                    <a href="/home/Perfil/perfil.html">Editar perfil</a>
                </div>
            </div>

            <li class="menu-item" id="menu-btn1">
                <div class="menu-icon-circle">
                    <img src="/assets/icone_criar_analise.png" alt="Criar Análise" />
                </div>
                <span class="menu-text">Criar análise</span>
            </li>

            <li class="menu-item" id="menu-btn2">
                <div class="menu-icon-circle">
                    <img src="/assets/icone_suas_analises.png" alt="Suas Análises" />
                </div>
                <span class="menu-text">Suas análises</span>
            </li>

            <div id="menu-logout-icon-container" title="Sair" role="button" tabindex="0" aria-label="Logout" style="cursor:pointer;">
                <img src="/assets/icon_sair.png" alt="Sair" id="menu-logout-icon-image" />
                <span id="menu-logout-text">Sair</span>
            </div>

        </ul>
    </div>
    `;

    body.insertAdjacentHTML('beforeend', html);

    document.getElementById('menu-burger').addEventListener('change', toggleSidebar);
    document.getElementById('menu-logout-icon-container').addEventListener('click', logout);

    // Verifica admin para mostrar botão Admin
    const userData = sessionStorage.getItem('user');
    if (userData) {
        const user = JSON.parse(userData);
        const adminEmails = [
            'williamfunk.11@gmail.com',
            'williamgame.11@gmail.com',
            'joao.falves07@gmail.com'
        ];
        if (adminEmails.includes(user.email)) {
            const ul = document.querySelector('#menu-sidebar ul');
            const adminBtn = document.createElement('li');
            adminBtn.classList.add('menu-item');
            adminBtn.id = 'menu-btn3';
            adminBtn.innerHTML = `
                <div class="menu-icon-circle">
                    <img src="/assets/icone_admin.png" alt="Admin" />
                </div>
                <span class="menu-text">Admin</span>
    `;
    ul.insertBefore(adminBtn, document.getElementById('menu-logout-icon-container'));

    addNavigationListeners(); 
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
            el.style.cursor = 'pointer';
            el.addEventListener('click', () => {
                window.location.href = url;
            });
        }
    });
}

// Inicializa
generateSidebarMenu();
autenticacao();
