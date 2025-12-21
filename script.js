// Import the functions you need from the SDKs you need
import { initializeApp } from "https://esm.sh/firebase/app";
import { getDatabase, ref, push, set, onValue, query, orderByKey, limitToFirst, orderByChild, limitToLast, update, off, runTransaction } from "https://esm.sh/firebase/database";

const firebaseConfig = {
    apiKey: "AIzaSyDM9E8Y_YW-ld8MH8-yKS345hklA0v5P_w",
    authDomain: "hunterteam.firebaseapp.com",
    databaseURL: "https://hunterteam-default-rtdb.firebaseio.com",
    projectId: "hunterteam",
    storageBucket: "hunterteam.firebasestorage.app",
    messagingSenderId: "1001713111500",
    appId: "1:1001713111500:web:8729bf9a47a7806f6c4d69",
    measurementId: "G-W6E0YQ8PEJ"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const threadsRef = ref(db, 'threads'); 

const threadsPerPage = 5; 
let currentPage = 1; 
let totalThreads = 0; 
let searchTerm = ''; 
let activeThreadId = null; 

// --- FUNCIONES DE UTILIDAD ---
function getUserId() {
    let userId = localStorage.getItem('userId');
    if (!userId) {
        userId = 'user_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('userId', userId);
    }
    return userId;
}

window.toggleMenu = function() {
    const dropdown = document.querySelector('.menu-dropdown');
    if (dropdown) dropdown.classList.toggle('show');
};

// --- LOGICA DE COMENTARIOS Y VISTAS ---
window.openComments = function(threadId) {
    activeThreadId = threadId;
    const modal = document.getElementById('commentsModal');
    const list = document.getElementById('commentsList');
    const usernameInput = document.getElementById('usernameInput');

    // Cargar nombre guardado
    const savedName = localStorage.getItem('chatUsername');
    if (savedName && usernameInput) {
        usernameInput.value = savedName;
    }

    list.innerHTML = '<p style="text-align:center; padding: 20px;">Cargando...</p>';
    modal.style.display = "block";

    const threadViewRef = ref(db, `threads/${threadId}/views`);
    runTransaction(threadViewRef, (currentViews) => {
        return (currentViews || 0) + 1;
    });

    const commentsRef = ref(db, `threads/${threadId}/comments`);
    off(commentsRef);

    onValue(commentsRef, (snapshot) => {
        list.innerHTML = '';
        const data = snapshot.val();
        if (data) {
            Object.values(data).forEach(comment => {
                const item = document.createElement('div');
                item.classList.add('comment-item');
                const date = new Date(comment.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                const authorName = comment.username || 'Anónimo';
                item.innerHTML = `
                    <span class="comment-author">${authorName}:</span> 
                    <span class="comment-text">${comment.text}</span> 
                    <span class="comment-date">${date}</span>
                `;
                list.appendChild(item);
            });
            list.scrollTop = list.scrollHeight;
        } else {
            list.innerHTML = '<p style="text-align:center; color:#888; margin-top: 20px;">Sé el primero en comentar.</p>';
        }
    });
};

const commentForm = document.getElementById('commentForm');
if(commentForm) {
    commentForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const input = document.getElementById('commentInput');
        const usernameInput = document.getElementById('usernameInput');

        const text = input.value.trim();
        const username = usernameInput.value.trim() || 'Anónimo';

        if (text && activeThreadId) {
            localStorage.setItem('chatUsername', username);
            const commentsRef = ref(db, `threads/${activeThreadId}/comments`);
            push(commentsRef, { 
                text: text, 
                username: username, 
                timestamp: Date.now(), 
                userId: getUserId() 
            });
            input.value = '';
        }
    });
}

// --- LÓGICA DE ROBUX REBOTADORES ---
function initBouncingRobux() {
    const container = document.getElementById('floating-robux-container');
    if (!container) return;

    const robuxCount = 20; 
    const robuxUrl = "https://upload.wikimedia.org/wikipedia/commons/c/c7/Robux_2019_Logo_gold.svg";
    const robuxs = [];

    for (let i = 0; i < robuxCount; i++) {
        const img = document.createElement('img');
        img.src = robuxUrl;
        img.classList.add('bouncing-robux');

        let x = Math.random() * (window.innerWidth - 50);
        let y = Math.random() * (window.innerHeight - 50);
        let vx = (Math.random() - 0.5) * 5; 
        let vy = (Math.random() - 0.5) * 5; 

        container.appendChild(img);
        robuxs.push({ element: img, x, y, vx, vy });
    }

    function animate() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        const size = 40; 

        robuxs.forEach(robux => {
            robux.x += robux.vx;
            robux.y += robux.vy;

            if (robux.x <= 0 || robux.x + size >= width) robux.vx *= -1;
            if (robux.y <= 0 || robux.y + size >= height) robux.vy *= -1;

            robux.element.style.transform = `translate(${robux.x}px, ${robux.y}px)`;
        });

        requestAnimationFrame(animate);
    }
    animate();
}

// --- LÓGICA PRINCIPAL ---
document.addEventListener('DOMContentLoaded', function () {

    initBouncingRobux();

    const newThreadButton = document.getElementById('newThreadButton');
    const newThreadModalContent = document.getElementById('newThreadModalContent');
    const newThreadForm = document.getElementById('newThreadForm');
    const threadContainer = document.querySelector('.thread-container');
    const noThreadsMessage = document.getElementById('noThreadsMessage');
    const paginationContainer = document.getElementById('pagination-container');
    const searchInput = document.getElementById('searchInput');

    function saveThreadToFirebase(thread) {
        thread.timestamp = Date.now();
        thread.displayDate = new Date().toLocaleDateString('es-ES');
        thread.likeCount = 0;
        thread.views = 0; 
        push(threadsRef, thread);
    }

    function formatCount(count) {
        let num = Number(count);
        if (num >= 1000000) return (num / 1000000).toFixed(1).replace('.0','') + ' mill.';
        if (num >= 1000) return (num / 1000).toFixed(1).replace('.0','') + ' mil';
        return num;
    }

    function loadThreadsFromFirebase(page, searchTerm = '') {
        const firstThreadIndex = (page - 1) * threadsPerPage;
        const getThreads = query(threadsRef, orderByChild('timestamp'));

        onValue(getThreads, (snapshot) => {
            threadContainer.innerHTML = '';
            let threads = snapshot.val();
            if (threads) {
                let allThreads = Object.entries(threads).sort((a, b) => b[1].timestamp - a[1].timestamp);
                let filteredThreads = allThreads.filter(([key, thread]) =>
                    thread.title.toLowerCase().includes(searchTerm.toLowerCase())
                );
                totalThreads = filteredThreads.length;

                for (let i = firstThreadIndex; i < firstThreadIndex + threadsPerPage && i < filteredThreads.length; i++) {
                    let [key, thread] = filteredThreads[i];
                    let newThread = document.createElement('div');
                    newThread.classList.add('thread');
                    const userId = getUserId();
                    let isLiked = thread.likes && thread.likes[userId];
                    let insigniaVerificado = thread.verificado ? '<i class="fas fa-check-circle insignia-verificado"></i>' : '';
                    let rawCommentCount = thread.comments ? Object.keys(thread.comments).length : 0;

                    let formattedLikeCount = formatCount(thread.likeCount || 0);
                    let formattedViewCount = formatCount(thread.views || 0);
                    let formattedCommentCount = formatCount(rawCommentCount);

                    // --- DETECTAR SI ES VIDEO O IMAGEN PARA MOSTRARLO ---
                    let mediaHTML = '';
                    if (thread.image) {
                        // Comprobamos si es video buscando extensiones o rutas de cloudinary
                        const isVideo = thread.image.endsWith('.mp4') || thread.image.endsWith('.webm') || thread.image.endsWith('.mov') || thread.image.includes('/video/upload/');

                        if (isVideo) {
                            mediaHTML = `
                                <div style="position:relative; width:100%; margin-top:10px; border-radius:4px; overflow:hidden; border:2px solid #000; background:#000;">
                                    <video controls style="width:100%; display:block; max-height:400px;">
                                        <source src="${thread.image}" type="video/mp4">
                                        Tu navegador no soporta videos.
                                    </video>
                                </div>`;
                        } else {
                            mediaHTML = `<img src="${thread.image}" style="width:100%; max-height:400px; object-fit:contain; background:#000; border-radius:4px; margin-top:10px; border:2px solid #000;" alt="Adjunto">`;
                        }
                    }

                    newThread.innerHTML = `
                        <div class="thread-date">${thread.displayDate}</div>
                        <h2>${thread.title} ${insigniaVerificado}</h2>
                        <p><strong>Categoría:</strong> ${thread.category}</p>
                        <p>${thread.description}</p>
                        
                        ${mediaHTML}

                        <div class="thread-actions">
                            <button class="like-button ${isLiked ? 'liked' : ''}" data-thread-id="${key}" data-like-count="${thread.likeCount || 0}">
                                <i class="fas fa-heart"></i> ${formattedLikeCount}
                            </button>
                            <button class="comment-button" onclick="openComments('${key}')">
                                <i class="far fa-comment"></i> ${formattedCommentCount}
                            </button>
                            <span class="view-button" title="Vistas">
                                <i class="far fa-eye"></i> ${formattedViewCount}
                            </span>
                        </div>
                    `;
                    threadContainer.appendChild(newThread);
                }

                if (filteredThreads.length === 0) {
                    noThreadsMessage.style.display = 'block';
                    threadContainer.appendChild(noThreadsMessage);
                } else {
                    noThreadsMessage.style.display = 'none';
                }
            } else {
                noThreadsMessage.style.display = 'block';
                threadContainer.appendChild(noThreadsMessage);
                totalThreads = 0;
            }
            createPaginationButtons(totalThreads, searchTerm);

            document.querySelectorAll('.like-button').forEach(button => {
                button.onclick = function() {
                    const threadId = this.dataset.threadId;
                    const userId = getUserId();
                    const liked = this.classList.contains('liked');
                    const currentCount = parseInt(this.dataset.likeCount);
                    const newCount = liked ? currentCount - 1 : currentCount + 1;
                    const updates = {};
                    updates[`/threads/${threadId}/likeCount`] = newCount;
                    updates[`/threads/${threadId}/likes/${userId}`] = liked ? null : true;
                    update(ref(db), updates);
                };
            });
        });
    }

    function createPaginationButtons(totalThreads, searchTerm = '') {
        paginationContainer.innerHTML = '';
        const totalPages = Math.ceil(totalThreads / threadsPerPage);
        const prevButton = document.createElement('button');
        prevButton.textContent = '« Anterior';
        prevButton.classList.add('pagination-button');
        prevButton.disabled = (currentPage === 1);
        prevButton.onclick = () => { if (currentPage > 1) { currentPage--; loadThreadsFromFirebase(currentPage, searchTerm); } };
        paginationContainer.appendChild(prevButton);

        for (let i = 1; i <= totalPages; i++) {
            let pageButton = document.createElement('button');
            pageButton.textContent = i;
            pageButton.classList.add('pagination-button');
            if (i === currentPage) pageButton.classList.add('active-page');
            pageButton.onclick = () => { currentPage = i; loadThreadsFromFirebase(currentPage, searchTerm); };
            paginationContainer.appendChild(pageButton);
        }

        const nextButton = document.createElement('button');
        nextButton.textContent = 'Siguiente »';
        nextButton.classList.add('pagination-button');
        nextButton.disabled = (currentPage === totalPages || totalPages === 0);
        nextButton.onclick = () => { if (currentPage < totalPages) { currentPage++; loadThreadsFromFirebase(currentPage, searchTerm); } };
        paginationContainer.appendChild(nextButton);
    }

    loadThreadsFromFirebase(currentPage, searchTerm);

    if(newThreadButton) {
        newThreadButton.onclick = () => {
            newThreadModalContent.style.display = (newThreadModalContent.style.display === 'none') ? 'block' : 'none';
        };
    }

    if(searchInput) {
        searchInput.oninput = (event) => {
            searchTerm = event.target.value;
            currentPage = 1;
            loadThreadsFromFirebase(currentPage, searchTerm);
        };
    }

    // --- NUEVA LÓGICA DE ENVÍO DE FORMULARIO (CLOUDINARY) ---
    if(newThreadForm) {
        newThreadForm.onsubmit = async (event) => {
            event.preventDefault();

            // Interfaz de carga
            const submitBtn = document.getElementById('submitBtn');
            const originalText = submitBtn.textContent;
            submitBtn.textContent = "Subiendo archivo...";
            submitBtn.disabled = true;

            const title = document.getElementById('title').value;
            const category = document.getElementById('category').value;
            const description = document.getElementById('description').value;
            const fileInput = document.getElementById('imageFile');

            let mediaUrl = ''; // Aquí guardaremos el link de Cloudinary

            // 1. SUBIR A CLOUDINARY (Si hay archivo)
            if (fileInput.files && fileInput.files[0]) {
                const file = fileInput.files[0];
                const formData = new FormData();
                formData.append('file', file);

                // --- CONFIGURACIÓN DE CLOUDINARY ---
                const uploadPreset = 'comunidad_arc'; // Tu preset
                const cloudName = 'dmrlmfoip'; // <--- ¡PON TU CLOUD NAME AQUÍ! (Dashboard)

                formData.append('upload_preset', uploadPreset);

                // Usamos /auto/upload para que Cloudinary decida si es imagen o video
                const url = `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`;

                try {
                    const response = await fetch(url, { method: 'POST', body: formData });
                    const data = await response.json();

                    if (data.secure_url) {
                        mediaUrl = data.secure_url; // ¡Tenemos el link!
                    } else {
                        console.error("Error Cloudinary:", data);
                        alert("Error al subir archivo. Verifica tu Cloud Name.");
                        submitBtn.textContent = originalText;
                        submitBtn.disabled = false;
                        return;
                    }
                } catch (error) {
                    console.error("Error red:", error);
                    alert("Error de conexión al subir imagen.");
                    submitBtn.textContent = originalText;
                    submitBtn.disabled = false;
                    return;
                }
            }

            // 2. GUARDAR EN FIREBASE
            let thread = {
                title: title,
                category: category,
                description: description,
                image: mediaUrl // Guardamos el link de la foto/video
            };

            saveThreadToFirebase(thread);

            // Limpiar y recargar
            newThreadModalContent.style.display = 'none';
            newThreadForm.reset();
            document.getElementById('fileName').textContent = "";
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
            loadThreadsFromFirebase(currentPage, searchTerm);
        };
    }
});