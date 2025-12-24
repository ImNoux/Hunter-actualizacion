import { initializeApp } from "https://esm.sh/firebase/app";
import { getDatabase, ref, push, onValue, query, orderByChild, update, off, get, child, set, increment } from "https://esm.sh/firebase/database";

// --- CONFIGURACIÓN ---
const DEFAULT_AVATAR = "https://upload.wikimedia.org/wikipedia/commons/a/ac/Default_pfp.jpg";

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
const verifiedRef = ref(db, 'verified'); 

let searchTerm = ''; 
let currentSection = 'Home'; 
let viewingUserProfile = ''; 
let allThreadsData = []; 
let verifiedUsersList = []; 
let allUsersMap = {}; 
let myFollowingList = []; // Para control de follows

// --- TOASTS (Alertas) ---
window.showToast = function(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if(!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    let icon = type === 'success' ? 'check-circle' : (type === 'error' ? 'exclamation-circle' : 'info-circle');
    toast.innerHTML = `<span><i class="fas fa-${icon}"></i> ${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.5s forwards';
        setTimeout(() => toast.remove(), 500);
    }, 3000);
};

window.showConfirm = function(message, callback) {
    const modal = document.getElementById('confirmModal');
    const text = document.getElementById('confirmText');
    const btn = document.getElementById('confirmActionBtn');
    if(modal && text && btn) {
        text.textContent = message;
        modal.style.display = 'block';
        btn.onclick = () => { callback(); modal.style.display = 'none'; };
    }
};

function makeLinksClickable(text) {
    if (!text) return '';
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.replace(urlRegex, (url) => `<a href="${url}" target="_blank" style="color:#00a2ff; text-decoration:underline;">${url}</a>`);
}

function formatCount(num) {
    if (!num) return 0;
    if (num >= 1000000) return (Math.floor(num/100000)/10) + ' M';
    if (num >= 1000) return (Math.floor(num/100)/10) + ' k';
    return num;
}

window.getUserId = function() {
    let userId = localStorage.getItem('userId');
    if (!userId) {
        userId = 'user_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('userId', userId);
    }
    return userId;
}

function initFirebaseListener() {
    onValue(usersRef, (snap) => { 
        allUsersMap = snap.val() || {}; 
        if (allThreadsData.length > 0) renderCurrentView(); 
    });
    
    onValue(query(threadsRef, orderByChild('timestamp')), (snap) => {
        const data = snap.val();
        allThreadsData = data ? Object.entries(data).sort((a,b) => b[1].timestamp - a[1].timestamp) : [];
        renderCurrentView();
    });
    
    onValue(verifiedRef, (snap) => {
        const data = snap.val();
        verifiedUsersList = data ? Object.keys(data).map(n => n.toLowerCase()) : [];
        renderCurrentView();
    });
}
// --- NAVEGACIÓN ---
window.changeSection = function(sectionName) {
    currentSection = sectionName;
    localStorage.setItem('lastSection', sectionName);
    
    // Si no es perfil, borramos la memoria de visita
    if(sectionName !== 'Perfil') localStorage.removeItem('lastVisitedProfile');
    
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const sc = document.getElementById('searchContainer');
    
    if(sectionName === 'Busqueda') {
        document.getElementById('nav-search').classList.add('active');
        if(sc) sc.style.display = 'block';
    } else {
        if(sc) sc.style.display = 'none';
        const map = { Home: 'nav-home', Activity: 'nav-activity', Perfil: 'nav-profile' };
        if(map[sectionName]) document.getElementById(map[sectionName]).classList.add('active');
    }
    renderCurrentView();
    if(sectionName === 'Home') window.scrollTo(0,0);
};

// --- FUNCIÓN NUEVA: IR A MI PERFIL ---
window.openMyProfile = function() {
    viewingUserProfile = ''; // Resetear perfil visto
    localStorage.removeItem('lastVisitedProfile'); 
    changeSection('Perfil'); 
};

function renderCurrentView() {
    const container = document.querySelector('.thread-container');
    if(!container) return;
    container.innerHTML = '';

    if (currentSection === 'Activity') return renderActivity(container);
    if (currentSection === 'Perfil') return renderFullProfile(container);
    if (currentSection === 'Busqueda') {
        renderUserSearch(container);
        if (searchTerm) renderPostList(container, true);
        return;
    }
    renderPostList(container, false);
}

// --- RENDERIZADO DE POSTS (CON PROTECCIÓN DE ERRORES) ---
function renderThread(key, thread, container) {
    const div = document.createElement('div');
    div.className = 'thread';
    
    // PROTECCIÓN: Si no hay usuario, poner 'Desconocido'
    const authorName = thread.username || "Desconocido";
    const authorData = allUsersMap[authorName] || {};
    
    // PROTECCIÓN: Verificar que existe nombre antes de toLowerCase
    const isVerified = authorName && verifiedUsersList.includes(authorName.toLowerCase());
    const verifiedIconHTML = isVerified ? '<i class="fas fa-check-circle verified-icon" title="Verificado"></i>' : '';
    
    const userId = getUserId();
    const likes = thread.likes || {}; // Protección likes
    const isLiked = likes[userId] ? 'liked' : '';
    
    // Lógica Carrusel
    let mediaHTML = '';
    if(thread.images && thread.images.length > 0) {
        mediaHTML = `<div class="media-carousel">`;
        thread.images.forEach(img => { mediaHTML += `<img src="${img}">`; });
        mediaHTML += `</div>`;
    } else if(thread.image) {
        mediaHTML = `<img src="${thread.image}" style="width:100%; margin-top:10px; border-radius:8px;">`;
    }

    div.innerHTML = `
        <div class="post-header">
            <img src="${authorData.avatar || DEFAULT_AVATAR}" class="user-avatar-small" onclick="openFullProfile('${authorName}')">
            <div class="user-info-display">
                <div class="username-styled" onclick="openFullProfile('${authorName}')">
                    ${authorData.displayName || authorName}
                </div>
                <div class="user-rank-styled" style="display:flex; flex-direction:column;">
                    <span>${thread.category || "Miembro"}</span>
                    <span style="color:#00a2ff; font-size:0.9em; margin-top:2px;">
                        @${authorData.customHandle || authorName} ${verifiedIconHTML}
                    </span>
                </div>
            </div>
            <div style="font-size:0.8em; color:#777; margin-left:auto;">${thread.displayDate || ""}</div>
        </div>
        <h3 style="margin:10px 0 5px 0;">${thread.title}</h3>
        <p>${makeLinksClickable(thread.description)}</p>
        ${mediaHTML}
        <div class="thread-actions">
            <button class="like-button ${isLiked}" onclick="toggleLike('${key}', ${thread.likeCount||0}, this)">
                <i class="${isLiked ? 'fas' : 'far'} fa-heart"></i> ${formatCount(thread.likeCount)}
            </button>
            <button onclick="openComments('${key}')"><i class="far fa-comment"></i></button>
        </div>
    `;
    container.appendChild(div);
}

function renderPostList(container, isSearch) {
    const filtered = allThreadsData.filter(([k, t]) => {
        if (!isSearch) return true;
        const term = searchTerm.toLowerCase();
        // Protección en búsqueda también
        const tUser = t.username || ""; 
        const tTitle = t.title || "";
        return tTitle.toLowerCase().includes(term) || tUser.toLowerCase().includes(term);
    });
    if (filtered.length) filtered.forEach(([k, t]) => renderThread(k, t, container));
    else container.innerHTML += '<p style="text-align:center; padding:20px; color:#777;">Sin resultados.</p>';
}

function renderUserSearch(container) {
    if (!searchTerm) { container.innerHTML = '<p style="text-align:center; color:#777; margin-top:20px;">Busca personas...</p>'; return; }
    const term = searchTerm.toLowerCase();
    
    Object.keys(allUsersMap).filter(u => 
        u.toLowerCase().includes(term) || 
        (allUsersMap[u].displayName && allUsersMap[u].displayName.toLowerCase().includes(term))
    ).forEach(username => {
        const uData = allUsersMap[username];
        const isVerified = verifiedUsersList.includes(username.toLowerCase());
        const verifIcon = isVerified ? '<i class="fas fa-check-circle verified-icon"></i>' : '';
        
        const div = document.createElement('div');
        div.className = 'user-search-result';
        div.onclick = () => openFullProfile(username);
        div.innerHTML = `
            <img src="${uData.avatar || DEFAULT_AVATAR}" class="user-search-avatar">
            <div class="user-search-info">
                <h4 style="margin:0; color:#fff;">${uData.displayName || username}</h4>
                <p style="color:#00a2ff; margin:0;">@${uData.customHandle || username} ${verifIcon}</p>
            </div>
        `;
        container.appendChild(div);
    });
}
function renderFullProfile(container) {
    const target = viewingUserProfile || localStorage.getItem('savedRobloxUser');
    if (!target) return showToast("Inicia sesión", "error");
    
    const ud = allUsersMap[target] || {};
    const isMe = target === localStorage.getItem('savedRobloxUser');
    const isVerified = verifiedUsersList.includes(target.toLowerCase());
    const verifiedIconHTML = isVerified ? '<i class="fas fa-check-circle verified-icon"></i>' : '';
    
    const header = document.createElement('div');
    header.className = 'profile-header-container';
    header.innerHTML = `
        <div class="profile-top-section">
            <img src="${ud.avatar || DEFAULT_AVATAR}" class="profile-avatar-big" style="width:80px; height:80px; border-radius:50%;">
            <div style="margin-left:15px;">
                <div class="username-styled" style="font-size:1.4em;">
                    ${ud.displayName || target}
                </div>
                <div class="user-rank-styled">${ud.role || ud.status || "Miembro"}</div>
                <span style="color:#00a2ff; font-size:0.9em; display:block; margin-top:5px;">
                    @${ud.customHandle || target} ${verifiedIconHTML}
                </span>
            </div>
        </div>
        <div class="profile-bio-section">${makeLinksClickable(ud.bio || "Sin biografía")}</div>
        <div class="profile-stats-bar">
            <div class="p-stat"><span>${formatCount(ud.followingCount)}</span><label>Siguiendo</label></div>
            <div class="p-stat"><span>${formatCount(ud.followersCount)}</span><label>Seguidores</label></div>
        </div>
        ${isMe ? `<button onclick="openEditProfileModal()">Editar perfil</button>` : `<button onclick="toggleFollow('${target}')">Seguir</button>`}
    `;
    container.appendChild(header);
    
    allThreadsData.forEach(([k, t]) => { if(t.username === target) renderThread(k, t, container); });
}

function renderActivity(container) {
    const myUser = localStorage.getItem('savedRobloxUser');
    if (!myUser) { container.innerHTML = '<p style="text-align:center; padding:30px;">Inicia sesión.</p>'; return; }
    container.innerHTML = '<h3 style="padding:15px; border-bottom:1px solid #333;">Actividad</h3>';
    const myData = allUsersMap[myUser];
    if (myData?.followers) {
        Object.keys(myData.followers).forEach(f => {
            const fd = allUsersMap[f] || {};
            const div = document.createElement('div');
            div.className = 'activity-item';
            div.innerHTML = `<img src="${fd.avatar || DEFAULT_AVATAR}" class="activity-avatar"> <div class="activity-text"><strong>${f}</strong> te siguió.</div>`;
            container.appendChild(div);
        });
    } else { container.innerHTML += '<p style="text-align:center; padding:40px; color:#555;">Sin actividad.</p>'; }
}

// --- SUBIDA DE POSTS (CARRUSEL MÚLTIPLE) ---
const form = document.getElementById('newThreadForm');
if(form) {
    form.onsubmit = async (e) => {
        e.preventDefault();
        const user = localStorage.getItem('savedRobloxUser');
        if(!user) return showToast("Inicia sesión", "error");
        
        const btn = document.getElementById('submitBtn');
        btn.disabled = true; btn.innerText = "Subiendo...";
        
        let imgs = [];
        const files = document.getElementById('imageFile').files; // Leer múltiples archivos
        
        for (let i = 0; i < files.length; i++) {
            const fd = new FormData();
            fd.append('file', files[i]);
            fd.append('upload_preset', 'comunidad_arc');
            try {
                const res = await fetch(`https://api.cloudinary.com/v1_1/dmrlmfoip/auto/upload`, { method: 'POST', body: fd });
                const data = await res.json();
                imgs.push(data.secure_url);
            } catch(err) { console.error(err); }
        }

        const post = {
            title: document.getElementById('title').value,
            description: document.getElementById('description').value,
            category: document.getElementById('categorySelect').value,
            username: user,
            images: imgs, // Guardar array
            image: imgs.length > 0 ? imgs[0] : "", // Fallback
            timestamp: Date.now(),
            displayDate: new Date().toLocaleDateString('es-ES'),
            likeCount: 0
        };
        
        await push(threadsRef, post);
        form.reset();
        document.getElementById('fileName').textContent = "";
        closeModal('newThreadModalContent');
        showToast("Publicado", "success");
        btn.disabled = false; btn.innerText = "PUBLICAR";
        changeSection('Home');
    };
}

// --- SISTEMA DE LOGIN / REGISTRO ---
window.loginSystem = async function() {
    const u = document.getElementById('loginUser').value.trim();
    const p = document.getElementById('loginPin').value.trim();
    try {
        const s = await get(child(usersRef, u));
        if (s.exists() && s.val().pin == p) {
            localStorage.setItem('savedRobloxUser', u);
            localStorage.setItem('userId', 'res_' + u);
            window.location.reload();
        } else showToast("Datos incorrectos", "error");
    } catch(e) { showToast("Error de red", "error"); }
};

window.registerSystem = async function() {
    const u = document.getElementById('regUser').value.trim();
    const p = document.getElementById('regPin').value.trim();
    if(p.length < 4) return showToast("PIN muy corto", "error");
    try {
        const s = await get(child(usersRef, u));
        if (s.exists()) return showToast("Ya existe", "error");
        await set(child(usersRef, u), { 
            pin: p, displayName: u, customHandle: u, 
            registeredAt: Date.now(), followersCount: 0, followingCount: 0 
        });
        localStorage.setItem('savedRobloxUser', u);
        window.location.reload();
    } catch(e) { showToast("Error al registrar", "error"); }
};

window.logoutSystem = () => showConfirm("¿Cerrar sesión?", () => { 
    localStorage.clear(); 
    window.location.reload(); 
});

window.openFullProfile = (u) => { viewingUserProfile = u; changeSection('Perfil'); };

const searchIn = document.getElementById('searchInput');
if(searchIn) searchIn.oninput = (e) => { searchTerm = e.target.value.trim(); renderCurrentView(); };

window.toggleLike = (k, c, b) => {
    const u = localStorage.getItem('savedRobloxUser');
    if(!u) return showToast("Inicia sesión", "error");
    const id = getUserId();
    const isL = b.querySelector('i').classList.contains('fas');
    update(ref(db), { [`threads/${k}/likeCount`]: isL ? c - 1 : c + 1, [`threads/${k}/likes/${id}`]: isL ? null : true });
};

window.toggleFollow = function(target) {
    const me = localStorage.getItem('savedRobloxUser');
    if(!me) { showToast("Regístrate primero", "error"); return; }
    if(me === target) return;
    const updates = {};
    updates[`users/${me}/following/${target}`] = true; 
    updates[`users/${target}/followers/${me}`] = true;
    update(ref(db), updates);
    showToast(`Siguiendo a ${target}`, "success");
};

// Avatar Upload
const avatarInput = document.getElementById('avatarUpload');
if(avatarInput) {
    avatarInput.onchange = async function() {
        const user = localStorage.getItem('savedRobloxUser');
        if(!user || this.files.length === 0) return;
        showToast("Subiendo avatar...", "info");
        const formData = new FormData();
        formData.append('file', this.files[0]);
        formData.append('upload_preset', 'comunidad_arc');
        try {
            const res = await fetch(`https://api.cloudinary.com/v1_1/dmrlmfoip/auto/upload`, { method: 'POST', body: formData });
            const data = await res.json();
            await update(ref(db, `users/${user}`), { avatar: data.secure_url });
            document.getElementById('editAvatarPreview').src = data.secure_url;
            showToast("Avatar actualizado", "success");
        } catch(e) { showToast("Error al subir", "error"); }
    };
}

// Edición Perfil
window.openEditProfileModal = function() {
    const d = allUsersMap[localStorage.getItem('savedRobloxUser')] || {};
    document.getElementById('editAvatarPreview').src = d.avatar || DEFAULT_AVATAR;
    document.getElementById('editNameInput').value = d.displayName || "";
    document.getElementById('editHandleInput').value = d.customHandle || "";
    document.getElementById('editBioInput').value = d.bio || "";
    document.getElementById('editStatusInput').value = d.status || "";
    openModal('editProfileModal');
};

window.saveProfileChanges = async function() {
    const myUser = localStorage.getItem('savedRobloxUser');
    const now = Date.now();
    const gap = 15 * 24 * 60 * 60 * 1000;
    const ud = allUsersMap[myUser] || {};

    if (ud.lastProfileUpdate && (now - ud.lastProfileUpdate < gap)) {
        const left = Math.ceil((gap - (now - ud.lastProfileUpdate)) / (1000*60*60*24));
        return showToast(`Espera ${left} días para cambiar tus nombres.`, "error");
    }

    const updates = {
        [`users/${myUser}/displayName`]: document.getElementById('editNameInput').value,
        [`users/${myUser}/customHandle`]: document.getElementById('editHandleInput').value,
        [`users/${myUser}/bio`]: document.getElementById('editBioInput').value,
        [`users/${myUser}/status`]: document.getElementById('editStatusInput').value,
        [`users/${myUser}/lastProfileUpdate`]: now
    };
    await update(ref(db), updates);
    closeModal('editProfileModal');
    showToast("Perfil actualizado", "success");
};

// Comentarios
window.openComments = (key) => {
    const modal = document.getElementById('commentsModal');
    const list = document.getElementById('commentsList');
    modal.style.display = 'block';
    off(ref(db, `threads/${key}/comments`));
    onValue(ref(db, `threads/${key}/comments`), (snap) => {
        list.innerHTML = '';
        const data = snap.val();
        if(data) Object.values(data).forEach(c => {
            const d = document.createElement('div');
            d.innerHTML = `<strong>${c.username}:</strong> ${makeLinksClickable(c.text)}`;
            d.style.padding = "5px 0"; d.style.borderBottom = "1px solid #333";
            list.appendChild(d);
        });
        else list.innerHTML = '<p style="text-align:center; color:#777;">Sin comentarios.</p>';
    });
    
    const cForm = document.getElementById('commentForm');
    const newForm = cForm.cloneNode(true);
    cForm.parentNode.replaceChild(newForm, cForm);
    newForm.onsubmit = (e) => {
        e.preventDefault();
        const u = localStorage.getItem('savedRobloxUser');
        if(!u) return showToast("Inicia sesión", "error");
        push(ref(db, `threads/${key}/comments`), { 
            text: document.getElementById('commentInput').value, 
            username: u, timestamp: Date.now() 
        });
        document.getElementById('commentInput').value = '';
    };
};

document.addEventListener('DOMContentLoaded', () => {
    initFirebaseListener();
    const user = localStorage.getItem('savedRobloxUser');
    if(user) { 
        document.getElementById('menuLogin').style.display = 'none'; 
        document.getElementById('menuLogout').style.display = 'block'; 
    }
    changeSection(localStorage.getItem('lastSection') || 'Home');
});
