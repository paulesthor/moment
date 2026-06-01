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

    // Target the navbar menu
    const navMenu = document.getElementById('navMenu');
    if (!navMenu) return;

    const isAdmin = document.body.classList.contains('is-admin');
    const userLi = document.createElement('li');
    userLi.className = 'nav-item user-menu-item';
    userLi.style.position = 'relative';

    // Button HTML
    userLi.innerHTML = `
        <a href="#" class="nav-link nav-cta" id="user-menu-btn" style="display: flex; align-items: center; gap: 0.5rem; background: var(--color-primary); color: white; border: 1px solid var(--color-primary); padding: 8px 16px; border-radius: 30px; font-weight: 500; transition: all 0.3s; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <span>👤</span>
            <span style="font-size: 0.9em;">Mon Espace</span>
            <span id="unread-badge" style="display: none; width: 10px; height: 10px; background: #e74c3c; border: 2px solid white; border-radius: 50%; position: absolute; top: 0; right: 0;"></span>
        </a>
        <div class="user-dropdown" style="display: none; position: absolute; right: 0; top: 120%; background: white; padding: 1rem; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); min-width: 220px; z-index: 1000; text-align: left; border: 1px solid #eee;">
            <div style="padding: 0 0.5rem 0.5rem; margin-bottom: 0.5rem; border-bottom: 1px solid #eee; font-size: 0.85rem; color: #666;">
                Connecté en tant que <br><strong>${user.email?.split('@')[0]}</strong>
            </div>
            ${isAdmin ? '<div style="margin-bottom: 0.5rem;"><span style="background: var(--color-accent); color: white; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.8em; display:inline-block;">Admin</span></div>' : ''}
            
            <a href="dashboard.html" style="display: flex; align-items: center; gap: 8px; width: 100%; text-align: left; padding: 0.8rem 0.5rem; margin-bottom: 0.2rem; color: var(--color-text-primary); text-decoration: none; transition: background 0.2s; border-radius: 5px;" onmouseover="this.style.background='#f9f9f9'" onmouseout="this.style.background='transparent'">
                <span>💬</span> Mes Messages
            </a>

            ${isAdmin ? `
            <a href="admin-dashboard.html" style="display: flex; align-items: center; gap: 8px; width: 100%; text-align: left; padding: 0.8rem 0.5rem; margin-bottom: 0.2rem; color: var(--color-primary-dark); font-weight: 600; text-decoration: none; position: relative; border-radius: 5px;" onmouseover="this.style.background='#f9f9f9'" onmouseout="this.style.background='transparent'">
                <span>⚡</span> Admin
                <span id="admin-unread-count" style="display: none; background: #e74c3c; color: white; border-radius: 10px; padding: 1px 6px; font-size: 0.7em; margin-left: auto;">0</span>
            </a>
            <button id="toggle-edit-btn" style="display: flex; align-items: center; gap: 8px; width: 100%; text-align: left; padding: 0.8rem 0.5rem; margin-bottom: 0.2rem; background: none; border: none; cursor: pointer; color: var(--color-primary-dark); font-family: inherit; border-radius: 5px;" onmouseover="this.style.background='#f9f9f9'" onmouseout="this.style.background='transparent'">
                <span>✏️</span> Mode Édition
            </button>
            ` : ''}
            
            <hr style="border: 0; border-top: 1px solid #eee; margin: 0.5rem 0;">
            
            <button id="logout-btn" style="display: block; width: 100%; text-align: left; padding: 0.5rem; background: none; border: none; cursor: pointer; color: #e74c3c; font-family: inherit;">
                Se Déconnecter
            </button>
        </div>
    `;

    navMenu.appendChild(userLi);

    // Event Listeners
    const btn = userLi.querySelector('#user-menu-btn');
    const dropdown = userLi.querySelector('.user-dropdown');

    // Toggle Dropdown
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
        // Hide global badge when opening menu (optional, or keep it)
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!userLi.contains(e.target)) {
            dropdown.style.display = 'none';
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
