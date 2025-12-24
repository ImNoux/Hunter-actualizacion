import { initializeApp } from "https://esm.sh/firebase/app";
import { getDatabase, ref, push, onValue, query, orderByChild, update, off, runTransaction, get, child, set, increment, onChildAdded } from "https://esm.sh/firebase/database";

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

const threadsPerPage = 10;
let currentPage = 1;
let searchTerm = ''; 
let currentSection = 'Home'; // Inicia en la Casita
let viewingUserProfile = ''; 
let allThreadsData = []; 
let verifiedUsersList = []; 
let myFollowingList = []; 
let myAvatarUrl = ""; 
let allUsersMap = {}; 

// --- NUEVO SISTEMA DE ALERTAS (TOASTS) ---
window.showToast = function(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if(!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = '';
    if(type === 'success') icon = '<i class="fas fa-check-circle" style="margin-right:10px; color:#00e676;"></i>';
    else if(type === 'error') icon = '<i class="fas fa-exclamation-circle" style="margin-right:10px; color:#ff4d4d;"></i>';
    else icon = '<i class="fas fa-info-circle" style="margin-right:10px; color:#00a2ff;"></i>';

    toast.innerHTML = `<span>${icon}${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.5s forwards';
        setTimeout(() => toast.remove(), 500);
    }, 3000);
};

// --- CONFIRMACIÓN PERSONALIZADA (MODAL) ---
window.showConfirm = function(message, callback) {
    const modal = document.getElementById('confirmModal');
    const text = document.getElementById('confirmText');
    const btn = document.getElementById('confirmActionBtn');
    
    if(modal && text && btn) {
        text.textContent = message;
        modal.style.display = 'block';
        
        btn.onclick = function() {
            callback();
            modal.style.display = 'none';
        };
    }
};

function makeLinksClickable(text) {
    if (!text) return '';
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.replace(urlRegex, function(url) {
        return `<a href="${url}" target="_blank" style="color: #00a2ff; text-decoration: underline; word-break: break-all;">${url}</a>`;
    });
}

function formatCount(num) {
    if (!num) return 0;
    if (num >= 1000000) { return (Math.floor((num / 1000000) * 10) / 10) + ' M'; }
    if (num >= 1000) { return Math.floor(num / 1000) + ' k'; }
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
    onValue(usersRef, (snapshot) => {
        const data = snapshot.val();
        allUsersMap = data ? data : {};
        if (allThreadsData.length > 0) renderCurrentView();
    });

    const getThreads = query(threadsRef, orderByChild('timestamp'));
    onValue(getThreads, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            allThreadsData = Object.entries(data).sort((a, b) => b[1].timestamp - a[1].timestamp);
        } else { allThreadsData = []; }
        renderCurrentView();
    });

    onValue(verifiedRef, (snapshot) => {
        const data = snapshot.val();
        verifiedUsersList = data ? Object.keys(data).map(name => name.toLowerCase()) : [];
        renderCurrentView(); 
    });

    const myUser = localStorage.getItem('savedRobloxUser');
    if (myUser) {
        const myUserRef = ref(db, `users/${myUser}`);
        onValue(myUserRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                myFollowingList = data.following ? Object.keys(data.following) : [];
                myAvatarUrl = data.avatar || DEFAULT_AVATAR;
            } else {
                myFollowingList = [];
                myAvatarUrl = DEFAULT_AVATAR;
            }
        });
    }
}
// --- PARTE 2: RENDERIZADO DE VISTAS ---

window.changeSection = function(sectionName) {
    currentSection = sectionName;
    currentPage = 1;
    
    // Actualizar iconos barra inferior
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    
    const searchContainer = document.getElementById('searchContainer');
    
    if(sectionName === 'Busqueda') {
        document.getElementById('nav-search').classList.add('active');
        if(searchContainer) searchContainer.style.display = 'block';
    } else {
        if(searchContainer) searchContainer.style.display = 'none';
        if(sectionName === 'Home') document.getElementById('nav-home').classList.add('active');
        if(sectionName === 'Activity') document.getElementById('nav-activity').classList.add('active');
        if(sectionName === 'Perfil') document.getElementById('nav-profile').classList.add('active');
    }
    
    renderCurrentView();
    window.scrollTo(0, 0);
};

function renderCurrentView() {
    const container = document.querySelector('.thread-container');
    const noMsg = document.getElementById('noThreadsMessage');
    if(!container) return;
    container.innerHTML = '';
    if(noMsg) noMsg.style.display = 'none';

    // 1. ACTIVIDAD
    if (currentSection === 'Activity') {
        renderActivity(container);
        return;
    }

    // 2. PERFIL
    if (currentSection === 'Perfil') {
        renderFullProfile(container);
        return;
    }

    // 3. BUSCADOR Y HOME
    if (currentSection === 'Busqueda') {
        renderUserSearch(container);
        if (searchTerm) renderPostList(container, true); 
        return;
    }

    // 4. HOME (Publicaciones)
    renderPostList(container, false);
}

// RENDERIZAR ACTIVIDAD
function renderActivity(container) {
    const myUser = localStorage.getItem('savedRobloxUser');
    if (!myUser) {
        container.innerHTML = '<div style="text-align:center; padding:30px; color:#777;">Inicia sesión para ver tu actividad.</div>';
        return;
    }

    container.innerHTML = '<h3 style="padding:15px; margin:0; border-bottom:1px solid #333; font-size:1.2em;">Actividad</h3>';
    let activityFound = false;

    // Seguidores
    const myData = allUsersMap[myUser];
    if (myData && myData.followers) {
        Object.keys(myData.followers).forEach(followerUser => {
            const fData = allUsersMap[followerUser] || {};
            const avatar = fData.avatar || DEFAULT_AVATAR;
            const name = fData.displayName || followerUser;
            
            const div = document.createElement('div');
            div.className = 'activity-item';
            div.innerHTML = `
                <img src="${avatar}" class="activity-avatar" onclick="openFullProfile('${followerUser}')">
                <div class="activity-text">
                    <strong onclick="openFullProfile('${followerUser}')">${name}</strong> comenzó a seguirte.
                </div>
            `;
            container.appendChild(div);
            activityFound = true;
        });
    }

    if (!activityFound) {
        container.innerHTML += '<div style="text-align:center; padding:40px; color:#555;">No hay actividad reciente.</div>';
    }
}

function renderPostList(container, isSearch) {
    let filtered = allThreadsData.filter(([key, thread]) => {
        if (isSearch) {
            if (!searchTerm) return false;
            const term = searchTerm.toLowerCase();
            return (thread.title?.toLowerCase().includes(term) || 
                    thread.description?.toLowerCase().includes(term) ||
                    thread.username?.toLowerCase().includes(term));
        }
        return true; 
    });

    if (filtered.length > 0) {
        filtered.forEach(([key, thread]) => renderThread(key, thread, container));
    } else if (!isSearch) {
        container.innerHTML = '<p style="text-align:center; padding:20px; color:#777;">No hay publicaciones aún.</p>';
    } else {
        container.innerHTML += '<p style="text-align:center; padding:20px; color:#777;">No se encontraron posts.</p>';
    }
}

function renderUserSearch(container) {
    if (!searchTerm) {
        container.innerHTML = '<p style="text-align:center; color:#777; margin-top:20px;">Busca personas o posts...</p>';
        return;
    }
    const term = searchTerm.toLowerCase();
    const foundUsers = Object.keys(allUsersMap).filter(u => 
        u.toLowerCase().includes(term) || 
        (allUsersMap[u].displayName && allUsersMap[u].displayName.toLowerCase().includes(term))
    );

    if (foundUsers.length > 0) {
        container.innerHTML += `<h4 style="padding:10px 15px; margin:0; color:#888;">Usuarios</h4>`;
        foundUsers.forEach(username => {
            const uData = allUsersMap[username];
            const div = document.createElement('div');
            div.className = 'user-search-result';
            div.onclick = () => openFullProfile(username);
            div.innerHTML = `
                <img src="${uData.avatar || DEFAULT_AVATAR}" class="user-search-avatar">
                <div class="user-search-info">
                    <h4 style="color:#fff; margin:0;">${uData.displayName || username}</h4>
                    <p style="color:#00a2ff; margin:0;">@${uData.customHandle || username}</p>
                </div>
            `;
            container.appendChild(div);
        });
    }
}

function renderFullProfile(container) {
    const targetUser = viewingUserProfile || localStorage.getItem('savedRobloxUser');
    if (!targetUser) {
        showToast("Inicia sesión para ver tu perfil", "error");
        return;
    }
    
    const userData = allUsersMap[targetUser] || {};
    const isMe = (targetUser === localStorage.getItem('savedRobloxUser'));
    
    // Verificado
    const isVerified = verifiedUsersList.includes(targetUser.toLowerCase());
    const verifyBadge = isVerified ? '<i class="fas fa-check-circle" style="color:#0095f6; margin-left:5px;"></i>' : '';

    const header = document.createElement('div');
    header.className = 'profile-header-container';
    header.innerHTML = `
        <div class="profile-top-section">
            <img src="${userData.avatar || DEFAULT_AVATAR}" class="profile-avatar-big">
            <div class="profile-info-column">
                <h2 class="display-name" onclick="${myUser===targetUser ? 'openEditProfileModal()' : ''}">${userData.displayName || targetUser} ${verifyBadge}</h2>
                <span style="color:#00a2ff;">@${userData.customHandle || targetUser}</span>
            </div>
        </div>
        
        <div class="profile-bio-section">
            ${makeLinksClickable(userData.bio || (isMe ? "Toca editar para añadir biografía..." : ""))}
        </div>

        <div class="profile-stats-bar">
            <div class="p-stat"><span>${formatCount(userData.followingCount)}</span><label>Siguiendo</label></div>
            <div class="p-stat"><span>${formatCount(userData.followersCount)}</span><label>Seguidores</label></div>
        </div>
        
        ${isMe ? `<button onclick="openEditProfileModal()" style="width:100%; padding:8px; margin-top:10px; background:transparent; border:1px solid #555; color:white; border-radius:6px; font-weight:bold; cursor:pointer;">Editar perfil</button>` 
               : `<button onclick="toggleFollow('${targetUser}')" style="width:100%; padding:8px; margin-top:10px; background:#00a2ff; border:none; color:white; border-radius:6px; font-weight:bold; cursor:pointer;">Seguir</button>`}
    `;
    container.appendChild(header);
    
    allThreadsData.forEach(([key, thread]) => {
        if(thread.username === targetUser) renderThread(key, thread, container);
    });
}

function renderThread(key, thread, container) {
    const div = document.createElement('div');
    div.classList.add('thread');
    
    const authorName = thread.username;
    const authorData = allUsersMap[authorName] || {};
    const avatar = authorData.avatar || DEFAULT_AVATAR;
    const displayName = authorData.displayName || authorName;
    const userId = getUserId();
    const isLiked = thread.likes && thread.likes[userId] ? 'liked' : '';
    const likeIcon = isLiked ? 'fas fa-heart' : 'far fa-heart';

    // Verificado y Rango
    const isVerified = verifiedUsersList.includes(authorName.toLowerCase());
    const verifyBadge = (isVerified || thread.verificado) 
        ? '<i class="fas fa-check-circle" style="color:#0095f6; margin-left:4px; font-size:0.9em;"></i>' : '';
    
    // Categoría debajo del nombre
    let roleHTML = '';
    let displayRank = thread.rank || thread.category;
    if (displayRank && displayRank !== 'Publicaciones' && displayRank !== 'General') {
        roleHTML = `<div style="font-size: 0.85em; color: #888; font-weight: 500; margin-top:-2px;">${displayRank}</div>`;
    }

    // Media
    let mediaHTML = '';
    if(thread.images && thread.images.length > 0) {
        let imgs = thread.images.map(url => {
            const isVid = url.match(/\.(mp4|webm)|video/i);
            return isVid ? `<video src="${url}" controls></video>` : `<img src="${url}">`;
        }).join('');
        mediaHTML = `<div class="media-carousel" style="display:flex; overflow-x:auto; gap:5px; margin-top:10px;">${imgs}</div>`;
    } else if (thread.image) {
        mediaHTML = `<img src="${thread.image}" style="width:100%; margin-top:10px; border-radius:12px;">`;
    }

    div.innerHTML = `
        <div class="post-header" style="align-items: flex-start;">
            <img src="${avatar}" class="user-avatar-small" onclick="openFullProfile('${authorName}')">
            
            <div class="post-header-info" style="display:flex; flex-direction:column; justify-content:center;">
                <div style="display:flex; align-items:center;">
                    <strong style="color:#fff; cursor:pointer; margin-right:2px;" onclick="openFullProfile('${authorName}')">${displayName}</strong>
                    ${verifyBadge}
                    <span style="color:#555; font-size:0.8em; margin-left:6px;">• ${thread.displayDate || "hoy"}</span>
                </div>
                ${roleHTML} </div>
        </div>

        <h3 style="margin:10px 0 5px 0; font-size:1.1em;">${thread.title}</h3>
        <p>${makeLinksClickable(thread.description)}</p>
        ${mediaHTML}
        
        <div class="thread-actions">
            <button class="like-button ${isLiked}" onclick="toggleLike('${key}', ${thread.likeCount||0}, this)">
                <i class="${likeIcon}"></i> ${formatCount(thread.likeCount)}
            </button>
            <button class="comment-button" onclick="openComments('${key}')">
                <i class="far fa-comment"></i>
            </button>
        </div>
    `;
    container.appendChild(div);
}
// --- PARTE 3: GESTIÓN DE USUARIOS ---

window.loginSystem = async function() {
    const user = document.getElementById('loginUser').value.trim();
    const pin = document.getElementById('loginPin').value.trim();
    if(!user || !pin) { showToast("Faltan datos", "error"); return; }

    try {
        const snapshot = await get(child(usersRef, user));
        if (snapshot.exists() && snapshot.val().pin == pin) {
            localStorage.setItem('savedRobloxUser', user);
            localStorage.setItem('userId', 'restored_' + user);
            showToast("Bienvenido", "success");
            closeModal('loginModal');
            setTimeout(() => window.location.reload(), 500);
        } else {
            showToast("Datos incorrectos", "error");
        }
    } catch(e) { showToast("Error de conexión", "error"); }
};

window.registerSystem = async function() {
    const user = document.getElementById('regUser').value.trim();
    const pin = document.getElementById('regPin').value.trim();
    if(!user || pin.length < 4) { showToast("Usuario o PIN inválido", "error"); return; }

    try {
        const snapshot = await get(child(usersRef, user));
        if (snapshot.exists()) { showToast("Usuario ya existe", "error"); } 
        else {
            await set(child(usersRef, user), { 
                pin, displayName: user, customHandle: user, 
                registeredAt: Date.now(), followersCount: 0, followingCount: 0 
            });
            localStorage.setItem('savedRobloxUser', user);
            localStorage.setItem('userId', 'new_' + user);
            showToast("Cuenta creada", "success");
            closeModal('registerModal');
            setTimeout(() => window.location.reload(), 500);
        }
    } catch(e) { showToast("Error al registrar", "error"); }
};

window.logoutSystem = function() {
    showConfirm("¿Seguro que quieres cerrar sesión?", () => {
        localStorage.removeItem('savedRobloxUser');
        localStorage.removeItem('userId');
        window.location.reload();
    });
};

// --- EDICIÓN PERFIL ---
window.openEditProfileModal = function() {
    const myUser = localStorage.getItem('savedRobloxUser');
    if (!myUser) return;
    const d = allUsersMap[myUser] || {};
    document.getElementById('editAvatarPreview').src = d.avatar || DEFAULT_AVATAR;
    document.getElementById('editNameInput').value = d.displayName || myUser;
    document.getElementById('editHandleInput').value = d.customHandle || myUser;
    document.getElementById('editBioInput').value = d.bio || "";
    document.getElementById('editStatusInput').value = d.status || "";
    openModal('editProfileModal');
};

window.saveProfileChanges = async function() {
    const myUser = localStorage.getItem('savedRobloxUser');
    if (!myUser) return;
    const btn = document.getElementById('saveProfileBtn');
    const oldText = btn.innerText; 
    btn.innerText = "Guardando...";

    const updates = {};
    const now = Date.now();
    
    updates[`users/${myUser}/displayName`] = document.getElementById('editNameInput').value;
    updates[`users/${myUser}/customHandle`] = document.getElementById('editHandleInput').value;
    updates[`users/${myUser}/bio`] = document.getElementById('editBioInput').value;
    updates[`users/${myUser}/status`] = document.getElementById('editStatusInput').value;

    try {
        await update(ref(db), updates);
        showToast("Perfil actualizado", "success");
        closeModal('editProfileModal');
        renderCurrentView(); 
    } catch(e) { showToast("Error al guardar", "error"); }
    finally { btn.innerText = oldText; }
};

window.openFullProfile = function(username) {
    viewingUserProfile = username || localStorage.getItem('savedRobloxUser');
    changeSection('Perfil');
};
// --- PARTE 4: EVENTOS E INICIALIZACIÓN ---

const searchIn = document.getElementById('searchInput');
if(searchIn) {
    searchIn.oninput = (e) => {
        searchTerm = e.target.value.trim();
        renderCurrentView();
    };
}

window.toggleFollow = function(target) {
    const me = localStorage.getItem('savedRobloxUser');
    if(!me) { showToast("Regístrate primero", "error"); return; }
    if(me === target) return;
    
    const isFollowing = myFollowingList.includes(target);
    const updates = {};
    if(isFollowing) {
        updates[`users/${me}/following/${target}`] = null;
        updates[`users/${target}/followers/${me}`] = null;
        updates[`users/${me}/followingCount`] = increment(-1);
        updates[`users/${target}/followersCount`] = increment(-1);
    } else {
        updates[`users/${me}/following/${target}`] = true;
        updates[`users/${target}/followers/${me}`] = true;
        updates[`users/${me}/followingCount`] = increment(1);
        updates[`users/${target}/followersCount`] = increment(1);
    }
    update(ref(db), updates);
};

window.toggleLike = function(key, count, btn) {
    if(!localStorage.getItem('savedRobloxUser')) { showToast("Inicia sesión para dar like", "error"); return; }
    
    const userId = getUserId();
    const isLiked = btn.querySelector('i').classList.contains('fas'); 
    
    const updates = {};
    updates[`threads/${key}/likeCount`] = isLiked ? count - 1 : count + 1;
    updates[`threads/${key}/likes/${userId}`] = isLiked ? null : true;
    
    update(ref(db), updates);
};

// PUBLICAR
const form = document.getElementById('newThreadForm');
if(form) {
    form.onsubmit = async (e) => {
        e.preventDefault();
        const user = localStorage.getItem('savedRobloxUser');
        if(!user) { showToast("Debes iniciar sesión", "error"); return; }
        
        const btn = document.getElementById('submitBtn');
        btn.disabled = true; btn.innerText = "Publicando...";

        let imgUrl = "";
        const fileInput = document.getElementById('imageFile');
        if(fileInput.files.length > 0) {
             const formData = new FormData();
             formData.append('file', fileInput.files[0]);
             formData.append('upload_preset', 'comunidad_arc');
             try {
                 const res = await fetch(`https://api.cloudinary.com/v1_1/dmrlmfoip/auto/upload`, { method: 'POST', body: formData });
                 const data = await res.json();
                 imgUrl = data.secure_url;
             } catch(err) { console.error(err); }
        }

        const newPost = {
            title: document.getElementById('title').value,
            description: document.getElementById('description').value,
            category: document.getElementById('categorySelect').value,
            username: user,
            image: imgUrl,
            timestamp: Date.now(),
            displayDate: new Date().toLocaleDateString('es-ES'),
            likeCount: 0
        };

        await push(threadsRef, newPost);
        form.reset();
        document.getElementById('fileName').textContent = "";
        closeModal('newThreadModalContent');
        showToast("Publicado con éxito", "success");
        btn.disabled = false; btn.innerText = "Publicar";
        changeSection('Home');
    };
}

// Avatar Upload
document.getElementById('avatarUpload').onchange = async function() {
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

// COMENTARIOS
window.openComments = function(key) {
    const modal = document.getElementById('commentsModal');
    const list = document.getElementById('commentsList');
    list.innerHTML = '<p style="text-align:center; color:#777;">Cargando...</p>';
    modal.style.display = 'block';

    const commentsRef = ref(db, `threads/${key}/comments`);
    off(commentsRef);
    onValue(commentsRef, (snapshot) => {
        list.innerHTML = '';
        const data = snapshot.val();
        if(data) {
            Object.values(data).forEach(c => {
                const div = document.createElement('div');
                div.innerHTML = `<strong>${c.username}:</strong> ${makeLinksClickable(c.text)}`;
                div.style.padding = "8px 0";
                div.style.borderBottom = "1px solid #333";
                list.appendChild(div);
            });
        } else { list.innerHTML = '<p style="text-align:center; color:#777;">Sin comentarios aún.</p>'; }
    });

    const cForm = document.getElementById('commentForm');
    cForm.onsubmit = (e) => {
        e.preventDefault();
        const user = localStorage.getItem('savedRobloxUser');
        if(!user) { showToast("Inicia sesión para comentar", "error"); return; }
        
        const txt = document.getElementById('commentInput').value;
        push(commentsRef, { text: txt, username: user, timestamp: Date.now() });
        // Vistas solo al comentar
        runTransaction(ref(db, `threads/${key}/views`), (v) => (v || 0) + 1);
        document.getElementById('commentInput').value = '';
    };
};

// INICIALIZACIÓN
document.addEventListener('DOMContentLoaded', () => {
    initFirebaseListener();
    changeSection('Home');
    
    const user = localStorage.getItem('savedRobloxUser');
    if(user) {
        document.getElementById('menuLogin').style.display = 'none';
        document.getElementById('menuLogout').style.display = 'block';
    }

    // Botón flotante nuevo post: cargar avatar
    const btnNew = document.querySelector('.plus-btn-container'); 
    if(btnNew) {
        btnNew.onclick = (e) => {
            e.preventDefault();
            if(!user) { showToast("Regístrate para publicar", "error"); return; }
            
            const myData = allUsersMap[user] || {};
            const myAvatar = myData.avatar || DEFAULT_AVATAR;
            const myHandle = myData.customHandle || user;

            document.getElementById('postAvatarPreview').src = myAvatar;
            document.getElementById('postUserHandle').textContent = myHandle;
            openModal('newThreadModalContent');
        };
    }
});