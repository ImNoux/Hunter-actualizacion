import { initializeApp } from "https://esm.sh/firebase/app";
import { getDatabase, ref, push, onValue, query, orderByChild, update, off } from "https://esm.sh/firebase/database";

const firebaseConfig = {
    apiKey: "AIzaSyDM9E8Y_YW-ld8MH8-yKS345hklA0v5P_w",
    authDomain: "hunterteam.firebaseapp.com",
    databaseURL: "https://hunterteam-default-rtdb.firebaseio.com",
    projectId: "hunterteam",
    storageBucket: "hunterteam.firebasestorage.app",
    messagingSenderId: "1001713111500",
    appId: "1:1001713111500:web:8729bf9a47a7806f6c4d69"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const threadsRef = ref(db, 'threads');

// VARIABLES GLOBALES
const threadsPerPage = 10;
let currentPage = 1;
let searchTerm = '';
let currentSection = 'Publicaciones'; // Sección activa
let allThreadsData = []; // AQUÍ GUARDAMOS TODOS LOS DATOS (MEMORIA)

// --- SISTEMA DE PESTAÑAS (OPTIMIZADO) ---
window.changeSection = function(sectionName) {
    currentSection = sectionName;
    currentPage = 1;

    // 1. Actualizar botones visualmente
    document.querySelectorAll('.tab-btn').forEach(btn => {
        if(btn.textContent.trim() === sectionName) btn.classList.add('active');
        else btn.classList.remove('active');
    });

    // 2. Actualizar textos del modal (sin borrar formulario)
    const modalTitle = document.getElementById('modalSectionTitle');
    const sectionInput = document.getElementById('sectionInput');
    if(modalTitle) modalTitle.textContent = sectionName;
    if(sectionInput) sectionInput.value = sectionName;

    // 3. RENDERIZAR (Mostrar) INMEDIATAMENTE sin recargar base de datos
    renderCurrentView();
};

function getUserId() {
    let userId = localStorage.getItem('userId');
    if (!userId) {
        userId = 'user_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('userId', userId);
    }
    return userId;
}

// --- CONEXIÓN ÚNICA A FIREBASE (INIT) ---
function initFirebaseListener() {
    const getThreads = query(threadsRef, orderByChild('timestamp'));

    // Escuchamos una sola vez. Cada vez que alguien publique algo nuevo, esto se ejecuta solo.
    onValue(getThreads, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            // Guardamos TODO en la variable global ordenado por fecha
            allThreadsData = Object.entries(data).sort((a, b) => b[1].timestamp - a[1].timestamp);
        } else {
            allThreadsData = [];
        }
        // Una vez tenemos los datos, pintamos la vista actual
        renderCurrentView();
    });
}

// --- FUNCIÓN DE RENDERIZADO (FILTRO VISUAL) ---
function renderCurrentView() {
    const threadContainer = document.querySelector('.thread-container');
    const noThreadsMessage = document.getElementById('noThreadsMessage');
    const paginationContainer = document.getElementById('pagination-container');

    threadContainer.innerHTML = '';
    paginationContainer.innerHTML = '';

    // FILTRAR los datos que ya tenemos en memoria
    let filtered = allThreadsData.filter(([key, thread]) => {
        const matchesSearch = thread.title.toLowerCase().includes(searchTerm.toLowerCase());

        // Lógica de compatibilidad para posts antiguos
        let postSection = thread.section; 
        let postCategory = thread.category;

        if (!postSection) {
            // Si es antiguo, miramos si su categoría coincide con una sección
            if (['Publicaciones', 'Foros', 'Sugerencias'].includes(postCategory)) {
                postSection = postCategory;
            } else {
                // Si no, por defecto a Publicaciones
                postSection = 'Publicaciones';
            }
        }

        return matchesSearch && (postSection === currentSection);
    });

    // MOSTRAR RESULTADOS
    if (filtered.length > 0) {
        noThreadsMessage.style.display = 'none';

        // Paginación local
        const start = (currentPage - 1) * threadsPerPage;
        const end = start + threadsPerPage;
        const pageThreads = filtered.slice(start, end);

        pageThreads.forEach(([key, thread]) => {
            renderThread(key, thread, threadContainer);
        });

        renderPagination(filtered.length);
    } else {
        noThreadsMessage.style.display = 'block';
        noThreadsMessage.textContent = `No hay posts en ${currentSection}.`;
        threadContainer.appendChild(noThreadsMessage);
    }
}

function renderThread(key, thread, container) {
    const div = document.createElement('div');
    div.classList.add('thread');

    // Media
    let mediaHTML = '';
    if (thread.image) {
        const isVideo = thread.image.match(/\.(mp4|webm)|video\/upload/i);
        if (isVideo) {
            mediaHTML = `<div style="background:#000;border-radius:4px;margin-top:10px;overflow:hidden;"><video src="${thread.image}" controls autoplay muted loop style="width:100%;display:block;"></video></div>`;
        } else {
            mediaHTML = `<img src="${thread.image}" alt="Media">`;
        }
    }

    // Badge de Categoría (Rango)
    let displayRank = thread.rank; 
    if (!displayRank && thread.category && !['Publicaciones', 'Foros', 'Sugerencias'].includes(thread.category)) {
        displayRank = thread.category; // Compatibilidad
    }

    let rankBadge = '';
    if (displayRank) {
        rankBadge = `<span class="rank-badge">${displayRank}</span>`;
    }

    const likeCount = thread.likeCount || 0;
    const commentCount = thread.comments ? Object.keys(thread.comments).length : 0;
    const userId = getUserId();
    const isLiked = thread.likes && thread.likes[userId] ? 'liked' : '';
    const verifyBadge = thread.verificado ? '<i class="fas fa-check-circle" style="color:#00a2ff; margin-left:5px;"></i>' : '';

    // ESTRUCTURA DE LA TARJETA
    // Muestra: USUARIO [RANGO]
    div.innerHTML = `
        <div class="thread-date">${thread.displayDate}</div>
        <h2>${thread.title} ${rankBadge} ${verifyBadge}</h2>
        <p>${thread.description}</p>
        ${mediaHTML}
        <div class="thread-actions">
            <button class="like-button ${isLiked}" onclick="toggleLike('${key}', ${likeCount}, this)">
                <i class="fas fa-heart"></i> ${likeCount}
            </button>
            <button class="comment-button" onclick="openComments('${key}')">
                <i class="far fa-comment"></i> ${commentCount}
            </button>
        </div>
    `;
    container.appendChild(div);
}

window.toggleLike = function(key, currentCount, btn) {
    const userId = getUserId();
    const liked = btn.classList.contains('liked');
    const newCount = liked ? currentCount - 1 : currentCount + 1;
    const updates = {};
    updates[`threads/${key}/likeCount`] = newCount;
    updates[`threads/${key}/likes/${userId}`] = liked ? null : true;
    update(ref(db), updates);
};

function renderPagination(totalItems) {
    const container = document.getElementById('pagination-container');
    const totalPages = Math.ceil(totalItems / threadsPerPage);
    if(totalPages <= 1) return;

    for(let i=1; i<=totalPages; i++) {
        const btn = document.createElement('button');
        btn.textContent = i;
        btn.className = `pagination-button ${i === currentPage ? 'active-page' : ''}`;
        btn.onclick = () => { currentPage = i; renderCurrentView(); }; // Solo renderiza, no recarga
        container.appendChild(btn);
    }
}

// INICIALIZACIÓN
document.addEventListener('DOMContentLoaded', () => {
    // 1. Iniciamos la escucha de datos (UNA SOLA VEZ)
    initFirebaseListener();

    // 2. Configuramos vista inicial
    changeSection('Publicaciones'); 

    document.getElementById('searchInput').oninput = (e) => {
        searchTerm = e.target.value;
        currentPage = 1;
        renderCurrentView(); // Filtrado local instantáneo
    };

    const modal = document.getElementById('newThreadModalContent');
    document.getElementById('newThreadButton').onclick = () => {
        document.getElementById('sectionInput').value = currentSection;
        document.getElementById('modalSectionTitle').textContent = currentSection;
        modal.style.display = (modal.style.display === 'block') ? 'none' : 'block';
    };

    const form = document.getElementById('newThreadForm');
    form.onsubmit = async (e) => {
        e.preventDefault();
        const btn = document.getElementById('submitBtn');
        const originalText = btn.textContent;
        btn.textContent = "Subiendo...";
        btn.disabled = true;

        // Capturamos los datos del nuevo formulario
        const title = document.getElementById('title').value; // Ahora es el Usuario
        const desc = document.getElementById('description').value;
        const section = document.getElementById('sectionInput').value; 
        const rank = document.getElementById('categorySelect').value; // El rango seleccionado
        const fileInput = document.getElementById('imageFile');

        let mediaUrl = '';
        if(fileInput.files[0]) {
            const formData = new FormData();
            formData.append('file', fileInput.files[0]);
            formData.append('upload_preset', 'comunidad_arc'); 
            const cloudName = 'dmrlmfoip'; 
            try {
                const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
                    method: 'POST', body: formData
                });
                const data = await res.json();
                mediaUrl = data.secure_url || '';
            } catch(err) { console.error(err); alert('Error subiendo archivo'); }
        }

        const newPost = {
            title: title,
            description: desc,
            section: section, 
            rank: rank,       
            image: mediaUrl,
            timestamp: Date.now(),
            displayDate: new Date().toLocaleDateString('es-ES')
        };

        push(threadsRef, newPost);

        form.reset();
        document.getElementById('fileName').textContent = '';
        modal.style.display = 'none';
        btn.textContent = originalText;
        btn.disabled = false;

        // Restaurar input de sección
        document.getElementById('sectionInput').value = currentSection;
    };
    initBouncingRobux();
});

// Comentarios
window.openComments = function(key) {
    const modal = document.getElementById('commentsModal');
    const list = document.getElementById('commentsList');
    list.innerHTML = '<p style="text-align:center;">Cargando...</p>';
    modal.style.display = 'block';

    const commentsRef = ref(db, `threads/${key}/comments`);
    off(commentsRef);
    onValue(commentsRef, (snapshot) => {
        list.innerHTML = '';
        const data = snapshot.val();
        if(data) {
            Object.values(data).forEach(c => {
                const item = document.createElement('div');
                item.className = 'comment-item';
                item.innerHTML = `<span style="color:#00a2ff;font-weight:bold;">${c.username || 'Anon'}:</span> ${c.text}`;
                list.appendChild(item);
            });
        } else {
            list.innerHTML = '<p style="text-align:center;color:#777;">Sé el primero en comentar.</p>';
        }
    });

    document.getElementById('commentForm').onsubmit = (e) => {
        e.preventDefault();
        const txt = document.getElementById('commentInput').value;
        const usr = document.getElementById('usernameInput').value || 'Anónimo';
        push(commentsRef, { text: txt, username: usr, timestamp: Date.now() });
        document.getElementById('commentInput').value = '';
    }
};

// Robux Background
function initBouncingRobux() {
    const container = document.getElementById('floating-robux-container');
    if(!container) return;
    for(let i=0; i<15; i++) {
        const img = document.createElement('img');
        img.src = "https://upload.wikimedia.org/wikipedia/commons/c/c7/Robux_2019_Logo_gold.svg";
        img.className = 'bouncing-robux';
        img.style.left = Math.random() * 80 + '%';
        img.style.top = Math.random() * 80 + '%';
        container.appendChild(img);
        let x = parseFloat(img.style.left);
        let y = parseFloat(img.style.top);
        let dx = (Math.random() - 0.5) * 0.5;
        let dy = (Math.random() - 0.5) * 0.5;
        setInterval(() => {
            x += dx; y += dy;
            if(x<=0 || x>=95) dx *= -1;
            if(y<=0 || y>=95) dy *= -1;
            img.style.left = x + '%';
            img.style.top = y + '%';
        }, 20);
    }
}