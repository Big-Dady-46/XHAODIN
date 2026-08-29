# 🚀 A&H Chat Pro - Next-Gen Realtime Messenger

A modern, high-performance, full-screen WebRTC messenger with WhatsApp-style messaging, calling, and call history.

---

## 📁 Project Directory Structure

```
Chat system/
├── index.html                 # Main App HTML with responsive viewport
├── README.md                  # Project documentation
├── css/
│   └── style.css              # Montserrat typography, Glassmorphism, bubble styles & animations
└── js/
    ├── firebase-config.js     # Firebase Realtime Database & Auth SDK setup
    ├── audio-service.js       # Synthesized ringtones, notification chime & call tones
    ├── notifications.js       # In-app floating toast banners & Desktop Web Push notifications
    ├── auth.js                # Sign in, Sign up, Presence & onDisconnect triggers
    ├── webrtc-call.js         # WebRTC 1-to-1 Voice & Video calling engine with STUN
    ├── calls-history.js       # WhatsApp-style Call Logging, render & 1-click redial
    ├── chats.js               # Realtime message streams, read/delivery ticks, unread counts
    └── app.js                 # App coordinator, tab switching & event listeners
```

---

## ✨ Features Included

1. **🎨 High-End UI**:
   - **Google Montserrat** (weights: 300 to 900) & Plus Jakarta Sans typography.
   - Cyber-Emerald Glassmorphism theme (`#080f14`, `#00a884`, `#00f5a0`).
   - Modern message bubbles with tailored border radii and glowing neon double ticks (`✓✓`).

2. **📞 Complete WebRTC Audio & Video Calling**:
   - Google STUN signaling via Firebase RTDB.
   - Picture-in-picture local video preview + Fullscreen remote video.
   - Incoming call ringing modal with Accept / Decline controls.
   - In-call controls (Mute mic, Camera toggle, Live duration timer, End call).

3. **📋 WhatsApp-Style Calls History Tab**:
   - Chronological call logs with ↗️ Outgoing (Green), ↙️ Incoming (Green), and ❌ Missed (Red) badges.
   - Relative timestamps (`Today, 6:45 PM`, `Yesterday, 2:15 PM`).
   - Call duration tracking (`1m 45s`).
   - 1-click Quick Recall action to redial immediately.
   - Unattended missed calls notification badge counter.

4. **🔔 Notifications & Audio**:
   - Synthesized ringtones & alert chimes (no external MP3 needed).
   - In-app floating slide-in banner toasts.
   - HTML5 Desktop Web Push Notifications.

---

## 💻 How to Open

Double-click **`index.html`** in this folder to open directly in any modern browser (Chrome, Edge, Brave, Firefox).
To test 2-way real-time messaging and calls, open a second window in **Incognito Mode** and sign up with a 2nd user!
