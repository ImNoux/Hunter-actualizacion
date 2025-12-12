// Import the functions you need from the SDKs you need
import { initializeApp } from "https://esm.sh/firebase/app";
import { getDatabase, ref, push, set, onValue, query, orderByKey, limitToFirst, orderByChild, limitToLast, update } from "https://esm.sh/firebase/database";

// Your web app's Firebase configuration
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

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Get a reference to the database
const db = getDatabase(app);

const threadsRef = ref(db, 'threads'); // Reference to the threads in Firebase
const threadsPerPage = 5; // Number of threads per page
let currentPage = 1; // Current page number
let totalThreads = 0; // Total number of threads
let searchTerm = ''; // Search term

// Function to get or generate a unique user ID
function getUserId() {
    let userId = localStorage.getItem('userId');
    if (!userId) {
        userId = 'user_' + Math.random().toString(36).substr(2, 9); // Generate unique ID
        localStorage.setItem('userId', userId);
    }
    return userId;
}

document.addEventListener('DOMContentLoaded', function () {
    const newThreadButton = document.getElementById('newThreadButton');
    const newThreadModalContent = document.getElementById('newThreadModalContent');
    const closeButton = document.querySelector('.close-button');
    const newThreadForm = document.getElementById('newThreadForm');
    const threadContainer = document.querySelector('.thread-container');
    const noThreadsMessage = document.getElementById('noThreadsMessage');
    const paginationContainer = document.getElementById('pagination-container');
    const searchInput = document.getElementById('searchInput'); // Search input

    // Function to save threads to Firebase
    function saveThreadToFirebase(thread) {
        // Add timestamp, likeCount, likes, and verificado to the thread
        thread.timestamp = new Date().toLocaleDateString('es-ES'); // Get current date in dd/mm/yyyy format
        thread.likeCount = 0; // Initialize likeCount
        thread.likes = {}; // Initialize likes object
        thread.verificado = false; // Initialize verificado as false (change to true for verified threads)
        push(threadsRef, thread);
    }

    // Function to format like counts
    function formatLikeCount(likeCount) {
        if (likeCount >= 1000000) {
            const mill = likeCount / 1000000;
            return (mill % 1 === 0 ? mill.toFixed(0) : mill.toFixed(1)) + ' mill.';
        } else if (likeCount >= 1000) {
            return (likeCount / 1000).toFixed(0) + ' mil';
        } else {
            return likeCount;
        }
    }

    // Function to load threads from Firebase with pagination and search
    function loadThreadsFromFirebase(page, searchTerm = '') {
        const firstThreadIndex = (page - 1) * threadsPerPage;

        // Query to get the threads for the current page, ordered by timestamp descending
        const getThreads = query(threadsRef, orderByKey());

        onValue(getThreads, (snapshot) => {
            threadContainer.innerHTML = ''; // Clear the thread container
            let threads = snapshot.val();
            if (threads) {
                let index = 0;
                let filteredThreads = Object.entries(threads).reverse().filter(([key, thread]) =>
                    thread.title.toLowerCase().includes(searchTerm.toLowerCase())
                );
                for (let i = firstThreadIndex; i < firstThreadIndex + threadsPerPage && i < filteredThreads.length; i++) {
                    let [key, thread] = filteredThreads[i];
                    let newThread = document.createElement('div');
                    newThread.classList.add('thread');
                    const userId = getUserId(); // Get unique user ID
                    let isLiked = thread.likes && thread.likes[userId]; // Check if current user liked
                    let insigniaVerificado = thread.verificado ? '<i class="fas fa-check-circle insignia-verificado"></i>' : ''; // Ícono de verificación azul como Instagram
                    let formattedLikeCount = formatLikeCount(thread.likeCount || 0);
                    newThread.innerHTML = `
            <div class="thread-date">${thread.timestamp}</div>
            <h2>${thread.title} ${insigniaVerificado}</h2>
            <p><strong>Categoría:</strong> ${thread.category}</p>
            <p>${thread.description}</p>
            <button class="like-button ${isLiked ? 'liked' : ''}" data-thread-id="${key}" data-like-count="${thread.likeCount || 0}">
              <i class="fas fa-heart"></i> ${formattedLikeCount}
            </button>
          `;
                    threadContainer.appendChild(newThread);
                }
                // Show "No threads yet" message if no threads match the search term
                if (threadContainer.innerHTML === '') {
                    noThreadsMessage.style.display = 'block';
                    threadContainer.appendChild(noThreadsMessage);
                } else {
                    noThreadsMessage.style.display = 'none';
                }
            } else {
                noThreadsMessage.style.display = 'block'; // Show the "No threads yet" message
                threadContainer.appendChild(noThreadsMessage);
            }
            createPaginationButtons(threads ? Object.keys(threads).length : 0, searchTerm); // Create pagination buttons after loading threads
            // Attach event listeners to like buttons after they are added to the DOM
            const likeButtons = document.querySelectorAll('.like-button');
            likeButtons.forEach(button => {
                button.addEventListener('click', function () {
                    const threadId = this.dataset.threadId;
                    const userId = getUserId(); // Get unique user ID
                    const liked = this.classList.contains('liked');
                    const currentCount = parseInt(this.dataset.likeCount);
                    const newCount = liked ? currentCount - 1 : currentCount + 1;
                    const updates = {};
                    updates[`/threads/${threadId}/likeCount`] = newCount;
                    updates[`/threads/${threadId}/likes/${userId}`] = liked ? null : true;

                    update(ref(db), updates);

                    // Update the button immediately
                    this.classList.toggle('liked');
                    this.innerHTML = `<i class="fas fa-heart"></i> ${formatLikeCount(newCount)}`;
                    this.dataset.likeCount = newCount;
                });
            });
        });
    }

    // Function to create pagination buttons
    function createPaginationButtons(totalThreads, searchTerm = '') {
        paginationContainer.innerHTML = ''; // Clear the pagination container
        const totalPages = Math.ceil(totalThreads / threadsPerPage);

        // "Previous" button
        const prevButton = document.createElement('button');
        prevButton.textContent = '« Anterior';
        prevButton.classList.add('pagination-button');
        prevButton.disabled = (currentPage === 1); // Disable if on the first page
        prevButton.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                loadThreadsFromFirebase(currentPage, searchTerm);
                updatePaginationButtons();
            }
        });
        paginationContainer.appendChild(prevButton);

        // Create numbered page buttons
        for (let i = 1; i <= totalPages; i++) {
            let pageButton = document.createElement('button');
            pageButton.textContent = i;
            pageButton.classList.add('pagination-button');
            if (i === currentPage) {
                pageButton.classList.add('active-page');
            }
            pageButton.addEventListener('click', () => {
                currentPage = i;
                loadThreadsFromFirebase(currentPage, searchTerm);
                updatePaginationButtons();
            });
            paginationContainer.appendChild(pageButton);
        }

        // "Next" button
        const nextButton = document.createElement('button');
        nextButton.textContent = 'Siguiente »';
        nextButton.classList.add('pagination-button');
        nextButton.disabled = (currentPage === totalPages); // Disable if on the last page
        nextButton.addEventListener('click', () => {
            if (currentPage < totalPages) {
                currentPage++;
                loadThreadsFromFirebase(currentPage, searchTerm);
                updatePaginationButtons();
            }
        });
        paginationContainer.appendChild(nextButton);
    }

    // Function to update pagination buttons based on current page
    function updatePaginationButtons() {
        const pageButtons = paginationContainer.querySelectorAll('.pagination-button');
        pageButtons.forEach(button => {
            if (parseInt(button.textContent) === currentPage) {
                button.classList.add('active-page');
            } else {
                button.classList.remove('active-page');
            }
        });
    }

    // Load threads from Firebase on page load
    loadThreadsFromFirebase(currentPage, searchTerm);

    // Event listener for "+ Nuevo" button click
    newThreadButton.addEventListener('click', function (event) {
        newThreadModalContent.style.display = (newThreadModalContent.style.display === 'none') ? 'block' : 'none';
    });

    // Event listener for modal close button
    closeButton.addEventListener('click', function () {
        newThreadModalContent.style.display = 'none';
    });

    // Event listener for new thread form submission
    newThreadForm.addEventListener('submit', function (event) {
        event.preventDefault();

        let category = document.getElementById('category').value;
        let title = document.getElementById('title').value;
        let description = document.getElementById('description').value;

        // Create a new thread object
        let thread = {
            title: title,
            category: category,
            description: description
        };

        // Save the thread to Firebase
        saveThreadToFirebase(thread);

        // Close the modal
        newThreadModalContent.style.display = 'none';

        // Clear the form
        newThreadForm.reset();

        // Reload the threads
        loadThreadsFromFirebase(currentPage, searchTerm);
    });

    // Event listener for search input
    searchInput.addEventListener('input', function (event) {
        searchTerm = event.target.value;
        currentPage = 1; // Reset current page to 1
        loadThreadsFromFirebase(currentPage, searchTerm);
    });
});