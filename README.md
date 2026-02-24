# Academic Excellence Hub – Postgraduate Support Platform

## Overview
Academic Excellence Hub is a comprehensive academic support platform built using **JavaScript, HTML, CSS**, and **Firebase**.  
It connects postgraduate students (especially distance learners) with professional tutoring services through a secure, feature-rich environment.

The platform features **dual portals** (Admin and Client) with **real-time messaging**, **project tracking**, **document management**, and **payment processing** — all designed to support students who receive little to no institutional support.

---

## 📸 Project Snapshots

| Admin Dashboard | Client Portal |
|:---:|:---:|
| ![Admin Dashboard](link-to-admin-dashboard-screenshot) | ![Client Portal](link-to-client-portal-screenshot) |

| Real-time Chat Interface | Project Progress Tracking |
|:---:|:---:|
| ![Chat Interface](link-to-chat-screenshot) | ![Project Tracking](link-to-project-tracking-screenshot) |

---

## Key Features

### 1. Dual Portal System
- **Admin Portal** – Full oversight of clients, projects, payments, and platform activity.  
- **Client Portal** – Students submit requests, track progress, and communicate with tutors.  
- Role-based access control ensuring data privacy and security.

### 2. Authentication & Security
- Email verification for all new accounts.  
- Password reset functionality.  
- Session management with Firebase Auth.  
- Role-based page protection (admin routes vs client routes).

### 3. Real-time Chat Messaging
- Instant messaging between clients and admin/tutors.  
- File attachment support (documents, images, PDFs).  
- Message history stored in Firebase Realtime Database.  
- Read receipts and timestamps.

### 4. Project Management
- Students can submit project requests with descriptions.  
- Admin assigns tutors and sets milestones.  
- Progress tracking with status updates (Pending, In Progress, Completed, Revisions).  
- Document upload/download for each project phase.

### 5. Document Management
- Secure file upload to Firebase Storage.  
- Organized by project and client.  
- Version tracking for drafts and final submissions.  
- Direct download links shared via chat.

### 6. Payment Processing
- Track payments and generate invoices.  
- Payment history with status (Pending, Paid, Overdue).  
- Cost calculator for service customization.  
- Ready for payment gateway integration (PayFast/PayPal).

### 7. Interactive Calendar
- Schedule consultations and deadlines.  
- Calendar sync with project milestones.  
- Email/SMS reminders (prepared for integration).

### 8. Admin Dashboard & Analytics
- Live statistics: active clients, ongoing projects, pending payments.  
- Client management interface.  
- Activity logs and notification center.  
- Revenue tracking and reporting.

---

## Database Structure

### **Firestore Collections**
| Collection | Description |
|------------|-------------|
| `users` | User profiles with roles (admin/client), contact details, and account status |
| `projects` | Project details, client ID, status, milestones, and deadlines |
| `payments` | Transaction records, amounts, dates, and payment status |
| `appointments` | Calendar events with client ID, date, time, and purpose |
| `documents` | File metadata (URL, project ID, uploader, timestamp) |
| `activityLogs` | System events and user actions for audit purposes |

### **Realtime Database**
| Path | Description |
|------|-------------|
| `/chats/{chatId}/messages` | Real-time message storage with timestamps |
| `/notifications/{userId}` | Push notifications for users |

### **Security Rules**
- **Firestore:** Role-based access (admin read/write, clients read their own data only).  
- **Storage:** Authenticated users can upload; access controlled by project membership.  
- **Realtime Database:** Only participants in a chat can read/write messages.

---

## Files and Structure
