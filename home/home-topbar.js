import firebaseConfig from '/firebase.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.9.3/firebase-app.js";
import { getDatabase, ref, get, child } from "https://www.gstatic.com/firebasejs/9.9.3/firebase-database.js";

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Recuperar dados do usuário da sessão
function getUser() {
  const userData = sessionStorage.getItem('user');
  if (!userData) return null;
  try {
    const parsed = JSON.parse(userData);
    return {
      uid: parsed.uid,
      email: parsed.email || ''
    };
  } catch {
    return null;
  }
}

const user = getUser();

if (user) {
  const emailSpan = document.getElementById('emailTopo');
  if (emailSpan) emailSpan.textContent = user.email;

  const dbRef = ref(db);
  get(child(dbRef, `/users/${user.uid}`)).then(snapshot => {
    if (snapshot.exists()) {
      const data = snapshot.val();

      if (data.tipo) {
        atualizarIconeUsuario(data.tipo);
      }

      // Exibe botão Admin apenas para e-mails autorizados
      const adminEmails = [
        'williamfunk.11@gmail.com',
        'williamgame.11@gmail.com',
        'joao.falves07@gmail.com'
      ];

      if (adminEmails.includes(user.email)) {
        const adminBtn = document.getElementById("adminButton");
        if (adminBtn) adminBtn.style.display = "list-item";
      }
    }
  });
}

// Atualiza o ícone do usuário conforme o tipo
function atualizarIconeUsuario(tipo) {
  const icone = document.getElementById('iconeUsuario');
  if (!icone) return;

  const mapaIcones = {
    "pessoafisica": "/home/Perfil/assets_perfil/icone_login_pessoa_fisica.png",
    "empresa": "/home/Perfil/assets_perfil/icone_empresas.png",
    "universidade/escola": "/home/Perfil/assets_perfil/icone_instituicao_de_ensino.png",
    "ong": "/home/Perfil/assets_perfil/icone_ong.png",
    "outros": "/home/Perfil/assets_perfil/icone_login_pessoa_fisica.png"
  };

  const tipoLower = (tipo || '').trim().toLowerCase();
  icone.src = mapaIcones[tipoLower] || "/home/Perfil/assets_perfil/user.png";
}

// Função de logout compatível com menu lateral
window.logoutUsuario = function () {
  sessionStorage.clear();
  localStorage.clear();
  window.location.href = "/index.html"; // ajuste se necessário
};
