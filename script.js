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
let currentSection = 'Publicaciones'; 
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
    if (num >= 1000000) { return (Math.floor((num / 1000000) * 10) / 10) + ' Mill.'; }
    if (num >= 1000) { return Math.floor(num / 1000) + ' mil'; }
    return num;
}

window.changeSection = function(sectionName) {
    currentSection = sectionName;
    currentPage = 1;
    document.querySelectorAll('.tab-btn').forEach(btn => {
        if(btn.textContent.trim() === sectionName) btn.classList.add('active');
        else btn.classList.remove('active');
    });
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
// --- PARTE 2: RENDERIZADO MEJORADO ---

function renderCurrentView() {
    const threadContainer = document.querySelector('.thread-container');
    const noThreadsMessage = document.getElementById('noThreadsMessage');
    const paginationContainer = document.getElementById('pagination-container');

    if(!threadContainer) return;
    threadContainer.innerHTML = '';
    paginationContainer.innerHTML = '';
    if(noThreadsMessage) noThreadsMessage.style.display = 'none';

    if (currentSection === 'Perfil') { renderFullProfile(threadContainer); return; }
    if (currentSection === 'Busqueda') { renderUserSearch(threadContainer); return; }

    // FILTRO POTENTE (BUSCADOR)
    let filtered = allThreadsData.filter(([key, thread]) => {
        let postCategory = thread.category || 'Publicaciones';
        let postSection = thread.section || (['Publicaciones', 'Foros', 'Sugerencias'].includes(postCategory) ? postCategory : 'Publicaciones');
        
        let isInSection = (currentSection === 'Publicaciones') 
                          ? (postSection === 'Publicaciones') 
                          : (postSection === currentSection);

        let matchesSearch = true;
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            const titleMatch = thread.title?.toLowerCase().includes(term);
            const descMatch = thread.description?.toLowerCase().includes(term);
            const userMatch = thread.username?.toLowerCase().includes(term); 
            
            let displayMatch = false;
            let handleMatch = false;
            if(allUsersMap[thread.username]) {
                const dName = allUsersMap[thread.username].displayName || "";
                const cHandle = allUsersMap[thread.username].customHandle || "";
                if(dName.toLowerCase().includes(term)) displayMatch = true;
                if(cHandle.toLowerCase().includes(term)) handleMatch = true;
            }
            matchesSearch = (titleMatch || descMatch || userMatch || displayMatch || handleMatch);
        }

        if (searchTerm) { return matchesSearch; } 
        else { return isInSection; }
    });

    if (filtered.length > 0) {
        const start = (currentPage - 1) * threadsPerPage;
        const end = start + threadsPerPage;
        const pageThreads = filtered.slice(start, end);
        pageThreads.forEach(([key, thread]) => renderThread(key, thread, threadContainer));
        renderPagination(filtered.length);
    } else {
        if(noThreadsMessage) {
            noThreadsMessage.style.display = 'block';
            noThreadsMessage.textContent = searchTerm 
                ? `No encontramos resultados para "${searchTerm}"` 
                : `No hay contenido en ${currentSection}.`;
            threadContainer.appendChild(noThreadsMessage);
        }
    }
}

function renderUserSearch(container) {
    if (!searchTerm) {
        container.innerHTML = '<p style="text-align:center; color:#777; margin-top:20px;">Escribe un nombre o usuario para buscar...</p>';
        return;
    }
    const term = searchTerm.toLowerCase();
    
    const foundUsers = Object.keys(allUsersMap).filter(u => {
        const data = allUsersMap[u];
        const usernameMatch = u.toLowerCase().includes(term);
        const displayMatch = data.displayName?.toLowerCase().includes(term);
        const handleMatch = data.customHandle?.toLowerCase().includes(term);
        return usernameMatch || displayMatch || handleMatch;
    });

    if (foundUsers.length === 0) {
        container.innerHTML = `<p style="text-align:center; margin-top:20px;">No encontramos a "${searchTerm}"</p>`;
        return;
    }

    foundUsers.forEach(username => {
        const uData = allUsersMap[username];
        const avatar = uData.avatar || DEFAULT_AVATAR;
        const display = uData.displayName || username;
        const handle = uData.customHandle || username;
        const followers = formatCount(uData.followersCount || 0);

        const div = document.createElement('div');
        div.className = 'user-search-result';
        div.onclick = () => openFullProfile(username);

        div.innerHTML = `
            <img src="${avatar}" class="user-search-avatar">
            <div class="user-search-info">
                <h4 style="color:#fff; margin:0;">${display}</h4>
                <p style="color:#00a2ff; margin:2px 0;">@${handle}</p>
                <p style="font-size:0.75em; color:#888; margin:0;">${followers} Seguidores</p>
            </div>
        `;
        container.appendChild(div);
    });
}

function renderFullProfile(container) {
    const targetUser = viewingUserProfile;
    const userData = allUsersMap[targetUser] || {};
    
    const avatar = userData.avatar || DEFAULT_AVATAR;
    const displayName = userData.displayName || targetUser;
    const displayHandle = userData.customHandle || targetUser; 

    const status = userData.status || ""; 
    const bio = userData.bio || "";
    const hasPin = userData.pin ? true : false;
    
    const followers = formatCount(userData.followersCount || 0);
    const following = formatCount(userData.followingCount || 0);
    
    let totalLikes = 0;
    let userPosts = [];
    allThreadsData.forEach(([key, thread]) => {
        if(thread.username === targetUser) {
            userPosts.push([key, thread]);
            totalLikes += (thread.likeCount || 0);
        }
    });

    const isVerified = verifiedUsersList.includes(targetUser.toLowerCase());
    const verifyBadge = isVerified ? '<i class="fas fa-check-circle" style="font-size: 0.9em;"></i>' : '';

    const myUser = localStorage.getItem('savedRobloxUser');
    let bubbleHTML = '';
    let plusBtnAction = '';
    let pinWarningHTML = '';
    let actionButtonsHTML = '';

    if (myUser === targetUser) {
        if (status) {
            bubbleHTML = `<div class="status-bubble" onclick="openEditProfileModal()">${status}</div>`;
        } else {
            bubbleHTML = `<div class="status-bubble" onclick="openEditProfileModal()" style="opacity:0.5;">+ Nota</div>`;
        }
        
        plusBtnAction = `onclick="openEditProfileModal()"`;
        
        actionButtonsHTML = `
            <button onclick="openEditProfileModal()" style="width:100%; margin-top:15px; padding:10px; background:transparent; color:#fff; border:1px solid #555; border-radius:6px; font-weight:bold; cursor:pointer;">
                Editar perfil
            </button>
        `;

        if (!hasPin) {
            pinWarningHTML = `
                <div style="background: rgba(255, 165, 0, 0.15); border: 1px solid orange; padding: 10px; border-radius: 6px; margin: 15px 0; text-align: center;">
                    <p style="color: orange; font-size: 0.85em; margin: 0 0 5px 0;">⚠️ Seguridad: No tienes contraseña (PIN)</p>
                    <button onclick="createMyPin()" style="background: orange; color: white; border: none; padding: 5px 15px; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 0.9em; margin-top:5px;">CREAR PIN</button>
                </div>`;
        }

    } else {
        if (status) bubbleHTML = `<div class="status-bubble">${status}</div>`;
        const isFollowing = myFollowingList.includes(targetUser);
        if(isFollowing) {
             plusBtnAction = `onclick="toggleFollow('${targetUser}')" style="background:#00a2ff; color:#fff; border:none;"`; 
        } else {
             plusBtnAction = `onclick="toggleFollow('${targetUser}')"`;
        }
        
        actionButtonsHTML = `
            <button onclick="toggleFollow('${targetUser}')" style="width:100%; margin-top:15px; padding:10px; background:${isFollowing ? '#1a1a1a' : '#00a2ff'}; color:white; border:${isFollowing ? '1px solid #555' : 'none'}; border-radius:6px; font-weight:bold; cursor:pointer;">
                ${isFollowing ? 'Siguiendo' : 'Seguir'}
            </button>
        `;
    }

    let plusIcon = (myUser === targetUser) ? '<i class="fas fa-camera" style="font-size:0.8em;"></i>' : '<i class="fas fa-plus"></i>';
    if(myUser !== targetUser && myFollowingList.includes(targetUser)) {
        plusIcon = '<i class="fas fa-check"></i>';
    }

    const header = document.createElement('div');
    header.className = 'profile-header-container';
    header.innerHTML = `
        <div class="profile-top-section">
            <div class="profile-avatar-wrapper">
                ${bubbleHTML}
                <img src="${avatar}" class="profile-avatar-big">
                <div class="profile-plus-btn" ${plusBtnAction}>${plusIcon}</div>
            </div>

            <div class="profile-info-column">
                <h2 class="display-name" onclick="${myUser===targetUser ? 'openEditProfileModal()' : ''}">${displayName}</h2>
                <div class="username-handle">
                    <span>@${displayHandle}</span>
                    ${verifyBadge}
                </div>
            </div>
        </div>

        <div class="profile-stats-bar">
            <div class="p-stat"><span>${following}</span><label>Siguiendo</label></div>
            <div class="p-stat"><span>${followers}</span><label>Seguidores</label></div>
            <div class="p-stat"><span>${formatCount(totalLikes)}</span><label>Me gusta</label></div>
        </div>

        ${pinWarningHTML}

        <div class="profile-bio-section">
            ${bio ? makeLinksClickable(bio) : (myUser===targetUser ? '<span style="color:#777; font-style:italic; cursor:pointer;" onclick="openEditProfileModal()">Toca para añadir presentación...</span>' : '')}
        </div>
        
        ${actionButtonsHTML}
    `;
    container.appendChild(header);

    if (userPosts.length > 0) {
        userPosts.forEach(([key, thread]) => renderThread(key, thread, container));
    } else {
        container.innerHTML += `<div style="text-align:center; padding:40px; color:#555;"><i class="fas fa-camera" style="font-size:2em; margin-bottom:10px;"></i><br>Sin publicaciones</div>`;
    }
}

function renderThread(key, thread, container) {
    const div = document.createElement('div');
    div.classList.add('thread');

    let mediaHTML = '';
    if (thread.images && Array.isArray(thread.images) && thread.images.length > 0) {
        const totalImages = thread.images.length;
        const wrapper = document.createElement('div');
        wrapper.className = 'media-wrapper';
        
        const counter = document.createElement('div');
        counter.className = 'carousel-counter';
        counter.innerText = `1/${totalImages}`;
        wrapper.appendChild(counter);
        
        const carousel = document.createElement('div');
        carousel.className = 'media-carousel';
        
        thread.images.forEach(url => {
            const isVideo = url.match(/\.(mp4|webm)|video\/upload/i);
            if(isVideo) {
                const vid = document.createElement('video');
                vid.src = url;
                vid.controls = true;
                vid.preload = "metadata";
                carousel.appendChild(vid);
            } else {
                const img = document.createElement('img');
                img.src = url;
                img.loading = "lazy";
                carousel.appendChild(img);
            }
        });
        wrapper.appendChild(carousel);
        
        const dotsContainer = document.createElement('div');
        dotsContainer.className = 'carousel-dots';
        for(let i = 0; i < totalImages; i++) {
            const dot = document.createElement('div');
            dot.className = i === 0 ? 'dot active' : 'dot';
            dotsContainer.appendChild(dot);
        }
        wrapper.appendChild(dotsContainer);
        mediaHTML = wrapper.outerHTML;
    } 
    else if (thread.image) {
        const isVideo = thread.image.match(/\.(mp4|webm)|video\/upload/i);
        if (isVideo) {
            mediaHTML = `<div style="background:#000;border-radius:4px;margin-top:10px;overflow:hidden;"><video src="${thread.image}" controls style="width:100%;display:block;"></video></div>`;
        } else {
            mediaHTML = `<img src="${thread.image}" alt="Media" style="width:100%; margin-top:10px; border-radius:4px;">`;
        }
    }

    let displayRank = thread.rank; 
    if (!displayRank && thread.category && !['Publicaciones', 'Foros', 'Sugerencias'].includes(thread.category)) {
        displayRank = thread.category;
    }
    let rankBadge = displayRank ? `<span class="rank-badge">${displayRank}</span>` : '';

    const authorName = thread.username || 'Usuario';
    let displayAuthorName = authorName;
    if (allUsersMap[authorName] && allUsersMap[authorName].customHandle) {
        displayAuthorName = allUsersMap[authorName].customHandle;
    }

    const isVerifiedAuto = verifiedUsersList.includes(authorName.toLowerCase());
    const verifyBadge = (isVerifiedAuto || thread.verificado) 
        ? '<i class="fas fa-check-circle" style="color:#00a2ff; margin-left:5px;"></i>' : '';
    const descriptionWithLinks = makeLinksClickable(thread.description);

    const rawLikeCount = thread.likeCount || 0;
    const rawCommentCount = thread.comments ? Object.keys(thread.comments).length : 0;
    const rawViewCount = thread.views || 0;
    const likeCountDisplay = formatCount(rawLikeCount);
    const commentCountDisplay = formatCount(rawCommentCount);
    const viewCountDisplay = formatCount(rawViewCount);

    const userId = getUserId();
    const isLiked = thread.likes && thread.likes[userId] ? 'liked' : '';

    const myUser = localStorage.getItem('savedRobloxUser');
    let avatarMenuHTML = '';
    
    if (myUser && myUser !== authorName) {
        const isFollowing = myFollowingList.includes(authorName);
        if (!isFollowing) {
            avatarMenuHTML = `
                <div class="plus-badge" onclick="toggleMiniMenu(event, 'menu-${key}')"><i class="fas fa-plus"></i></div>
                <div id="menu-${key}" class="mini-menu-dropdown">
                    <div class="mini-menu-item" onclick="openFullProfile('${authorName}')">Ir al perfil <i class="far fa-user"></i></div>
                    <div class="mini-menu-item" onclick="toggleFollow('${authorName}')">Seguir <i class="fas fa-plus-circle"></i></div>
                </div>`;
        }
    }

    let currentAvatar = DEFAULT_AVATAR;
    if (allUsersMap[authorName] && allUsersMap[authorName].avatar) {
        currentAvatar = allUsersMap[authorName].avatar;
    } else if (thread.authorAvatar) {
        currentAvatar = thread.authorAvatar;
    }

    div.innerHTML = `
        <div class="thread-date">${thread.displayDate}</div>
        <div class="post-header">
            <div class="avatar-wrapper">
                <img src="${currentAvatar}" class="user-avatar-small" alt="Avatar" onclick="openFullProfile('${authorName}')">
                ${avatarMenuHTML}
            </div>
            <div class="post-header-info">
                <div style="font-size: 0.9em; color: #aaa;">
                    ${rankBadge} <strong class="clickable-name" style="color: #fff;" onclick="openFullProfile('${authorName}')">${displayAuthorName}</strong> ${verifyBadge}
                </div>
            </div>
        </div>
        <h2>${thread.title}</h2>
        <p>${descriptionWithLinks}</p>
        <div class="media-container-hook-${key}">${mediaHTML}</div>
        <div class="thread-actions">
            <button class="like-button ${isLiked}" onclick="toggleLike('${key}', ${rawLikeCount}, this)"><i class="fas fa-heart"></i> ${likeCountDisplay}</button>
            <button class="comment-button" onclick="openComments('${key}')"><i class="far fa-comment"></i> ${commentCountDisplay}</button>
            <span class="view-button" style="color: #aaa; font-weight: bold; font-size: 1em; cursor: default; display: inline-flex; align-items: center; gap: 5px;"><i class="far fa-eye"></i> ${viewCountDisplay}</span>
        </div>`;
    container.appendChild(div);

    if (thread.images && thread.images.length > 0) {
        const injectedWrapper = div.querySelector(`.media-container-hook-${key} .media-wrapper`);
        if(injectedWrapper) {
            const carousel = injectedWrapper.querySelector('.media-carousel');
            const counter = injectedWrapper.querySelector('.carousel-counter');
            const dots = injectedWrapper.querySelectorAll('.dot');
            const total = thread.images.length;
            if(carousel && counter) {
                carousel.addEventListener('scroll', () => {
                    const index = Math.round(carousel.scrollLeft / carousel.offsetWidth);
                    counter.innerText = `${index + 1}/${total}`;
                    dots.forEach((d, i) => {
                        if(i === index) d.classList.add('active'); else d.classList.remove('active');
                    });
                });
            }
        }
    }
}
// --- PARTE 3: SISTEMA DE USUARIOS ---

window.goToHome = function() {
    searchTerm = ''; 
    const searchInput = document.getElementById('searchInput');
    if(searchInput) searchInput.value = '';
    currentSection = 'Publicaciones';
    document.querySelectorAll('.tab-btn').forEach(btn => {
        if(btn.textContent.trim() === 'Publicaciones') btn.classList.add('active');
        else btn.classList.remove('active');
    });
    renderCurrentView();
    window.scrollTo(0, 0);
};

// --- A. LOGIN CON ALERTAS MODERNAS ---
window.loginSystem = async function() {
    const user = document.getElementById('loginUser').value.trim();
    const pin = document.getElementById('loginPin').value.trim();
    
    if(!user || !pin) { 
        showToast("Llena usuario y PIN", "error"); 
        return; 
    }

    try {
        const snapshot = await get(child(usersRef, user));
        if (snapshot.exists()) {
            const data = snapshot.val();
            if (data.pin == pin) { 
                localStorage.setItem('savedRobloxUser', user);
                localStorage.setItem('userId', 'restored_' + user);
                
                showToast(`¡Bienvenido, ${user}!`, "success"); // Alerta bonita
                closeModal('loginModal');
                
                // Recargar para actualizar menú y perfil
                setTimeout(() => window.location.reload(), 1000); 
            } else {
                showToast("PIN incorrecto", "error");
            }
        } else {
            showToast("Usuario no encontrado", "error");
        }
    } catch (error) {
        console.error(error);
        showToast("Error de conexión", "error");
    }
};

// --- B. REGISTRO ---
window.registerSystem = async function() {
    const user = document.getElementById('regUser').value.trim();
    const pin = document.getElementById('regPin').value.trim();

    if(!user) { showToast("Escribe un usuario", "error"); return; }
    if(!pin || pin.length < 4) { showToast("PIN de 4 dígitos requerido", "error"); return; }

    try {
        const snapshot = await get(child(usersRef, user));
        if (snapshot.exists()) {
            showToast(`El usuario "${user}" ya existe`, "error");
        } else {
            await set(child(usersRef, user), { 
                registeredAt: Date.now(),
                pin: pin,
                displayName: user,
                customHandle: user,
                followersCount: 0,
                followingCount: 0
            });
            
            localStorage.setItem('savedRobloxUser', user);
            localStorage.setItem('userId', 'new_' + user);
            
            showToast("¡Cuenta creada con éxito!", "success");
            closeModal('registerModal');
            setTimeout(() => window.location.reload(), 1000);
        }
    } catch (error) {
        console.error(error);
        showToast("Error al registrar", "error");
    }
};

// --- C. EDICIÓN DE PERFIL (CON LÍMITE DE DÍAS) ---
window.openEditProfileModal = function() {
    const myUser = localStorage.getItem('savedRobloxUser');
    if (!myUser) return;

    const userData = allUsersMap[myUser] || {};
    document.getElementById('editAvatarPreview').src = userData.avatar || DEFAULT_AVATAR;
    document.getElementById('editNameInput').value = userData.displayName || myUser;
    document.getElementById('editHandleInput').value = userData.customHandle || myUser;
    document.getElementById('editBioInput').value = userData.bio || "";
    document.getElementById('editStatusInput').value = userData.status || "";
    openModal('editProfileModal');
};

window.saveProfileChanges = async function() {
    const myUser = localStorage.getItem('savedRobloxUser');
    if (!myUser) return;

    const btn = document.getElementById('saveProfileBtn');
    const originalText = btn.textContent;
    btn.textContent = "Guardando...";
    
    const newName = document.getElementById('editNameInput').value.trim();
    const newHandle = document.getElementById('editHandleInput').value.trim();
    const newBio = document.getElementById('editBioInput').value.trim();
    const newStatus = document.getElementById('editStatusInput').value.trim();

    const userData = allUsersMap[myUser] || {};
    const updates = {};
    const now = Date.now();

    // 1. Validar Nombre (7 días)
    const lastChangeName = userData.lastChangedName || 0;
    const daysSinceName = (now - lastChangeName) / (1000 * 60 * 60 * 24);
    
    if (newName !== (userData.displayName || myUser)) {
        if (daysSinceName < 7) {
            showToast(`Espera ${Math.ceil(7 - daysSinceName)} días para cambiar nombre`, "error");
            btn.textContent = originalText;
            return;
        }
        updates[`users/${myUser}/displayName`] = newName;
        updates[`users/${myUser}/lastChangedName`] = now;
    }

    // 2. Validar Usuario (15 días)
    const lastChangeHandle = userData.lastChangedHandle || 0;
    const daysSinceHandle = (now - lastChangeHandle) / (1000 * 60 * 60 * 24);

    if (newHandle !== (userData.customHandle || myUser)) {
        if (daysSinceHandle < 15) {
            showToast(`Espera ${Math.ceil(15 - daysSinceHandle)} días para cambiar usuario`, "error");
            btn.textContent = originalText;
            return;
        }
        updates[`users/${myUser}/customHandle`] = newHandle;
        updates[`users/${myUser}/lastChangedHandle`] = now;
    }

    // 3. Bio y Estado
    updates[`users/${myUser}/bio`] = newBio;
    updates[`users/${myUser}/status`] = newStatus;

    try {
        await update(ref(db), updates);
        showToast("Perfil actualizado", "success");
        closeModal('editProfileModal');
        renderCurrentView();
    } catch (e) {
        console.error(e);
        showToast("Error al guardar", "error");
    } finally {
        btn.textContent = originalText;
    }
};

// --- D. CERRAR SESIÓN (CORREGIDO) ---
window.logoutSystem = function() {
    // Usa el modal de confirmación personalizado en lugar de confirm()
    showConfirm("¿Seguro que quieres cerrar sesión?", () => {
        localStorage.removeItem('savedRobloxUser');
        localStorage.removeItem('userId');
        
        showToast("Sesión finalizada", "info");
        setTimeout(() => window.location.reload(), 1000);
    });
};

// --- EXTRAS ---
window.createMyPin = function() {
    const myUser = localStorage.getItem('savedRobloxUser');
    if (!myUser) return;
    const newPin = prompt("🔐 Crea un PIN de 4 dígitos:");
    if (newPin !== null) {
        if (newPin.length >= 4) {
            update(ref(db, `users/${myUser}`), { pin: newPin })
            .then(() => showToast("PIN Guardado", "success"));
        } else { showToast("Mínimo 4 dígitos", "error"); }
    }
};

window.openFullProfile = function(username) {
    if(!username || username === 'null') {
        username = localStorage.getItem('savedRobloxUser');
    }
    if(!username) {
        showToast("Inicia sesión para ver perfiles", "error");
        document.getElementById("menuDropdown").classList.remove('show');
        return;
    }
    viewingUserProfile = username; 
    currentSection = 'Perfil';     
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    renderCurrentView();
    window.scrollTo(0, 0);
    document.getElementById("menuDropdown").classList.remove('show');
};
window.openUserProfile = window.openFullProfile;
// --- PARTE 4: INTERACCIONES Y EVENTOS ---

const searchIn = document.getElementById('searchInput');
if(searchIn) {
    searchIn.oninput = (e) => {
        searchTerm = e.target.value.trim();
        renderCurrentView(); 
    };
}

window.toggleMiniMenu = function(event, menuId) {
    event.stopPropagation(); 
    document.querySelectorAll('.mini-menu-dropdown').forEach(m => {
        if(m.id !== menuId) m.classList.remove('show');
    });
    const menu = document.getElementById(menuId);
    if(menu) menu.classList.toggle('show');
};
document.addEventListener('click', function() {
    document.querySelectorAll('.mini-menu-dropdown').forEach(m => m.classList.remove('show'));
});

window.toggleFollow = function(targetUser) {
    const myUser = localStorage.getItem('savedRobloxUser');
    if(!myUser) { showToast("Regístrate primero", "error"); return; }
    if(myUser === targetUser) { showToast("No puedes seguirte a ti mismo", "error"); return; }
    
    document.querySelectorAll('.mini-menu-dropdown').forEach(m => m.classList.remove('show'));

    const isFollowing = myFollowingList.includes(targetUser);
    const updates = {};
    if (isFollowing) {
        updates[`users/${myUser}/following/${targetUser}`] = null; 
        updates[`users/${targetUser}/followers/${myUser}`] = null;
        updates[`users/${myUser}/followingCount`] = increment(-1);
        updates[`users/${targetUser}/followersCount`] = increment(-1);
    } else {
        updates[`users/${myUser}/following/${targetUser}`] = true; 
        updates[`users/${targetUser}/followers/${myUser}`] = true;
        updates[`users/${myUser}/followingCount`] = increment(1);
        updates[`users/${targetUser}/followersCount`] = increment(1);
    }
    update(ref(db), updates).then(() => {
        if(isFollowing) showToast(`Dejaste de seguir a ${targetUser}`);
        else showToast(`Ahora sigues a ${targetUser}`, "success");
        if(currentSection === 'Perfil' && viewingUserProfile === targetUser) { setTimeout(renderCurrentView, 100); }
    }).catch(err => showToast("Error DB", "error"));
};

const avatarInput = document.getElementById('avatarUpload');
if(avatarInput) {
    avatarInput.onchange = async function(e) {
        if(this.files && this.files.length > 0) {
            const file = this.files[0];
            const myUser = localStorage.getItem('savedRobloxUser');
            if(!myUser) return;
            
            showToast("Subiendo foto...", "info");

            const cloudName = 'dmrlmfoip';
            const uploadPreset = 'comunidad_arc';
            const formData = new FormData();
            formData.append('file', file);
            formData.append('upload_preset', uploadPreset);
            try {
                const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, { method: 'POST', body: formData });
                const data = await res.json();
                await update(ref(db, `users/${myUser}`), { avatar: data.secure_url });
                const preview = document.getElementById('editAvatarPreview');
                if(preview) preview.src = data.secure_url;
                
                showToast("Foto actualizada", "success");
                renderCurrentView();
            } catch(err) { console.error(err); showToast("Error al subir imagen", "error"); }
        }
    };
}

window.toggleLike = function(key, currentCount, btn) {
    const myUser = localStorage.getItem('savedRobloxUser');
    if (!myUser) { showToast("Inicia sesión para dar Like", "error"); return; }

    const userId = getUserId();
    const liked = btn.classList.contains('liked');
    const newCount = liked ? currentCount - 1 : currentCount + 1;
    const updates = {};
    updates[`threads/${key}/likeCount`] = newCount;
    updates[`threads/${key}/likes/${userId}`] = liked ? null : true;
    update(ref(db), updates);
};

function renderPagination(totalItems) {
    if(currentSection === 'Busqueda' || currentSection === 'Perfil') return; 
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

async function checkUsernameAvailability(username) {
    const normalizedUser = username.toLowerCase().trim();
    const userRef = child(usersRef, normalizedUser);
    const snapshot = await get(userRef);
    if (snapshot.exists()) {
        if (localStorage.getItem('savedRobloxUser') !== username) return false;
    } else { await set(userRef, { registeredAt: Date.now() }); }
    return true; 
}

window.openComments = function(key) {
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
    } else if(usernameInput) {
        usernameInput.value = "";
        usernameInput.placeholder = "Inicia sesión para comentar";
        usernameInput.disabled = true; 
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
                const authorName = c.username || 'Anónimo';
                const isVerified = verifiedUsersList.includes(authorName.toLowerCase());
                const badge = isVerified ? '<i class="fas fa-check-circle" style="color:#00a2ff; margin-left:5px;"></i>' : '';
                
                let avatar = DEFAULT_AVATAR;
                if(allUsersMap[authorName] && allUsersMap[authorName].avatar) {
                    avatar = allUsersMap[authorName].avatar;
                } else if (c.authorAvatar) { avatar = c.authorAvatar; }
                
                item.innerHTML = `
                    <div style="display:flex; align-items:flex-start; margin-bottom: 5px;">
                        <img src="${avatar}" style="width:25px; height:25px; border-radius:50%; margin-right:8px; object-fit:cover;">
                        <div><span style="color:#00a2ff;font-weight:bold;">${authorName}</span>${badge}: <span style="color:#ddd;">${commentWithLinks}</span></div>
                    </div>`;
                list.appendChild(item);
            });
        } else { list.innerHTML = '<p style="text-align:center;color:#777;">Sé el primero en comentar.</p>'; }
    });
    
    const cForm = document.getElementById('commentForm');
    if(cForm) {
        cForm.onsubmit = async (e) => {
            e.preventDefault();
            const myUser = localStorage.getItem('savedRobloxUser');
            if(!myUser) { showToast("Inicia sesión para comentar", "error"); return; }

            try {
                const txt = document.getElementById('commentInput').value;
                const usr = myUser;
                await push(commentsRef, { text: txt, username: usr, timestamp: Date.now(), authorAvatar: myAvatarUrl || DEFAULT_AVATAR });
                
                // CONTADOR DE VISTAS SOLO AL COMENTAR
                const threadViewRef = ref(db, `threads/${key}/views`);
                runTransaction(threadViewRef, (currentViews) => { return (currentViews || 0) + 1; });
                
                document.getElementById('commentInput').value = '';
            } catch (error) { showToast("Error al comentar", "error"); }
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    initFirebaseListener();
    changeSection('Publicaciones'); 
    
    // MENÚ DINÁMICO
    const savedUser = localStorage.getItem('savedRobloxUser');
    const menuLogin = document.getElementById('menuLogin');
    const menuLogout = document.getElementById('menuLogout');

    if (savedUser) {
        if(menuLogin) menuLogin.style.display = 'none';
        if(menuLogout) menuLogout.style.display = 'block';
    } else {
        if(menuLogin) menuLogin.style.display = 'block';
        if(menuLogout) menuLogout.style.display = 'none';
    }

    const btnNew = document.getElementById('newThreadButton');
    if(btnNew) {
        btnNew.onclick = (e) => {
            e.preventDefault();
            if(!savedUser) { showToast("Regístrate para publicar", "error"); return; }
            const modal = document.getElementById('newThreadModalContent');
            if(modal) {
                document.getElementById("menuDropdown").classList.remove('show');
                modal.style.display = 'block';
                const userInput = document.getElementById('robloxUser');
                if(userInput) userInput.value = savedUser;
            }
        };
    }
    
    const form = document.getElementById('newThreadForm');
    if(form) {
        form.onsubmit = async (e) => {
            e.preventDefault();
            const myUser = localStorage.getItem('savedRobloxUser');
            if (!myUser) { showToast("Inicia sesión para publicar", "error"); return; }

            const btn = document.getElementById('submitBtn');
            const originalText = btn.textContent;
            btn.textContent = "Procesando...";
            btn.disabled = true;

            try { 
                const rank = document.getElementById('categorySelect').value; 
                const user = myUser; 
                const title = document.getElementById('title').value;       
                const desc = document.getElementById('description').value;
                const section = document.getElementById('sectionInput').value; 
                const fileInput = document.getElementById('imageFile');
                const modal = document.getElementById('newThreadModalContent');

                let mediaUrls = [];
                if(fileInput && fileInput.files && fileInput.files.length > 0) {
                    const cloudName = 'dmrlmfoip';
                    const uploadPreset = 'comunidad_arc';
                    const uploadPromises = Array.from(fileInput.files).map(async (file) => {
                        const formData = new FormData();
                        formData.append('file', file);
                        formData.append('upload_preset', uploadPreset);
                        try {
                            const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, { method: 'POST', body: formData });
                            const data = await res.json();
                            return data.secure_url;
                        } catch(err) { return null; }
                    });
                    const results = await Promise.all(uploadPromises);
                    mediaUrls = results.filter(url => url !== null); 
                }

                const newPost = {
                    title: title,      
                    username: user,    
                    rank: rank,        
                    description: desc,
                    section: section, 
                    images: mediaUrls, 
                    timestamp: Date.now(),
                    displayDate: new Date().toLocaleDateString('es-ES'),
                    views: 0,
                    authorAvatar: myAvatarUrl || DEFAULT_AVATAR
                };

                await push(threadsRef, newPost);
                form.reset();
                document.getElementById('fileName').textContent = '';
                if(modal) modal.style.display = 'none';
                btn.textContent = originalText;
                btn.disabled = false;
                document.getElementById('sectionInput').value = currentSection;
                showToast("Publicación creada", "success");

            } catch (error) { showToast("Error: " + error.message, "error"); btn.textContent = originalText; btn.disabled = false; }
        };
    }
});