import { supabase } from './config.js';
import {
    CONFIG_KEY, applyLayout, applyNav, currentPageId, isCustomId, isLayoutLocked,
    layoutKeyFor, parseConfig, saveContent, uploadImageFor,
} from './site.js';

// Export for auth.js
window.disableInlineEditing = null;

let builder = null; // module page-builder.js (chargé à la demande)
let editing = false;

// Wait for Admin Mode to be enabled AND edit mode toggle
window.addEventListener('admin-mode-enabled', () => {
    if (document.body.classList.contains('edit-mode')) startEditing();
});

window.addEventListener('edit-mode-toggled', (e) => {
    if (e.detail.active) startEditing();
    else stopEditing();
});

async function startEditing() {
    if (editing) return;
    editing = true;
    enableInlineEditing();
    try {
        builder = await import('./page-builder.js');
        if (editing) builder.start();
    } catch (err) {
        console.error('Page builder indisponible:', err);
    }
}

function stopEditing() {
    editing = false;
    disableInlineEditing();
    if (builder) builder.stop();
}

// ---------- Édition du texte ----------

const isEditMode = () => document.body.classList.contains('edit-mode');
const SINGLE_LINE_TAGS = new Set(['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'A', 'SPAN', 'CITE', 'LABEL', 'STRONG', 'EM', 'SMALL']);

function enableInlineEditing() {
    document.querySelectorAll('[data-content-key]').forEach(el => {
        el.setAttribute('contenteditable', 'true');
        el.setAttribute('spellcheck', 'false');
        el.classList.add('editable');
    });
}

function disableInlineEditing() {
    document.querySelectorAll('[contenteditable="true"]').forEach(el => {
        el.removeAttribute('contenteditable');
        el.classList.remove('editable');
    });
}

// Contenu injecté après coup (mise en page enregistrée) : le rendre éditable aussi
window.addEventListener('site-content-loaded', () => { if (editing) enableInlineEditing(); });

// Expose globally for auth.js
window.disableInlineEditing = disableInlineEditing;
// Le page builder appelle ceci après avoir ajouté des blocs
window.refreshInlineEditing = () => { if (editing) enableInlineEditing(); };

// Sauvegarde à la sortie du champ (délégué : fonctionne aussi pour les blocs ajoutés)
document.addEventListener('focusout', async (e) => {
    const el = e.target;
    if (!isEditMode() || !(el instanceof HTMLElement) || !el.matches('[data-content-key][contenteditable="true"]')) return;
    const key = el.getAttribute('data-content-key');
    const newContent = el.innerHTML.trim();
    try {
        await saveContent(key, newContent);
        el.style.outline = '2px solid green';
    } catch (error) {
        console.error('Error saving content:', error);
        alert('Erreur lors de la sauvegarde !');
        el.style.outline = '2px solid red';
    }
    setTimeout(() => { el.style.outline = ''; }, 1000);
});

document.addEventListener('keydown', (e) => {
    const el = e.target;
    if (!isEditMode() || !(el instanceof HTMLElement) || !el.matches('[data-content-key][contenteditable="true"]')) return;
    // Titres, boutons… : Entrée = saut de ligne simple plutôt qu'un nouveau bloc
    if (e.key === 'Enter' && !e.shiftKey && SINGLE_LINE_TAGS.has(el.tagName)) {
        e.preventDefault();
        document.execCommand('insertLineBreak');
    }
});

document.addEventListener('paste', (e) => {
    const el = e.target;
    if (!isEditMode() || !(el instanceof HTMLElement) || !el.matches('[data-content-key][contenteditable="true"]')) return;
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text/plain');
    document.execCommand('insertText', false, text);
});

// En mode édition, les liens des blocs éditables ne naviguent pas
document.addEventListener('click', (e) => {
    if (!isEditMode()) return;
    const a = e.target instanceof Element ? e.target.closest('a') : null;
    if (!a || a.closest('nav.navbar') || a.closest('[data-admin-ui]')) return;
    e.preventDefault();
}, true);

// ---------- Images ----------

let sharedInput = null;
let pendingTarget = null;

/** Ouvre le sélecteur de fichier pour remplacer l'image donnée. */
function pickImageFor(img) {
    if (!sharedInput) {
        sharedInput = document.createElement('input');
        sharedInput.type = 'file';
        sharedInput.accept = 'image/*';
        sharedInput.style.display = 'none';
        sharedInput.setAttribute('data-admin-ui', '');
        document.body.appendChild(sharedInput);
        sharedInput.addEventListener('change', async () => {
            const file = sharedInput.files[0];
            sharedInput.value = '';
            if (file && pendingTarget) {
                await uploadImageFor(file, pendingTarget.getAttribute('data-image-key'), pendingTarget);
                window.dispatchEvent(new CustomEvent('image-replaced', { detail: { img: pendingTarget } }));
            }
        });
    }
    pendingTarget = img;
    sharedInput.click();
}
window.pickImageFor = pickImageFor;

/** Image visée par un événement : l'image elle-même, ou le fond de la section survolée. */
function imageTarget(node) {
    if (!(node instanceof Element)) return null;
    const direct = node.closest('img[data-image-key]');
    if (direct) return direct;
    const section = node.closest('section');
    return section ? section.querySelector('.hero-background[data-image-key]') : null;
}

document.addEventListener('click', (e) => {
    if (!isEditMode() || !(e.target instanceof Element)) return;
    const img = e.target.closest('img[data-image-key]');
    if (!img || img.classList.contains('hero-background')) return;
    e.preventDefault();
    e.stopPropagation();
    pickImageFor(img);
}, true);

document.addEventListener('dragover', (e) => {
    if (!isEditMode()) return;
    const img = imageTarget(e.target);
    if (!img) return;
    e.preventDefault();
    img.classList.add('drag-over');
});

document.addEventListener('dragleave', (e) => {
    const img = imageTarget(e.target);
    if (img) img.classList.remove('drag-over');
});

document.addEventListener('drop', async (e) => {
    if (!isEditMode()) return;
    const img = imageTarget(e.target);
    if (!img) return;
    e.preventDefault();
    e.stopPropagation();
    document.querySelectorAll('.drag-over').forEach(n => n.classList.remove('drag-over'));
    const file = e.dataTransfer.files[0];
    if (!file || !file.type.startsWith('image/')) {
        alert('Veuillez déposer un fichier image');
        return;
    }
    await uploadImageFor(file, img.getAttribute('data-image-key'), img);
}, true);

// ---------- Chargement du contenu ----------

function revealImages(images) {
    images.forEach(img => img.classList.add('loaded'));
}

async function waitForAdmin(ms) {
    if (document.body.classList.contains('is-admin')) return true;
    await Promise.race([
        new Promise(resolve => window.addEventListener('admin-mode-enabled', resolve, { once: true })),
        new Promise(resolve => setTimeout(resolve, ms)),
    ]);
    return document.body.classList.contains('is-admin');
}

function showNotice(html) {
    const bar = document.createElement('div');
    bar.className = 'pb-notice';
    bar.setAttribute('data-admin-ui', '');
    bar.innerHTML = html;
    document.body.appendChild(bar);
}

async function loadDynamicContent() {
    if (!supabase) {
        revealImages(document.querySelectorAll('img[data-image-key]'));
        return;
    }

    const pageId = currentPageId();
    const custom = isCustomId(pageId);
    const layoutKey = layoutKeyFor(pageId);

    const [contentRes, layoutRes] = await Promise.all([
        supabase.from('static_content').select('key, content').not('key', 'like', '__layout__%'),
        (custom || !isLayoutLocked())
            ? supabase.from('static_content').select('content').eq('key', layoutKey).maybeSingle()
            : Promise.resolve({ data: null }),
    ]);

    if (contentRes.error) {
        console.warn('Error fetching content:', contentRes.error.message);
        revealImages(document.querySelectorAll('img[data-image-key]'));
        if (custom) showNotFound();
        return;
    }

    const rows = contentRes.data || [];
    const dataMap = new Map(rows.map(item => [item.key, item.content]));
    const config = parseConfig(dataMap.get(CONFIG_KEY));
    window.siteConfig = config;

    // Page masquée / inexistante : réservé à l'administrateur
    const pageGone = custom
        ? !config.custom.some(c => 'c:' + c.id === pageId)
        : config.hidden.includes(pageId);
    if (pageGone) {
        document.body.style.visibility = 'hidden';
        const admin = await waitForAdmin(2500);
        if (!admin) {
            if (custom) { document.body.style.visibility = ''; showNotFound(); }
            else location.replace('index.html');
            return;
        }
        document.body.style.visibility = '';
        showNotice(custom
            ? '⚠️ Cette page n\'existe pas ou a été supprimée.'
            : '👁 Cette page est <strong>masquée</strong> : visible uniquement par vous. Rétablissez-la depuis « Pages ».');
    }

    applyNav(config);

    const entry = custom ? config.custom.find(c => 'c:' + c.id === pageId) : null;
    if (entry) document.title = `${entry.title} | Moments d'Évasion`;

    const layoutHtml = layoutRes && layoutRes.data && layoutRes.data.content;
    if (layoutHtml) applyLayout(layoutHtml);
    const placeholder = document.getElementById('page-loading');
    if (placeholder) placeholder.remove();

    // Textes
    rows.forEach(item => {
        if (item.key.startsWith('__')) return;
        const textEl = document.querySelector(`[data-content-key="${item.key}"]`);
        if (textEl) textEl.innerHTML = typeof DOMPurify !== 'undefined'
            ? DOMPurify.sanitize(item.content)
            : item.content;
    });

    // Images — hero backgrounds en priorité haute
    document.querySelectorAll('img[data-image-key]').forEach(img => {
        const key = img.getAttribute('data-image-key');
        if (dataMap.has(key)) {
            if (img.classList.contains('hero-background')) {
                img.setAttribute('fetchpriority', 'high');
                img.setAttribute('loading', 'eager');
            } else {
                img.setAttribute('loading', 'lazy');
            }
            img.src = dataMap.get(key);
            img.onload = () => img.classList.add('loaded');
            if (img.complete) img.classList.add('loaded');
        } else {
            img.classList.add('loaded');
        }
    });

    window.dispatchEvent(new CustomEvent('site-content-loaded'));
}

function showNotFound() {
    const placeholder = document.getElementById('page-loading');
    if (placeholder) {
        placeholder.innerHTML = '<div class="container" style="padding:8rem 1rem; text-align:center;">' +
            '<h1>Page introuvable</h1><p><a href="index.html" class="btn btn-primary" style="margin-top:1.5rem;">Retour à l\'accueil</a></p></div>';
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', loadDynamicContent);
