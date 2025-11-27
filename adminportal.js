// adminportal.js (fixed & hardened)

import { auth, db, storage } from './firebase-config.js';
import { signOut, onAuthStateChanged, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
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
  getDocs,
  setDoc,
  deleteDoc,
  limit,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  ref,
  uploadBytesResumable,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

/* -------------------------
   Utility helpers
   ------------------------- */
const $id = (id) => document.getElementById(id);

function safeText(value) {
  return value == null ? '' : String(value);
}

/* -------------------------
   State
   ------------------------- */
let currentAdmin = null;
let currentDate = new Date();
let selectedClientId = null;
let chatUnsubscribes = {};
let clientsData = [];

/* -------------------------
   Auth state
   ------------------------- */
onAuthStateChanged(auth, async (user) => {
  try {
    if (user) {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData.userType === 'admin') {
          currentAdmin = { uid: user.uid, ...userData };
          initializeAdminPortal();
        } else {
          window.location.href = 'clientportal.html';
        }
      } else {
        // No user doc found
        console.warn('No user document found for', user.uid);
        window.location.href = 'login.html';
      }
    } else {
      window.location.href = 'login.html';
    }
  } catch (err) {
    console.error('Auth state handling error:', err);
    // fallback to login
    // window.location.href = 'login.html';
  }
});

/* -------------------------
   Initialization
   ------------------------- */
function initializeAdminPortal() {
  if (!currentAdmin) return;

  const welcomeEl = $id('welcomeMessage');
  if (welcomeEl) welcomeEl.textContent = `Welcome, ${currentAdmin.name || 'Admin'}!`;

  initializeSidebar();
  loadDashboardData();
  loadClients();
  generateCalendar(currentDate);
  initializeChats();
  loadAnalytics();
  initializeEventListeners();
}

/* -------------------------
   Sidebar / navigation
   ------------------------- */
function initializeSidebar() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      showSection(item.getAttribute('data-section'));
    });
  });
}

window.showSection = function (sectionId) {
  document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
  document.querySelectorAll('.content-section').forEach(section => section.classList.remove('active'));

  const navEl = document.querySelector(`[data-section="${sectionId}"]`);
  navEl?.classList.add('active');
  $id(sectionId)?.classList.add('active');
};

/* -------------------------
   Dashboard
   ------------------------- */
async function loadDashboardData() {
  try {
    const clientsRef = collection(db, 'users');
    const clientsQuery = query(clientsRef, where('userType', '==', 'client'));
    const clientsSnapshot = await getDocs(clientsQuery);

    const activeClientsEl = $id('activeClientsCount');
    if (activeClientsEl) activeClientsEl.textContent = clientsSnapshot.size;

    const projectsRef = collection(db, 'projects');
    const projectsSnapshot = await getDocs(projectsRef);

    let pendingReviews = 0;
    let completedProjects = 0;

    projectsSnapshot.forEach((d) => {
      const project = d.data();
      if (!project) return;
      if (project.status === 'Under Review' || project.status === 'Awaiting Feedback') pendingReviews++;
      if (project.status === 'Completed') completedProjects++;
    });

    $id('pendingReviewsCount') && ($id('pendingReviewsCount').textContent = pendingReviews);
    $id('completedProjectsCount') && ($id('completedProjectsCount').textContent = completedProjects);

    // Payments & monthly revenue (guard conversions)
    const paymentsRef = collection(db, 'payments');
    const paymentsSnapshot = await getDocs(paymentsRef);
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let monthlyRevenue = 0;
    paymentsSnapshot.forEach((d) => {
      const payment = d.data();
      if (!payment) return;
      const paymentDate = new Date(payment.date); // expects ISO string or timestamp-like
      if (!isNaN(paymentDate)) {
        if (paymentDate.getMonth() === currentMonth && paymentDate.getFullYear() === currentYear) {
          monthlyRevenue += Number(payment.amount || 0);
        }
      }
    });

    $id('monthlyRevenue') && ($id('monthlyRevenue').textContent = `R${monthlyRevenue.toFixed(2)}`);

    loadAdminActivity();
  } catch (error) {
    console.error('Error loading dashboard:', error);
  }
}

/* -------------------------
   Admin activity
   ------------------------- */
async function loadAdminActivity() {
  try {
    const activitiesRef = collection(db, 'activities');
    const q = query(activitiesRef, orderBy('timestamp', 'desc'), limit ? limit(10) : orderBy('timestamp', 'desc'));
    const querySnapshot = await getDocs(q);
    const activityList = $id('adminRecentActivity');
    if (!activityList) return;

    if (querySnapshot.empty) {
      activityList.innerHTML = '<p class="no-activity">No recent activity</p>';
      return;
    }

    activityList.innerHTML = '';
    let count = 0;
    querySnapshot.forEach((d) => {
      if (count >= 10) return;
      const activity = d.data();
      const activityDiv = document.createElement('div');
      activityDiv.className = 'activity-item';

      const timeAgo = getTimeAgo(activity.timestamp?.toDate ? activity.timestamp.toDate() : activity.timestamp);
      activityDiv.innerHTML = `
        <span class="activity-time">${safeText(timeAgo)}</span>
        <span class="activity-text">${safeText(activity.message)}</span>
      `;
      activityList.appendChild(activityDiv);
      count++;
    });
  } catch (error) {
    console.error('Error loading activity:', error);
  }
}

/* -------------------------
   Clients list & management
   ------------------------- */
async function loadClients() {
  try {
    const clientsRef = collection(db, 'users');
    const q = query(clientsRef, where('userType', '==', 'client'));
    const querySnapshot = await getDocs(q);

    const tableBody = $id('clientsTableBody');
    const progressClientSelect = $id('progressClient');
    const eventClientSelect = $id('eventClient');

    if (tableBody) tableBody.innerHTML = '';
    if (progressClientSelect) progressClientSelect.innerHTML = '<option value="">Choose a client</option>';
    if (eventClientSelect) eventClientSelect.innerHTML = '<option value="">Select Client</option>';
    clientsData = [];

    if (querySnapshot.empty) {
      if (tableBody) tableBody.innerHTML = '<tr><td colspan="6" class="no-clients">No clients found</td></tr>';
      return;
    }

    querySnapshot.forEach((d) => {
      const client = d.data();
      const clientId = d.id;
      clientsData.push({ id: clientId, ...client });

      // Table row
      if (tableBody) {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${safeText(client.name)}</td>
          <td>${safeText(client.email)}</td>
          <td>${safeText(client.phone) || 'N/A'}</td>
          <td>${(client.activeProjects?.length) || 0}</td>
          <td><span class="status-active">Active</span></td>
          <td>
            <button class="btn-small" onclick="viewClient('${clientId}')">View</button>
            <button class="btn-small" onclick="manageProjects('${clientId}')">Projects</button>
          </td>
        `;
        tableBody.appendChild(row);
      }

      // Select options
      if (progressClientSelect) {
        const option1 = document.createElement('option');
        option1.value = clientId;
        option1.textContent = client.name;
        progressClientSelect.appendChild(option1);
      }
      if (eventClientSelect) {
        const option2 = document.createElement('option');
        option2.value = clientId;
        option2.textContent = client.name;
        eventClientSelect.appendChild(option2);
      }
    });
  } catch (error) {
    console.error('Error loading clients:', error);
  }
}

/* -------------------------
   View & manage client
   ------------------------- */
window.viewClient = async function (clientId) {
  try {
    const clientDoc = await getDoc(doc(db, 'users', clientId));
    if (!clientDoc.exists()) {
      alert('Client not found');
      return;
    }
    const client = clientDoc.data();
    const modal = $id('viewClientModal');
    const content = $id('clientDetailsContent');
    if (!content || !modal) return;

    // createdAt may be string or timestamp
    let joined = 'Unknown';
    if (client.createdAt) {
      if (client.createdAt.toDate) joined = client.createdAt.toDate().toLocaleDateString();
      else joined = new Date(client.createdAt).toLocaleDateString();
    }

    content.innerHTML = `
      <div class="client-details">
        <div class="detail-row"><strong>Name:</strong> ${safeText(client.name)}</div>
        <div class="detail-row"><strong>Email:</strong> ${safeText(client.email)}</div>
        <div class="detail-row"><strong>Phone:</strong> ${safeText(client.phone) || 'N/A'}</div>
        <div class="detail-row"><strong>Joined:</strong> ${joined}</div>
        <div class="detail-row"><strong>Active Projects:</strong> ${client.activeProjects?.length || 0}</div>
        <div class="detail-row"><strong>Completed Projects:</strong> ${client.completedProjects?.length || 0}</div>
        <div class="detail-row"><strong>Total Spent:</strong> R${client.totalSpent || 0}</div>
      </div>
    `;
    modal.style.display = 'block';
  } catch (error) {
    console.error('Error viewing client:', error);
    alert('Failed to load client details');
  }
};

window.manageProjects = function (clientId) {
  const selectEl = $id('progressClient');
  if (selectEl) selectEl.value = clientId;
  loadClientProjects(clientId);
  showSection('progress');
};

/* -------------------------
   Client projects
   ------------------------- */
async function loadClientProjects(clientId) {
  try {
    const projectsRef = collection(db, 'projects');
    const q = query(projectsRef, where('clientId', '==', clientId));
    const querySnapshot = await getDocs(q);
    const container = $id('clientProjects');

    if (!container) return;

    if (querySnapshot.empty) {
      container.innerHTML = '<p class="no-projects">This client has no projects yet</p>';
      return;
    }

    container.innerHTML = '<h3>Client Projects</h3>';
    querySnapshot.forEach((d) => {
      const project = d.data();
      const projectId = d.id;
      const projectDiv = document.createElement('div');
      projectDiv.className = 'project-item';
      projectDiv.innerHTML = `
        <div class="project-info">
          <h4>${safeText(project.title)}</h4>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${project.progress || 0}%"></div>
          </div>
          <span class="progress-text">${project.progress || 0}% - ${safeText(project.status || 'Not Started')}</span>
          ${project.notes ? `<p class="project-notes">${safeText(project.notes)}</p>` : ''}
        </div>
        <button class="btn-small" data-project-id="${projectId}">Update</button>
      `;
      // attach update handler
      const btn = projectDiv.querySelector('button');
      if (btn) {
        btn.addEventListener('click', () => {
          editProjectProgress(projectId, project.title || '', project.progress || 0, project.status || 'Not Started', project.notes || '');
        });
      }

      container.appendChild(projectDiv);
    });
  } catch (error) {
    console.error('Error loading projects:', error);
  }
}

window.editProjectProgress = function (projectId, title, progress, status, notes) {
  $id('selectedProjectId') && ($id('selectedProjectId').value = projectId);
  $id('projectTitle') && ($id('projectTitle').value = title);
  $id('progressPercentage') && ($id('progressPercentage').value = progress);
  $id('progressValue') && ($id('progressValue').textContent = progress + '%');
  $id('progressStatus') && ($id('progressStatus').value = status);
  $id('progressNotes') && ($id('progressNotes').value = notes);
  $id('progressUpdateForm') && ($id('progressUpdateForm').style.display = 'block');
};

/* -------------------------
   Calendar & events
   ------------------------- */
function generateCalendar(date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startingDayOfWeek = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];

  $id('currentMonth') && ($id('currentMonth').textContent = `${monthNames[month]} ${year}`);

  const calendarGrid = $id('calendarGrid');
  if (!calendarGrid) return;
  calendarGrid.innerHTML = '';

  const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  dayHeaders.forEach(day => {
    const dayHeader = document.createElement('div');
    dayHeader.className = 'calendar-day-header';
    dayHeader.textContent = day;
    calendarGrid.appendChild(dayHeader);
  });

  // add blank days (only once per slot)
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

  loadUpcomingEvents();
}

async function loadUpcomingEvents() {
  try {
    const eventsRef = collection(db, 'events');
    // NOTE: this query expects event.date stored as a 'YYYY-MM-DD' string OR a Firestore Timestamp.
    // If your events use timestamps, adapt the query accordingly.
    const todayStr = new Date().toISOString().split('T')[0];
    const q = query(
      eventsRef,
      where('date', '>=', todayStr),
      orderBy('date', 'asc')
    );

    const querySnapshot = await getDocs(q);
    const eventsContainer = $id('upcomingEventsList');
    if (!eventsContainer) return;

    if (querySnapshot.empty) {
      eventsContainer.innerHTML = '<p class="no-events">No upcoming events</p>';
      return;
    }

    eventsContainer.innerHTML = '';
    for (const eventDoc of querySnapshot.docs) {
      const event = eventDoc.data();
      const eventDiv = document.createElement('div');
      eventDiv.className = 'event-item admin-event';

      // parse date safely
      let eventDate;
      if (event.date?.toDate) eventDate = event.date.toDate();
      else eventDate = new Date(event.date);

      const formattedDate = isNaN(eventDate) ? safeText(event.date) : eventDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      let clientName = 'Unknown Client';
      if (event.clientId) {
        try {
          const clientDoc = await getDoc(doc(db, 'users', event.clientId));
          if (clientDoc.exists()) clientName = clientDoc.data().name;
        } catch (err) {
          console.warn('Failed to fetch client for event', err);
        }
      }

      eventDiv.innerHTML = `
        <span class="event-date">${formattedDate}</span>
        <span class="event-text">${safeText(clientName)} - ${safeText(event.title)}</span>
        <button class="event-edit" data-event-id="${eventDoc.id}">Edit</button>
        <button class="event-delete" data-event-id="${eventDoc.id}">Delete</button>
      `;

      // attach handlers
      eventDiv.querySelector('.event-edit')?.addEventListener('click', () => editEvent(eventDoc.id));
      eventDiv.querySelector('.event-delete')?.addEventListener('click', () => deleteEvent(eventDoc.id));

      eventsContainer.appendChild(eventDiv);
    }
  } catch (error) {
    console.error('Error loading events:', error);
  }
}

window.deleteEvent = async function (eventId) {
  if (!confirm('Are you sure you want to delete this event?')) return;
  try {
    await deleteDoc(doc(db, 'events', eventId));
    loadUpcomingEvents();
    alert('Event deleted successfully');
  } catch (error) {
    console.error('Error deleting event:', error);
    alert('Failed to delete event');
  }
};

/* -------------------------
   Chats
   ------------------------- */
function initializeChats() {
  loadChatList();
}

async function loadChatList() {
  try {
    const chatsRef = collection(db, 'chats');
    const q = query(chatsRef, where('participants', 'array-contains', 'admin'));

    onSnapshot(q, async (snapshot) => {
      const chatList = $id('chatList');
      if (!chatList) return;

      const clientChats = new Map();

      snapshot.forEach((d) => {
        const message = d.data();
        if (!message) return;
        const clientId = message.senderId === 'admin' ? message.receiverId : message.senderId;
        if (!clientId) return;

        if (!clientChats.has(clientId)) {
          clientChats.set(clientId, {
            lastMessage: message.text || '',
            timestamp: message.timestamp,
            unread: !message.read && message.senderId !== 'admin',
            clientId: clientId,
            senderName: message.senderName || ''
          });
        } else {
          const existing = clientChats.get(clientId);
          if (message.timestamp && existing.timestamp && message.timestamp > existing.timestamp) {
            existing.lastMessage = message.text || '';
            existing.timestamp = message.timestamp;
          }
          if (!message.read && message.senderId !== 'admin') existing.unread = true;
        }
      });

      if (clientChats.size === 0) {
        chatList.innerHTML = '<p class="no-chats">No active chats</p>';
        return;
      }

      chatList.innerHTML = '';

      const sortedChats = Array.from(clientChats.entries()).sort((a, b) => {
        return (b[1].timestamp?.toMillis ? b[1].timestamp.toMillis() : 0) - (a[1].timestamp?.toMillis ? a[1].timestamp.toMillis() : 0);
      });

      for (const [clientId, chatData] of sortedChats) {
        let clientName = chatData.senderName || 'Client';
        try {
          const clientDoc = await getDoc(doc(db, 'users', clientId));
          if (clientDoc.exists()) clientName = clientDoc.data().name || clientName;
        } catch (err) {
          console.warn('Fetch client failed for chat list:', err);
        }

        const initials = clientName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
        const chatItem = document.createElement('div');
        chatItem.className = 'chat-item';
        chatItem.innerHTML = `
          <div class="chat-avatar">${initials}</div>
          <div class="chat-info">
            <div class="chat-name">${safeText(clientName)}</div>
            <div class="chat-preview">${safeText(chatData.lastMessage).substring(0, 50)}${safeText(chatData.lastMessage).length > 50 ? '...' : ''}</div>
          </div>
          ${chatData.unread ? '<div class="chat-badge">•</div>' : ''}
        `;

        // pass chatItem so openChat can highlight it
        chatItem.addEventListener('click', () => openChat(clientId, clientName, chatItem));
        chatList.appendChild(chatItem);
      }

      const unreadCount = Array.from(clientChats.values()).filter(c => c.unread).length;
      $id('notificationBadge') && ($id('notificationBadge').textContent = unreadCount);
    });
  } catch (error) {
    console.error('Error loading chat list:', error);
  }
}

function openChat(clientId, clientName, clickedElement = null) {
  selectedClientId = clientId;

  $id('currentChatClient') && ($id('currentChatClient').textContent = clientName);
  $id('chatStatus') && ($id('chatStatus').textContent = 'Online');
  $id('chatInputContainer') && ($id('chatInputContainer').style.display = 'block');

  document.querySelectorAll('.chat-item').forEach(item => item.classList.remove('active'));
  if (clickedElement) clickedElement.classList.add('active');

  loadChatMessages(clientId);
  markMessagesAsRead(clientId);
}

function loadChatMessages(clientId) {
  const chatMessages = $id('adminChatMessages');
  if (!chatMessages) return;
  chatMessages.innerHTML = '';

  // unsubscribe previous
  if (chatUnsubscribes[clientId]) {
    chatUnsubscribes[clientId]();
  }

  const chatsRef = collection(db, 'chats');
  const q = query(
    chatsRef,
    where('participants', 'array-contains', clientId),
    orderBy('timestamp', 'asc')
  );

  chatUnsubscribes[clientId] = onSnapshot(q, (snapshot) => {
    if (!chatMessages) return;
    chatMessages.innerHTML = '';

    snapshot.forEach((d) => {
      const message = d.data();
      displayAdminMessage(message);
    });

    // scroll
    chatMessages.scrollTop = chatMessages.scrollHeight;
  });
}

function displayAdminMessage(message) {
  const chatMessages = $id('adminChatMessages');
  if (!chatMessages || !message) return;

  const messageDiv = document.createElement('div');
  const isOwnMessage = message.senderId === 'admin';
  messageDiv.className = `message ${isOwnMessage ? 'admin-message' : 'client-message'}`;

  const timestamp = message.timestamp?.toDate ? message.timestamp.toDate() : (message.timestamp ? new Date(message.timestamp) : null);
  const timeString = timestamp ? timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

  messageDiv.innerHTML = `
    <div class="message-header">
      <strong>${isOwnMessage ? 'You' : safeText(message.senderName)}</strong>
      <span class="message-time">${timeString}</span>
    </div>
    <div class="message-content">${safeText(message.text || '')}</div>
    ${message.fileUrl ? `<div class="message-attachment"><a href="${message.fileUrl}" target="_blank">📎 ${safeText(message.fileName || 'attachment')}</a></div>` : ''}
  `;

  chatMessages.appendChild(messageDiv);
}

/* -------------------------
   Send / mark read / upload
   ------------------------- */
async function sendAdminMessage(text, fileUrl = null, fileName = null) {
  if (!selectedClientId) {
    alert('Please select a client first');
    return;
  }

  try {
    const chatRef = collection(db, 'chats');
    await addDoc(chatRef, {
      text: text,
      senderId: 'admin',
      senderName: currentAdmin?.name || 'Admin',
      receiverId: selectedClientId,
      participants: ['admin', selectedClientId],
      timestamp: serverTimestamp(),
      fileUrl: fileUrl,
      fileName: fileName,
      read: false
    });

    await addDoc(collection(db, 'activities'), {
      userId: selectedClientId,
      message: `Admin sent a message`,
      timestamp: serverTimestamp()
    });

  } catch (error) {
    console.error('Error sending message:', error);
    alert('Failed to send message');
  }
}

async function markMessagesAsRead(clientId) {
  try {
    const chatsRef = collection(db, 'chats');
    const q = query(
      chatsRef,
      where('participants', 'array-contains', clientId),
      where('senderId', '==', clientId),
      where('read', '==', false)
    );

    const querySnapshot = await getDocs(q);
    for (const docSnapshot of querySnapshot.docs) {
      await updateDoc(doc(db, 'chats', docSnapshot.id), { read: true });
    }
  } catch (error) {
    console.error('Error marking messages as read:', error);
  }
}

async function uploadChatFile(file) {
  const storageRef = ref(storage, `admin-chat-files/${Date.now()}_${file.name}`);
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

/* -------------------------
   Analytics & chart
   ------------------------- */
async function loadAnalytics() {
  try {
    const paymentsRef = collection(db, 'payments');
    const paymentsSnapshot = await getDocs(paymentsRef);

    let currentMonthRevenue = 0;
    let lastMonthRevenue = 0;
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    paymentsSnapshot.forEach((d) => {
      const payment = d.data();
      const paymentDate = new Date(payment.date);
      if (!isNaN(paymentDate)) {
        if (paymentDate.getMonth() === currentMonth && paymentDate.getFullYear() === currentYear) {
          currentMonthRevenue += Number(payment.amount || 0);
        } else if (paymentDate.getMonth() === (currentMonth - 1) && paymentDate.getFullYear() === currentYear) {
          lastMonthRevenue += Number(payment.amount || 0);
        }
      }
    });

    $id('analyticsRevenue') && ($id('analyticsRevenue').textContent = `R${currentMonthRevenue.toFixed(2)}`);

    const revenueChange = lastMonthRevenue > 0 ? ((currentMonthRevenue - lastMonthRevenue) / lastMonthRevenue * 100).toFixed(1) : 0;
    if ($id('revenueChange')) {
      $id('revenueChange').textContent = `${revenueChange > 0 ? '+' : ''}${revenueChange}% from last month`;
      $id('revenueChange').className = `analytics-change ${revenueChange >= 0 ? 'positive' : 'negative'}`;
    }

    $id('clientSatisfaction') && ($id('clientSatisfaction').textContent = '94%');
    $id('satisfactionChange') && ($id('satisfactionChange').textContent = '+2% from last month');

    const projectsRef = collection(db, 'projects');
    const projectsSnapshot = await getDocs(projectsRef);
    const totalProjects = projectsSnapshot.size;
    let completedProjects = 0;
    projectsSnapshot.forEach((d) => {
      const project = d.data();
      if (project?.status === 'Completed') completedProjects++;
    });

    const completionRate = totalProjects > 0 ? ((completedProjects / totalProjects) * 100).toFixed(0) : 0;
    $id('completionRate') && ($id('completionRate').textContent = `${completionRate}%`);

    drawRevenueChart();
  } catch (error) {
    console.error('Error loading analytics:', error);
  }
}

function drawRevenueChart() {
  const canvas = $id('revenueCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;

  // demo data
  const data = [15000, 18000, 16000, 22000, 20000, 25000];
  const labels = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  ctx.clearRect(0, 0, width, height);
  ctx.strokeStyle = '#EDEDED';
  ctx.lineWidth = 1;

  for (let i = 0; i <= 5; i++) {
    const y = (height / 5) * i;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  const maxValue = Math.max(...data);
  const padding = 20;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;
  const stepX = chartWidth / (data.length - 1);

  ctx.strokeStyle = '#0057A0';
  ctx.lineWidth = 2;
  ctx.beginPath();

  data.forEach((value, index) => {
    const x = padding + index * stepX;
    const y = height - padding - (value / maxValue) * chartHeight;

    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);

    ctx.fillStyle = '#0057A0';
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.stroke();
  ctx.fillStyle = '#666';
  ctx.font = '12px Roboto';
  ctx.textAlign = 'center';
  labels.forEach((label, index) => {
    const x = padding + index * stepX;
    ctx.fillText(label, x, height - 5);
  });
}

/* -------------------------
   Event listeners & UI wiring
   ------------------------- */
function initializeEventListeners() {
  // logout
  $id('logoutBtn')?.addEventListener('click', async () => {
    try {
      Object.values(chatUnsubscribes).forEach(unsubscribe => unsubscribe && unsubscribe());
      await signOut(auth);
      localStorage.removeItem('currentUser');
      sessionStorage.removeItem('currentUser');
      window.location.href = 'login.html';
    } catch (error) {
      console.error('Logout error:', error);
    }
  });

  // settings modal
  const settingsModal = $id('settingsModal');
  const settingsBtn = $id('accountSettings');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      if (!currentAdmin) return;
      $id('profileName') && ($id('profileName').value = currentAdmin.name || '');
      $id('profileEmail') && ($id('profileEmail').value = currentAdmin.email || '');
      $id('profilePhone') && ($id('profilePhone').value = currentAdmin.phone || '');
      $id('businessHours') && ($id('businessHours').value = currentAdmin.businessHours || '');
      settingsModal && (settingsModal.style.display = 'block');
    });
  }

  // save settings
  $id('settingsForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const name = $id('profileName')?.value || '';
      const phone = $id('profilePhone')?.value || '';
      const businessHours = $id('businessHours')?.value || '';
      if (!currentAdmin) throw new Error('No admin found');

      await updateDoc(doc(db, 'users', currentAdmin.uid), {
        name, phone, businessHours
      });

      currentAdmin.name = name;
      currentAdmin.phone = phone;
      currentAdmin.businessHours = businessHours;

      $id('welcomeMessage') && ($id('welcomeMessage').textContent = `Welcome, ${name}!`);
      alert('Settings updated successfully!');
      settingsModal && (settingsModal.style.display = 'none');
    } catch (error) {
      console.error('Error updating settings:', error);
      alert('Failed to update settings');
    }
  });

  // progress client change
  $id('progressClient')?.addEventListener('change', (e) => {
    const clientId = e.target.value;
    if (clientId) loadClientProjects(clientId);
    else {
      $id('clientProjects') && ($id('clientProjects').innerHTML = '<p class="no-selection">Please select a client to view their projects</p>');
      $id('progressUpdateForm') && ($id('progressUpdateForm').style.display = 'none');
    }
  });

  $id('progressPercentage')?.addEventListener('input', (e) => {
    $id('progressValue') && ($id('progressValue').textContent = e.target.value + '%');
  });

  $id('progressForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const projectId = $id('selectedProjectId')?.value;
      const progress = parseInt($id('progressPercentage')?.value || '0', 10);
      const status = $id('progressStatus')?.value || '';
      const notes = $id('progressNotes')?.value || '';

      if (!projectId) throw new Error('No project selected');

      await updateDoc(doc(db, 'projects', projectId), {
        progress, status, notes, lastUpdated: serverTimestamp()
      });

      const clientId = $id('progressClient')?.value;
      await addDoc(collection(db, 'activities'), {
        userId: clientId,
        message: `Project progress updated to ${progress}% - ${status}`,
        timestamp: serverTimestamp()
      });

      alert('Progress updated successfully!');
      if (clientId) loadClientProjects(clientId);
      $id('progressUpdateForm') && ($id('progressUpdateForm').style.display = 'none');
    } catch (error) {
      console.error('Error updating progress:', error);
      alert('Failed to update progress');
    }
  });

  // calendar prev/next
  $id('prevMonth')?.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    generateCalendar(currentDate);
  });
  $id('nextMonth')?.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    generateCalendar(currentDate);
  });

  // event modal
  const eventModal = $id('eventModal');
  const addEventBtn = $id('addEventBtn');
  const closeEventModal = $id('closeEventModal');
  addEventBtn?.addEventListener('click', () => eventModal && (eventModal.style.display = 'block'));
  closeEventModal?.addEventListener('click', () => eventModal && (eventModal.style.display = 'none'));

  $id('eventForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const clientId = $id('eventClient')?.value || '';
      const title = $id('eventTitle')?.value || '';
      const date = $id('eventDate')?.value || '';
      const time = $id('eventTime')?.value || '';
      const description = $id('eventDescription')?.value || '';

      await addDoc(collection(db, 'events'), {
        clientId, title, date, time, description, createdBy: 'admin', createdAt: serverTimestamp()
      });

      await addDoc(collection(db, 'activities'), {
        userId: clientId,
        message: `New event scheduled: ${title}`,
        timestamp: serverTimestamp()
      });

      alert('Event added successfully!');
      eventModal && (eventModal.style.display = 'none');
      $id('eventForm') && ($id('eventForm').reset());
      loadUpcomingEvents();
    } catch (error) {
      console.error('Error adding event:', error);
      alert('Failed to add event');
    }
  });

  // chat - send / attach
  const adminChatInput = $id('adminChatInput');
  const adminSendBtn = $id('adminSendBtn');
  const adminAttachBtn = $id('adminAttachBtn');
  const adminFileInput = $id('adminFileInput');

  adminSendBtn?.addEventListener('click', async () => {
    const message = (adminChatInput?.value || '').trim();
    if (message) {
      await sendAdminMessage(message);
      if (adminChatInput) adminChatInput.value = '';
    }
  });

  adminChatInput?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      adminSendBtn?.click();
    }
  });

  adminAttachBtn?.addEventListener('click', () => adminFileInput?.click());

  adminFileInput?.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      try {
        const fileUrl = await uploadChatFile(file);
        await sendAdminMessage(`Sent a file: ${file.name}`, fileUrl, file.name);
      } catch (error) {
        console.error('Error uploading file:', error);
        alert('Failed to upload file');
      }
    }
    if (adminFileInput) adminFileInput.value = '';
  });

  // search inputs
  $id('chatSearchInput')?.addEventListener('input', (e) => {
    const searchTerm = (e.target.value || '').toLowerCase();
    document.querySelectorAll('.chat-item').forEach(item => {
      const name = safeText(item.querySelector('.chat-name')?.textContent || '').toLowerCase();
      item.style.display = name.includes(searchTerm) ? 'flex' : 'none';
    });
  });

  $id('clientSearch')?.addEventListener('input', (e) => {
    const searchTerm = (e.target.value || '').toLowerCase();
    document.querySelectorAll('#clientsTableBody tr').forEach(row => {
      const text = (row.textContent || '').toLowerCase();
      row.style.display = text.includes(searchTerm) ? '' : 'none';
    });
  });

  // add client modal
  const addClientModal = $id('addClientModal');
  const addClientBtn = $id('addClientBtn');
  const closeAddClientModal = $id('closeAddClientModal');
  addClientBtn?.addEventListener('click', () => addClientModal && (addClientModal.style.display = 'block'));
  closeAddClientModal?.addEventListener('click', () => addClientModal && (addClientModal.style.display = 'none'));

  $id('addClientForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const name = $id('newClientName')?.value || '';
      const email = $id('newClientEmail')?.value || '';
      const phone = $id('newClientPhone')?.value || '';
      const password = $id('newClientPassword')?.value || '';

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
        totalSpent: 0
      });

      await addDoc(collection(db, 'activities'), {
        userId: user.uid,
        message: 'Account created by admin',
        timestamp: serverTimestamp()
      });

      alert('Client added successfully!');
      addClientModal && (addClientModal.style.display = 'none');
      $id('addClientForm') && ($id('addClientForm').reset());
      loadClients();
      loadDashboardData();
    } catch (error) {
      console.error('Error adding client:', error);
      alert(getErrorMessage(error.code));
    }
  });

  // modal close on outside click
  window.addEventListener('click', (e) => {
    if (e.target === settingsModal) settingsModal.style.display = 'none';
    if (e.target === eventModal) eventModal.style.display = 'none';
    if (e.target === addClientModal) addClientModal.style.display = 'none';
    if (e.target === $id('viewClientModal')) $id('viewClientModal').style.display = 'none';
  });

  // close buttons inside modals
  document.querySelectorAll('.close').forEach(closeBtn => {
    closeBtn.addEventListener('click', () => {
      const modal = closeBtn.closest('.modal');
      if (modal) modal.style.display = 'none';
    });
  });

  $id('closeViewClientModal')?.addEventListener('click', () => $id('viewClientModal') && ($id('viewClientModal').style.display = 'none'));

  $id('notificationIcon')?.addEventListener('click', () => {
    alert('You have unread messages. Check the chat section.');
  });
}

/* -------------------------
   Helpers
   ------------------------- */
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

function getErrorMessage(errorCode) {
  const errorMessages = {
    'auth/email-already-in-use': 'An account with this email already exists.',
    'auth/weak-password': 'Password should be at least 6 characters.',
    'auth/invalid-email': 'Invalid email address format.'
  };

  return errorMessages[errorCode] || 'An error occurred. Please try again.';
}
