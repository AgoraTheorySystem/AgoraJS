const button1 = document.getElementById('button1');
const button2 = document.getElementById('button2');
const button3 = document.getElementById('button3');

const button5 = document.getElementById('button5');
const button6 = document.getElementById('button6');

button1.addEventListener('click', () => openPage('tipos_cadastros/pessoafisica.html'));
button2.addEventListener('click', () => openPage('tipos_cadastros/empresa.html'));
button3.addEventListener('click', () => openPage('tipos_cadastros/universidadeescola.html'));

button5.addEventListener('click', () => openPage('tipos_cadastros/ong.html'));
button6.addEventListener('click', () => openPage('tipos_cadastros/outros.html'));

function openPage(pageUrl) {
    window.location.href = pageUrl;
}


