// /traducao.js

// Objeto global para armazenar as traduções carregadas
window.translations = {};
let currentLanguage = localStorage.getItem('selectedLanguage') || 'pt';

const languages = {
    'pt': { flag: '/assets/br.png' },
    'en': { flag: '/assets/us.png' },
    'es': { flag: '/assets/es.png' }
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

    const flagImage = document.getElementById('current-flag');
    if (languages[lang] && flagImage) {
        flagImage.src = languages[lang].flag;
    }
    
    await loadLanguage(lang);
    applyTranslationsToDOM();
};

// Configuração inicial e eventos
document.addEventListener('DOMContentLoaded', () => {
    const languageToggle = document.getElementById('language-toggle');
    const langKeys = Object.keys(languages);

    if (languageToggle) {
        languageToggle.addEventListener('click', () => {
            const currentLang = localStorage.getItem('selectedLanguage') || 'pt';
            const currentIndex = langKeys.indexOf(currentLang);
            const nextIndex = (currentIndex + 1) % langKeys.length;
            const nextLang = langKeys[nextIndex];
            updateLanguage(nextLang);
        });
    }

    // Carrega o idioma salvo ou o padrão ao iniciar a página
    updateLanguage(currentLanguage);
});
