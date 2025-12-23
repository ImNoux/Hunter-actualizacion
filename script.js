import { initializeApp } from "https://esm.sh/firebase/app";
// OJO: Aquí al final está 'increment', indispensable para los contadores
import { getDatabase, ref, push, onValue, query, orderByChild, update, off, runTransaction, get, child, set, increment, onChildAdded } from "https://esm.sh/firebase/database";

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
let allThreadsData = []; 
let verifiedUsersList = []; 
let myFollowingList = []; 

// --- FUNCIONES DE AYUDA ---
function showError(msg) {
    const alertModal = document.getElementById('customAlertModal');
    const alertText = document.getElementById('customAlertText');
    if(alertModal && alertText) {
        alertText.innerHTML = msg; 
        alertModal.style.display = 'block';
    } else {
        alert(msg); 
    }
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
        return (num / 1000000).toFixed(1).replace(/\.0$/, '') + ' Mill.';
    }
    if (num >= 1000) {
        return (num / 1000).toFixed(1).replace(/\.0$/, '') + ' mil';
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

function initFirebaseListener() {
    // 1. Cargar Posts
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

    // 2. Cargar Verificados
    onValue(verifiedRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            verifiedUsersList = Object.keys(data).map(name => name.toLowerCase());
        } else {
            verifiedUsersList = [];
        }
        renderCurrentView(); 
    });

    // 3. Cargar Mis Seguidos (Listener en vivo)
    const myUser = localStorage.getItem('savedRobloxUser');
    if (myUser) {
        const myFollowingRef = ref(db, `users/${myUser}/following`);
        onValue(myFollowingRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                myFollowingList = Object.keys(data);
            } else {
                myFollowingList = [];
            }
            // Importante: Volver a renderizar para actualizar los botones grises/azules
            renderCurrentView();
        });
    }
}
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

    // Carrusel Multimedia
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

    // --- LÓGICA DEL BOTÓN SEGUIR (PEQUEÑO) ---
    let followBtnHTML = '';
    const myUser = localStorage.getItem('savedRobloxUser');
    
    // Solo mostrar si estoy logueado y NO es mi propio post
    if (myUser && myUser !== authorName) {
        const isFollowing = myFollowingList.includes(authorName);
        const btnText = isFollowing ? 'SIGUIENDO' : 'SEGUIR';
        const btnClass = isFollowing ? 'follow-btn following' : 'follow-btn';
        
        // onclick llama directamente a toggleFollow
        followBtnHTML = `<button class="${btnClass}" onclick="toggleFollow('${authorName}')">${btnText}</button>`;
    }

    div.innerHTML = `
        <div class="thread-date">${thread.displayDate}</div>
        <div style="margin-bottom: 5px; font-size: 0.9em; color: #aaa;">
            ${rankBadge} 
            <strong class="clickable-name" style="color: #fff;" onclick="openUserProfile('${authorName}')">${authorName}</strong> 
            ${verifyBadge}
            ${followBtnHTML}
        </div>
        <h2>${thread.title}</h2>
        <p>${descriptionWithLinks}</p>
        
        <div class="media-container-hook-${key}">
            ${mediaHTML}
        </div>
        
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

    // Eventos de Scroll del Carrusel
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
                        if(i === index) d.classList.add('active');
                        else d.classList.remove('active');
                    });
                });
            }
        }
    }
}
// --- PARTE 3: ACCIONES Y LÓGICA ---

// 1. ABRIR PERFIL (CUALQUIERA)
window.openUserProfile = function(targetUser) {
    if(!targetUser) return;

    // Reset Visual (Limpiar datos anteriores)
    const elements = {
        name: document.getElementById('profileModalName'),
        rank: document.getElementById('profileModalRank'),
        followers: document.getElementById('profileFollowers'),
        following: document.getElementById('profileFollowing'),
        posts: document.getElementById('profilePosts'),
        likes: document.getElementById('profileLikes'),
        btnContainer: document.getElementById('profileFollowBtnContainer')
    };

    if(elements.name) elements.name.textContent = targetUser;
    if(elements.rank) elements.rank.textContent = "Cargando...";
    if(elements.followers) elements.followers.textContent = "-";
    if(elements.following) elements.following.textContent = "-";
    if(elements.posts) elements.posts.textContent = "-";
    if(elements.likes) elements.likes.textContent = "-";
    if(elements.btnContainer) elements.btnContainer.innerHTML = "";

    // Abrir Modal
    const modal = document.getElementById('userProfileModal');
    if(modal) {
        document.getElementById("menuDropdown").classList.remove('show');
        modal.style.display = 'block';
    }

    // Datos de Firebase (Seguidores/Seguidos)
    const userRef = ref(db, `users/${targetUser}`);
    onValue(userRef, (snapshot) => {
        const data = snapshot.val() || {};
        if(elements.followers) elements.followers.textContent = formatCount(data.followersCount || 0);
        if(elements.following) elements.following.textContent = formatCount(data.followingCount || 0);

        // Calcular Posts y Likes recorriendo todo
        let posts = 0;
        let likes = 0;
        let rank = "Miembro";

        allThreadsData.forEach(([key, thread]) => {
            if(thread.username === targetUser) {
                posts++;
                likes += (thread.likeCount || 0);
                if(thread.rank) rank = thread.rank;
            }
        });

        if(elements.posts) elements.posts.textContent = formatCount(posts);
        if(elements.likes) elements.likes.textContent = formatCount(likes);
        if(elements.rank) elements.rank.textContent = rank;

    }, { onlyOnce: true });

    // Renderizar Botón Seguir Grande (Dentro del Perfil)
    const myUser = localStorage.getItem('savedRobloxUser');
    if (myUser && myUser !== targetUser) {
        const isFollowing = myFollowingList.includes(targetUser);
        const btnText = isFollowing ? 'DEJAR DE SEGUIR' : 'SEGUIR';
        const btnColor = isFollowing ? '#555' : '#00a2ff';
        
        const btnHTML = `
            <button onclick="toggleFollowFromProfile('${targetUser}')" 
                style="background: ${btnColor}; color: white; border: none; padding: 10px 25px; border-radius: 6px; font-weight: bold; cursor: pointer; width: 100%; transition: 0.2s;">
                ${btnText}
            </button>
        `;
        if(elements.btnContainer) elements.btnContainer.innerHTML = btnHTML;
    }
};

// Función auxiliar para el botón dentro del perfil
window.toggleFollowFromProfile = function(targetUser) {
    window.toggleFollow(targetUser);
    setTimeout(() => {
        const modal = document.getElementById('userProfileModal');
        if(modal && modal.style.display === 'block') {
             window.openUserProfile(targetUser); // Refrescar modal
        }
    }, 300); 
};

// --- FUNCIÓN PRINCIPAL: SEGUIR / DEJAR DE SEGUIR ---
window.toggleFollow = function(targetUser) {
    console.log("--> Click en Seguir a:", targetUser); 

    const myUser = localStorage.getItem('savedRobloxUser');
    
    // Validación: Usuario logueado
    if(!myUser) {
        showError("Para seguir usuarios, primero debes publicar algo o comentar para registrar tu nombre.");
        return;
    }

    // Validación: No seguirse a sí mismo
    if(myUser === targetUser) {
        showError("No puedes seguirte a ti mismo.");
        return;
    }

    const isFollowing = myFollowingList.includes(targetUser);
    const updates = {};
    
    if (isFollowing) {
        // --- DEJAR DE SEGUIR ---
        updates[`users/${myUser}/following/${targetUser}`] = null; 
        updates[`users/${targetUser}/followers/${myUser}`] = null;
        updates[`users/${myUser}/followingCount`] = increment(-1);
        updates[`users/${targetUser}/followersCount`] = increment(-1);
    } else {
        // --- SEGUIR ---
        updates[`users/${myUser}/following/${targetUser}`] = true; 
        updates[`users/${targetUser}/followers/${myUser}`] = true;
        updates[`users/${myUser}/followingCount`] = increment(1);
        updates[`users/${targetUser}/followersCount`] = increment(1);
    }
    
    update(ref(db), updates)
        .then(() => console.log("Follow actualizado"))
        .catch(err => {
            console.error(err);
            showError("Error al conectar con la base de datos.");
        });
};

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

async function checkUsernameAvailability(username) {
    const normalizedUser = username.toLowerCase().trim();
    const userRef = child(usersRef, normalizedUser);
    const snapshot = await get(userRef);
    if (snapshot.exists()) {
        if (localStorage.getItem('savedRobloxUser') !== username) {
            return false; 
        }
    } else {
        await set(userRef, { registeredAt: Date.now() });
    }
    return true; 
}

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
                const authorName = c.username || 'Anónimo';
                const isVerified = verifiedUsersList.includes(authorName.toLowerCase());
                const badge = isVerified ? '<i class="fas fa-check-circle" style="color:#00a2ff; margin-left:5px;"></i>' : '';
                item.innerHTML = `<span style="color:#00a2ff;font-weight:bold;">${authorName}</span>${badge}: <span style="color:#ddd;">${commentWithLinks}</span>`;
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
            try {
                const txt = document.getElementById('commentInput').value;
                const usr = document.getElementById('usernameInput').value || 'Anónimo';
                if (usr !== 'Anónimo') {
                    const isAvailable = await checkUsernameAvailability(usr);
                    if (!isAvailable) {
                        showError(`El usuario <strong>"${usr}"</strong> ya está ocupado.<br><br>Si eres nuevo, elige otro nombre.`);
                        return;
                    }
                }
                if(!localStorage.getItem('savedRobloxUser') && usr !== 'Anónimo') {
                    localStorage.setItem('savedRobloxUser', usr);
                    const uInput = document.getElementById('usernameInput');
                    if(uInput) { uInput.disabled=true; uInput.style.backgroundColor='#252525'; }
                }
                await push(commentsRef, { text: txt, username: usr, timestamp: Date.now() });
                document.getElementById('commentInput').value = '';
            } catch (error) {
                console.error(error);
                showError("Error al comentar: " + error.message);
            }
        }
    }
};

// --- EVENT LISTENERS ---
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
                    showError(`El usuario <strong>"${user}"</strong> ya está ocupado.<br><br>Por favor, elige otro nombre.`);
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
                        } catch(err) {
                            console.error("Error subiendo una imagen:", err);
                            return null;
                        }
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
                    views: 0 
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
                console.error(error);
                showError("Error: " + error.message + "<br><br>Revisa tu conexión o las Reglas de Firebase.");
                btn.textContent = originalText;
                btn.disabled = false;
            }
        };
    }
    initBouncingRobux();
});

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