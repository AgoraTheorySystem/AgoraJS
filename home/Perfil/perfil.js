import firebaseConfig from '/firebase.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.9.3/firebase-app.js";
import { getDatabase, ref, get, child } from "https://www.gstatic.com/firebasejs/9.9.3/firebase-database.js";

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

function getUser() {
  const userData = sessionStorage.getItem('user');
  if (!userData) {
    console.error("Dados do usuário não encontrados na sessão.");
    return null;
  }
  try {
    const parsed = JSON.parse(userData);
    return { uid: parsed.uid };
  } catch (error) {
    console.error("Erro ao analisar dados do usuário:", error);
    return null;
  }
}

const user = getUser();
console.log(user ? user.uid : 'Usuário não encontrado');

// Inicializa o Firebase

/**
 * Lê e imprime todos os dados de um diretório no Realtime Database
 * @param {string} path - Caminho do diretório no banco (ex: "usuarios/")
 */
async function printFirebaseDirectory(path) {
  const dbRef = ref(db);

  try {
    const snapshot = await get(child(dbRef, path));
    if (snapshot.exists()) {
      console.log(`Dados em ${path}`);
      console.log(JSON.stringify(snapshot.val(), null, 2));
    } else {
      console.log(`Nenhum dado encontrado em ${path}`);
    }
  } catch (error) {
    console.error("Erro ao acessar o Firebase:", error);
  }
}

// Exemplo de uso
if (user) {
  printFirebaseDirectory(`/users/${user.uid}`);
}