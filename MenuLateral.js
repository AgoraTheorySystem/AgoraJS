import firebaseConfig from '../firebase.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, signOut } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getDatabase, ref, get, child } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

/**
 * Injeta os ícones SVG no início do body para serem reutilizados no menu.
 * Isso melhora o desempenho e a escalabilidade dos ícones.
 */
function injectSvgSprites() {
    // Esconder o SVG do layout visual, mas o manter acessível
    const svgContainer = document.createElement('div');
    svgContainer.style.display = 'none';
    svgContainer.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg">
        <symbol id="icon-home" viewBox="0 0 24 24"><path fill="currentColor" d="M10 20v-6h4v6h5v-8h3L12 3L2 12h3v8h5z"/></symbol>
        <symbol id="icon-create" viewBox="0 0 24 24"><path fill="currentColor" d="M20.71 7.04c.39-.39.39-1.04 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83L19.5 9.59l1.21-1.55M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z"/></symbol>
        <symbol id="icon-sheets" viewBox="0 0 24 24"><path fill="currentColor" d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"/></symbol>
        <symbol id="icon-manual" viewBox="0 0 24 24"><path fill="currentColor" d="M19 2H5C3.9 2 3 2.9 3 4v16c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V6h10v2z"/></symbol>
        <symbol id="icon-admin" viewBox="0 0 24 24"><path fill="currentColor" d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12-.64l2 3.46c.12.22.39.3.61.22l2.49 1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59-1.69-.98l2.49 1c.23.09.49 0 .61.22l2-3.46c.12-.22-.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5s3.5 1.57 3.5 3.5s-1.57 3.5-3.5 3.5z"/></symbol>
        <symbol id="icon-logout" viewBox="0 0 24 24"><path fill="currentColor" d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5l-5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/></symbol>
        <symbol id="icon-language" viewBox="0 0 24 24"><path fill="currentColor" d="M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v1.99h11.17C11.5 7.92 10.44 9.75 9 11.35c-.79.84-1.5 1.76-2.12 2.76s-1.15 2.05-1.56 3.12H4V20H2v-1.99h.62c.41-1.16.92-2.27 1.56-3.32.63-1.04 1.34-2.04 2.12-2.91.81-.86 1.7-1.76 2.65-2.71l-1.99 1.99L12.87 15.07zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/></symbol>
    </svg>
    `;
    document.body.insertAdjacentElement('afterbegin', svgContainer);
}

/**
 * Gera o HTML do menu lateral e o insere na página.
 * Também configura os listeners de eventos para interatividade.
 */
function generateSidebarMenu() {
    const isHome = window.location.pathname.includes('/home/home.html');
    const body = document.body;

    const menuHtml = `
    <button id="menu-burger-toggle" class="" aria-label="Abrir menu" aria-expanded="false">
        <span class="bar"></span>
        <span class="bar"></span>
        <span class="bar"></span>
    </button>

    <aside id="menu-sidebar">
        <div class="sidebar-header">
            <div class="user-avatar-container">
                <div class="user-avatar">
                    <img id="menu-user-icon" src="/home/Perfil/assets_perfil/user.png" alt="Ícone do Usuário" />
                </div>
            </div>
            <div class="user-details">
                <h2 class="user-greeting" data-translate="welcome_greeting">Bem-vindo</h2>
                <p id="menu-user-email" class="user-email">Carregando...</p>
                <a href="/home/Perfil/perfil.html" class="edit-profile-link" data-translate="edit_profile">Editar perfil</a>
            </div>
        </div>

        <nav class="sidebar-nav">
            <a class="nav-item" id="menu-btn0"><svg class="nav-icon"><use xlink:href="#icon-home"></use></svg><span class="nav-text" data-translate="home_screen">Tela Inicial</span></a>
            <a class="nav-item" id="menu-btn1"><svg class="nav-icon"><use xlink:href="#icon-create"></use></svg><span class="nav-text" data-translate="create_analysis">Criar Análise</span></a>
            <a class="nav-item" id="menu-btn2"><svg class="nav-icon"><use xlink:href="#icon-sheets"></use></svg><span class="nav-text" data-translate="your_analyses">Suas Análises</span></a>
            <a class="nav-item" id="menu-btn-manual"><svg class="nav-icon"><use xlink:href="#icon-manual"></use></svg><span class="nav-text" data-translate="user_manual">Manual do Usuário</span></a>
            <a class="nav-item" id="menu-btn3" style="display: none;"><svg class="nav-icon"><use xlink:href="#icon-admin"></use></svg><span class="nav-text" data-translate="admin_panel">Admin</span></a>
        </nav>

        <div class="sidebar-footer">
            <div class="nav-item" id="language-toggle-menu" style="cursor: pointer;">
                <svg class="nav-icon"><use xlink:href="#icon-language"></use></svg>
                <span class="nav-text" data-translate="language_selector">Idioma</span>
                <img id="current-flag-menu" src="/assets/br.png" alt="Idioma" style="width: 24px; height: 24px; border-radius: 50%; margin-left: auto;">
            </div>
            <a class="nav-item logout-btn" id="menu-logout-btn"><svg class="nav-icon"><use xlink:href="#icon-logout"></use></svg><span class="nav-text" data-translate="logout">Sair</span></a>
        </div>
    </aside>
    <div id="sidebar-overlay"></div>
    `;

    body.insertAdjacentHTML('beforeend', menuHtml);

    // Configura as interações após o HTML ser adicionado ao DOM
    setupMenuInteractions();
    autenticacao();
    addNavigationListeners();
    setupLanguageSwitcher();
}

/**
 * Configura os eventos de clique para abrir/fechar o menu.
 */
function setupMenuInteractions() {
    const toggleBtn = document.getElementById('menu-burger-toggle');
    const overlay = document.getElementById('sidebar-overlay');

    const toggleMenu = () => {
        const isOpen = document.body.classList.toggle('sidebar-open');
        toggleBtn.setAttribute('aria-expanded', isOpen);
    };

    toggleBtn.addEventListener('click', toggleMenu);
    overlay.addEventListener('click', toggleMenu);
}

/**
 * Autentica o usuário, busca e exibe suas informações.
 */
function autenticacao() {
    const userData = sessionStorage.getItem('user');
    if (userData) {
        const user = JSON.parse(userData);
        document.getElementById('menu-user-email').textContent = user.email;
        carregarTipoUsuarioEAtualizarIcone(user.uid);
        checkAdminStatus(user.email);
    } else {
        console.log('Nenhum usuário logado. Redirecionando...');
        window.location.href = '/index.html';
    }
}

/**
 * Carrega o tipo de usuário do Firebase e atualiza o ícone correspondente.
 * @param {string} uid - O ID do usuário.
 */
function carregarTipoUsuarioEAtualizarIcone(uid) {
    get(child(ref(db), `users/${uid}`)).then(snapshot => {
        if (snapshot.exists()) {
            const tipo = snapshot.val().tipo;
            if (tipo) {
                const iconMap = {
                    "pessoafisica": "/home/Perfil/assets_perfil/icone_login_pessoa_fisica.png",
                    "empresa": "/home/Perfil/assets_perfil/icone_empresas.png",
                    "universidade/escola": "/home/Perfil/assets_perfil/icone_instituicao_de_ensino.png",
                    "ong": "/home/Perfil/assets_perfil/icone_ong.png",
                    "outros": "/home/Perfil/assets_perfil/icone_login_pessoa_fisica.png"
                };
                document.getElementById('menu-user-icon').src = iconMap[tipo.trim().toLowerCase()] || "/home/Perfil/assets_perfil/user.png";
            }
        }
    }).catch(error => console.error("Erro ao buscar dados do usuário:", error));
}

/**
 * Verifica se o usuário é administrador e exibe o botão correspondente.
 * @param {string} email - O email do usuário.
 */
function checkAdminStatus(email) {
    const adminEmails = ['williamfunk.11@gmail.com', 'joao.falves07@gmail.com'];
    const adminButton = document.getElementById('menu-btn3');
    if (adminEmails.includes(email)) {
        adminButton.style.display = 'flex';
    }
}

// Função auxiliar para obter texto traduzido
async function getTranslation(key) {
    const lang = localStorage.getItem('selectedLanguage') || 'pt';
    try {
        const response = await fetch(`/i18n/${lang}.json`);
        if (!response.ok) return key; // Retorna a chave como fallback
        const translations = await response.json();
        return translations[key] || key; // Retorna a chave como fallback
    } catch (error) {
        console.error('Erro ao buscar tradução:', error);
        return key; // Retorna a chave como fallback
    }
}

/**
 * Realiza o logout do usuário, limpando a sessão.
 */
async function logout() {
    const title = await getTranslation('swal_logout_title');
    const text = await getTranslation('swal_logout_text');
    const confirmButtonText = await getTranslation('swal_logout_confirm');
    const cancelButtonText = await getTranslation('swal_logout_cancel');

    Swal.fire({
        title: title,
        text: text,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: confirmButtonText,
        cancelButtonText: cancelButtonText
    }).then((result) => {
        if (result.isConfirmed) {
            signOut(auth).then(() => {
                sessionStorage.clear();
                // A linha que deletava o IndexedDB foi removida daqui.
                window.location.href = '/index.html'; // Redireciona diretamente.
            }).catch(error => console.error('Erro ao deslogar:', error));
        }
    });
}


/**
 * Adiciona os listeners de navegação para os itens do menu e o botão de logout.
 */
function addNavigationListeners() {
    const navMap = {
        'menu-btn0': '/home/home.html',
        'menu-btn1': '/home/CriaAnalise/cria_analise.html',
        'menu-btn2': '/home/SuasAnalises/suas_analises.html',
        'menu-btn3': '/home/adm/adm.html',
        'menu-btn-manual': 'https://docs.google.com/document/d/1GRTPK-FSrdIToDhhsmitcQHkWB7nVn3r/edit?usp=drive_link&ouid=111418885411734694225&rtpof=true&sd=true'
    };

    Object.entries(navMap).forEach(([id, url]) => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('click', (e) => {
                e.preventDefault();
                if (id === 'menu-btn-manual') {
                    window.open(url, '_blank');
                } else {
                    window.location.href = url;
                }
            });
        }
    });

    document.getElementById('menu-logout-btn').addEventListener('click', logout);
}


/**
 * Configura o seletor de idiomas dentro do menu.
 */
function setupLanguageSwitcher() {
    const languages = {
        'pt': { flag: '/assets/br.png' },
        'en': { flag: '/assets/us.png' },
        'es': { flag: '/assets/es.png' },
        'ita': { flag: '/assets/ita.png' },
        'ru': { flag: '/assets/ru.png' },
        'cn': { flag: '/assets/cn.png' }
    };

    const languageToggle = document.getElementById('language-toggle-menu');
    const flagImage = document.getElementById('current-flag-menu');
    const langKeys = Object.keys(languages);

    const updateLanguage = async (lang) => {
        try {
            if (languages[lang] && flagImage) {
                flagImage.src = languages[lang].flag;
            }

            const response = await fetch(`/i18n/${lang}.json`);
            if (!response.ok) {
                console.error(`Erro ao carregar o arquivo de idioma: ${lang}`);
                return;
            }
            const translations = await response.json();

            document.querySelectorAll('[data-translate]').forEach(element => {
                const key = element.getAttribute('data-translate');
                if (translations[key]) {
                    element.textContent = translations[key];
                }
            });

            localStorage.setItem('selectedLanguage', lang);

        } catch (error) {
            console.error('Erro ao aplicar traduções:', error);
        }
    };

    if (languageToggle) {
        languageToggle.addEventListener('click', () => {
            const currentLang = localStorage.getItem('selectedLanguage') || 'pt';
            const currentIndex = langKeys.indexOf(currentLang);
            const nextIndex = (currentIndex + 1) % langKeys.length;
            const nextLang = langKeys[nextIndex];
            updateLanguage(nextLang);
        });
    }

    const savedLanguage = localStorage.getItem('selectedLanguage') || 'pt';
    updateLanguage(savedLanguage);
}

// Inicializa o processo quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    injectSvgSprites();
    generateSidebarMenu();
});