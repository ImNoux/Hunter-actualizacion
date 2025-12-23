import { initializeApp } from "https://esm.sh/firebase/app";
import { getDatabase, ref, push, onValue, query, orderByChild, update, off, runTransaction, get, child, set, increment, onChildAdded } from "https://esm.sh/firebase/database";

// --- IMAGEN POR DEFECTO ---
const DEFAULT_AVATAR = "https://upload.wikimedia.org/wikipedia/commons/a/ac/Default_pfp.jpg";

// --- CONFIGURACIÓN FIREBASE ---
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

function showError(msg) {
    const alertModal = document.getElementById('customAlertModal');
    const alertText = document.getElementById('customAlertText');
    if(alertModal && alertText) {
        alertText.innerHTML = msg; 
        alertModal.style.display = 'block';
    } else { alert(msg); }
}

function makeLinksClickable(text) {
    if (!text) return '';
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.replace(urlRegex, function(url) {
        return `<a href="${url}" target="_blank" style="color: #00a2ff; text-decoration: underline; word-break: break-all;">${url}</a>`;
    });
}

function formatCount(num) {
    if (!num) return 0;
    if (num >= 1000000) {
        let millions = Math.floor((num / 1000000) * 10) / 10;
        return millions + ' Mill.';
    }
    if (num >= 1000) {
        let thousands = Math.floor(num / 1000); 
        return thousands + ' mil';
    }
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
        if (data) { allUsersMap = data; } else { allUsersMap = {}; }
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
        if (data) { verifiedUsersList = Object.keys(data).map(name => name.toLowerCase()); } 
        else { verifiedUsersList = []; }
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
// --- PARTE 2: RENDERIZADO ---

function renderCurrentView() {
    const threadContainer = document.querySelector('.thread-container');
    const noThreadsMessage = document.getElementById('noThreadsMessage');
    const paginationContainer = document.getElementById('pagination-container');

    if(!threadContainer) return;
    threadContainer.innerHTML = '';
    paginationContainer.innerHTML = '';
    if(noThreadsMessage) noThreadsMessage.style.display = 'none';

    if (currentSection === 'Perfil') {
        renderFullProfile(threadContainer);
        return;
    }

    if (currentSection === 'Busqueda') {
        renderUserSearch(threadContainer);
        return;
    }

    let filtered = allThreadsData.filter(([key, thread]) => {
        let postSection = thread.section; 
        let postCategory = thread.category;
        if (!postSection) {
            if (['Publicaciones', 'Foros', 'Sugerencias'].includes(postCategory)) {
                postSection = postCategory;
            } else { postSection = 'Publicaciones'; }
        }
        return (postSection === currentSection);
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
            noThreadsMessage.textContent = `No hay posts en ${currentSection}.`;
            threadContainer.appendChild(noThreadsMessage);
        }
    }
}

function renderUserSearch(container) {
    if (!searchTerm) {
        container.innerHTML = '<p style="text-align:center; color:#777;">Escribe el nombre de un usuario...</p>';
        return;
    }
    const term = searchTerm.toLowerCase();
    const foundUsers = Object.keys(allUsersMap).filter(u => u.toLowerCase().includes(term));

    if (foundUsers.length === 0) {
        container.innerHTML = `<p style="text-align:center;">No encontramos a "${searchTerm}"</p>`;
        return;
    }

    foundUsers.forEach(username => {
        const uData = allUsersMap[username];
        const avatar = uData.avatar || DEFAULT_AVATAR;
        const followers = formatCount(uData.followersCount || 0);

        const div = document.createElement('div');
        div.className = 'user-search-result';
        div.onclick = () => openFullProfile(username);

        div.innerHTML = `
            <img src="${avatar}" class="user-search-avatar">
            <div class="user-search-info">
                <h4>${username}</h4>
                <p>${followers} Seguidores</p>
            </div>
        `;
        container.appendChild(div);
    });
}

// --- RENDERIZAR PERFIL COMPLETO (FINAL CON LÍNEAS DIVISORIAS) ---
function renderFullProfile(container) {
    const targetUser = viewingUserProfile;
    const userData = allUsersMap[targetUser] || {};
    
    const avatar = userData.avatar || DEFAULT_AVATAR;
    const displayName = userData.displayName || targetUser; 
    const status = userData.status || ""; 
    const bio = userData.bio || "";
    
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
    let nameAction = ''; 

    if (myUser === targetUser) {
        if (status) {
            bubbleHTML = `<div class="status-bubble" onclick="editMyStatus()">${status}</div>`;
        } else {
            bubbleHTML = `<div class="status-bubble" onclick="editMyStatus()" style="opacity:0.5;">+ Nota</div>`;
        }
        plusBtnAction = `onclick="document.getElementById('avatarUpload').click()"`;
        nameAction = `onclick="editMyName()"`;
    } else {
        if (status) bubbleHTML = `<div class="status-bubble">${status}</div>`;
        const isFollowing = myFollowingList.includes(targetUser);
        if(isFollowing) {
             plusBtnAction = `onclick="toggleFollow('${targetUser}')" style="background:#00a2ff; color:#fff; border:none;"`; 
        } else {
             plusBtnAction = `onclick="toggleFollow('${targetUser}')"`;
        }
        nameAction = `style="cursor:default;"`;
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
                <h2 class="display-name" ${nameAction}>${displayName}</h2>
                <div class="username-handle">
                    <span>@${targetUser}</span>
                    ${verifyBadge}
                </div>
            </div>
        </div>

        <div class="profile-stats-bar">
            <div class="p-stat"><span>${following}</span><label>Siguiendo</label></div>
            <div class="p-stat"><span>${followers}</span><label>Seguidores</label></div>
            <div class="p-stat"><span>${formatCount(totalLikes)}</span><label>Me gusta</label></div>
        </div>

        <div class="profile-bio-section" onclick="${myUser===targetUser ? 'editMyBio()' : ''}">
            ${bio ? makeLinksClickable(bio) : (myUser===targetUser ? '<span style="color:#777; font-style:italic;">Toca para añadir biografía...</span>' : '')}
        </div>
        
        ${myUser !== targetUser ? `
            <button onclick="toggleFollow('${targetUser}')" style="width:100%; margin-top:15px; padding:10px; background:#333; color:white; border:1px solid #555; border-radius:6px; font-weight:bold; cursor:pointer;">
                ${myFollowingList.includes(targetUser) ? 'Siguiendo' : 'Seguir'}
            </button>
        ` : ''}
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

    const rawLikeCount = thread.likeCount || 0;
    const rawCommentCount = thread.comments ? Object.keys(thread.comments).length : 0;
    const rawViewCount = thread.views || 0;
    const likeCountDisplay = formatCount(rawLikeCount);
    const commentCountDisplay = formatCount(rawCommentCount);
    const viewCountDisplay = formatCount(rawViewCount);

    const userId = getUserId();
    const isLiked = thread.likes && thread.likes[userId] ? 'liked' : '';
    const authorName = thread.username || 'Usuario';
    const isVerifiedAuto = verifiedUsersList.includes(authorName.toLowerCase());
    const verifyBadge = (isVerifiedAuto || thread.verificado) 
        ? '<i class="fas fa-check-circle" style="color:#00a2ff; margin-left:5px;"></i>' 
        : '';
    const descriptionWithLinks = makeLinksClickable(thread.description);

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
                    ${rankBadge} <strong class="clickable-name" style="color: #fff;" onclick="openFullProfile('${authorName}')">${authorName}</strong> ${verifyBadge}
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
// --- PARTE 3: LÓGICA Y EVENTOS ---

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

window.openFullProfile = function(username) {
    if(!username || username === 'null') {
        username = localStorage.getItem('savedRobloxUser');
    }

    if(!username) {
        showError("⚠️ <strong>No estás identificado.</strong><br><br>En este navegador no tienes un perfil guardado.<br>Por favor, <strong>crea una publicación o comenta</strong> para registrarte aquí.");
        const menu = document.getElementById("menuDropdown");
        if(menu) menu.classList.remove('show');
        return;
    }
    
    viewingUserProfile = username; 
    currentSection = 'Perfil';     
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    
    renderCurrentView();
    window.scrollTo(0, 0);
    
    const menu = document.getElementById("menuDropdown");
    if(menu) menu.classList.remove('show');
};

window.openUserProfile = window.openFullProfile;

// --- EDICIÓN ---
window.editMyName = function() {
    const myUser = localStorage.getItem('savedRobloxUser');
    if (!myUser) return;
    let currentName = (allUsersMap[myUser] && allUsersMap[myUser].displayName) ? allUsersMap[myUser].displayName : myUser;
    
    const newName = prompt("Elige tu nombre para mostrar:", currentName);
    if (newName !== null && newName.trim() !== "") {
        update(ref(db, `users/${myUser}`), { displayName: newName.substring(0, 20) });
    }
};

window.editMyStatus = function() {
    const myUser = localStorage.getItem('savedRobloxUser');
    if (!myUser) return;
    let currentStatus = (allUsersMap[myUser] && allUsersMap[myUser].status) ? allUsersMap[myUser].status : "";

    const newStatus = prompt("Escribe una nota corta (Estado):", currentStatus);
    if (newStatus !== null) {
        update(ref(db, `users/${myUser}`), { status: newStatus.substring(0, 30) });
    }
};

window.editMyBio = function() {
    const myUser = localStorage.getItem('savedRobloxUser');
    if (!myUser) return;
    let currentBio = allUsersMap[myUser]?.bio || "";
    
    const newBio = prompt("Escribe tu biografía:", currentBio);
    if (newBio !== null) {
        update(ref(db, `users/${myUser}`), { bio: newBio });
    }
};

const searchIn = document.getElementById('searchInput');
if(searchIn) {
    searchIn.oninput = (e) => {
        searchTerm = e.target.value.trim();
        if(searchTerm.length > 0) {
            currentSection = 'Busqueda'; 
        } else {
            currentSection = 'Publicaciones'; 
        }
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
    if(!myUser) { showError("Regístrate primero."); return; }
    if(myUser === targetUser) { showError("No puedes seguirte a ti mismo."); return; }
    
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
        if(currentSection === 'Perfil' && viewingUserProfile === targetUser) {
            setTimeout(renderCurrentView, 100);
        }
    }).catch(err => showError("Error DB: " + err.message));
};

const avatarInput = document.getElementById('avatarUpload');
if(avatarInput) {
    avatarInput.onchange = async function(e) {
        if(this.files && this.files.length > 0) {
            const file = this.files[0];
            const myUser = localStorage.getItem('savedRobloxUser');
            if(!myUser) return;
            
            const cloudName = 'dmrlmfoip';
            const uploadPreset = 'comunidad_arc';
            const formData = new FormData();
            formData.append('file', file);
            formData.append('upload_preset', uploadPreset);

            try {
                const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
                    method: 'POST', body: formData
                });
                const data = await res.json();
                const newAvatarUrl = data.secure_url;

                await update(ref(db, `users/${myUser}`), { avatar: newAvatarUrl });
                alert("✅ Foto actualizada.");

            } catch(err) {
                console.error(err);
                alert("Error al subir.");
                renderCurrentView(); 
            }
        }
    };
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
    const threadViewRef = ref(db, `threads/${key}/views`);
    runTransaction(threadViewRef, (currentViews) => { return (currentViews || 0) + 1; });

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
            try {
                const txt = document.getElementById('commentInput').value;
                const usr = document.getElementById('usernameInput').value || 'Anónimo';
                if (usr !== 'Anónimo') {
                    const isAvailable = await checkUsernameAvailability(usr);
                    if (!isAvailable) { showError(`Usuario ocupado.`); return; }
                }
                if(!localStorage.getItem('savedRobloxUser') && usr !== 'Anónimo') {
                    localStorage.setItem('savedRobloxUser', usr);
                    const uInput = document.getElementById('usernameInput');
                    if(uInput) { uInput.disabled=true; uInput.style.backgroundColor='#252525'; }
                }
                await push(commentsRef, { text: txt, username: usr, timestamp: Date.now(), authorAvatar: myAvatarUrl || DEFAULT_AVATAR });
                document.getElementById('commentInput').value = '';
            } catch (error) { showError("Error al comentar."); }
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    initFirebaseListener();
    changeSection('Publicaciones'); 
    
    const robloxInput = document.getElementById('robloxUser');
    const savedRobloxUser = localStorage.getItem('savedRobloxUser');
    if(savedRobloxUser && robloxInput) {
        robloxInput.value = savedRobloxUser;
        robloxInput.disabled = true;
        robloxInput.style.backgroundColor = '#252525';
        robloxInput.style.cursor = 'not-allowed';
    }

    const btnNew = document.getElementById('newThreadButton');
    if(btnNew) {
        btnNew.onclick = (e) => {
            e.preventDefault();
            const modal = document.getElementById('newThreadModalContent');
            if(modal) {
                document.getElementById("menuDropdown").classList.remove('show');
                modal.style.display = 'block';
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

            try { 
                const rank = document.getElementById('categorySelect').value; 
                const user = document.getElementById('robloxUser').value.trim(); 
                const title = document.getElementById('title').value;       
                const desc = document.getElementById('description').value;
                const section = document.getElementById('sectionInput').value; 
                const fileInput = document.getElementById('imageFile');
                const modal = document.getElementById('newThreadModalContent');

                if (!user) { throw new Error("Debes escribir un usuario"); }
                const isAvailable = await checkUsernameAvailability(user);
                if (!isAvailable) {
                    showError(`El usuario <strong>"${user}"</strong> ya está ocupado.`);
                    btn.disabled = false; btn.textContent = originalText; return;
                }
                if(!localStorage.getItem('savedRobloxUser')) {
                    localStorage.setItem('savedRobloxUser', user);
                    const rInput = document.getElementById('robloxUser');
                    if(rInput) { rInput.disabled = true; rInput.style.backgroundColor = '#252525'; }
                }

                btn.textContent = "Subiendo...";
                let mediaUrls = [];
                if(fileInput && fileInput.files && fileInput.files.length > 0) {
                    const cloudName = 'dmrlmfoip';
                    const uploadPreset = 'comunidad_arc';
                    const uploadPromises = Array.from(fileInput.files).map(async (file) => {
                        const formData = new FormData();
                        formData.append('file', file);
                        formData.append('upload_preset', uploadPreset);
                        try {
                            const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
                                method: 'POST', body: formData
                            });
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
                if(localStorage.getItem('savedRobloxUser')) {
                    document.getElementById('robloxUser').value = localStorage.getItem('savedRobloxUser');
                }
                document.getElementById('fileName').textContent = '';
                if(modal) modal.style.display = 'none';
                btn.textContent = originalText;
                btn.disabled = false;
                document.getElementById('sectionInput').value = currentSection;

            } catch (error) {
                showError("Error: " + error.message);
                btn.textContent = originalText;
                btn.disabled = false;
            }
        };
    }
});