// Mode édition avancé : blocs supprimables / dupliquables / déplaçables, ajout de
// blocs, gestion des pages (dupliquer, créer, renommer, masquer, supprimer).
import { supabase } from './config.js';
import {
    CONFIG_KEY, STATIC_PAGES, currentPageId, getContentNodes, isCustomId, isLayoutLocked,
    layoutKeyFor, navEntries, navIdFromHref, newKey, pageUrl, parseConfig, rekey, saveConfig, saveContent,
    serializeContent, slugify,
} from './site.js';

const PLACEHOLDER_IMG = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500">' +
    '<rect width="800" height="500" fill="#e8efe9"/><g fill="none" stroke="#8ba888" stroke-width="6">' +
    '<rect x="300" y="170" width="200" height="150" rx="10"/><circle cx="355" cy="225" r="16"/>' +
    '<path d="M310 310l60-60 40 40 30-30 50 50"/></g>' +
    '<text x="400" y="380" text-anchor="middle" font-family="sans-serif" font-size="22" fill="#4f7d65">Cliquez pour choisir une image</text></svg>');

const BLOCK_TAGS = new Set(['SECTION', 'DIV', 'ARTICLE', 'UL', 'OL', 'LI', 'TABLE', 'FIGURE', 'BLOCKQUOTE', 'ASIDE', 'HEADER', 'ADDRESS', 'DETAILS']);

let active = false;
let target = null;       // bloc survolé / sélectionné
let toolbar, highlight, panel, toast, hideTimer, toastTimer;
let lastRoot = null;

// ======================================================================
// Détection des blocs
// ======================================================================

const roots = () => getContentNodes();
const inContent = (el) => roots().some(r => r.contains(el));
const isRoot = (el) => roots().includes(el);

function isBlock(el) {
    if (!(el instanceof HTMLElement) || el.closest('[data-admin-ui]') || !inContent(el)) return false;
    if (isRoot(el)) return true;
    const keyedAncestor = el.parentElement && el.parentElement.closest('[data-content-key]');
    if (keyedAncestor) return false; // fragment à l'intérieur d'un texte : pas un bloc
    if (el.matches('[data-content-key], img')) return true;
    if (el.classList.contains('container') || el.classList.contains('hero-overlay')) return false;
    if (!el.textContent.trim() && !el.querySelector('img')) return false;
    const siblings = el.parentElement ? [...el.parentElement.children] : [];
    const repeated = siblings.filter(c => c.tagName === el.tagName && c.className === el.className).length >= 2;
    return repeated || BLOCK_TAGS.has(el.tagName);
}

function blockAt(node) {
    let el = node instanceof Element ? node : null;
    while (el && el !== document.body) {
        if (isBlock(el)) return el;
        el = el.parentElement;
    }
    return null;
}

const parentBlock = (el) => blockAt(el.parentElement);

function blockLabel(el) {
    if (isRoot(el)) return 'Section';
    if (el.matches('img')) return 'Image';
    if (el.matches('h1,h2,h3,h4,h5,h6')) return 'Titre';
    if (el.matches('a.btn, .btn')) return 'Bouton';
    if (el.matches('[data-content-key]')) return 'Texte';
    return 'Bloc';
}

// ======================================================================
// Enregistrement de la mise en page
// ======================================================================

let saveTimer = null;
let saving = Promise.resolve();

function saveLayout() {
    clearTimeout(saveTimer);
    return new Promise((resolve) => {
        saveTimer = setTimeout(() => {
            saving = saving.then(async () => {
                try {
                    await saveContent(layoutKeyFor(currentPageId()), serializeContent());
                    flash('✔ Enregistré');
                } catch (e) {
                    console.error(e);
                    flash('⚠️ Échec de l\'enregistrement', true);
                }
                resolve();
            });
        }, 250);
    });
}

function refreshEditing() {
    if (window.refreshInlineEditing) window.refreshInlineEditing();
    // Les blocs insérés ne doivent pas rester invisibles (animation d'apparition)
    roots().forEach(r => {
        if (r.classList.contains('reveal')) r.classList.add('active');
        r.querySelectorAll('.reveal').forEach(n => n.classList.add('active'));
    });
}

// ======================================================================
// Barre d'outils flottante
// ======================================================================

function btn(label, title, onClick, extra = '') {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pb-btn ' + extra;
    b.innerHTML = label;
    b.title = title;
    b.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); onClick(e); });
    return b;
}

function heroImageOf(el) {
    if (el.matches('img[data-image-key]')) return el;
    if (isRoot(el)) return el.querySelector('.hero-background[data-image-key]');
    return null;
}

function buildToolbar() {
    toolbar.innerHTML = '';
    if (!target) return;
    const locked = isLayoutLocked();
    const chip = document.createElement('span');
    chip.className = 'pb-chip';
    chip.textContent = blockLabel(target);
    toolbar.appendChild(chip);

    const img = heroImageOf(target);
    if (img) toolbar.appendChild(btn('📷', 'Changer l\'image', () => window.pickImageFor(img)));

    const link = target.matches('a') ? target : target.querySelector('a[href]');
    if (link && !locked && target.matches('a, [data-content-key]')) {
        toolbar.appendChild(btn('🔗', 'Modifier le lien', () => editLink(link)));
    }
    if (locked) return;

    if (parentBlock(target)) toolbar.appendChild(btn('⬆', 'Sélectionner le bloc parent', () => select(parentBlock(target))));
    toolbar.appendChild(btn('▲', 'Monter', () => move(-1)));
    toolbar.appendChild(btn('▼', 'Descendre', () => move(1)));
    toolbar.appendChild(btn('⧉', 'Dupliquer ce bloc', duplicateBlock));
    toolbar.appendChild(btn('➕', 'Ajouter un bloc après', (e) => openAddMenu(e.currentTarget, target)));
    toolbar.appendChild(btn('🗑', 'Supprimer ce bloc', deleteBlock, 'pb-danger'));
}

function position() {
    if (!target || !document.contains(target)) { hideTools(); return; }
    const r = target.getBoundingClientRect();
    highlight.style.display = 'block';
    highlight.style.top = r.top + 'px';
    highlight.style.left = r.left + 'px';
    highlight.style.width = r.width + 'px';
    highlight.style.height = r.height + 'px';

    toolbar.style.display = toolbar.childElementCount > 1 ? 'flex' : 'none';
    const tw = toolbar.offsetWidth, th = toolbar.offsetHeight;
    // Grands blocs : barre à l'intérieur (en haut à droite) ; petits blocs : juste au-dessus
    let top = r.height > 90 ? Math.max(r.top + 6, 60) : r.top - th + 1;
    if (top < 56) top = r.bottom - 1 < 100 ? r.bottom - 1 : 60;
    top = Math.min(top, window.innerHeight - th - 8);
    const left = Math.min(r.right - tw - (r.height > 90 ? 6 : 0), window.innerWidth - tw - 8);
    toolbar.style.top = top + 'px';
    toolbar.style.left = Math.max(8, left) + 'px';
}

function select(el) {
    if (!el) return;
    target = el;
    if (isRoot(el)) lastRoot = el;
    buildToolbar();
    position();
}

function hideTools() {
    target = null;
    if (highlight) highlight.style.display = 'none';
    if (toolbar) toolbar.style.display = 'none';
}

function onPointerOver(e) {
    if (!active || !(e.target instanceof Element)) return;
    if (e.target.closest('[data-admin-ui]')) { clearTimeout(hideTimer); return; }
    clearTimeout(hideTimer);
    const block = blockAt(e.target);
    if (!block) { hideTimer = setTimeout(hideTools, 350); return; }
    if (block !== target) select(block);
}

function onPointerLeave(e) {
    if (!e.relatedTarget) hideTimer = setTimeout(hideTools, 350);
}

// ======================================================================
// Actions sur les blocs
// ======================================================================

function flash(message, isError = false) {
    toast.innerHTML = '';
    toast.textContent = message;
    toast.className = 'pb-toast show' + (isError ? ' error' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}

function deleteBlock() {
    const el = target;
    if (!el) return;
    const parent = el.parentNode, next = el.nextSibling;
    hideTools();
    el.remove();
    saveLayout();

    toast.innerHTML = '';
    toast.className = 'pb-toast show';
    toast.append('🗑 Bloc supprimé ');
    const undo = btn('Annuler', 'Rétablir le bloc', () => {
        parent.insertBefore(el, next && next.parentNode === parent ? next : null);
        refreshEditing();
        toast.classList.remove('show');
        saveLayout();
    }, 'pb-undo');
    toast.appendChild(undo);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 8000);
}

function cleanForClone(clone) {
    [clone, ...clone.querySelectorAll('*')].forEach(n => {
        n.removeAttribute('contenteditable');
        n.classList.remove('editable', 'drag-over');
    });
}

function duplicateBlock() {
    const el = target;
    if (!el) return;
    const copy = el.cloneNode(true);
    cleanForClone(copy);
    rekey(copy);
    el.after(copy);
    refreshEditing();
    select(copy);
    copy.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    saveLayout();
}

function move(direction) {
    const el = target;
    if (!el) return;
    const sibling = direction < 0 ? el.previousElementSibling : el.nextElementSibling;
    const isInert = (n) => n && (['SCRIPT', 'STYLE'].includes(n.tagName) || n.hasAttribute('data-admin-ui'));
    let s = sibling;
    while (isInert(s)) s = direction < 0 ? s.previousElementSibling : s.nextElementSibling;
    if (!s || (isRoot(el) && !isRoot(s))) { flash('Déjà en ' + (direction < 0 ? 'première' : 'dernière') + ' position'); return; }
    if (direction < 0) s.before(el); else s.after(el);
    position();
    el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    saveLayout();
}

function editLink(link) {
    const current = link.getAttribute('href') || '';
    const value = prompt('Adresse du lien (ex. contact.html, https://…, tel:0600000000) :', current);
    if (value === null) return;
    link.setAttribute('href', value.trim());
    flash('✔ Lien modifié');
    saveLayout();
}

// ======================================================================
// Ajout de blocs
// ======================================================================

const k = () => newKey('u');

const BLOCKS = {
    text: { label: '📝 Texte', html: () => `<p data-content-key="${k()}">Nouveau texte — cliquez pour le modifier.</p>` },
    title: { label: '🔠 Titre', html: () => `<h2 class="section-title" data-content-key="${k()}">Nouveau titre</h2>` },
    image: { label: '🖼 Image', html: () => `<img src="${PLACEHOLDER_IMG}" alt="" class="user-image loaded" data-image-key="${k()}" loading="lazy">` },
    button: { label: '🔘 Bouton', html: () => `<a href="contact.html" class="btn btn-primary" data-content-key="${k()}">Nouveau bouton</a>` },
};

const SECTIONS = {
    textLight: {
        label: '📄 Section texte (claire)',
        html: () => `<section class="section-light"><div class="container"><div class="section-header"><span class="eyebrow" data-content-key="${k()}">Sous-titre</span><h2 class="section-title" data-content-key="${k()}">Titre de la section</h2></div><p data-content-key="${k()}">Écrivez ici votre texte. Cliquez dessus pour le modifier.</p></div></section>`,
    },
    textDark: {
        label: '📄 Section texte (douce)',
        html: () => `<section class="section-dark"><div class="container"><div class="section-header centered"><span class="eyebrow" data-content-key="${k()}">Sous-titre</span><h2 class="section-title" data-content-key="${k()}">Titre de la section</h2></div><p style="text-align:center;" data-content-key="${k()}">Écrivez ici votre texte. Cliquez dessus pour le modifier.</p></div></section>`,
    },
    imageText: {
        label: '🖼 Image + texte',
        html: () => `<div class="services-wrapper"><div class="service-block"><div class="service-img"><img src="${PLACEHOLDER_IMG}" alt="" class="loaded" data-image-key="${k()}" loading="lazy"></div><div class="service-body"><p class="service-label" data-content-key="${k()}">Sous-titre</p><h3 data-content-key="${k()}">Titre</h3><p data-content-key="${k()}">Décrivez ici votre soin ou votre activité.</p><a href="contact.html" class="service-link" data-content-key="${k()}">En savoir plus</a></div></div></div>`,
    },
    imageOnly: {
        label: '🖼 Image seule',
        html: () => `<section class="section-light"><div class="container" style="text-align:center;"><img src="${PLACEHOLDER_IMG}" alt="" class="user-image loaded" data-image-key="${k()}" loading="lazy"></div></section>`,
    },
    columns: {
        label: '▦ 3 colonnes',
        html: () => `<section class="section-dark"><div class="container"><div class="benefits-grid">${[1, 2, 3].map(n => `<div class="benefit"><div class="benefit-num" data-content-key="${k()}">0${n}</div><h3 data-content-key="${k()}">Titre ${n}</h3><p data-content-key="${k()}">Description de cette colonne.</p></div>`).join('')}</div></div></section>`,
    },
    quote: {
        label: '❝ Citation',
        html: () => `<section class="quote-section"><div class="pull-quote"><p data-content-key="${k()}">"Une belle citation ou un témoignage."</p><cite data-content-key="${k()}">— Nom</cite></div></section>`,
    },
    cta: {
        label: '📣 Appel à l\'action',
        html: () => `<section class="cta-section"><h2 data-content-key="${k()}">Prêt à vous offrir un moment d'évasion ?</h2><p data-content-key="${k()}">Prenez rendez-vous dès maintenant.</p><a href="contact.html" class="btn btn-accent" data-content-key="${k()}">Prendre rendez-vous</a></section>`,
    },
};

function toNodes(html) {
    const tpl = document.createElement('template');
    tpl.innerHTML = html.trim();
    return tpl.content.firstElementChild;
}

let menuEl = null;
function closeMenu() { if (menuEl) { menuEl.remove(); menuEl = null; } }

function showMenu(anchor, entries, title) {
    closeMenu();
    menuEl = document.createElement('div');
    menuEl.className = 'pb-menu';
    menuEl.setAttribute('data-admin-ui', '');
    const h = document.createElement('div');
    h.className = 'pb-menu-title';
    h.textContent = title;
    menuEl.appendChild(h);
    entries.forEach(({ label, run }) => {
        const b = btn(label, '', () => { closeMenu(); run(); }, 'pb-menu-item');
        menuEl.appendChild(b);
    });
    document.body.appendChild(menuEl);
    const r = anchor.getBoundingClientRect();
    const mw = menuEl.offsetWidth, mh = menuEl.offsetHeight;
    let top = r.bottom + 6;
    if (top + mh > window.innerHeight - 8) top = Math.max(8, r.top - mh - 6);
    menuEl.style.top = top + 'px';
    menuEl.style.left = Math.max(8, Math.min(r.left, window.innerWidth - mw - 8)) + 'px';
}

/** Menu « ajouter après le bloc » : éléments simples + sections complètes. */
function openAddMenu(anchor, ref) {
    const entries = [];
    Object.values(BLOCKS).forEach(b => entries.push({ label: b.label, run: () => insertAfter(ref, b.html()) }));
    Object.values(SECTIONS).forEach(s => entries.push({ label: s.label, run: () => insertSectionNear(ref, s.html()) }));
    showMenu(anchor, entries, 'Ajouter après ce bloc');
}

function wrapInSection(html) {
    return `<section class="section-light"><div class="container">${html}</div></section>`;
}

function insertAfter(ref, html) {
    let node;
    if (isRoot(ref)) {
        node = toNodes(wrapInSection(html));
    } else if (ref.tagName === 'LI') {
        const isText = html.includes('<p ');
        node = toNodes(isText ? html.replace('<p ', '<li ').replace('</p>', '</li>') : `<li>${html}</li>`);
    } else {
        node = toNodes(html);
    }
    ref.after(node);
    didInsert(node);
}

function insertSectionNear(ref, html) {
    // Une section complète se place au niveau des sections de la page
    let anchor = ref;
    while (anchor && !isRoot(anchor)) anchor = anchor.parentElement;
    const node = toNodes(html);
    (anchor || roots()[roots().length - 1]).after(node);
    didInsert(node);
}

function didInsert(node) {
    refreshEditing();
    select(isBlock(node) ? node : blockAt(node));
    node.scrollIntoView({ block: 'center', behavior: 'smooth' });
    saveLayout();
}

function openSectionMenu(anchor) {
    const entries = Object.values(SECTIONS).map(s => ({
        label: s.label,
        run: () => {
            const all = roots();
            const last = all[all.length - 1];
            const node = toNodes(s.html());
            if (last) last.after(node); else document.querySelector('footer.footer').before(node);
            didInsert(node);
        },
    }));
    showMenu(anchor, entries, 'Ajouter une section en bas de page');
}

// ======================================================================
// Gestion des pages
// ======================================================================

async function fetchConfig() {
    const { data, error } = await supabase.from('static_content').select('content').eq('key', CONFIG_KEY).maybeSingle();
    if (error) throw error;
    return parseConfig(data && data.content);
}

function uniqueSlug(base, config) {
    const taken = new Set([...config.custom.map(c => c.id), ...STATIC_PAGES.map(p => p.id)]);
    let slug = base, i = 2;
    while (taken.has(slug)) slug = `${base}-${i++}`;
    return slug;
}

function pageTitleNow() {
    const entry = (window.siteConfig && window.siteConfig.custom || []).find(c => 'c:' + c.id === currentPageId());
    if (entry) return entry.title;
    const h1 = document.querySelector('h1');
    return (h1 ? h1.textContent.replace(/\s+/g, ' ').trim() : document.title.split('|')[0].trim()) || 'Page';
}

function blankPageHtml(title) {
    return `<section class="page-banner"><img src="Gemini_Generated_Image_36tfxk36tfxk36tf.png" alt="" class="hero-background loaded" data-image-key="${k()}"><div class="hero-overlay"></div><div class="page-banner-content"><p class="page-banner-label" data-content-key="${k()}">Moments d'Évasion · Montamisé</p><h1 class="page-banner-title" data-content-key="${k()}">${title.replace(/[<>&]/g, '')}</h1><p class="page-banner-sub" data-content-key="${k()}">Sous-titre de la page</p></div></section>\n` +
        SECTIONS.textLight.html();
}

async function createPage(title, html) {
    const config = await fetchConfig();
    const slug = uniqueSlug(slugify(title), config);
    await saveContent(layoutKeyFor('c:' + slug), html);
    config.custom.push({ id: slug, title });
    await saveConfig(config);
    return slug;
}

async function duplicateCurrentPage() {
    if (isLayoutLocked()) { alert('Cette page contient un formulaire interne et ne peut pas être dupliquée.'); return; }
    const title = prompt('Nom de la nouvelle page :', `${pageTitleNow()} (copie)`);
    if (!title || !title.trim()) return;
    try {
        flash('Duplication…');
        const holder = document.createElement('div');
        holder.innerHTML = serializeContent();
        rekey(holder);
        const slug = await createPage(title.trim(), holder.innerHTML);
        location.href = pageUrl('c:' + slug);
    } catch (e) {
        console.error(e);
        alert('Impossible de créer la page : ' + e.message);
    }
}

async function createBlankPage() {
    const title = prompt('Nom de la nouvelle page :', 'Nouvelle page');
    if (!title || !title.trim()) return;
    try {
        flash('Création…');
        const slug = await createPage(title.trim(), blankPageHtml(title.trim()));
        location.href = pageUrl('c:' + slug);
    } catch (e) {
        console.error(e);
        alert('Impossible de créer la page : ' + e.message);
    }
}

let modal = null;

async function openPagesManager() {
    closeModal();
    modal = document.createElement('div');
    modal.className = 'pb-modal';
    modal.setAttribute('data-admin-ui', '');
    modal.innerHTML = '<div class="pb-modal-box"><p>Chargement…</p></div>';
    modal.addEventListener('mousedown', (e) => { if (e.target === modal) closeModal(); });
    document.body.appendChild(modal);
    try {
        const config = await fetchConfig();
        renderManager(config);
    } catch (e) {
        modal.firstChild.textContent = 'Erreur : ' + e.message;
    }
}

function closeModal() { if (modal) { modal.remove(); modal = null; } }

function renderManager(config) {
    const box = modal.querySelector('.pb-modal-box');
    box.innerHTML = '<div class="pb-modal-head"><h3>Pages du site</h3></div>';
    const close = btn('✕', 'Fermer', closeModal, 'pb-close');
    box.firstChild.appendChild(close);

    const persist = async () => {
        try { await saveConfig(config); window.siteConfig = config; flash('✔ Enregistré'); }
        catch (e) { alert('Erreur : ' + e.message); }
        renderManager(config);
    };

    const list = document.createElement('div');
    list.className = 'pb-pages';
    const entries = navEntries(config);
    const hiddenOnly = STATIC_PAGES.filter(p => p.hiddenFromNav).map(p => ({ id: p.id, title: p.title, custom: false, footerOnly: true }));
    const visibleOrder = entries.filter(e => e.id !== 'contact');

    [...entries, ...hiddenOnly].forEach(entry => {
        const hidden = config.hidden.includes(entry.id);
        const staticPage = STATIC_PAGES.find(p => p.id === entry.id);
        const row = document.createElement('div');
        row.className = 'pb-page-row' + (hidden ? ' is-hidden' : '') + (entry.id === currentPageId() ? ' is-current' : '');

        const name = document.createElement('input');
        name.type = 'text';
        name.value = entry.title;
        name.className = 'pb-page-name';
        name.disabled = !!entry.footerOnly;
        name.title = 'Nom affiché dans le menu';
        name.addEventListener('change', () => {
            const v = name.value.trim();
            if (!v) { name.value = entry.title; return; }
            if (entry.custom) config.custom.find(c => 'c:' + c.id === entry.id).title = v;
            else config.labels[entry.id] = v;
            persist();
        });
        row.appendChild(name);

        const tags = document.createElement('span');
        tags.className = 'pb-page-tags';
        tags.textContent = [entry.custom ? 'ajoutée' : '', hidden ? 'masquée' : '', entry.id === currentPageId() ? 'page actuelle' : ''].filter(Boolean).join(' · ');
        row.appendChild(tags);

        const actions = document.createElement('div');
        actions.className = 'pb-page-actions';
        const idx = visibleOrder.findIndex(e => e.id === entry.id);
        if (idx !== -1 && entry.id !== 'contact') {
            const reorder = (delta) => {
                const ids = visibleOrder.map(e => e.id);
                const j = idx + delta;
                if (j < 0 || j >= ids.length) return;
                [ids[idx], ids[j]] = [ids[j], ids[idx]];
                config.order = ids;
                persist();
            };
            actions.appendChild(btn('↑', 'Monter dans le menu', () => reorder(-1)));
            actions.appendChild(btn('↓', 'Descendre dans le menu', () => reorder(1)));
        }
        const href = entry.custom ? pageUrl(entry.id) : (staticPage ? staticPage.file : '#');
        const open = document.createElement('a');
        open.href = href; open.className = 'pb-btn'; open.textContent = '↗'; open.title = 'Ouvrir la page';
        actions.appendChild(open);

        const protectedPage = staticPage && staticPage.protected;
        if (hidden) {
            actions.appendChild(btn('Rétablir', 'Afficher à nouveau la page', () => { config.hidden = config.hidden.filter(i => i !== entry.id); persist(); }));
        } else if (protectedPage) {
            const lock = document.createElement('span');
            lock.className = 'pb-page-lock';
            lock.textContent = '🔒';
            lock.title = entry.id === 'index' ? 'La page d\'accueil ne peut pas être supprimée' : 'Page légale obligatoire';
            actions.appendChild(lock);
        } else {
            actions.appendChild(btn('🗑', entry.custom ? 'Supprimer la page' : 'Supprimer la page (masquée du site, rétablissable)', async () => {
                if (!confirm(`Supprimer la page « ${entry.title} » ?` + (entry.custom ? '' : '\n(Elle sera retirée du site et pourra être rétablie.)'))) return;
                if (entry.custom) {
                    config.custom = config.custom.filter(c => 'c:' + c.id !== entry.id);
                    config.order = config.order.filter(i => i !== entry.id);
                } else {
                    config.hidden.push(entry.id);
                }
                if (entry.id === currentPageId()) {
                    try { await saveConfig(config); } catch (e) { alert('Erreur : ' + e.message); return; }
                    location.href = 'index.html';
                    return;
                }
                persist();
            }, 'pb-danger'));
        }
        row.appendChild(actions);
        list.appendChild(row);
    });
    box.appendChild(list);

    const footer = document.createElement('div');
    footer.className = 'pb-modal-foot';
    const dup = btn('⧉ Dupliquer la page actuelle', 'Crée une copie de cette page', duplicateCurrentPage, 'pb-primary');
    if (isLayoutLocked()) { dup.disabled = true; dup.title = 'Cette page contient un formulaire interne'; }
    footer.appendChild(dup);
    footer.appendChild(btn('＋ Nouvelle page vierge', 'Crée une page vide', createBlankPage, 'pb-primary'));
    box.appendChild(footer);
}


// ======================================================================
// Onglets du menu : renommer / supprimer / ajouter (au survol, en mode édition)
// ======================================================================

function navPages() {
    return [...document.querySelectorAll('#navMenu > li')].filter(li =>
        !li.classList.contains('nav-login') && !li.classList.contains('user-menu-item') && !li.classList.contains('pb-nav-add'));
}

async function renameTab(id, li) {
    const link = li.querySelector('a.nav-link');
    const title = prompt('Nouveau nom de l\'onglet :', link.textContent.trim());
    if (title === null || !title.trim()) return;
    try {
        const config = await fetchConfig();
        const custom = config.custom.find(c => 'c:' + c.id === id);
        if (custom) custom.title = title.trim(); else config.labels[id] = title.trim();
        await saveConfig(config);
        window.siteConfig = config;
        link.textContent = title.trim();
        flash('✔ Onglet renommé');
    } catch (e) { alert('Erreur : ' + e.message); }
}

async function removeTab(id, li) {
    const link = li.querySelector('a.nav-link');
    const staticPage = STATIC_PAGES.find(p => p.id === id);
    if (staticPage && staticPage.protected) { alert('Cette page ne peut pas être supprimée.'); return; }
    if (!confirm(`Supprimer la page « ${link.textContent.trim()} » ?` + (isCustomId(id) ? '' : '\n(Elle sera retirée du site et pourra être rétablie depuis « Pages ».)'))) return;
    try {
        const config = await fetchConfig();
        if (isCustomId(id)) {
            config.custom = config.custom.filter(c => 'c:' + c.id !== id);
            config.order = config.order.filter(i => i !== id);
        } else if (!config.hidden.includes(id)) {
            config.hidden.push(id);
        }
        await saveConfig(config);
        if (id === currentPageId()) { location.href = 'index.html'; return; }
        li.remove();
        flash('✔ Page supprimée');
    } catch (e) { alert('Erreur : ' + e.message); }
}

function decorateNav() {
    const menu = document.getElementById('navMenu');
    if (!menu) return;
    navPages().forEach(li => {
        if (li.querySelector('.pb-nav-tools')) return;
        const a = li.querySelector('a.nav-link');
        const id = a && navIdFromHref(a.getAttribute('href'));
        if (!id) return;
        const tools = document.createElement('span');
        tools.className = 'pb-nav-tools';
        tools.setAttribute('data-admin-ui', '');
        tools.appendChild(btn('✏️ Renommer', 'Renommer cet onglet', () => renameTab(id, li)));
        const staticPage = STATIC_PAGES.find(p => p.id === id);
        if (!(staticPage && staticPage.protected)) tools.appendChild(btn('🗑', 'Supprimer cette page', () => removeTab(id, li), 'pb-danger'));
        li.appendChild(tools);
    });
    if (!menu.querySelector('.pb-nav-add')) {
        const li = document.createElement('li');
        li.className = 'pb-nav-add';
        li.setAttribute('data-admin-ui', '');
        li.appendChild(btn('＋ Page', 'Créer une nouvelle page', (e) => showMenu(e.currentTarget, [
            { label: '＋ Nouvelle page vierge', run: createBlankPage },
            { label: '⧉ Dupliquer la page actuelle', run: duplicateCurrentPage },
            { label: '📄 Gérer toutes les pages', run: openPagesManager },
        ], 'Pages du site'), 'pb-nav-add-btn'));
        menu.insertBefore(li, menu.querySelector('.nav-login') || null);
    }
}

function undecorateNav() {
    document.querySelectorAll('#navMenu .pb-nav-tools, #navMenu .pb-nav-add').forEach(n => n.remove());
}

// ======================================================================
// Démarrage / arrêt
// ======================================================================

function ensureUi() {
    if (toolbar) return;
    toolbar = document.createElement('div');
    toolbar.className = 'pb-toolbar';
    toolbar.setAttribute('data-admin-ui', '');
    toolbar.addEventListener('mouseenter', () => clearTimeout(hideTimer));
    highlight = document.createElement('div');
    highlight.className = 'pb-highlight';
    highlight.setAttribute('data-admin-ui', '');
    toast = document.createElement('div');
    toast.className = 'pb-toast';
    toast.setAttribute('data-admin-ui', '');
    panel = document.createElement('div');
    panel.className = 'pb-panel';
    panel.setAttribute('data-admin-ui', '');
    panel.appendChild(btn('📄 Pages', 'Ajouter, dupliquer, renommer ou supprimer des pages', openPagesManager));
    if (!isLayoutLocked()) {
        panel.appendChild(btn('➕ Section', 'Ajouter une section en bas de la page', (e) => openSectionMenu(e.currentTarget)));
    }
    document.body.append(highlight, toolbar, toast, panel);
}

const onScroll = () => { if (active && target) position(); };
const onDocClick = (e) => {
    if (menuEl && !e.target.closest('.pb-menu') && !e.target.closest('.pb-toolbar') && !e.target.closest('.pb-panel')) closeMenu();
};

export function start() {
    if (active) return;
    active = true;
    ensureUi();
    panel.style.display = 'flex';
    decorateNav();
    window.addEventListener('site-content-loaded', decorateNav);
    document.addEventListener('mouseover', onPointerOver);
    document.addEventListener('mouseout', onPointerLeave);
    document.addEventListener('mousedown', onDocClick);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    window.addEventListener('image-replaced', onScroll);
}

export function stop() {
    active = false;
    hideTools();
    closeMenu();
    closeModal();
    undecorateNav();
    window.removeEventListener('site-content-loaded', decorateNav);
    if (panel) panel.style.display = 'none';
    document.removeEventListener('mouseover', onPointerOver);
    document.removeEventListener('mouseout', onPointerLeave);
    document.removeEventListener('mousedown', onDocClick);
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onScroll);
    window.removeEventListener('image-replaced', onScroll);
}
