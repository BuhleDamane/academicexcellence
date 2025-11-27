import { auth, db, storage } from './firebase-config.js';
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    doc, 
    getDoc, 
    updateDoc, 
    collection, 
    query, 
    where, 
    orderBy, 
    onSnapshot,
    addDoc,
    serverTimestamp,
    getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { 
    ref, 
    uploadBytesResumable, 
    getDownloadURL,
    listAll,
    deleteObject
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

let currentUser = null;
let currentDate = new Date();
let chatUnsubscribe = null;

onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
            const userData = userDoc.data();
            if (userData.userType === 'client') {
                currentUser = { uid: user.uid, ...userData };
                initializePortal();
            } else {
                window.location.href = 'adminportal.html';
            }
        }
    } else {
        window.location.href = 'login.html';
    }
});

function initializePortal() {
    document.getElementById('welcomeMessage').textContent = `Welcome, ${currentUser.name}!`;
    
    initializeSidebar();
    loadDashboardData();
    loadProjects();
    generateCalendar(currentDate);
    initializeChat();
    loadPaymentData();
    loadDocuments();
    initializeEventListeners();
}

function initializeSidebar() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
            document.querySelectorAll('.content-section').forEach(section => section.classList.remove('active'));
            
            item.classList.add('active');
            const sectionId = item.getAttribute('data-section');
            document.getElementById(sectionId).classList.add('active');
        });
    });
}

async function loadDashboardData() {
    try {
        const userRef = doc(db, 'users', currentUser.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
            const data = userSnap.data();
            
            document.getElementById('activeProjectsCount').textContent = data.activeProjects?.length || 0;
            document.getElementById('completedTasks').textContent = data.completedProjects?.length || 0;
            document.getElementById('totalSpent').textContent = `R${data.totalSpent || 0}`;
            
            
            loadRecentActivity();
        }
    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

async function loadRecentActivity() {
    try {
        const activitiesRef = collection(db, 'activities');
        const q = query(
            activitiesRef, 
            where('userId', '==', currentUser.uid),
            orderBy('timestamp', 'desc'),
        );
        
        const querySnapshot = await getDocs(q);
        const activityList = document.getElementById('recentActivityList');
        
        if (querySnapshot.empty) {
            activityList.innerHTML = '<p class="no-activity">No recent activity</p>';
            return;
        }
        
        activityList.innerHTML = '';
        querySnapshot.forEach((doc) => {
            const activity = doc.data();
            const activityDiv = document.createElement('div');
            activityDiv.className = 'activity-item';
            
            const timeAgo = getTimeAgo(activity.timestamp?.toDate());
            activityDiv.innerHTML = `
                <span class="activity-time">${timeAgo}</span>
                <span class="activity-text">${activity.message}</span>
            `;
            activityList.appendChild(activityDiv);
        });
    } catch (error) {
        console.error('Error loading activity:', error);
    }
}

async function loadProjects() {
    try {
        const projectsRef = collection(db, 'projects');
        const q = query(projectsRef, where('clientId', '==', currentUser.uid));
        
        const querySnapshot = await getDocs(q);
        const progressContainer = document.getElementById('progressContainer');
        
        if (querySnapshot.empty) {
            progressContainer.innerHTML = '<p class="no-projects">No active projects yet</p>';
            return;
        }
        
        progressContainer.innerHTML = '';
        querySnapshot.forEach((doc) => {
            const project = doc.data();
            const projectDiv = document.createElement('div');
            projectDiv.className = 'project-progress';
            projectDiv.innerHTML = `
                <h3>${project.title}</h3>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${project.progress || 0}%"></div>
                </div>
                <span class="progress-text">${project.progress || 0}% Complete</span>
                <p class="progress-status">Status: ${project.status || 'Not Started'}</p>
                ${project.notes ? `<p class="progress-notes">${project.notes}</p>` : ''}
            `;
            progressContainer.appendChild(projectDiv);
        });
    } catch (error) {
        console.error('Error loading projects:', error);
    }
}

function generateCalendar(date) {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startingDayOfWeek = firstDay.getDay();
    const daysInMonth = lastDay.getDate();
    
    const monthNames = ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"];
    
    document.getElementById('currentMonth').textContent = `${monthNames[month]} ${year}`;
    
    const calendarGrid = document.getElementById('calendarGrid');
    calendarGrid.innerHTML = '';
    
    const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    dayHeaders.forEach(day => {
        const dayHeader = document.createElement('div');
        dayHeader.className = 'calendar-day-header';
        dayHeader.textContent = day;
        calendarGrid.appendChild(dayHeader);
    });
    
    for (let i = 0; i < startingDayOfWeek; i++) {
        const emptyDay = document.createElement('div');
        emptyDay.className = 'calendar-day empty';
        calendarGrid.appendChild(emptyDay);
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
        const dayElement = document.createElement('div');
        dayElement.className = 'calendar-day';
        dayElement.textContent = day;
        
        const today = new Date();
        if (year === today.getFullYear() && month === today.getMonth() && day === today.getDate()) {
            dayElement.classList.add('today');
        }
        
        calendarGrid.appendChild(dayElement);
    }
    
    loadCalendarEvents();
}

async function loadCalendarEvents() {
    try {
        const eventsRef = collection(db, 'events');
        const q = query(
            eventsRef, 
            where('clientId', '==', currentUser.uid),
            where('date', '>=', new Date().toISOString().split('T')[0])
        );
        
        const querySnapshot = await getDocs(q);
        const eventsContainer = document.getElementById('upcomingEvents');
        
        if (querySnapshot.empty) {
            eventsContainer.innerHTML = '<p class="no-events">No upcoming events</p>';
            return;
        }
        
        eventsContainer.innerHTML = '';
        querySnapshot.forEach((doc) => {
            const event = doc.data();
            const eventDiv = document.createElement('div');
            eventDiv.className = 'event-item';
            
            const eventDate = new Date(event.date);
            const formattedDate = eventDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            
            eventDiv.innerHTML = `
                <span class="event-date">${formattedDate}</span>
                <span class="event-text">${event.title}</span>
            `;
            eventsContainer.appendChild(eventDiv);
        });
    } catch (error) {
        console.error('Error loading events:', error);
    }
}

function initializeChat() {
    const chatRef = collection(db, 'chats');
    const q = query(
        chatRef,
        where('participants', 'array-contains', currentUser.uid),
        orderBy('timestamp', 'asc')
    );
    
    chatUnsubscribe = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
                const message = change.data();
                displayMessage(message);
            }
        });
    });
}

function displayMessage(message) {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    
    const isOwnMessage = message.senderId === currentUser.uid;
    messageDiv.className = `message ${isOwnMessage ? 'client-message' : 'tutor-message'}`;
    
    const timestamp = message.timestamp?.toDate();
    const timeString = timestamp ? timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '';
    
    messageDiv.innerHTML = `
        <div class="message-header">
            <strong>${isOwnMessage ? 'You' : 'Support Team'}</strong>
            <span class="message-time">${timeString}</span>
        </div>
        <div class="message-content">${escapeHtml(message.text)}</div>
        ${message.fileUrl ? `<div class="message-attachment">
            <a href="${message.fileUrl}" target="_blank">📎 ${message.fileName}</a>
        </div>` : ''}
    `;
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    const welcomeMsg = chatMessages.querySelector('.chat-welcome');
    if (welcomeMsg) welcomeMsg.remove();
}

async function sendMessage(text, fileUrl = null, fileName = null) {
    try {
        const chatRef = collection(db, 'chats');
        await addDoc(chatRef, {
            text: text,
            senderId: currentUser.uid,
            senderName: currentUser.name,
            receiverId: 'admin',
            participants: [currentUser.uid, 'admin'],
            timestamp: serverTimestamp(),
            fileUrl: fileUrl,
            fileName: fileName,
            read: false
        });
        
        updateNotificationCount('admin');
        
    } catch (error) {
        console.error('Error sending message:', error);
        alert('Failed to send message. Please try again.');
    }
}

async function uploadFile(file) {
    const storageRef = ref(storage, `chat-files/${currentUser.uid}/${Date.now()}_${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, file);
    
    return new Promise((resolve, reject) => {
        uploadTask.on('state_changed',
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                console.log('Upload is ' + progress + '% done');
            },
            (error) => {
                console.error('Upload error:', error);
                reject(error);
            },
            async () => {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                resolve(downloadURL);
            }
        );
    });
}

async function loadPaymentData() {
    try {
        const userRef = doc(db, 'users', currentUser.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
            const data = userSnap.data();
            const balance = data.balance || 0;
            const pending = data.pendingCharges || 0;
            
            document.getElementById('currentBalance').textContent = `R${balance.toFixed(2)}`;
            document.getElementById('pendingCharges').textContent = `R${pending.toFixed(2)}`;
            document.getElementById('totalDue').textContent = `R${(balance + pending).toFixed(2)}`;
        }
        
        const paymentsRef = collection(db, 'payments');
        const q = query(
            paymentsRef,
            where('userId', '==', currentUser.uid),
            orderBy('date', 'desc')
        );
        
        const querySnapshot = await getDocs(q);
        const historyList = document.getElementById('paymentHistoryList');
        
        if (querySnapshot.empty) {
            historyList.innerHTML = '<p class="no-payments">No payment history</p>';
            return;
        }
        
        historyList.innerHTML = '';
        querySnapshot.forEach((doc) => {
            const payment = doc.data();
            const paymentDiv = document.createElement('div');
            paymentDiv.className = 'payment-item';
            
            const paymentDate = new Date(payment.date);
            const formattedDate = paymentDate.toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });
            
            paymentDiv.innerHTML = `
                <span class="payment-date">${formattedDate}</span>
                <span class="payment-desc">${payment.description}</span>
                <span class="payment-amount">R${payment.amount.toFixed(2)}</span>
            `;
            historyList.appendChild(paymentDiv);
        });
    } catch (error) {
        console.error('Error loading payment data:', error);
    }
}

async function loadDocuments() {
    try {
        const documentsRef = ref(storage, `documents/${currentUser.uid}/`);
        const documentsList = await listAll(documentsRef);
        
        const docsContainer = document.getElementById('documentsList');
        
        if (documentsList.items.length === 0) {
            docsContainer.innerHTML = '<p class="no-documents">No documents uploaded yet</p>';
            return;
        }
        
        docsContainer.innerHTML = '';
        
        for (const itemRef of documentsList.items) {
            const url = await getDownloadURL(itemRef);
            const metadata = await itemRef.getMetadata();
            
            const docDiv = document.createElement('div');
            docDiv.className = 'document-item';
            
            const uploadDate = new Date(metadata.timeCreated);
            const formattedDate = uploadDate.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric',
                year: 'numeric'
            });
            
            docDiv.innerHTML = `
                <span class="doc-icon">📄</span>
                <span class="doc-name">${itemRef.name}</span>
                <span class="doc-date">${formattedDate}</span>
                <button class="doc-action" onclick="downloadDocument('${url}', '${itemRef.name}')">Download</button>
                <button class="doc-action delete" onclick="deleteDocument('${itemRef.fullPath}')">Delete</button>
            `;
            docsContainer.appendChild(docDiv);
        }
    } catch (error) {
        console.error('Error loading documents:', error);
    }
}

async function uploadDocument(file) {
    const uploadProgress = document.getElementById('uploadProgress');
    const progressBar = document.getElementById('uploadProgressBar');
    const uploadStatus = document.getElementById('uploadStatus');
    
    uploadProgress.style.display = 'block';
    
    const storageRef = ref(storage, `documents/${currentUser.uid}/${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, file);
    
    uploadTask.on('state_changed',
        (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            progressBar.style.width = progress + '%';
            uploadStatus.textContent = `Uploading: ${Math.round(progress)}%`;
        },
        (error) => {
            console.error('Upload error:', error);
            alert('Upload failed. Please try again.');
            uploadProgress.style.display = 'none';
        },
        async () => {
            uploadStatus.textContent = 'Upload complete!';
            setTimeout(() => {
                uploadProgress.style.display = 'none';
                progressBar.style.width = '0%';
            }, 2000);
            
            await addDoc(collection(db, 'activities'), {
                userId: currentUser.uid,
                message: `Uploaded document: ${file.name}`,
                timestamp: serverTimestamp()
            });
            
            loadDocuments();
        }
    );
}

window.deleteDocument = async function(filePath) {
    if (!confirm('Are you sure you want to delete this document?')) return;
    
    try {
        const fileRef = ref(storage, filePath);
        await deleteObject(fileRef);
        
        await addDoc(collection(db, 'activities'), {
            userId: currentUser.uid,
            message: 'Deleted a document',
            timestamp: serverTimestamp()
        });
        
        loadDocuments();
    } catch (error) {
        console.error('Error deleting document:', error);
        alert('Failed to delete document.');
    }
}

window.downloadDocument = function(url, filename) {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.target = '_blank';
    link.click();
}

function initializeEventListeners() {
    document.getElementById('logoutBtn').addEventListener('click', async () => {
        try {
            if (chatUnsubscribe) chatUnsubscribe();
            await signOut(auth);
            localStorage.removeItem('currentUser');
            sessionStorage.removeItem('currentUser');
            window.location.href = 'login.html';
        } catch (error) {
            console.error('Logout error:', error);
        }
    });
    
    const settingsModal = document.getElementById('settingsModal');
    const settingsBtn = document.getElementById('accountSettings');
    const closeModal = settingsModal.querySelector('.close');
    
    settingsBtn.addEventListener('click', () => {
        document.getElementById('profileName').value = currentUser.name;
        document.getElementById('profileEmail').value = currentUser.email;
        document.getElementById('profilePhone').value = currentUser.phone || '';
        settingsModal.style.display = 'block';
    });
    
    closeModal.addEventListener('click', () => {
        settingsModal.style.display = 'none';
    });
    
    window.addEventListener('click', (e) => {
        if (e.target === settingsModal) {
            settingsModal.style.display = 'none';
        }
    });
    
    document.getElementById('settingsForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = document.getElementById('profileName').value;
        const phone = document.getElementById('profilePhone').value;
        
        try {
            await updateDoc(doc(db, 'users', currentUser.uid), {
                name: name,
                phone: phone
            });
            
            currentUser.name = name;
            currentUser.phone = phone;
            document.getElementById('welcomeMessage').textContent = `Welcome, ${name}!`;
            
            alert('Settings updated successfully!');
            settingsModal.style.display = 'none';
        } catch (error) {
            console.error('Error updating settings:', error);
            alert('Failed to update settings.');
        }
    });
    
    const chatInput = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');
    const attachBtn = document.getElementById('attachBtn');
    const fileInput = document.getElementById('fileInput');
    
    sendBtn.addEventListener('click', async () => {
        const message = chatInput.value.trim();
        if (message) {
            await sendMessage(message);
            chatInput.value = '';
        }
    });
    
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendBtn.click();
        }
    });
    
    attachBtn.addEventListener('click', () => {
        fileInput.click();
    });
    
    fileInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        for (const file of files) {
            try {
                const fileUrl = await uploadFile(file);
                await sendMessage(`Sent a file: ${file.name}`, fileUrl, file.name);
            } catch (error) {
                console.error('Error uploading file:', error);
                alert('Failed to upload file.');
            }
        }
        fileInput.value = '';
    });
    document.getElementById('prevMonth').addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() - 1);
        generateCalendar(currentDate);
    });
    
    document.getElementById('nextMonth').addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        generateCalendar(currentDate);
    });
    
    document.getElementById('paymentForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const amount = parseFloat(document.getElementById('paymentAmount').value);
        const method = document.getElementById('paymentMethod').value;
        
        if (!amount || !method) {
            alert('Please fill in all fields');
            return;
        }
        
        try {
            
            await addDoc(collection(db, 'payments'), {
                userId: currentUser.uid,
                amount: amount,
                method: method,
                date: new Date().toISOString(),
                description: 'Service Payment',
                status: 'completed'
            });
            
            const userRef = doc(db, 'users', currentUser.uid);
            const userSnap = await getDoc(userRef);
            const currentBalance = userSnap.data().balance || 0;
            
            await updateDoc(userRef, {
                balance: currentBalance - amount,
                totalSpent: (userSnap.data().totalSpent || 0) + amount
            });
            
            await addDoc(collection(db, 'activities'), {
                userId: currentUser.uid,
                message: `Payment of R${amount.toFixed(2)} processed successfully`,
                timestamp: serverTimestamp()
            });
            
            alert('Payment processed successfully!');
            document.getElementById('paymentForm').reset();
            loadPaymentData();
            loadDashboardData();
            
        } catch (error) {
            console.error('Payment error:', error);
            alert('Payment failed. Please try again.');
        }
    });
    
    const uploadZone = document.getElementById('uploadZone');
    const documentUpload = document.getElementById('documentUpload');
    
    uploadZone.addEventListener('click', () => {
        documentUpload.click();
    });
    
    uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.classList.add('drag-over');
    });
    
    uploadZone.addEventListener('dragleave', () => {
        uploadZone.classList.remove('drag-over');
    });
    
    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('drag-over');
        const files = Array.from(e.dataTransfer.files);
        files.forEach(file => uploadDocument(file));
    });
    
    documentUpload.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        files.forEach(file => uploadDocument(file));
    });
    
    document.getElementById('notificationIcon').addEventListener('click', () => {
        alert('No new notifications');
    });
}

function getTimeAgo(date) {
    if (!date) return 'Just now';
    
    const seconds = Math.floor((new Date() - date) / 1000);
    
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " years ago";
    
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " months ago";
    
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " days ago";
    
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " hours ago";
    
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " minutes ago";
    
    return "Just now";
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function updateNotificationCount(userId) {
    try {
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);
        const currentCount = userSnap.data().notificationCount || 0;
        
        await updateDoc(userRef, {
            notificationCount: currentCount + 1
        });
    } catch (error) {
        console.error('Error updating notification count:', error);
    }
}