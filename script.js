// ============================================
// MOMENTS D'ÉVASION - JavaScript
// Interactive Features & Animations
// ============================================

// === Navbar Scroll Effect ===
const navbar = document.getElementById('navbar');
let lastScroll = 0;

window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;

    // Add scrolled class when scrolling down
    if (currentScroll > 50) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }

    lastScroll = currentScroll;
});

// === Mobile Menu Toggle ===
const menuToggle = document.getElementById('menuToggle');
const navMenu = document.getElementById('navMenu');

if (menuToggle && navMenu) {
    menuToggle.addEventListener('click', () => {
        navMenu.classList.toggle('active');

        // Animate hamburger menu
        const spans = menuToggle.querySelectorAll('span');
        spans.forEach((span, index) => {
            if (navMenu.classList.contains('active')) {
                if (index === 0) span.style.transform = 'rotate(45deg) translateY(8px)';
                if (index === 1) span.style.opacity = '0';
                if (index === 2) span.style.transform = 'rotate(-45deg) translateY(-8px)';
            } else {
                span.style.transform = '';
                span.style.opacity = '';
            }
        });
    });

    // Close menu when clicking on a link
    const navLinks = navMenu.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            navMenu.classList.remove('active');
            const spans = menuToggle.querySelectorAll('span');
            spans.forEach(span => {
                span.style.transform = '';
                span.style.opacity = '';
            });
        });
    });
}

// === Smooth Scroll for Anchor Links ===
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const href = this.getAttribute('href');
        if (href !== '#' && href.length > 1) {
            e.preventDefault();
            const target = document.querySelector(href);
            if (target) {
                const offsetTop = target.offsetTop - 80; // Account for fixed navbar
                window.scrollTo({
                    top: offsetTop,
                    behavior: 'smooth'
                });
            }
        }
    });
});

// === Scroll Reveal Animations ===
const revealElements = document.querySelectorAll('.reveal');

const revealOnScroll = () => {
    const triggerBottom = window.innerHeight * 0.85;

    revealElements.forEach(element => {
        const elementTop = element.getBoundingClientRect().top;

        if (elementTop < triggerBottom) {
            element.classList.add('active');
        }
    });
};

// Run on scroll
window.addEventListener('scroll', revealOnScroll);
// Run on load
window.addEventListener('load', revealOnScroll);

// === Contact Form Handling ===
const contactForm = document.getElementById('contactForm');
const formStatus = document.getElementById('formStatus');

if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Get form data
        const formData = new FormData(contactForm);
        const data = Object.fromEntries(formData);

        // Show loading message
        formStatus.textContent = 'Envoi en cours...';
        formStatus.style.color = 'var(--color-accent-light)';

        // Simulate form submission (replace with actual backend call)
        setTimeout(() => {
            // Success message
            formStatus.textContent = '✔ Message envoyé avec succès ! Je vous recontacterai très prochainement.';
            formStatus.style.color = 'var(--color-primary-light)';

            // Reset form
            contactForm.reset();

            // Clear message after 5 seconds
            setTimeout(() => {
                formStatus.textContent = '';
            }, 5000);
        }, 1000);

        // In production, you would send data to your backend:
        // try {
        //     const response = await fetch('/api/contact', {
        //         method: 'POST',
        //         headers: { 'Content-Type': 'application/json' },
        //         body: JSON.stringify(data)
        //     });
        //     
        //     if (response.ok) {
        //         formStatus.textContent = '✔ Message envoyé avec succès !';
        //         contactForm.reset();
        //     } else {
        //         throw new Error('Erreur réseau');
        //     }
        // } catch (error) {
        //     formStatus.textContent = '❌ Une erreur est survenue. Veuillez réessayer.';
        //     formStatus.style.color = '#e74c3c';
        // }
    });
}

// === Add hover effects to cards ===
const cards = document.querySelectorAll('.card, .glass-card, .pricing-card');
cards.forEach(card => {
    card.addEventListener('mouseenter', function () {
        this.style.transition = 'all 0.3s ease';
    });
});

// === Set active nav link based on current page ===
const setActiveNavLink = () => {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const navLinks = document.querySelectorAll('.nav-link');

    navLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href === currentPage) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
};

// Run on load
window.addEventListener('load', setActiveNavLink);

// === Lazy Loading for Images ===
if ('IntersectionObserver' in window) {
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                if (img.dataset.src) {
                    img.src = img.dataset.src;
                    img.removeAttribute('data-src');
                }
                observer.unobserve(img);
            }
        });
    });

    document.querySelectorAll('img[data-src]').forEach(img => {
        imageObserver.observe(img);
    });
}

// === Floating animation removed to prevent layout shift ===
// The hero content should remain static for stability as requested.

// === Console welcome message ===
console.log('%c🌿 Moments d\'Évasion 🌿', 'color: #8ba888; font-size: 24px; font-weight: bold;');
console.log('%cVotre havre de paix et de bien-être', 'color: #d4a574; font-size: 14px;');
// Booking Link Interceptor
document.addEventListener('click', (e) => {
    // Find closest anchor tag
    const link = e.target.closest('a');
    if (!link) return;

    const href = link.getAttribute('href');
    if (href && href.includes('dashboard.html') && href.includes('tab=booking')) {
        // Parse params from the link href
        // Use a dummy base if href is relative to parse seamlessly
        const url = new URL(href, window.location.origin);
        const service = url.searchParams.get('service');

        if (service) {
            console.log('Saving booking intent:', service);
            localStorage.setItem('booking_intent', service);
        }
    }
});
