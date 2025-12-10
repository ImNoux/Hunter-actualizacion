 // Import the functions you need from the SDKs you need
 import { initializeApp } from "https://esm.sh/firebase/app";
 import { getDatabase, ref, push, set, onValue } from "https://esm.sh/firebase/database";

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

 document.addEventListener('DOMContentLoaded', function() {
  const newThreadButton = document.getElementById('newThreadButton');
  const newThreadModalContent = document.getElementById('newThreadModalContent');
  const closeButton = document.querySelector('.close-button');
  const newThreadForm = document.getElementById('newThreadForm');
  const threadContainer = document.querySelector('.thread-container');
  const noThreadsMessage = document.getElementById('noThreadsMessage');

  // Function to save threads to Firebase
  function saveThreadToFirebase(thread) {
  const threadsRef = ref(db, 'threads');
  push(threadsRef, thread);
  }

  // Function to load threads from Firebase
  function loadThreadsFromFirebase() {
  const threadsRef = ref(db, 'threads');
  onValue(threadsRef, (snapshot) => {
  threadContainer.innerHTML = ''; // Clear the thread container
  let threads = snapshot.val();
  if (threads) {
  Object.keys(threads).forEach((key) => {
  let thread = threads[key];
  let newThread = document.createElement('div');
  newThread.classList.add('thread');
  newThread.innerHTML = `
  <h2>${thread.title}</h2>
  <p><strong>Categoría:</strong> ${thread.category}</p>
  <p>${thread.description}</p>
  `;
  threadContainer.appendChild(newThread);
  });
  noThreadsMessage.style.display = 'none'; // Hide the "No threads yet" message
  } else {
  noThreadsMessage.style.display = 'block'; // Show the "No threads yet" message
  threadContainer.appendChild(noThreadsMessage);
  }
  });
  }

  // Load threads from Firebase on page load
  loadThreadsFromFirebase();

  // Event listener for "+ Nuevo" button click
  newThreadButton.addEventListener('click', function(event) {
  newThreadModalContent.style.display = (newThreadModalContent.style.display === 'none') ? 'block' : 'none';
  });

  // Event listener for modal close button
  closeButton.addEventListener('click', function() {
  newThreadModalContent.style.display = 'none';
  });

  // Event listener for new thread form submission
  newThreadForm.addEventListener('submit', function(event) {
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
  });
 });