import firebaseConfig from '/firebase.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.9.3/firebase-app.js";
import {getDatabase, ref, get,child, set} from "https://www.gstatic.com/firebasejs/9.9.3/firebase-database.js";

// Inicialização do Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Recuperação do usuário
function getUser() {
  const userData = sessionStorage.getItem('user');
  if (!userData) {
    console.error("Dados do usuário não encontrados na sessão.");
    return null;
  }
  try {
    const parsed = JSON.parse(userData);
    return {
      uid: parsed.uid,
      email: parsed.email || ''
    };
  } catch (error) {
    console.error("Erro ao analisar dados do usuário:", error);
    return null;
  }
}

const user = getUser();
console.log(user ? user.uid : 'Usuário não encontrado');

// Atualiza o email do topo do perfil
if (user) {
  const spanEmailTopo = document.getElementById('emailTopo');
  if (spanEmailTopo && user.email) {
    spanEmailTopo.textContent = user.email;
  }

  const path = `/users/${user.uid}`;
  const dbRef = ref(db);

  get(child(dbRef, path)).then(snapshot => {
    if (snapshot.exists()) {
      const data = snapshot.val();

      // Atualiza ícone do usuário com base no login feito
      if (data.tipo) {
        console.log("Tipo de usuário:", data.tipo); 
        atualizarIconeUsuario(data.tipo);
      }

      preencherCamposDinamicamente(data);
    } else {
      console.log("Nenhum dado encontrado.");
    }
  }).catch(error => {
    console.error("Erro ao carregar dados:", error);
  });
}

// Cria os campos adaptaveis
function preencherCamposDinamicamente(dados) {
  const container = document.getElementById('informacoes');
  container.innerHTML = '';

  Object.entries(dados).forEach(([chave, valor]) => {
    const campo = document.createElement('div');
    campo.className = 'campos';

    const label = document.createElement('label');
    label.setAttribute('for', chave);
    label.innerText = formatarTituloCampo(chave);

    const divInput = document.createElement('div');
    divInput.className = 'nome_campos';
    divInput.style.position = 'relative';

    const input = document.createElement('input');
    input.type = 'text';
    input.id = chave;
    input.value = valor;
    input.readOnly = true;
    input.style.paddingRight = '40px';

    const botao = document.createElement('button');
    botao.className = 'editar_botao';
    botao.innerHTML = `<img src="/home/Perfil/assets_perfil/icone_editar.png" alt="Editar">`;
    botao.style.position = 'absolute';
    botao.style.right = '10px';
    botao.style.top = '50%';
    botao.style.transform = 'translateY(-50%)';

    let editando = false;

    botao.addEventListener('click', () => {
      editando = !editando;
      input.readOnly = !editando;
      if (editando) {
        input.focus();
        botao.innerHTML = `<img src="/home/Perfil/assets_perfil/user.png" alt="Salvar">`;
      } else {
        botao.innerHTML = `<img src="/home/Perfil/assets_perfil/icone_editar.png" alt="Editar">`;
        salvarCampoNoFirebase(user.uid, chave, input.value);
      }
    });

    divInput.appendChild(input);
    divInput.appendChild(botao);
    campo.appendChild(label);
    campo.appendChild(divInput);
    container.appendChild(campo);
  });
}

// Devolve alteração pro firebase
function salvarCampoNoFirebase(uid, campo, valor) {
  const campoRef = ref(db, `/users/${uid}/${campo}`);
  set(campoRef, valor)
    .then(() => console.log(`Campo "${campo}" salvo com sucesso.`))
    .catch(err => console.error(`Erro ao salvar campo "${campo}":`, err));
}

// Formata nome 
function formatarTituloCampo(campo) {
  return campo
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase());
}

// Atualiza o ícone do usuário conforme tipo de login
function atualizarIconeUsuario(tipo) {
  const icone = document.getElementById('iconeUsuario');
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
