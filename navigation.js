
(async function () {
   
    const { initializeApp, getApps } = await import(
        "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js"
    );
    const { getAuth, onAuthStateChanged, signOut } = await import(
        "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js"
    );
    const { getFirestore, doc, getDoc } = await import(
        "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js"
    );

    const firebaseConfig = {
        apiKey: "AIzaSyB49ShVVKQmef4w68JLa9p0_KZVMMEzEYg",
        authDomain: "academic-excellence-hub.firebaseapp.com",
        projectId: "academic-excellence-hub",
        storageBucket: "academic-excellence-hub.appspot.com",
        messagingSenderId: "967792268188",
        appId: "1:967792268188:web:7dfd9f4ab5757205ae2e59"
    };

    const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db   = getFirestore(app);

    await domReady();

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            let userData = { name: user.email, userType: 'client' };
            try {
                const snap = await getDoc(doc(db, 'users', user.uid));
                if (snap.exists()) userData = snap.data();
            } catch (_) { }

            updateNavForLoggedInUser(auth, user, userData);
        } else {
            updateNavForGuest();
        }
    });
    function domReady() {
        return new Promise(resolve => {
            if (document.readyState !== 'loading') resolve();
            else document.addEventListener('DOMContentLoaded', resolve);
        });
    }

    function updateNavForLoggedInUser(auth, user, userData) {
        const navActions = document.querySelector('.nav-actions');
        if (!navActions) return;

        const existing = navActions.querySelector('.login-btn, .user-menu');
        if (existing) existing.remove();

        const displayName = userData.name || user.email;
        const portalHref  = userData.userType === 'admin' ? 'adminportal.html' : 'clientportal.html';
        const portalLabel = userData.userType === 'admin' ? 'Admin Portal' : 'My Portal';

        const menu = document.createElement('div');
        menu.className = 'user-menu';
        menu.innerHTML = `
            <button class="user-menu-toggle" aria-haspopup="true" aria-expanded="false">
                <i class="fas fa-user-circle"></i>
                <span class="user-menu-name">${escapeHtml(displayName.split(' ')[0])}</span>
                <i class="fas fa-chevron-down user-menu-chevron"></i>
            </button>
            <div class="user-menu-dropdown" role="menu">
                <div class="user-menu-header">
                    <span class="user-menu-fullname">${escapeHtml(displayName)}</span>
                    <span class="user-menu-role">${userData.userType === 'admin' ? '⭐ Admin' : '🎓 Student'}</span>
                </div>
                <hr class="user-menu-divider">
                <a href="${portalHref}" class="user-menu-item" role="menuitem">
                    <i class="fas fa-th-large"></i> ${portalLabel}
                </a>
                <button class="user-menu-item user-menu-logout" id="nav-logout-btn" role="menuitem">
                    <i class="fas fa-sign-out-alt"></i> Sign Out
                </button>
            </div>
        `;

        injectUserMenuStyles();
        navActions.appendChild(menu);
        const toggle = menu.querySelector('.user-menu-toggle');
        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = menu.classList.toggle('open');
            toggle.setAttribute('aria-expanded', isOpen);
        });

        document.addEventListener('click', (e) => {
            if (!menu.contains(e.target)) {
                menu.classList.remove('open');
                toggle.setAttribute('aria-expanded', false);
            }
        });

        menu.querySelector('#nav-logout-btn').addEventListener('click', async () => {
            try {
                await signOut(auth);
                window.location.href = 'login.html';
            } catch (err) {
                console.error('Sign out error:', err);
            }
        });
    }

    function updateNavForGuest() {
        const navActions = document.querySelector('.nav-actions');
        if (!navActions) return;

        if (navActions.querySelector('.login-btn')) return;

        const userMenu = navActions.querySelector('.user-menu');
        if (userMenu) userMenu.remove();

        const loginBtn = document.createElement('a');
        loginBtn.href = 'login.html';
        loginBtn.className = 'login-btn';
        loginBtn.innerHTML = '<i class="fas fa-user"></i><span>Login</span>';
        navActions.appendChild(loginBtn);
    }

    function injectUserMenuStyles() {
        if (document.getElementById('user-menu-styles')) return;

        const style = document.createElement('style');
        style.id = 'user-menu-styles';
        style.textContent = `
            .user-menu { position: relative; }

            .user-menu-toggle {
                display: flex;
                align-items: center;
                gap: 6px;
                background: rgba(255,255,255,0.15);
                border: 1.5px solid rgba(255,255,255,0.4);
                color: #fff;
                padding: 8px 14px;
                border-radius: 25px;
                cursor: pointer;
                font-size: 0.9rem;
                font-weight: 500;
                transition: background 0.2s;
                font-family: inherit;
            }
            .user-menu-toggle:hover { background: rgba(255,255,255,0.25); }
            .user-menu-toggle .fa-user-circle { font-size: 1.1rem; }

            .user-menu-chevron {
                font-size: 0.75rem;
                transition: transform 0.2s;
            }
            .user-menu.open .user-menu-chevron { transform: rotate(180deg); }

            .user-menu-dropdown {
                display: none;
                position: absolute;
                top: calc(100% + 10px);
                right: 0;
                min-width: 200px;
                background: #fff;
                border-radius: 12px;
                box-shadow: 0 8px 30px rgba(0,0,0,0.15);
                overflow: hidden;
                z-index: 9999;
                animation: menuFadeIn 0.2s ease;
            }
            @keyframes menuFadeIn {
                from { opacity: 0; transform: translateY(-6px); }
                to   { opacity: 1; transform: translateY(0); }
            }
            .user-menu.open .user-menu-dropdown { display: block; }

            .user-menu-header {
                padding: 14px 16px 10px;
                display: flex;
                flex-direction: column;
                gap: 2px;
            }
            .user-menu-fullname {
                font-weight: 600;
                color: #222;
                font-size: 0.95rem;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .user-menu-role {
                font-size: 0.78rem;
                color: #0057A0;
                font-weight: 500;
            }
            .user-menu-divider {
                border: none;
                border-top: 1px solid #eee;
                margin: 0;
            }
            .user-menu-item {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 11px 16px;
                color: #333;
                text-decoration: none;
                font-size: 0.9rem;
                font-weight: 500;
                transition: background 0.15s;
                width: 100%;
                border: none;
                background: none;
                cursor: pointer;
                font-family: inherit;
                text-align: left;
            }
            .user-menu-item:hover { background: #f4f8ff; color: #0057A0; }
            .user-menu-logout { color: #c0392b; }
            .user-menu-logout:hover { background: #fff5f5; color: #c0392b; }
            .user-menu-item i { width: 16px; text-align: center; }
        `;
        document.head.appendChild(style);
    }

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
})();