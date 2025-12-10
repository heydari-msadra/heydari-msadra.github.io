// Insert Navigation
fetch("/includes/nav.html")
    .then(response => response.text())
    .then(data => {
        document.getElementById("nav-placeholder").innerHTML = data;
        // Reinitialize toggles after dynamic load
        initializeThemeToggle();
        initializeMobileMenu();
        highlightActiveLink();
    });

// Insert Footer
fetch("/includes/footer.html")
    .then(response => response.text())
    .then(data => {
        document.getElementById("footer-placeholder").innerHTML = data;
    });
