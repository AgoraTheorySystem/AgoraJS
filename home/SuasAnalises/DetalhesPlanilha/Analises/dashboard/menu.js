document.addEventListener("DOMContentLoaded", () => {
    // Recupera o parâmetro "planilha" da URL atual
    const urlParams = new URLSearchParams(window.location.search);
    const planilhaNome = urlParams.get("planilha");
  
    if (!planilhaNome) {
      console.warn("Parâmetro 'planilha' ausente na URL.");
      return;
    }
  
    // Atualiza os links do menu para usar o valor dinâmico de planilhaNome
    const menuLinks = document.querySelectorAll(".menu a[href]");
    menuLinks.forEach(link => {
      // Cria um objeto URL usando o href do link e a URL atual como base (para links relativos)
      const linkUrl = new URL(link.getAttribute("href"), window.location.href);
      // Define (ou substitui) o parâmetro "planilha" com o valor dinâmico
      linkUrl.searchParams.set("planilha", planilhaNome);
      // Atualiza o atributo href do link
      link.setAttribute("href", linkUrl.toString());
    });
  
    // Evento para o botão "Menu Das Analises"
    const menuAnalisesBtn = document.querySelector(".menu_analises");
    if (menuAnalisesBtn) {
      menuAnalisesBtn.addEventListener("click", () => {
        // Ajuste o caminho abaixo conforme a estrutura do seu projeto
        const targetUrl = `/home/SuasAnalises/DetalhesPlanilha/menu_da_analise.html?planilha=${encodeURIComponent(planilhaNome)}`;
        window.location.href = targetUrl;
      });
    }
  
    // Destaca o menu selecionado
    // Compara o pathname do link com o pathname da URL atual
    const currentPath = window.location.pathname;
    menuLinks.forEach(link => {
      const linkPath = new URL(link.href, window.location.href).pathname;
      if (linkPath === currentPath) {
        link.classList.add("active");
      }
    });
  });
  