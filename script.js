// ==========================================
// script.js — Global Theme + Mobile Menu Logic
// ==========================================

// This version is designed to be used with dynamic nav loading
// The functions below are re-initialized by includes.js AFTER nav loads.

// ================================
// THEME TOGGLE (Desktop + Mobile)
// ================================

function initializeThemeToggle() {
    const body = document.body;

    // Select toggles (desktop + mobile)
    const toggleButton = document.getElementById('theme-toggle');
    const mobileToggle = document.getElementById('mobile-theme-toggle');

    // If nav hasn’t loaded yet, exit safely
    if (!toggleButton && !mobileToggle) return;

    // Load saved theme
    if (localStorage.getItem('theme') === 'dark') {
        body.classList.add('dark-mode');
    }

    // Update icon appearance
    function updateToggleIcon() {
        const icon = toggleButton ? toggleButton.querySelector('i') : null;
        if (!icon) return;

        if (body.classList.contains('dark-mode')) {
            icon.classList.remove('fa-moon');
            icon.classList.add('fa-sun');
            icon.style.transform = "rotate(180deg)";
        } else {
            icon.classList.remove('fa-sun');
            icon.classList.add('fa-moon');
            icon.style.transform = "rotate(0deg)";
        }
    }

    updateToggleIcon();

    // Desktop toggle
    if (toggleButton) {
        toggleButton.addEventListener("click", () => {
            body.classList.toggle("dark-mode");
            localStorage.setItem(
                "theme",
                body.classList.contains("dark-mode") ? "dark" : "light"
            );
            updateToggleIcon();
        });
    }

    // Mobile toggle simply “clicks” desktop toggle
    if (mobileToggle) {
        mobileToggle.addEventListener("click", () => {
            if (toggleButton) toggleButton.click();
        });
    }
}


// ================================
// MOBILE MENU OPEN/CLOSE
// ================================

function initializeMobileMenu() {

    const button = document.getElementById("mobile-menu-button");
    const menu = document.getElementById("mobile-menu");

    if (!button || !menu) return;

    // Toggle menu (animated)
    button.addEventListener("click", () => {
        menu.classList.toggle("open");
    });

    // Close menu when clicking outside
    document.addEventListener("click", (e) => {
        if (!menu.contains(e.target) &&
            !button.contains(e.target)) {
            menu.classList.remove("open");
        }
    });
}


function highlightActiveLink() {
    const currentPath = window.location.pathname;

    document.querySelectorAll(".site-nav a").forEach(link => {
        if (link.getAttribute("href") && currentPath.endsWith(link.getAttribute("href"))) {
            link.classList.add("active-link");
        }
    });
}



// =========================================
// INITIAL CALL (for pages that have nav inline)
// When nav is loaded dynamically, includes.js will call these again
// =========================================
document.addEventListener("DOMContentLoaded", () => {
    initializeThemeToggle();
    initializeMobileMenu();
});
