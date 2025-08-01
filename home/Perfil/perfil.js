import firebaseConfig from '/firebase.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.9.3/firebase-app.js";
import { getDatabase, ref, get, child, set } from "https://www.gstatic.com/firebasejs/9.9.3/firebase-database.js";

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
      if (data.tipo) {
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

// Cria os campos adaptáveis e filtra campos indesejados
function preencherCamposDinamicamente(dados) {
  const container = document.getElementById('informacoes');
  container.innerHTML = '';

  const camposIgnorados = ['UltimasAlteracoes', 'lematizacoes', 'planilhas'];

  Object.entries(dados).forEach(([chave, valor]) => {
    if (camposIgnorados.includes(chave)) return;

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

    const erroMensagem = document.createElement('div');
    erroMensagem.style.color = '#ff4d4d';
    erroMensagem.style.fontSize = '0.8em';
    erroMensagem.style.marginTop = '5px';
    erroMensagem.style.display = 'none';

    divInput.appendChild(input);
    campo.appendChild(label);
    campo.appendChild(divInput);
    campo.appendChild(erroMensagem);

    // Campos não editáveis: email e tipo
    if (!['email', 'tipo'].includes(chave.toLowerCase())) {
      const botao = document.createElement('button');
      botao.className = 'editar_botao';
      botao.innerHTML = `<img src="/home/Perfil/assets_perfil/icone_editar.png" alt="Editar">`;

      botao.style.position = 'absolute';
      botao.style.right = '10px';
      botao.style.top = '50%';
      botao.style.transform = 'translateY(-50%)';

      let editando = false;

      function salvarEdicao() {
        const valorFinal = input.value.trim();

        if (valorFinal === '') {
          erroMensagem.textContent = `O campo "${formatarTituloCampo(chave)}" é obrigatório.`;
          erroMensagem.style.display = 'block';
          input.readOnly = false;
          input.classList.add('editando');
          input.focus();
          return;
        }

        erroMensagem.style.display = 'none';
        editando = false;
        input.readOnly = true;
        input.classList.remove('editando');
        botao.innerHTML = `<img src="/home/Perfil/assets_perfil/icone_editar.png" alt="Editar">`;
        salvarCampoNoFirebase(user.uid, chave, valorFinal);
      }

      botao.addEventListener('click', () => {
        editando = !editando;
        input.readOnly = !editando;

        if (editando) {
          erroMensagem.style.display = 'none';
          input.classList.add('editando');
          input.focus();
          botao.innerHTML = `<img src="/home/Perfil/assets_perfil/salvar_alt.png" alt="Salvar">`;
        } else {
          salvarEdicao();
        }
      });

      input.addEventListener('keydown', (e) => {
        if (editando && e.key === 'Enter') {
          e.preventDefault();
          salvarEdicao();
        }
      });

      divInput.appendChild(botao);
    }

    container.appendChild(campo);
  });
}

// Salva alteração no Firebase
function salvarCampoNoFirebase(uid, campo, valor) {
  const campoRef = ref(db, `/users/${uid}/${campo}`);
  set(campoRef, valor)
    .then(() => console.log(`Campo "${campo}" salvo com sucesso.`))
    .catch(err => console.error(`Erro ao salvar campo "${campo}":`, err));
}

// Formata o título de cada campo
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
