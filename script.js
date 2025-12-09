// script.js

// 1. Get the button and body element
const toggleButton = document.getElementById('theme-toggle');
const body = document.body;

// 2. Check if the user already visited and chose Dark Mode
const currentTheme = localStorage.getItem('theme');
if (currentTheme === 'dark') {
    body.classList.add('dark-mode');
    toggleButton.innerText = '☀️ Light Mode';
}

// 3. Listen for a click on the button
toggleButton.addEventListener('click', function() {
    body.classList.toggle('dark-mode');

    // If body has the class 'dark-mode', save 'dark', else save 'light'
    if (body.classList.contains('dark-mode')) {
        localStorage.setItem('theme', 'dark');
        toggleButton.innerText = '☀️ Light Mode';
    } else {
        localStorage.setItem('theme', 'light');
        toggleButton.innerText = '🌙 Dark Mode';
    }
});
