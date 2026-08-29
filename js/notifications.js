// ==========================================================================
// A&H Chat - Notification Service
// Floating in-app banners + HTML5 Web Desktop Push Notifications
// ==========================================================================

import { playNotificationSound } from './audio-service.js';

// Request Web Desktop Notification Permission
export function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

// Show In-App Floating Toast & Desktop Notification
export function triggerToast(senderName, messageText, title, chatId, type, displayTitle, partnerUid = null, onToastClick = null) {
  // 1. HTML5 Desktop System Notification
  if ('Notification' in window && Notification.permission === 'granted' && document.visibilityState !== 'visible') {
    try {
      const notif = new Notification(`${senderName} (A&H Chat)`, {
        body: messageText || 'Sent you a new message',
        icon: 'https://cdn-icons-png.flaticon.com/512/124/124034.png',
        tag: `ahchat-${chatId}`
      });
      notif.onclick = () => {
        window.focus();
        if (typeof onToastClick === 'function') {
          onToastClick(chatId, displayTitle, type, partnerUid);
        }
      };
    } catch (e) {}
  }

  // 2. In-App Floating Toast
  const container = document.getElementById('notificationToastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'glass-card text-white p-3.5 rounded-2xl shadow-2xl flex items-center gap-3.5 border border-emerald-500/30 cursor-pointer transform translate-y-[-20px] opacity-0 transition-all duration-300 pointer-events-auto hover:border-emerald-400/60 max-w-sm';

  const avatarLetter = senderName.charAt(0).toUpperCase();

  toast.innerHTML = `
    <div class="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#00a884] to-[#00d2aa] flex items-center justify-center font-bold text-white flex-shrink-0 text-sm shadow-md ring-2 ring-emerald-500/20">
      ${avatarLetter}
    </div>
    <div class="flex-1 min-w-0">
      <div class="flex items-center justify-between gap-1 mb-0.5">
        <h5 class="text-xs font-bold text-[#00f5a0] truncate">${escapeHtml(senderName)}</h5>
        <span class="text-[10px] text-slate-400 font-medium">Just now</span>
      </div>
      <p class="text-xs text-slate-200 truncate font-normal">${escapeHtml(messageText)}</p>
    </div>
    <button class="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition close-toast-btn">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
    </button>
  `;

  toast.onclick = (e) => {
    if (e.target.closest('.close-toast-btn')) return;
    if (typeof onToastClick === 'function') {
      onToastClick(chatId, displayTitle, type, partnerUid);
    }
    removeToast(toast);
  };

  const closeBtn = toast.querySelector('.close-toast-btn');
  if (closeBtn) {
    closeBtn.onclick = (e) => {
      e.stopPropagation();
      removeToast(toast);
    };
  }

  container.appendChild(toast);

  // Trigger Slide In
  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-[-20px]', 'opacity-0');
    toast.classList.add('translate-y-0', 'opacity-100');
  });

  // Auto-dismiss after 4.5 seconds
  setTimeout(() => removeToast(toast), 4500);
}

function removeToast(toast) {
  if (!toast || !toast.parentElement) return;
  toast.classList.remove('translate-y-0', 'opacity-100');
  toast.classList.add('translate-y-[-20px]', 'opacity-0');
  setTimeout(() => toast.remove(), 300);
}

export function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.innerText = text;
  return div.innerHTML;
}
