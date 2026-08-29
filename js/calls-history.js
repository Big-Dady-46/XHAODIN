// ==========================================================================
// A&H Chat - Calls History Service (WhatsApp Web Style)
// Realtime Call Logs recording, WhatsApp-style list rendering & 1-click redial
// ==========================================================================

import {
  db,
  ref,
  set,
  push,
  remove,
  onValue
} from './firebase-config.js';
import { currentUser } from './auth.js';
import { escapeHtml } from './notifications.js';

export let callLogsMap = {};

// Record Call to Realtime Database
export async function recordCallLog(callerUid, callerName, receiverUid, receiverName, callType, status, durationSec) {
  if (!callerUid || !receiverUid) return;
  const now = Date.now();

  // 1. Record for Caller
  try {
    const callerRef = push(ref(db, `call_logs/${callerUid}`));
    await set(callerRef, {
      id: callerRef.key,
      partnerUid: receiverUid,
      partnerName: receiverName,
      callType: callType,
      direction: 'outgoing',
      status: status,
      duration: durationSec || 0,
      timestamp: now
    });
  } catch (e) {}

  // 2. Record for Receiver
  try {
    const receiverRef = push(ref(db, `call_logs/${receiverUid}`));
    await set(receiverRef, {
      id: receiverRef.key,
      partnerUid: callerUid,
      partnerName: callerName,
      callType: callType,
      direction: 'incoming',
      status: status === 'declined' || status === 'missed' ? 'missed' : 'completed',
      duration: durationSec || 0,
      timestamp: now
    });
  } catch (e) {}
}

// Listen to Realtime Call Logs
export function setupCallLogsListener(onLogsUpdated) {
  if (!currentUser) return;
  const logsRef = ref(db, `call_logs/${currentUser.uid}`);
  onValue(logsRef, (snap) => {
    callLogsMap = snap.val() || {};
    const missedCount = Object.values(callLogsMap).filter(l => l.status === 'missed').length;
    const badge = document.getElementById('missedCallsBadge');
    if (badge) {
      if (missedCount > 0) {
        badge.innerText = missedCount;
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    }
    if (typeof onLogsUpdated === 'function') {
      onLogsUpdated(callLogsMap);
    }
  });
}

// Format Duration
export function formatCallDuration(seconds) {
  if (!seconds || seconds <= 0) return '';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

// Format Relative Call Date & Time
export function formatCallDate(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (isToday) return `Today, ${timeStr}`;

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return `Yesterday, ${timeStr}`;

  return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${timeStr}`;
}

// Render Calls History Tab
export function renderCallsHistory(onCallPartner) {
  const callsList = document.getElementById('callsList');
  const searchInput = document.getElementById('searchChatsInput');
  if (!currentUser || !callsList) return;

  callsList.innerHTML = '';
  const logsArray = Object.values(callLogsMap || {});
  const searchTerm = (searchInput?.value || '').toLowerCase().trim();

  // Filter & sort descending
  const filteredLogs = logsArray.filter(log => {
    return !searchTerm || (log.partnerName || '').toLowerCase().includes(searchTerm);
  }).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  if (filteredLogs.length === 0) {
    callsList.innerHTML = `
      <div class="flex flex-col items-center justify-center p-8 text-center text-[#8696a0] space-y-2 select-none">
        <div class="w-12 h-12 rounded-full bg-[#202c33] flex items-center justify-center text-slate-400 text-xl mb-1">
          📞
        </div>
        <p class="text-sm font-medium text-[#e9edef]">No recent calls</p>
        <p class="text-xs max-w-xs text-[#8696a0]">Audio ya video call karne ke liye kisi bhi friend ki chat open karke Call button press karein.</p>
      </div>
    `;
    return;
  }

  // Header with Clear button
  const headerEl = document.createElement('div');
  headerEl.className = 'px-4 py-2 text-[12px] font-medium text-[#8696a0] uppercase tracking-wider flex items-center justify-between border-b border-[#222d34]/60';
  headerEl.innerHTML = `
    <span>Recent Calls (${filteredLogs.length})</span>
    <button id="clearCallLogsBtn" class="text-[#00a884] hover:underline lowercase text-[12px]">clear all</button>
  `;
  callsList.appendChild(headerEl);

  const clearBtn = headerEl.querySelector('#clearCallLogsBtn');
  if (clearBtn) {
    clearBtn.addEventListener('click', async () => {
      if (confirm('Kya aap call history clear karna chahte hain?')) {
        try {
          await remove(ref(db, `call_logs/${currentUser.uid}`));
          callLogsMap = {};
          renderCallsHistory(onCallPartner);
        } catch (e) {}
      }
    });
  }

  filteredLogs.forEach(log => {
    const item = document.createElement('div');
    item.className = 'px-4 py-3 hover:bg-[#202c33] cursor-pointer flex items-center justify-between gap-3 transition select-none border-b border-[#222d34]/60';

    const partnerName = log.partnerName || 'Friend';
    const avatarChar = partnerName.charAt(0).toUpperCase();
    const isVideo = log.callType === 'video';
    const isMissed = log.status === 'missed';
    const isOutgoing = log.direction === 'outgoing';

    let directionIcon = '';
    let statusColor = 'text-[#8696a0]';
    let statusText = formatCallDate(log.timestamp);

    if (isMissed) {
      statusColor = 'text-rose-400';
      directionIcon = `
        <svg class="w-3.5 h-3.5 text-rose-500 transform rotate-[225deg]" fill="currentColor" viewBox="0 0 24 24">
          <path d="M5 13h11.86l-5.43 5.43 1.42 1.42L21.14 12l-8.29-7.85-1.42 1.42L16.86 11H5v2z"/>
        </svg>
      `;
      statusText += ' · Missed';
    } else if (isOutgoing) {
      directionIcon = `
        <svg class="w-3.5 h-3.5 text-[#00a884] transform -rotate-45" fill="currentColor" viewBox="0 0 24 24">
          <path d="M5 13h11.86l-5.43 5.43 1.42 1.42L21.14 12l-8.29-7.85-1.42 1.42L16.86 11H5v2z"/>
        </svg>
      `;
      if (log.duration > 0) statusText += ` · ${formatCallDuration(log.duration)}`;
    } else {
      directionIcon = `
        <svg class="w-3.5 h-3.5 text-[#00a884] transform rotate-[225deg]" fill="currentColor" viewBox="0 0 24 24">
          <path d="M5 13h11.86l-5.43 5.43 1.42 1.42L21.14 12l-8.29-7.85-1.42 1.42L16.86 11H5v2z"/>
        </svg>
      `;
      if (log.duration > 0) statusText += ` · ${formatCallDuration(log.duration)}`;
    }

    item.innerHTML = `
      <div class="flex items-center gap-3.5 min-w-0">
        <div class="w-12 h-12 rounded-full bg-[#6a7b83] flex items-center justify-center font-bold text-white flex-shrink-0 text-base overflow-hidden">
          ${avatarChar}
        </div>
        <div class="min-w-0">
          <h4 class="font-normal text-[16px] ${isMissed ? 'text-rose-400' : 'text-[#e9edef]'} truncate">${escapeHtml(partnerName)}</h4>
          <p class="text-[13px] ${statusColor} flex items-center gap-1.5 truncate mt-0.5 font-normal">
            ${directionIcon}
            <span>${statusText}</span>
          </p>
        </div>
      </div>

      <!-- Quick Recall Button -->
      <button title="Call Back" class="quickRecallBtn p-2 rounded-full hover:bg-[#374248] text-[#aebac1] hover:text-white transition flex-shrink-0">
        ${isVideo ? `
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
          </svg>
        ` : `
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 00-1.01.24l-1.57 1.97c-2.83-1.44-5.15-3.75-6.59-6.59l1.97-1.57c.28-.28.36-.67.25-1.02A11.36 11.36 0 019 4.29c0-.56-.45-1-1-1H4.01c-.56 0-1 .45-1 1C3.01 13.9 11.1 22 21.01 22c.56 0 1-.45 1-1v-3.99c0-.56-.45-.63-.01-1.63z"/>
          </svg>
        `}
      </button>
    `;

    const recallBtn = item.querySelector('.quickRecallBtn');
    if (recallBtn && log.partnerUid) {
      recallBtn.onclick = (e) => {
        e.stopPropagation();
        if (typeof onCallPartner === 'function') {
          onCallPartner(log.partnerUid, partnerName, log.callType || 'voice');
        }
      };
    }

    callsList.appendChild(item);
  });
}
