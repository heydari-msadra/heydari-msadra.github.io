// script.js


const toggleButton = document.getElementById('theme-toggle');
const body = document.body;

function updateToggleIcon() {
    const icon = toggleButton.querySelector('i');
    if (body.classList.contains('dark-mode')) {
        icon.classList.remove('fa-moon');
        icon.classList.add('fa-sun');
        icon.style.transform = "rotate(180deg)"; // subtle animation
    } else {
        icon.classList.remove('fa-sun');
        icon.classList.add('fa-moon');
        icon.style.transform = "rotate(0deg)"; // reset rotation
    }
}

// Initial load
if (localStorage.getItem('theme') === 'dark') {
    body.classList.add('dark-mode');
}
updateToggleIcon();

// Toggle handler
toggleButton.addEventListener('click', () => {
    body.classList.toggle('dark-mode');
    localStorage.setItem('theme',
        body.classList.contains('dark-mode') ? 'dark' : 'light'
    );
    updateToggleIcon();
});


// MOBILE MENU
const mobileMenuButton = document.getElementById("mobile-menu-button");
const mobileMenu = document.getElementById("mobile-menu");

mobileMenuButton.addEventListener("click", () => {
    mobileMenu.classList.toggle("open");
});

// MOBILE DARK MODE
const mobileThemeToggle = document.getElementById("mobile-theme-toggle");
if (mobileThemeToggle) {
    mobileThemeToggle.addEventListener("click", () => {
        document.body.classList.toggle("dark-mode");
        localStorage.setItem(
            "theme",
            document.body.classList.contains("dark-mode") ? "dark" : "light"
        );
    });
}
