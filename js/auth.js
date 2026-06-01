import { supabase } from './config.js';

// Authentication Logic
async function initAuth() {
    if (!supabase) return;

    // Check current session
    const { data: { session } } = await supabase.auth.getSession();

    if (session) {
        checkUserRole(session.user);
    } else {
        document.body.classList.remove('is-admin');
    }

    // Listen for auth changes
    supabase.auth.onAuthStateChange(async (_event, session) => {
        if (session) {
            // For OAuth users, ensure profile exists
            if (_event === 'SIGNED_IN' || _event === 'INITIAL_SESSION') {
                await ensureProfileExists(session.user);
            }
            checkUserRole(session.user);
        } else {
            document.body.classList.remove('is-admin');
            removeUserMenu();
        }
    });
}

// Ensure profile exists for OAuth users
async function ensureProfileExists(user) {
    try {
        // Small delay to let session stabilize (OAuth issue workaround)
        await new Promise(resolve => setTimeout(resolve, 500));

        const { data: existingProfile, error: fetchError } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', user.id)
            .maybeSingle();

        // If fetch failed, log but don't crash - profile might exist or will be created by trigger
        if (fetchError) {
            console.warn('Profile check warning (non-critical):', fetchError.message);
            return;
        }

        if (!existingProfile) {
            // Create profile for OAuth user
            const { error } = await supabase
                .from('profiles')
                .insert({
                    id: user.id,
                    email: user.email,
                    full_name: user.user_metadata?.full_name || user.user_metadata?.name || 'Utilisateur',
                    role: 'client'
                });

            if (error) {
                console.error('Error creating OAuth profile:', error);
            } else {
                console.log('Profile created for OAuth user');
            }
        }
    } catch (error) {
        console.error('Error ensuring profile:', error);
        // Don't throw - let auth continue even if profile check fails
    }
}

async function checkUserRole(user) {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .maybeSingle();

        if (error) console.warn('Profile fetch warning:', error.message);

        // If no profile, assume regular user (or create one via trigger)
        // For security, only enable admin if explicitly set to 'admin'
        if (data && data.role === 'admin') {
            document.body.classList.add('is-admin');
            console.log('Admin mode enabled');
            window.dispatchEvent(new CustomEvent('admin-mode-enabled'));
        } else {
            document.body.classList.remove('is-admin');
        }

        createUserMenu(user);

    } catch (error) {
        console.error('Error checking user role:', error.message);
    }
}

function createUserMenu(user) {
    removeUserMenu();

    const navMenu = document.getElementById('navMenu');
    if (!navMenu) return;

    const isAdmin = document.body.classList.contains('is-admin');
    const initials = (user.email || '?').slice(0, 2).toUpperCase();

    const userLi = document.createElement('li');
    userLi.className = 'user-menu-item';

    userLi.innerHTML = `
        <button id="user-menu-btn" class="user-menu-btn" aria-haspopup="true" aria-expanded="false">
            <span class="user-avatar" aria-hidden="true">${initials}</span>
            <span class="user-menu-label">Mon espace</span>
            <span id="unread-badge" class="unread-dot" style="display:none;" aria-label="Messages non lus"></span>
            <svg class="user-chevron" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
        </button>

        <div class="user-dropdown" role="menu">
            <div class="user-dropdown-header">
                ${isAdmin ? '<span class="user-badge-admin">Admin</span>' : ''}
                <p class="user-dropdown-email">${user.email?.split('@')[0]}</p>
            </div>

            <a href="dashboard.html" class="user-dropdown-item" role="menuitem">
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                Mes messages
            </a>

            ${isAdmin ? `
            <a href="admin-dashboard.html" class="user-dropdown-item user-dropdown-item--admin" role="menuitem">
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z"/></svg>
                Tableau de bord
                <span id="admin-unread-count" class="admin-count" style="display:none;">0</span>
            </a>
            <button id="toggle-edit-btn" class="user-dropdown-item" role="menuitem">
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/></svg>
                Mode édition
            </button>
            ` : ''}

            <div class="user-dropdown-divider"></div>

            <button id="logout-btn" class="user-dropdown-item user-dropdown-item--danger" role="menuitem">
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                Se déconnecter
            </button>
        </div>
    `;

    // Insert before the Rendez-vous CTA (last item), not after
    const ctaItem = Array.from(navMenu.querySelectorAll('li')).find(li => li.querySelector('.nav-cta'));
    if (ctaItem) {
        navMenu.insertBefore(userLi, ctaItem);
    } else {
        navMenu.appendChild(userLi);
    }

    // Event Listeners
    const btn = userLi.querySelector('#user-menu-btn');
    const dropdown = userLi.querySelector('.user-dropdown');

    // Toggle Dropdown
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        const open = dropdown.classList.toggle('open');
        btn.setAttribute('aria-expanded', open);
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!userLi.contains(e.target)) {
            dropdown.classList.remove('open');
            btn.setAttribute('aria-expanded', 'false');
        }
    });

    // Check Unread Messages (Badge Logic)
    checkUnreadMessages(user, isAdmin);

    // Logout
    const logoutBtn = userLi.querySelector('#logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await supabase.auth.signOut();
            window.location.reload();
        });
    }

    // Toggle Edit Mode
    if (isAdmin) {
        const toggleBtn = userLi.querySelector('#toggle-edit-btn');
        if (toggleBtn) {
            let editModeActive = false;
            if (document.body.classList.contains('edit-mode')) {
                editModeActive = true;
                toggleBtn.textContent = '✏️ Mode Édition: ON';
            }

            toggleBtn.addEventListener('click', () => {
                editModeActive = !editModeActive;
                toggleBtn.textContent = editModeActive ? '✏️ Mode Édition: ON' : '✏️ Mode Édition: OFF';

                if (editModeActive) {
                    document.body.classList.add('edit-mode');
                    window.dispatchEvent(new CustomEvent('edit-mode-toggled', { detail: { active: true } }));
                } else {
                    document.body.classList.remove('edit-mode');
                    window.dispatchEvent(new CustomEvent('edit-mode-toggled', { detail: { active: false } }));
                }
            });
        }
    }

    // Hide static login link
    const loginLink = document.querySelector('.nav-login');
    if (loginLink) loginLink.style.display = 'none';
}

async function checkUnreadMessages(user, isAdmin) {
    if (!supabase) return;

    const countBadge = document.getElementById('admin-unread-count');
    const globalBadge = document.getElementById('unread-badge');
    const navBadge = document.getElementById('nav-unread-badge');

    // Function to fetch count
    const fetchCount = async () => {
        let count = 0;

        if (isAdmin) {
            // Count all unread messages sent by clients
            const { count: c, error } = await supabase
                .from('messages')
                .select('*', { count: 'exact', head: true })
                .eq('read', false)
                .eq('is_admin_reply', false); // Only messages FROM clients

            if (!error) count = c;
        } else {
            // Count unread replies for this user
            const { count: c, error } = await supabase
                .from('messages')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', user.id)
                .eq('is_admin_reply', true)
                .eq('read', false);

            if (!error) count = c;
        }

        if (count > 0) {
            if (globalBadge) globalBadge.style.display = 'block';
            if (countBadge) {
                countBadge.style.display = 'inline-block';
                countBadge.innerText = count;
            }
            if (navBadge) {
                navBadge.style.display = 'inline-block';
                navBadge.innerText = count;
            }
        } else {
            if (globalBadge) globalBadge.style.display = 'none';
            if (countBadge) countBadge.style.display = 'none';
            if (navBadge) navBadge.style.display = 'none';
        }
    };

    // Initial fetch
    fetchCount();

    // Subscribe to changes (INSERT and UPDATE)
    supabase
        .channel('badge-updates')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
            // Re-fetch on any change (new msg or read status change)
            fetchCount();
        })
        .subscribe();

    // Listen for manual read events from admin dashboard
    window.addEventListener('messages-read', () => {
        if (globalBadge) globalBadge.style.display = 'none';
        if (countBadge) { countBadge.innerText = '0'; countBadge.style.display = 'none'; }

        // Re-check after small delay to be safe
        setTimeout(fetchCount, 500);
    });
}

function removeUserMenu() {
    const existing = document.querySelector('.user-menu-item');
    if (existing) existing.remove();

    // Show static login link
    const loginLink = document.querySelector('.nav-login');
    if (loginLink) loginLink.style.display = 'block';
}

// Initialize
document.addEventListener('DOMContentLoaded', initAuth);
