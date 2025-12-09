// script.js

// --- PART 1: DARK MODE ---
const toggleButton = document.getElementById('theme-toggle');
const body = document.body;

// Check saved preference on load
if (localStorage.getItem('theme') === 'dark') {
    body.classList.add('dark-mode');
    if(toggleButton) toggleButton.innerText = '☀️ Light Mode';
}

// Toggle on click
if(toggleButton) {
    toggleButton.addEventListener('click', () => {
        body.classList.toggle('dark-mode');
        
        if (body.classList.contains('dark-mode')) {
            localStorage.setItem('theme', 'dark');
            toggleButton.innerText = '☀️ Light Mode';
        } else {
            localStorage.setItem('theme', 'light');
            toggleButton.innerText = '🌙 Dark Mode';
        }
    });
}

// --- PART 2: MOBILE ABSTRACT TOGGLE ---
// This function will be called when clicking "Show Abstract"
function toggleAbstract(button) {
    // Find the abstract div that is right next to the button
    const abstractText = button.nextElementSibling;
    
    // Toggle the 'open' class
    abstractText.classList.toggle('open');
    
    // Update button text
    if (abstractText.classList.contains('open')) {
        button.innerText = "Hide Abstract";
    } else {
        button.innerText = "Show Abstract";
    }
}
