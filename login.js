import { auth, db } from './firebase-config.js';
import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword,
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    doc, 
    setDoc, 
    getDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
            const userData = userDoc.data();
            if (userData.userType === 'admin') {
                window.location.href = 'adminportal.html';
            } else {
                window.location.href = 'clientportal.html';
            }
        }
    }
});

const loginFormElement = document.getElementById('loginFormElement');
const signupFormElement = document.getElementById('signupFormElement');
const showSignupBtn = document.getElementById('showSignup');
const showLoginBtn = document.getElementById('showLogin');
const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');

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
    btn.addEventListener('click', function() {
        const input = this.parentElement.querySelector('input');
        const icon = this.querySelector('i');
        
        if (input.type === 'password') {
            input.type = 'text';
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
        } else {
            input.type = 'password';
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
        }
    });
});

loginFormElement.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const loginBtn = document.getElementById('loginBtn');
    const btnText = loginBtn.querySelector('.btn-text');
    const btnLoader = loginBtn.querySelector('.btn-loader');
    const errorDiv = document.getElementById('loginError');

    btnText.style.display = 'none';
    btnLoader.style.display = 'flex';
    loginBtn.disabled = true;
    errorDiv.classList.remove('show');

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        
        if (!userDoc.exists()) {
            throw new Error('User profile not found. Please contact support.');
        }
        
        const userData = userDoc.data();
        
        if (userData.userType === 'admin') {
            window.location.href = 'adminportal.html';
        } else {
            window.location.href = 'clientportal.html';
        }

    } catch (error) {
        console.error('Login error:', error);
        let errorMessage = 'An error occurred. Please try again.';
        
        switch (error.code) {
            case 'auth/user-not-found':
            case 'auth/wrong-password':
                errorMessage = 'Invalid email or password.';
                break;
            case 'auth/invalid-email':
                errorMessage = 'Invalid email address format.';
                break;
            case 'auth/user-disabled':
                errorMessage = 'This account has been disabled.';
                break;
            case 'auth/too-many-requests':
                errorMessage = 'Too many failed attempts. Please try again later.';
                break;
            default:
                errorMessage = error.message;
        }
        
        errorDiv.textContent = errorMessage;
        errorDiv.classList.add('show');

        btnText.style.display = 'flex';
        btnLoader.style.display = 'none';
        loginBtn.disabled = false;
    }
});


signupFormElement.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('signupName').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const phone = document.getElementById('signupPhone').value.trim();
    const password = document.getElementById('signupPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const signupBtn = document.getElementById('signupBtn');
    const btnText = signupBtn.querySelector('.btn-text');
    const btnLoader = signupBtn.querySelector('.btn-loader');
    const errorDiv = document.getElementById('signupError');
    const successDiv = document.getElementById('signupSuccess');

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

    btnText.style.display = 'none';
    btnLoader.style.display = 'flex';
    signupBtn.disabled = true;
    errorDiv.classList.remove('show');
    successDiv.classList.remove('show');

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        await setDoc(doc(db, 'users', user.uid), {
            name: name,
            email: email,
            phone: phone,
            userType: 'client',
            createdAt: new Date().toISOString(),
            activeProjects: [],
            completedProjects: [],
            balance: 0,
            pendingCharges: 0,
            totalSpent: 0,
            notificationCount: 0
        });
        
        successDiv.textContent = 'Account created successfully! Redirecting to login...';
        successDiv.classList.add('show');
        
        setTimeout(() => {
            signupFormElement.reset();
            signupForm.classList.remove('active');
            loginForm.classList.add('active');
            successDiv.classList.remove('show');
        }, 2000);

    } catch (error) {
        console.error('Signup error:', error);
        let errorMessage = 'An error occurred. Please try again.';
        
        switch (error.code) {
            case 'auth/email-already-in-use':
                errorMessage = 'This email is already registered.';
                break;
            case 'auth/invalid-email':
                errorMessage = 'Invalid email address format.';
                break;
            case 'auth/weak-password':
                errorMessage = 'Password is too weak. Please use a stronger password.';
                break;
            default:
                errorMessage = error.message;
        }
        
        errorDiv.textContent = errorMessage;
        errorDiv.classList.add('show');
    } finally {
        btnText.style.display = 'flex';
        btnLoader.style.display = 'none';
        signupBtn.disabled = false;
    }
});

function clearErrors() {
    document.querySelectorAll('.error-message, .success-message').forEach(msg => {
        msg.classList.remove('show');
    });
}