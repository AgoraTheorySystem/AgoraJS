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
        if (checkbox.checked) {
            sidebar.style.left = '0';  // Quando o menu estiver aberto
        } else {
            sidebar.style.left = '-100%';  // Quando o menu estiver fechado
        }
    }
}

// Logout
function logout() {
    const auth = getAuth();
    signOut(auth).then(() => {
        sessionStorage.clear();
        const DBDeleteRequest = window.indexedDB.deleteDatabase('agoraDB');

        DBDeleteRequest.onerror = function(event) {
          console.log("Error deleting database.");
        };

        DBDeleteRequest.onsuccess = function(event) {
          console.log("Database deleted successfully");
          // Redireciona somente após o banco de dados ser excluído com sucesso.
          window.location.href = '/index.html';
        };

        DBDeleteRequest.onblocked = function(event) {
            console.log("Database delete blocked. Please close other connections.");
            // Lida com o caso em que o banco de dados está bloqueado.
            // Você pode querer informar o usuário.
        };

    }).catch((error) => {
        console.error('Erro ao deslogar:', error);
    });
}

// Construir o menu lateral
function generateSidebarMenu() {
    const isHome = window.location.pathname.includes('/home/home.html');
    const body = document.body;

    const html = `
    <input type="checkbox" id="menu-burger" hidden>
    <label id="menu-burger-label" for="menu-burger" style="${isHome ? 'display: none;' : ''}">
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

            <li class="menu-item" id="menu-btn0">
                <div class="menu-icon-circle">
                    <img src="/assets/icone_home.png" alt="Home" />
                </div>
                <span class="menu-text">Tela inicial</span>
            </li>

            <li class="menu-item" id="menu-btn1">
                <div class="menu-icon-circle">
                    <img src="/assets/icone_criar_analise.png" alt="Criar Análise" />
                </div>
                <span class="menu-text">Criar análise</span>
            </li>

            <li class="menu-item" id="menu-btn2">
                <div class="menu-icon-circle">
                    <img src="/assets/icone_suas_analises.png" alt="Suas Planilhas" />
                </div>
                <span class="menu-text">Suas Planilhas</span>
            </li>

            <li class="menu-item" id="menu-btn-manual">
                <div class="menu-icon-circle">
                    <img src="/assets/icon_manual_usuario.png" alt="Manual do Usuário" />
                </div>
                <span class="menu-text">Manual do Usuário</span>
            </li>

            <li class="menu-item" id="menu-btn3" style="display: none;">
                <div class="menu-icon-circle">
                    <img src="/assets/icone_admin.png" alt="Admin" />
                </div>
                <span class="menu-text">Admin</span>
            </li>

            <div id="menu-logout-icon-container" title="Sair" role="button" tabindex="0" aria-label="Logout" style="cursor:pointer;">
                <img src="/assets/icon_sair.png" alt="Sair" id="menu-logout-icon-image" />
                <span id="menu-logout-text">Sair</span>
            </div>

        </ul>
    </div>
    `;

    body.insertAdjacentHTML('afterbegin', html); // Manter afterbegin
    console.log('Menu lateral HTML injetado no DOM como afterbegin.');

    // **NOVO: Forçar estilos via JavaScript após a injeção do HTML**
    const menuLabel = document.getElementById('menu-burger-label');
    const sidebar = document.getElementById('menu-sidebar');
    const htmlEl = document.documentElement; // Elemento <html>
    const bodyEl = document.body;

    if (htmlEl) {
        htmlEl.style.overflowX = 'hidden';
        htmlEl.style.width = '100%';
        htmlEl.style.height = '100%';
        htmlEl.style.margin = '0';
        htmlEl.style.padding = '0';
        console.log('Estilos forçados no HTML.');
    }
    if (bodyEl) {
        bodyEl.style.overflowX = 'hidden';
        bodyEl.style.width = '100%';
        bodyEl.style.height = '100%';
        bodyEl.style.margin = '0';
        bodyEl.style.padding = '0';
        console.log('Estilos forçados no BODY.');
    }

    if (menuLabel) {
        menuLabel.style.position = 'fixed';
        menuLabel.style.top = '10px';
        menuLabel.style.left = '10px';
        menuLabel.style.zIndex = '9999';
        console.log('Estilos forçados no menu-burger-label.');
    }
    if (sidebar) {
        sidebar.style.position = 'fixed';
        sidebar.style.top = '0';
        sidebar.style.left = '-100%';
        sidebar.style.width = '360px';
        sidebar.style.height = '100%';
        sidebar.style.zIndex = '9998';
        sidebar.style.background = '#2b6f69'; // Garante cor
        console.log('Estilos forçados na menu-sidebar.');
    }
    // FIM NOVO


    if (!isHome) {
        document.getElementById('menu-burger').addEventListener('change', toggleSidebar);
    }

    document.getElementById('menu-logout-icon-container').addEventListener('click', () => {
        Swal.fire({
            title: 'Tem certeza que deseja sair?',
            text: 'Você precisará fazer login novamente para acessar a plataforma.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#2b6f69',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Sim, sair',
            cancelButtonText: 'Cancelar'
        }).then((result) => {
            if (result.isConfirmed) {
            logout();
            }
        });
    });


    // Verifica admin para mostrar botão Admin
    const userData = sessionStorage.getItem('user');
    if (userData) {
    const user = JSON.parse(userData);
    const adminEmails = [
        'williamfunk.11@gmail.com',
        'joao.falves07@gmail.com'
    ];

    const btn3 = document.getElementById('menu-btn3');
    if (adminEmails.includes(user.email)) {
        if (btn3) btn3.style.display = 'flex';
    } else {
        if (btn3) btn3.style.display = 'none';
    }
}


    addNavigationListeners();
}

// Ações de navegação
function addNavigationListeners() {
    const nav = {
        'menu-btn0': '/home/home.html',
        'menu-btn1': '/home/CriaAnalise/cria_analise.html',
        'menu-btn2': '/home/SuasAnalises/suas_analises.html',
        'menu-btn3': '/home/adm/adm.html',
        'menu-btn-manual': 'https://docs.google.com/document/d/1GRTPK-FSrdIToDhhsmitcQHkWB7nVn3r/edit?usp=drive_link&ouid=111418885411734694225&rtpof=true&sd=true'
    };

    Object.entries(nav).forEach(([id, url]) => {
        const el = document.getElementById(id);
        if (el) {
            el.style.cursor = 'pointer';
            el.addEventListener('click', () => {
        if (id === 'menu-btn1') {
            const loading = document.getElementById('loading');
            if (loading) loading.style.display = 'flex';
            setTimeout(() => {
                window.location.href = url;
            }, 800); 
        } else if (id === 'menu-btn-manual') {
            window.open(url, '_blank');
        } else {
            window.location.href = url;
        }
    });
        }
    });
}

// Inicializa
generateSidebarMenu();
autenticacao();

