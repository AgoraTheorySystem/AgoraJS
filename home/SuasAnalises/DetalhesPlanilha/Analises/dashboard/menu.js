document.addEventListener("DOMContentLoaded", () => {
  // Recupera o parâmetro "planilha" da URL atual
  const urlParams = new URLSearchParams(window.location.search);
  const planilhaNome = urlParams.get("planilha");

  if (!planilhaNome) {
    console.warn("Parâmetro 'planilha' ausente na URL.");
    // Não retorna, pois o botão "Menu Das Análises" pode precisar funcionar
  }

  // Seleciona todos os links de navegação que têm um href
  const menuLinks = document.querySelectorAll(".menu a[href]");
  // Pega o caminho da URL atual (ex: /home/Analises/prototipicas.html)
  const currentPath = window.location.pathname;

  menuLinks.forEach(link => {
    // Cria um objeto URL para manipular o href de forma segura
    const linkUrl = new URL(link.getAttribute("href"), window.location.href);
    
    if (planilhaNome) {
      // Define (ou substitui) o parâmetro "planilha" com o valor dinâmico
      linkUrl.searchParams.set("planilha", planilhaNome);
      // Atualiza o atributo href do link
      link.setAttribute("href", linkUrl.toString());
    }

    // --- CORREÇÃO DO MENU ATIVO ---
    // 1. Remove a classe 'active' de TODOS os links primeiro.
    // Isso corrige o problema de classes 'active' fixas no HTML.
    link.classList.remove("active");

    // 2. Compara o pathname (caminho do arquivo) do link com o da página atual
    const linkPath = linkUrl.pathname;
    if (linkPath === currentPath) {
      // Adiciona a classe 'active' APENAS ao link correto
      link.classList.add("active");
    }
    // --- FIM DA CORREÇÃO ---
  });

  // Evento para o botão "Menu Das Análises" (que é um <a> sem href tratado como botão)
  const menuAnalisesBtn = document.querySelector(".menu_analises");
  if (menuAnalisesBtn) {
    menuAnalisesBtn.addEventListener("click", (e) => {
      e.preventDefault(); // Impede a navegação padrão do <a>
      if (planilhaNome) {
        const targetUrl = `/home/SuasAnalises/DetalhesPlanilha/menu_da_analise.html?planilha=${encodeURIComponent(planilhaNome)}`;
        window.location.href = targetUrl;
      } else {
        // Fallback se não houver nome da planilha (ex: volta para a lista de análises)
        window.location.href = "/home/SuasAnalises/suas_analises.html";
      }
    });
  }
});