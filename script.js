 document.addEventListener('DOMContentLoaded', function() {
  const newThreadButton = document.getElementById('newThreadButton');
  const newThreadModalContent = document.getElementById('newThreadModalContent');
  const closeButton = document.querySelector('.close-button');
  const newThreadForm = document.getElementById('newThreadForm');
  const threadContainer = document.querySelector('.thread-container');
  const noThreadsMessage = document.getElementById('noThreadsMessage');
  const searchInput = document.getElementById('searchInput');

  // Función para guardar los hilos en LocalStorage
  function saveThreadsToLocalStorage() {
  const threads = [];
  const threadElements = threadContainer.querySelectorAll('.thread');
  threadElements.forEach(threadElement => {
  threads.push({
  title: threadElement.querySelector('h2').textContent,
  category: threadElement.querySelector('p:nth-child(2)').textContent.split(': ')[1],
  description: threadElement.querySelector('p:nth-child(3)').textContent
  });
  });
  localStorage.setItem('threads', JSON.stringify(threads));
  }

  // Función para cargar los hilos desde LocalStorage
  function loadThreadsFromLocalStorage() {
  const threadsJSON = localStorage.getItem('threads');
  if (threadsJSON) {
  const threads = JSON.parse(threadsJSON);
  threads.forEach(thread => {
  const newThread = document.createElement('div');
  newThread.classList.add('thread');
  newThread.innerHTML = `
  <h2>${thread.title}</h2>
  <p><strong>Categoría:</strong> ${thread.category}</p>
  <p>${thread.description}</p>
  `;
  threadContainer.appendChild(newThread);
  noThreadsMessage.style.display = 'none';
  });
  }
  }

  // Función para filtrar los hilos según el término de búsqueda
  function filterThreads(searchTerm) {
  const threadElements = threadContainer.querySelectorAll('.thread');
  threadElements.forEach(threadElement => {
  const title = threadElement.querySelector('h2').textContent.toLowerCase();
  const description = threadElement.querySelector('p:nth-child(3)').textContent.toLowerCase();
  if (title.includes(searchTerm.toLowerCase()) || description.includes(searchTerm.toLowerCase())) {
  threadElement.style.display = 'block';
  } else {
  threadElement.style.display = 'none';
  }
  });
  }

  // Cargar los hilos desde LocalStorage al cargar la página
  loadThreadsFromLocalStorage();

  // Abre/cierra el modal al hacer clic en el botón "+ Nuevo"
  newThreadButton.addEventListener('click', function(event) {
  newThreadModalContent.style.display = newThreadModalContent.style.display === 'block' ? 'none' : 'block';
  });

  // Cierra