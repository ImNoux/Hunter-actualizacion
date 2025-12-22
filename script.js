import { initializeApp } from "https://esm.sh/firebase/app";
import { getDatabase, ref, push, onValue, query, orderByChild, update, off, runTransaction, get, child, set } from "https://esm.sh/firebase/database";

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
const usersRef = ref(db, 'users'); 
const verifiedRef = ref(db, 'verified'); // NUEVA REFERENCIA PARA VERIFICADOS

const threadsPerPage = 10;
let currentPage = 1;
let searchTerm = '';
let currentSection = 'Publicaciones'; 
let allThreadsData = []; 
let verifiedUsersList = []; // Aquí guardaremos los verificados que vienen de la BD

// --- FUNCIÓN MÁGICA: CONVERTIR TEXTO EN LINKS ---
function makeLinksClickable(text) {
    if (!text) return '';
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.replace(urlRegex, function(url) {
        return `<a href="${url}" target="_blank" style="color: #00a2ff; text-decoration: underline; word-break: break-all;">${url}</a>`;
    });
}

// --- FORMATEAR NÚMEROS ---
function formatCount(num) {
    if (!num) return 0;
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1).replace(/\.0$/, '') + ' Mill.';
    }
    if (num >= 1000) {
        return (num / 1000).toFixed(1).replace(/\.0$/, '') + ' mil';
    }
    return num;
}

// --- PESTAÑAS ---
window.changeSection = function(sectionName) {
    currentSection = sectionName;
    currentPage = 1;
    document.querySelectorAll('.tab-btn').forEach(btn => {
        if(btn.textContent.trim() === sectionName) btn.classList.add('active');
        else btn.classList.remove('active');
    });
    const modalTitle = document.getElementById('modalSectionTitle');
    const sectionInput = document.getElementById('sectionInput');
    if(modalTitle) modalTitle.textContent = sectionName;
    if(sectionInput) sectionInput.value = sectionName;
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

// --- FIREBASE INIT (ESCUCHADORES) ---
function initFirebaseListener() {
    // 1. Escuchar Publicaciones
    const getThreads = query(threadsRef, orderByChild('timestamp'));
    onValue(getThreads, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            allThreadsData = Object.entries(data).sort((a, b) => b[1].timestamp - a[1].timestamp);
        } else {
            allThreadsData = [];
        }
        renderCurrentView();
    });

    // 2. Escuchar Verificados (NUEVO)
    onValue(verifiedRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            // Convertimos las llaves del objeto en un array de nombres
            // Estructura en BD: verified -> { "ARC_KIUXT": true, "Admin": true }
            verifiedUsersList = Object.keys(data).map(name => name.toLowerCase());
        } else {
            verifiedUsersList = [];
        }
        renderCurrentView(); // Actualizamos la vista por si alguien recibió la insignia en vivo
    });
}

// --- RENDERIZADO ---
function renderCurrentView() {
    const threadContainer = document.querySelector('.thread-container');
    const noThreadsMessage = document.getElementById('noThreadsMessage');
    const paginationContainer = document.getElementById('pagination-container');

    if(!threadContainer) return;
    threadContainer.innerHTML = '';
    paginationContainer.innerHTML = '';

    let filtered = allThreadsData.filter(([key, thread]) => {
        const matchesSearch = thread.title.toLowerCase().includes(searchTerm.toLowerCase());
        let postSection = thread.section; 
        let postCategory = thread.category;
        if (!postSection) {
            if (['Publicaciones', 'Foros', 'Sugerencias'].includes(postCategory)) {
                postSection = postCategory;
            } else {
                postSection = 'Publicaciones';
            }
        }
        return matchesSearch && (postSection === currentSection);
    });

    if (filtered.length > 0) {
        if(noThreadsMessage) noThreadsMessage.style.display = 'none';
        const start = (currentPage - 1) * threadsPerPage;
        const end = start + threadsPerPage;
        const pageThreads = filtered.slice(start, end);
        pageThreads.forEach(([key, thread]) => renderThread(key, thread, threadContainer));
        renderPagination(filtered.length);
    } else {
        if(noThreadsMessage) {
            noThreadsMessage.style.display = 'block';
            noThreadsMessage.textContent = `No hay posts en ${currentSection}.`;
            threadContainer.appendChild(noThreadsMessage);
        }
    }
}

function renderThread(key, thread, container) {
    const div = document.createElement('div');
    div.classList.add('thread');

    let mediaHTML = '';
    if (thread.image) {
        const isVideo = thread.image.match(/\.(mp4|webm)|video\/upload/i);
        if (isVideo) {
            mediaHTML = `<div style="background:#000;border-radius:4px;margin-top:10px;overflow:hidden;"><video src="${thread.image}" controls autoplay muted loop style="width:100%;display:block;"></video></div>`;
        } else {
            mediaHTML = `<img src="${thread.image}" alt="Media">`;
        }
    }

    let displayRank = thread.rank; 
    if (!displayRank && thread.category && !['Publicaciones', 'Foros', 'Sugerencias'].includes(thread.category)) {
        displayRank = thread.category;
    }
    let rankBadge = displayRank ? `<span class="rank-badge">${displayRank}</span>` : '';

    const rawLikeCount = thread.likeCount || 0;
    const rawCommentCount = thread.comments ? Object.keys(thread.comments).length : 0;
    const rawViewCount = thread.views || 0;

    const likeCountDisplay = formatCount(rawLikeCount);
    const commentCountDisplay = formatCount(rawCommentCount);
    const viewCountDisplay = formatCount(rawViewCount);

    const userId = getUserId();
    const isLiked = thread.likes && thread.likes[userId] ? 'liked' : '';
    const authorName = thread.username || 'Usuario';

    // VERIFICACIÓN DESDE FIREBASE
    // Comprobamos si el nombre está en la lista que bajamos de la base de datos
    const isVerifiedAuto = verifiedUsersList.includes(authorName.toLowerCase());
    
    const verifyBadge = (isVerifiedAuto || thread.verificado) 
        ? '<i class="fas fa-check-circle" style="color:#00a2ff; margin-left:5px;"></i>' 
        : '';

    const descriptionWithLinks = makeLinksClickable(thread.description);

    div.innerHTML = `
        <div class="thread-date">${thread.displayDate}</div>
        
        <div style="margin-bottom: 5px; font-size: 0.9em; color: #aaa;">
            ${rankBadge} <strong style="color: #fff;">${authorName}</strong> ${verifyBadge}
        </div>

        <h2>${thread.title}</h2>
        
        <p>${descriptionWithLinks}</p>
        ${mediaHTML}
        
        <div class="thread-actions">
            <button class="like-button ${isLiked}" onclick="toggleLike('${key}', ${rawLikeCount}, this)">
                <i class="fas fa-heart"></i> ${likeCountDisplay}
            </button>
            <button class="comment-button" onclick="openComments('${key}')">
                <i class="far fa-comment"></i> ${commentCountDisplay}
            </button>
            <span class="view-button" style="color: #aaa; font-weight: bold; font-size: 1em; cursor: default; display: inline-flex; align-items: center; gap: 5px;">
                <i class="far fa-eye"></i> ${viewCountDisplay}
            </span>
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
        btn.onclick = () => { currentPage = i; renderCurrentView(); };
        container.appendChild(btn);
    }
}

// --- FUNCIÓN AUXILIAR: VERIFICAR SI EL USUARIO ESTÁ LIBRE ---
async function checkUsernameAvailability(username) {
    const normalizedUser = username.toLowerCase().trim();
    // Referencia a users/nombreusuario
    const userRef = child(usersRef, normalizedUser);
    
    const snapshot = await get(userRef);
    
    if (snapshot.exists()) {
        // EL USUARIO EXISTE EN LA BASE DE DATOS
        if (localStorage.getItem('savedRobloxUser') !== username) {
            return false; // No disponible (Impostor)
        }
    } else {
        // EL USUARIO NO EXISTE, LO REGISTRAMOS
        await set(userRef, { registeredAt: Date.now() });
    }
    return true; 
}


document.addEventListener('DOMContentLoaded', () => {
    initFirebaseListener();
    changeSection('Publicaciones'); 

    // BLOQUEO VISUAL AL INICIAR
    const robloxInput = document.getElementById('robloxUser');
    const savedRobloxUser = localStorage.getItem('savedRobloxUser');
    
    if(savedRobloxUser && robloxInput) {
        robloxInput.value = savedRobloxUser;
        robloxInput.disabled = true;
        robloxInput.style.backgroundColor = '#252525';
        robloxInput.style.cursor = 'not-allowed';
    }

    const searchIn = document.getElementById('searchInput');
    if(searchIn) {
        searchIn.oninput = (e) => {
            searchTerm = e.target.value;
            currentPage = 1;
            renderCurrentView();
        };
    }

    const btnNew = document.getElementById('newThreadButton');
    if(btnNew) {
        btnNew.onclick = (e) => {
            e.preventDefault();
            const modal = document.getElementById('newThreadModalContent');
            if(modal) {
                const sectionInput = document.getElementById('sectionInput');
                const titleSec = document.getElementById('modalSectionTitle');
                if(sectionInput) sectionInput.value = currentSection;
                if(titleSec) titleSec.textContent = currentSection;
                modal.style.display = (modal.style.display === 'block') ? 'none' : 'block';
            }
        };
    }

    const form = document.getElementById('newThreadForm');
    if(form) {
        form.onsubmit = async (e) => {
            e.preventDefault();
            const btn = document.getElementById('submitBtn');
            const originalText = btn.textContent;
            btn.textContent = "Verificando...";
            btn.disabled = true;

            const rank = document.getElementById('categorySelect').value; 
            const user = document.getElementById('robloxUser').value.trim(); 
            const title = document.getElementById('title').value;       
            const desc = document.getElementById('description').value;
            const section = document.getElementById('sectionInput').value; 
            const fileInput = document.getElementById('imageFile');
            const modal = document.getElementById('newThreadModalContent');

            if (!user) { alert("Escribe un usuario"); btn.disabled=false; btn.textContent=originalText; return; }
            
            const isAvailable = await checkUsernameAvailability(user);
            if (!isAvailable) {
                alert(`⚠️ El usuario "${user}" ya está en uso.\n\nPor favor, elige otro nombre.`);
                btn.disabled = false;
                btn.textContent = originalText;
                return;
            }

            if(!localStorage.getItem('savedRobloxUser')) {
                localStorage.setItem('savedRobloxUser', user);
                const rInput = document.getElementById('robloxUser');
                if(rInput) {
                    rInput.disabled = true;
                    rInput.style.backgroundColor = '#252525';
                }
            }

            btn.textContent = "Subiendo...";

            let mediaUrl = '';
            if(fileInput && fileInput.files[0]) {
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
                username: user,    
                rank: rank,        
                description: desc,
                section: section, 
                image: mediaUrl,
                timestamp: Date.now(),
                displayDate: new Date().toLocaleDateString('es-ES'),
                views: 0 
            };

            push(threadsRef, newPost);
            form.reset();
            
            if(localStorage.getItem('savedRobloxUser')) {
                document.getElementById('robloxUser').value = localStorage.getItem('savedRobloxUser');
            }

            document.getElementById('fileName').textContent = '';
            if(modal) modal.style.display = 'none';
            btn.textContent = originalText;
            btn.disabled = false;
            document.getElementById('sectionInput').value = currentSection;
        };
    }
    initBouncingRobux();
});

window.openComments = function(key) {
    const threadViewRef = ref(db, `threads/${key}/views`);
    runTransaction(threadViewRef, (currentViews) => {
        return (currentViews || 0) + 1;
    });

    const modal = document.getElementById('commentsModal');
    const list = document.getElementById('commentsList');
    list.innerHTML = '<p style="text-align:center;">Cargando...</p>';
    modal.style.display = 'block';

    const usernameInput = document.getElementById('usernameInput');
    const savedUser = localStorage.getItem('savedRobloxUser');
    if(savedUser && usernameInput) {
        usernameInput.value = savedUser;
        usernameInput.disabled = true;
        usernameInput.style.backgroundColor = '#252525';
    }

    const commentsRef = ref(db, `threads/${key}/comments`);
    off(commentsRef);
    onValue(commentsRef, (snapshot) => {
        list.innerHTML = '';
        const data = snapshot.val();
        if(data) {
            Object.values(data).forEach(c => {
                const item = document.createElement('div');
                item.className = 'comment-item';
                const commentWithLinks = makeLinksClickable(c.text);
                item.innerHTML = `<span style="color:#00a2ff;font-weight:bold;">${c.username || 'Anon'}:</span> <span style="color:#ddd;">${commentWithLinks}</span>`;
                list.appendChild(item);
            });
        } else {
            list.innerHTML = '<p style="text-align:center;color:#777;">Sé el primero en comentar.</p>';
        }
    });

    const cForm = document.getElementById('commentForm');
    if(cForm) {
        cForm.onsubmit = async (e) => {
            e.preventDefault();
            const txt = document.getElementById('commentInput').value;
            const usr = document.getElementById('usernameInput').value || 'Anónimo';
            
            if (usr !== 'Anónimo') {
                const isAvailable = await checkUsernameAvailability(usr);
                if (!isAvailable) {
                    alert(`⚠️ El usuario "${usr}" ya está ocupado.\nSi eres nuevo, elige otro nombre.`);
                    return;
                }
            }
            
            if(!localStorage.getItem('savedRobloxUser') && usr !== 'Anónimo') {
                localStorage.setItem('savedRobloxUser', usr);
                const uInput = document.getElementById('usernameInput');
                if(uInput) { uInput.disabled=true; uInput.style.backgroundColor='#252525'; }
            }

            push(commentsRef, { text: txt, username: usr, timestamp: Date.now() });
            document.getElementById('commentInput').value = '';
        }
    }
};

function initBouncingRobux() {
    const container = document.getElementById('floating-robux-container');
    if(!container) return;
    container.innerHTML = ''; 
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