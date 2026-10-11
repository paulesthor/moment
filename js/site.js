// Noyau partagé : identification de la page, configuration du site (pages
// personnalisées, navigation), mise en page enregistrée, sauvegarde de contenu.
import { supabase } from './config.js';
import { compressImage } from './image-utils.js';

export const CONFIG_KEY = '__site_pages';

// Pages "fichier" du site. `locked` = mise en page non modifiable (scripts internes),
// `protected` = ne peut pas être supprimée.
export const STATIC_PAGES = [
    { id: 'index', file: 'index.html', title: 'Accueil', protected: true },
    { id: 'massage-ayurvedique', file: 'massage-ayurvedique.html', title: 'Ayurvédique' },
    { id: 'amma-assis', file: 'amma-assis.html', title: 'Amma Assis' },
    { id: 'massage-prenatal', file: 'massage-prenatal.html', title: 'Prénatal' },
    { id: 'magnetisme-reiki', file: 'magnetisme-reiki.html', title: 'Magnétisme' },
    { id: 'tarifs', file: 'tarifs.html', title: 'Tarifs' },
    { id: 'a-propos', file: 'a-propos.html', title: 'À Propos' },
    { id: 'temoignages', file: 'temoignages.html', title: 'Témoignages' },
    { id: 'contact', file: 'contact.html', title: 'Rendez-vous' },
    { id: 'mentions-legales', file: 'mentions-legales.html', title: 'Mentions légales', protected: true, hiddenFromNav: true },
    { id: 'confidentialite', file: 'confidentialite.html', title: 'Confidentialité', protected: true, hiddenFromNav: true },
];

export const DEFAULT_CONFIG = { custom: [], hidden: [], labels: {}, order: [] };

// ---------- Identification de la page ----------

export function currentPageId() {
    const file = location.pathname.split('/').pop() || 'index.html';
    if (file === 'page.html') {
        return 'c:' + (new URLSearchParams(location.search).get('p') || '');
    }
    return file.replace(/\.html$/, '') || 'index';
}

export const isCustomId = (id) => id.startsWith('c:');
export const layoutKeyFor = (id) => '__layout__' + id.replace(':', '_');
export const pageUrl = (id) => isCustomId(id) ? `page.html?p=${encodeURIComponent(id.slice(2))}` : `${id}.html`;

export function isLayoutLocked() {
    return document.body.dataset.layout === 'locked';
}

// ---------- Zone de contenu (entre la navigation et le pied de page) ----------

export function getContentNodes() {
    const nav = document.querySelector('nav.navbar');
    const footer = document.querySelector('footer.footer');
    const nodes = [];
    if (!nav || !footer) return nodes;
    let el = nav.nextElementSibling;
    while (el && el !== footer) {
        const skip = ['SCRIPT', 'STYLE', 'LINK', 'TEMPLATE'].includes(el.tagName) || el.hasAttribute('data-admin-ui');
        if (!skip) nodes.push(el);
        el = el.nextElementSibling;
    }
    return nodes;
}

const ADMIN_STATE_CLASSES = ['editable', 'drag-over', 'pb-selected'];

function cleanClone(root) {
    root.querySelectorAll('[data-admin-ui], .admin-file-input').forEach(n => n.remove());
    [root, ...root.querySelectorAll('*')].forEach(n => {
        n.removeAttribute('contenteditable');
        n.removeAttribute('spellcheck');
        ADMIN_STATE_CLASSES.forEach(c => n.classList.remove(c));
        if (n.classList.contains('reveal')) n.classList.remove('active');
        if (n.getAttribute('class') === '') n.removeAttribute('class');
        if (n.getAttribute('style') === '') n.removeAttribute('style');
    });
    return root;
}

/** HTML propre (sans traces du mode édition) de toute la zone de contenu. */
export function serializeContent() {
    return getContentNodes().map(n => cleanClone(n.cloneNode(true)).outerHTML).join('\n');
}

export function sanitizeFragment(html) {
    const tpl = document.createElement('template');
    tpl.innerHTML = html;
    tpl.content.querySelectorAll('script, iframe, object, embed').forEach(n => n.remove());
    tpl.content.querySelectorAll('*').forEach(n => {
        [...n.attributes].forEach(a => {
            if (/^on/i.test(a.name) || (/^(href|src)$/i.test(a.name) && /^\s*javascript:/i.test(a.value))) {
                n.removeAttribute(a.name);
            }
        });
    });
    return tpl.content;
}

/** Remplace la zone de contenu par une mise en page enregistrée. */
export function applyLayout(html) {
    const footer = document.querySelector('footer.footer');
    if (!footer) return;
    const fragment = sanitizeFragment(html);
    getContentNodes().forEach(n => n.remove());
    footer.parentNode.insertBefore(fragment, footer);
    // script.js n'observe que les éléments présents au chargement : on révèle directement
    getContentNodes().forEach(n => {
        if (n.classList.contains('reveal')) n.classList.add('active');
        n.querySelectorAll('.reveal').forEach(r => r.classList.add('active'));
    });
}

// ---------- Clés uniques (duplication) ----------

export function randomId(len = 5) {
    return Math.random().toString(36).slice(2, 2 + len).padEnd(len, '0');
}

/** Donne de nouvelles clés (contenu + images) à tout l'arbre fourni (élément ou fragment). */
export function rekey(root) {
    const suffix = randomId();
    const items = [];
    if (root.matches && root.matches('[data-content-key],[data-image-key]')) items.push(root);
    root.querySelectorAll('[data-content-key],[data-image-key]').forEach(n => items.push(n));
    items.forEach(n => {
        ['data-content-key', 'data-image-key'].forEach(attr => {
            const v = n.getAttribute(attr);
            if (v) n.setAttribute(attr, v.replace(/__[a-z0-9]{5}$/, '') + '__' + suffix);
        });
    });
    return root;
}

export const newKey = (prefix = 'u') => `${prefix}_${randomId(8)}`;

// ---------- Sauvegarde ----------

export async function saveContent(key, content) {
    if (!supabase) throw new Error('Supabase indisponible');
    const { error } = await supabase.from('static_content').upsert({ key, content });
    if (error) throw error;
}

export async function uploadImageFor(file, imageKey, imgElement) {
    const originalOpacity = imgElement.style.opacity;
    try {
        imgElement.style.opacity = '0.5';
        const blob = await compressImage(file);
        const fileName = `${imageKey}_${Date.now()}.webp`;
        const { error: uploadError } = await supabase.storage.from('images').upload(fileName, blob);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('images').getPublicUrl(fileName);
        await saveContent(imageKey, publicUrl);
        imgElement.src = publicUrl;
        imgElement.classList.add('loaded');
    } catch (error) {
        console.error('Error uploading image:', error);
        alert('Erreur upload image: ' + error.message);
    } finally {
        imgElement.style.opacity = originalOpacity;
    }
}

// ---------- Configuration du site (pages, navigation) ----------

export function parseConfig(raw) {
    try {
        const c = raw ? JSON.parse(raw) : {};
        return {
            custom: Array.isArray(c.custom) ? c.custom : [],
            hidden: Array.isArray(c.hidden) ? c.hidden : [],
            labels: c.labels && typeof c.labels === 'object' ? c.labels : {},
            order: Array.isArray(c.order) ? c.order : [],
        };
    } catch {
        return { ...DEFAULT_CONFIG, custom: [], hidden: [], labels: {}, order: [] };
    }
}

export const saveConfig = (config) => saveContent(CONFIG_KEY, JSON.stringify(config));

function navIdFromHref(href) {
    if (!href) return null;
    const m = href.match(/^page\.html\?p=(.+)$/);
    if (m) return 'c:' + decodeURIComponent(m[1]);
    const file = href.split('#')[0];
    const page = STATIC_PAGES.find(p => p.file === file);
    return page ? page.id : null;
}

/** Liste ordonnée des pages affichées dans le menu (statiques + personnalisées). */
export function navEntries(config) {
    const entries = [];
    STATIC_PAGES.filter(p => !p.hiddenFromNav).forEach(p => entries.push({ id: p.id, title: p.title, custom: false }));
    config.custom.forEach(c => entries.push({ id: 'c:' + c.id, title: c.title, custom: true }));
    entries.forEach(e => { if (config.labels[e.id]) e.title = config.labels[e.id]; });
    const cta = entries.filter(e => e.id === 'contact');
    const rest = entries.filter(e => e.id !== 'contact');
    if (config.order.length) {
        const rank = (id) => { const i = config.order.indexOf(id); return i === -1 ? 1e6 : i; };
        rest.sort((a, b) => rank(a.id) - rank(b.id));
    }
    return [...rest, ...cta];
}

/** Applique libellés, pages masquées, pages ajoutées et ordre au menu et au pied de page. */
export function applyNav(config) {
    const menu = document.getElementById('navMenu');
    if (menu) {
        const lis = [...menu.querySelectorAll(':scope > li')]
            .filter(li => !li.classList.contains('nav-login') && !li.classList.contains('user-menu-item'));
        const byId = new Map();
        lis.forEach(li => {
            const a = li.querySelector('a');
            const id = a && navIdFromHref(a.getAttribute('href'));
            if (id) byId.set(id, li);
        });
        config.custom.forEach(c => {
            const id = 'c:' + c.id;
            if (byId.has(id)) return;
            const li = document.createElement('li');
            li.innerHTML = '<a class="nav-link"></a>';
            li.firstChild.setAttribute('href', pageUrl(id));
            byId.set(id, li);
        });
        const anchor = menu.querySelector('.nav-login') || null;
        navEntries(config).forEach(entry => {
            const li = byId.get(entry.id);
            if (!li) return;
            if (config.hidden.includes(entry.id)) { li.remove(); return; }
            li.querySelector('a').textContent = entry.title;
            menu.insertBefore(li, anchor);
        });
        markActiveNav();
        window.addEventListener('load', markActiveNav);
    }
    document.querySelectorAll('.footer-links li').forEach(li => {
        const a = li.querySelector('a');
        const id = a && navIdFromHref(a.getAttribute('href'));
        if (id && config.hidden.includes(id)) li.remove();
    });
}

function markActiveNav() {
    const id = currentPageId();
    document.querySelectorAll('#navMenu .nav-link').forEach(a => {
        a.classList.toggle('active', navIdFromHref(a.getAttribute('href')) === id);
    });
}

export function slugify(text) {
    return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'page';
}
