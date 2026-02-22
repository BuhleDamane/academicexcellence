import { auth, db } from './firebase-config.js';
import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword,
    onAuthStateChanged,
    sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    doc, 
    setDoc, 
    getDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let isSigningUp = false;
let authReady = false;

onAuthStateChanged(auth, async (user) => {
    if (!authReady) {
        authReady = true; 
        if (user && !isSigningUp) {
            try {
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    window.location.href = userData.userType === 'admin'
                        ? 'adminportal.html'
                        : 'clientportal.html';
                }
            } catch (err) {
                console.error('Auth state error:', err);
            }
        }
    }
});

const loginFormElement  = document.getElementById('loginFormElement');
const signupFormElement = document.getElementById('signupFormElement');
const showSignupBtn     = document.getElementById('showSignup');
const showLoginBtn      = document.getElementById('showLogin');
const loginForm         = document.getElementById('loginForm');
const signupForm        = document.getElementById('signupForm');

showSignupBtn.addEventListener('click', (e) => {
    e.preventDefault();
    loginForm.classList.remove('active');
    signupForm.classList.add('active');
    clearErrors();
});

showLoginBtn.addEventListener('click', (e) => {
    e.preventDefault();
    signupForm.classList.remove('active');
    loginForm.classList.add('active');
    clearErrors();
});

document.querySelectorAll('.toggle-password').forEach(btn => {
    btn.addEventListener('click', function () {
        const input = this.parentElement.querySelector('input');
        const icon  = this.querySelector('i');
        if (input.type === 'password') {
            input.type = 'text';
            icon.classList.replace('fa-eye', 'fa-eye-slash');
        } else {
            input.type = 'password';
            icon.classList.replace('fa-eye-slash', 'fa-eye');
        }
    });
});

loginFormElement.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email     = document.getElementById('loginEmail').value.trim();
    const password  = document.getElementById('loginPassword').value;
    const loginBtn  = document.getElementById('loginBtn');
    const btnText   = loginBtn.querySelector('.btn-text');
    const btnLoader = loginBtn.querySelector('.btn-loader');
    const errorDiv  = document.getElementById('loginError');

    setLoading(loginBtn, btnText, btnLoader, true);
    errorDiv.classList.remove('show');

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));

        if (!userDoc.exists()) {
            throw new Error('User profile not found. Please contact support.');
        }

        const userData = userDoc.data();
        window.location.href = userData.userType === 'admin'
            ? 'adminportal.html'
            : 'clientportal.html';

    } catch (error) {
        console.error('Login error:', error);
        errorDiv.textContent = friendlyAuthError(error);
        errorDiv.classList.add('show');
        setLoading(loginBtn, btnText, btnLoader, false);
    }
});

const forgotPasswordLink = document.querySelector('.forgot-password');
if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener('click', async (e) => {
        e.preventDefault();

        const email    = document.getElementById('loginEmail').value.trim();
        const errorDiv = document.getElementById('loginError');

        if (!email) {
            errorDiv.textContent = 'Enter your email address above first, then click "Forgot password?".';
            errorDiv.classList.add('show');
            document.getElementById('loginEmail').focus();
            return;
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            errorDiv.textContent = 'Please enter a valid email address.';
            errorDiv.classList.add('show');
            return;
        }

        const originalText = forgotPasswordLink.innerHTML;
        forgotPasswordLink.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
        forgotPasswordLink.style.pointerEvents = 'none';
        errorDiv.classList.remove('show');

        try {
            await sendPasswordResetEmail(auth, email);

            errorDiv.style.cssText = 'background:#d4edda;border-color:#c3e6cb;color:#155724;display:block;';
            errorDiv.textContent = `✅ Reset email sent to ${email}. Check your inbox and spam folder.`;
            errorDiv.classList.add('show');

            setTimeout(() => {
                errorDiv.classList.remove('show');
                errorDiv.removeAttribute('style');
            }, 6000);

        } catch (error) {
            errorDiv.removeAttribute('style');
            errorDiv.textContent = error.code === 'auth/user-not-found'
                ? 'No account found with that email address.'
                : error.code === 'auth/too-many-requests'
                ? 'Too many requests. Please wait and try again.'
                : 'Failed to send reset email. Please try again.';
            errorDiv.classList.add('show');
        } finally {
            forgotPasswordLink.innerHTML = originalText;
            forgotPasswordLink.style.pointerEvents = '';
        }
    });
}

signupFormElement.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name            = document.getElementById('signupName').value.trim();
    const email           = document.getElementById('signupEmail').value.trim();
    const phone           = document.getElementById('signupPhone').value.trim();
    const password        = document.getElementById('signupPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const signupBtn       = document.getElementById('signupBtn');
    const btnText         = signupBtn.querySelector('.btn-text');
    const btnLoader       = signupBtn.querySelector('.btn-loader');
    const errorDiv        = document.getElementById('signupError');
    const successDiv      = document.getElementById('signupSuccess');

    errorDiv.classList.remove('show');
    successDiv.classList.remove('show');

    if (password !== confirmPassword) {
        errorDiv.textContent = 'Passwords do not match!';
        errorDiv.classList.add('show');
        return;
    }

    if (password.length < 6) {
        errorDiv.textContent = 'Password must be at least 6 characters long.';
        errorDiv.classList.add('show');
        return;
    }

    isSigningUp = true;
    setLoading(signupBtn, btnText, btnLoader, true);

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        await setDoc(doc(db, 'users', user.uid), {
            name,
            email,
            phone,
            userType: 'client',
            createdAt: new Date().toISOString(),
            activeProjects: [],
            completedProjects: [],
            balance: 0,
            pendingCharges: 0,
            totalSpent: 0,
            notificationCount: 0
        });

        successDiv.textContent = '✅ Account created! Please sign in with your new credentials.';
        successDiv.classList.add('show');

        setTimeout(() => {
            isSigningUp = false;
            signupFormElement.reset();
            signupForm.classList.remove('active');
            loginForm.classList.add('active');
            successDiv.classList.remove('show');
            clearErrors();

            document.getElementById('loginEmail').value = email;
        }, 2000);

    } catch (error) {
        console.error('Signup error:', error);
        isSigningUp = false;
        errorDiv.textContent = friendlyAuthError(error);
        errorDiv.classList.add('show');
        setLoading(signupBtn, btnText, btnLoader, false);
    }
});

function setLoading(btn, btnText, btnLoader, isLoading) {
    btn.disabled            = isLoading;
    btnText.style.display   = isLoading ? 'none' : 'flex';
    btnLoader.style.display = isLoading ? 'flex' : 'none';
}

function friendlyAuthError(error) {
    switch (error.code) {
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
            return 'Invalid email or password.';
        case 'auth/invalid-email':
            return 'Invalid email address format.';
        case 'auth/user-disabled':
            return 'This account has been disabled. Please contact support.';
        case 'auth/too-many-requests':
            return 'Too many failed attempts. Please try again later.';
        case 'auth/email-already-in-use':
            return 'This email is already registered. Try signing in instead.';
        case 'auth/weak-password':
            return 'Password is too weak. Please use a stronger password.';
        case 'auth/network-request-failed':
            return 'Network error. Please check your connection and try again.';
        default:
            return error.message || 'An unexpected error occurred. Please try again.';
    }
}

function clearErrors() {
    document.querySelectorAll('.error-message, .success-message').forEach(msg => {
        msg.classList.remove('show');
        msg.removeAttribute('style');
    });
}