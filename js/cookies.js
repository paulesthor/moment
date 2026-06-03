// Bandeau de consentement cookies — Moments d'Évasion
(function() {
    const CONSENT_KEY = 'mde_cookie_consent';

    // Déjà accepté → rien à faire
    if (localStorage.getItem(CONSENT_KEY)) return;

    // Crée le bandeau
    const banner = document.createElement('div');
    banner.id = 'cookie-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-label', 'Gestion des cookies');
    banner.innerHTML = `
        <div class="cookie-text">
            <p>
                Ce site utilise uniquement des cookies <strong>strictement nécessaires</strong> à son fonctionnement (authentification, mémorisation de session). Aucun cookie de tracking ou publicitaire n'est utilisé.
            </p>
            <p>
                Les polices d'écriture sont chargées depuis <strong>Google Fonts</strong>, ce qui implique un transfert de votre adresse IP vers Google. En continuant, vous acceptez ce transfert.
                <a href="confidentialite.html">En savoir plus</a>
            </p>
        </div>
        <div class="cookie-actions">
            <button id="cookie-accept" class="cookie-btn cookie-btn--accept">J'accepte</button>
            <a href="confidentialite.html" class="cookie-btn cookie-btn--more">Politique de confidentialité</a>
        </div>
    `;

    document.body.appendChild(banner);

    // Animation d'entrée
    setTimeout(() => banner.classList.add('cookie-visible'), 100);

    // Accepter
    document.getElementById('cookie-accept').addEventListener('click', () => {
        localStorage.setItem(CONSENT_KEY, '1');
        banner.classList.remove('cookie-visible');
        setTimeout(() => banner.remove(), 400);
    });
})();
