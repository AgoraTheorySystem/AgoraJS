// /traducao.js

document.addEventListener('DOMContentLoaded', () => {
    // Objeto com os idiomas e os caminhos para as bandeiras
    const languages = {
        'pt': { flag: '/assets/br.png' },
        'en': { flag: '/assets/us.png' },
        'es': { flag: '/assets/es.png' }
    };

    const languageToggle = document.getElementById('language-toggle');
    const flagImage = document.getElementById('current-flag');
    const langKeys = Object.keys(languages);

    // Função para buscar o arquivo de idioma e aplicar as traduções
    const updateLanguage = async (lang) => {
        try {
            // Atualiza a imagem da bandeira no botão
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

            // Guarda a preferência do usuário
            localStorage.setItem('selectedLanguage', lang);

        } catch (error) {
            console.error('Erro ao aplicar traduções:', error);
        }
    };

    if (languageToggle) {
        // Evento de clique para trocar o idioma
        languageToggle.addEventListener('click', () => {
            const currentLang = localStorage.getItem('selectedLanguage') || 'pt';
            const currentIndex = langKeys.indexOf(currentLang);
            const nextIndex = (currentIndex + 1) % langKeys.length;
            const nextLang = langKeys[nextIndex];
            updateLanguage(nextLang);
        });
    }

    // Ao carregar a página, aplica o idioma salvo
    const savedLanguage = localStorage.getItem('selectedLanguage') || 'pt';
    updateLanguage(savedLanguage);
});