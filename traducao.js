// /traducao.js

// Objeto global para armazenar as traduções carregadas
window.translations = {};
let currentLanguage = localStorage.getItem('selectedLanguage') || 'pt';

const languages = {
    'pt': { flag: '/assets/br.png' },
    'en': { flag: '/assets/us.png' },
    'es': { flag: '/assets/es.png' },
    'ita': { flag: '/assets/ita.png' },
    'ru': { flag: '/assets/ru.png' },
    'cn': { flag: '/assets/cn.png' }
};

// Função para buscar e carregar um arquivo de idioma
const loadLanguage = async (lang) => {
    try {
        const response = await fetch(`/i18n/${lang}.json`);
        if (!response.ok) {
            console.error(`Erro ao carregar o arquivo de idioma: ${lang}`);
            window.translations = {};
            return;
        }
        window.translations = await response.json();
    } catch (error) {
        console.error('Erro ao carregar traduções:', error);
        window.translations = {};
    }
};

// Função para aplicar as traduções aos elementos do DOM
const applyTranslationsToDOM = () => {
    // Traduz textos normais
    document.querySelectorAll('[data-translate]').forEach(element => {
        const key = element.getAttribute('data-translate');
        if (window.translations[key]) {
            // Para botões com ícones, preserva o ícone
            const icon = element.querySelector('i.fas');
            if (icon) {
                element.innerHTML = ` ${window.translations[key]}`;
                element.prepend(icon);
            } else {
                element.textContent = window.translations[key];
            }
        }
    });

    // Traduz atributos placeholder
    document.querySelectorAll('[data-translate-placeholder]').forEach(element => {
        const key = element.getAttribute('data-translate-placeholder');
        if (window.translations[key]) {
            element.placeholder = window.translations[key];
        }
    });
};

/**
 * Função global e assíncrona para obter uma única tradução.
 * Outros scripts podem chamar esta função para traduzir texto dinâmico.
 * @param {string} key - A chave da tradução.
 * @returns {Promise<string>} O texto traduzido ou a própria chave se não for encontrada.
 */
window.getTranslation = async (key) => {
    const lang = localStorage.getItem('selectedLanguage') || 'pt';
    // Garante que as traduções estejam carregadas para o idioma atual
    if (!Object.keys(window.translations).length || currentLanguage !== lang) {
        await loadLanguage(lang);
        currentLanguage = lang;
    }
    return window.translations[key] || key;
};

// Função principal para atualizar o idioma da página
const updateLanguage = async (lang) => {
    localStorage.setItem('selectedLanguage', lang);
    currentLanguage = lang;

    // Atualiza ambas as bandeiras (geral e do menu lateral)
    const flagImage = document.getElementById('current-flag');
    if (languages[lang] && flagImage) {
        flagImage.src = languages[lang].flag;
    }
    const flagImageMenu = document.getElementById('current-flag-menu');
    if (languages[lang] && flagImageMenu) {
        flagImageMenu.src = languages[lang].flag;
    }

    await loadLanguage(lang);
    applyTranslationsToDOM();
};

// Configuração inicial e eventos
document.addEventListener('DOMContentLoaded', () => {
    const languageToggle = document.getElementById('language-toggle');
    const languageToggleMenu = document.getElementById('language-toggle-menu');
    const langKeys = Object.keys(languages);

    const toggleAction = () => {
        const currentLang = localStorage.getItem('selectedLanguage') || 'pt';
        const currentIndex = langKeys.indexOf(currentLang);
        const nextIndex = (currentIndex + 1) % langKeys.length;
        const nextLang = langKeys[nextIndex];
        updateLanguage(nextLang);
    };

    if (languageToggle) {
        languageToggle.addEventListener('click', toggleAction);
    }
    // Adiciona o listener ao seletor de idioma do menu lateral também
    if (languageToggleMenu) {
        languageToggleMenu.addEventListener('click', toggleAction);
    }

    // Carrega o idioma salvo ou o padrão ao iniciar a página
    updateLanguage(currentLanguage);
});

