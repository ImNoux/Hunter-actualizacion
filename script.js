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
let myFollowingList = []; 

// --- TOASTS ---
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

// --- NUEVO FORMATO INTELIGENTE ---
function formatCount(num) {
    if (!num) return 0;
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1).replace(/\.0$/, '') + ' mill.';
    }
    if (num >= 1000) {
        let val = (num / 1000).toFixed(1).replace(/\.0$/, '');
        if (val === '1000') return '1 mill.';
        return val + ' mil';
    }
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

// --- LISTENERS ---
function initFirebaseListener() {
    onValue(usersRef, (snap) => { 
        allUsersMap = snap.val() || {}; 
        const myUser = localStorage.getItem('savedRobloxUser');
        if (myUser && allUsersMap[myUser] && allUsersMap[myUser].following) {
            myFollowingList = Object.keys(allUsersMap[myUser].following);
        } else {
            myFollowingList = [];
        }
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
// --- NAVEGACIÓN Y GESTOS (MODIFICADO) ---
window.changeSection = function(sectionName) {
    currentSection = sectionName;
    localStorage.setItem('lastSection', sectionName);
    
    // 1. Lógica del historial para el botón "Atrás"
    if (sectionName !== 'Home') {
        history.pushState({ section: sectionName }, "", "#" + sectionName);
    } else {
        history.replaceState(null, "", " ");
    }

    // 2. Limpieza de perfil visitado si salimos de "Perfil"
    if(sectionName !== 'Perfil') {
        localStorage.removeItem('lastVisitedProfile');
        viewingUserProfile = ''; 
    }
    
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

// --- EVENTO BOTÓN ATRÁS (NUEVO) ---
window.onpopstate = function(event) {
    if (currentSection !== 'Home') {
        currentSection = 'Home';
        localStorage.setItem('lastSection', 'Home');
        localStorage.removeItem('lastVisitedProfile');
        viewingUserProfile = '';
        
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
        const homeNav = document.getElementById('nav-home');
        if(homeNav) homeNav.classList.add('active');
        
        const sc = document.getElementById('searchContainer');
        if(sc) sc.style.display = 'none';
        
        renderCurrentView();
        window.scrollTo(0,0);
    }
};

window.openMyProfile = function() {
    viewingUserProfile = ''; 
    localStorage.removeItem('lastVisitedProfile'); 
    changeSection('Perfil'); 
};

// --- MODIFICADO: ABRIR PERFIL (Guarda la visita) ---
window.openFullProfile = (u) => { 
    viewingUserProfile = u; 
    localStorage.setItem('lastVisitedProfile', u); // <--- Guarda ID para recarga
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

window.updateImageCounter = function(carousel) {
    const width = carousel.offsetWidth;
    const currentIndex = Math.round(carousel.scrollLeft / width) + 1;
    const totalImages = carousel.childElementCount;
    const badge = carousel.parentElement.querySelector('.image-counter-badge');
    if(badge) badge.innerText = `${currentIndex}/${totalImages}`;
};

function renderThread(key, thread, container) {
    const div = document.createElement('div');
    div.className = 'thread';
    
    const authorName = thread.username || "Desconocido";
    const authorData = allUsersMap[authorName] || {};
    const myUser = localStorage.getItem('savedRobloxUser');
    const isVerified = authorName && verifiedUsersList.includes(authorName.toLowerCase());
    const verifiedIconHTML = isVerified ? '<i class="fas fa-check-circle verified-icon"></i>' : '';
    const isMe = (myUser === authorName);
    const isFollowing = myFollowingList.includes(authorName);
    
    let avatarHTML = '';
    if (!isMe && !isFollowing && myUser) {
        avatarHTML = `
        <div class="avatar-wrapper" onclick="toggleMiniMenu(this)">
            <img src="${authorData.avatar || DEFAULT_AVATAR}" class="user-avatar-small">
            <div class="plus-badge"><i class="fas fa-plus"></i></div>
            <div class="mini-action-menu">
                <div onclick="event.stopPropagation(); openFullProfile('${authorName}')">
                    <i class="far fa-user"></i> Ir al perfil
                </div>
                <div onclick="event.stopPropagation(); toggleFollow('${authorName}'); this.closest('.mini-action-menu').classList.remove('show');">
                    <i class="fas fa-plus-circle"></i> Seguir
                </div>
            </div>
        </div>`;
    } else {
        avatarHTML = `<img src="${authorData.avatar || DEFAULT_AVATAR}" class="user-avatar-small" onclick="openFullProfile('${authorName}')">`;
    }
    
    let mediaHTML = '';
    if(thread.images && thread.images.length > 1) {
        mediaHTML = `
        <div class="media-wrapper">
            <div class="media-carousel" onscroll="updateImageCounter(this)">
                ${thread.images.map(img => `<img src="${img}">`).join('')}
            </div>
            <div class="image-counter-badge">1/${thread.images.length}</div>
        </div>`;
    } else if (thread.images && thread.images.length === 1) {
        mediaHTML = `<img src="${thread.images[0]}" style="width:100%; margin-top:10px; border-radius:8px;">`;
    } else if(thread.image) {
        mediaHTML = `<img src="${thread.image}" style="width:100%; margin-top:10px; border-radius:8px;">`;
    }

    const userId = getUserId();
    const likes = thread.likes || {};
    const isLiked = likes[userId] ? 'liked' : '';
    const commentCount = thread.comments ? Object.keys(thread.comments).length : 0;

    div.innerHTML = `
        <div class="post-header">
            ${avatarHTML}
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
            <button onclick="openComments('${key}')">
                <i class="far fa-comment"></i> ${formatCount(commentCount)}
            </button>
        </div>
    `;
    container.appendChild(div);
}

window.toggleMiniMenu = function(element) {
    document.querySelectorAll('.mini-action-menu.show').forEach(el => {
        if(el !== element.querySelector('.mini-action-menu')) el.classList.remove('show');
    });
    const menu = element.querySelector('.mini-action-menu');
    if(menu) menu.classList.toggle('show');
}
document.addEventListener('click', function(e) {
    if(!e.target.closest('.avatar-wrapper')) {
        document.querySelectorAll('.mini-action-menu.show').forEach(el => el.classList.remove('show'));
    }
});

function renderFullProfile(container) {
    const target = viewingUserProfile || localStorage.getItem('savedRobloxUser');
    if (!target) return showToast("Inicia sesión", "error");
    
    const ud = allUsersMap[target] || {};
    const isMe = target === localStorage.getItem('savedRobloxUser');
    const isVerified = verifiedUsersList.includes(target.toLowerCase());
    const verifiedIconHTML = isVerified ? '<i class="fas fa-check-circle verified-icon"></i>' : '';
    const userStatus = ud.status && ud.status.trim() !== "" ? `<div class="status-pill">${ud.status}</div>` : '';
    
    const header = document.createElement('div');
    header.className = 'profile-header-container';
    header.innerHTML = `
        <div class="profile-top-section">
            <div class="avatar-wrapper" style="cursor:default;">
                ${userStatus}
                <img src="${ud.avatar || DEFAULT_AVATAR}" class="profile-avatar-big" style="width:80px; height:80px; border-radius:50%;">
            </div>
            <div style="margin-left:15px;">
                <div class="username-styled" style="font-size:1.4em;">
                    ${ud.displayName || target}
                </div>
                <div class="user-rank-styled">${ud.role || "Miembro"}</div>
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

function renderPostList(container, isSearch) {
    const filtered = allThreadsData.filter(([k, t]) => {
        if (!isSearch) return true;
        const term = searchTerm.toLowerCase();
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
// --- INICIALIZACIÓN (CORREGIDA) ---
document.addEventListener('DOMContentLoaded', () => {
    initFirebaseListener();
    const user = localStorage.getItem('savedRobloxUser');
    
    if(user) { 
        document.getElementById('menuLogin').style.display = 'none'; 
        document.getElementById('menuLogout').style.display = 'block'; 
    }
    
    // Recuperar la última sección visitada
    const lastSection = localStorage.getItem('lastSection') || 'Home';
    
    // Lógica especial si estábamos en un Perfil
    if (lastSection === 'Perfil') {
        const savedProfile = localStorage.getItem('lastVisitedProfile');
        
        if (savedProfile) {
            // CASO A: Estábamos viendo el perfil de OTRA persona
            viewingUserProfile = savedProfile;
        } else {
            // CASO B: Estábamos en NUESTRO perfil (savedProfile es nulo)
            // Si el usuario tiene sesión iniciada, dejamos que cargue su perfil.
            if (user) {
                viewingUserProfile = ''; // Esto indica cargar "Mi Perfil"
            } else {
                // Si no hay sesión y tampoco perfil ajeno guardado, vamos al Home
                changeSection('Home');
                return;
            }
        }
    }
    
    changeSection(lastSection);
});
