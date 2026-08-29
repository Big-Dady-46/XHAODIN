// ==========================================================================
// A&H Chat - Chats, Groups, & Messaging Service (WhatsApp Web Style)
// Realtime message sending, stream listeners, read receipts & delivery status
// ==========================================================================

import {
  db,
  ref,
  push,
  set,
  update,
  onValue,
  serverTimestamp
} from './firebase-config.js';
import { currentUser } from './auth.js';
import { playNotificationSound } from './audio-service.js';
import { triggerToast, escapeHtml } from './notifications.js';

export let activeChatId = 'group_squad';
export let activeChatType = 'group'; // 'group' | 'direct'
export let activePartnerUid = null;
export let activeMessagesUnsubscribe = null;

export let usersMap = {};
export let groupsMap = {};
export let chatsSummaryMap = {};
export let currentFilter = 'all'; // 'all' | 'unread' | 'favorites' | 'groups' | 'calls'

let knownMessageIds = new Set();
let isInitialGlobalLoad = true;

// Set Active Filter
export function setActiveFilter(filter) {
  currentFilter = filter;
}

// Generate Deterministic Direct Chat ID
export function getDirectChatId(uid1, uid2) {
  return [uid1, uid2].sort().join('_');
}

// Format Time
export function formatTime(timestamp) {
  if (!timestamp) return '';
  const date = typeof timestamp === 'number' ? new Date(timestamp) : new Date();
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Format Last Seen
export function formatLastSeen(lastSeenVal, isOnline) {
  if (isOnline) return 'online';
  if (!lastSeenVal) return 'offline';
  const date = new Date(lastSeenVal);
  const now = new Date();
  const diffMinutes = Math.floor((now - date) / (1000 * 60));

  if (diffMinutes < 1) return 'last seen just now';
  if (diffMinutes < 60) return `last seen ${diffMinutes}m ago`;

  const isToday = date.toDateString() === now.toDateString();
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (isToday) return `last seen today at ${timeStr}`;
  return `last seen ${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${timeStr}`;
}

// Listen to Global App Data (Users, Groups, Chats summary)
export function initChatsListeners(onDataUpdated) {
  // 1. Users
  onValue(ref(db, 'users'), (snap) => {
    usersMap = snap.val() || {};
    if (typeof onDataUpdated === 'function') onDataUpdated();
  });

  // 2. Groups
  onValue(ref(db, 'groups'), (snap) => {
    groupsMap = snap.val() || {};
    if (typeof onDataUpdated === 'function') onDataUpdated();
  });

  // 3. All Chats (for unread count & delivery status)
  onValue(ref(db, 'chats'), (snap) => {
    const chats = snap.val() || {};
    processIncomingChatsForDeliveryAndBadges(chats);
    if (typeof onDataUpdated === 'function') onDataUpdated();
  });
}

// Process Incoming Chats for Delivery & Badges
function processIncomingChatsForDeliveryAndBadges(chats) {
  if (!currentUser) return;
  const newSummaries = {};

  Object.keys(chats).forEach((chatId) => {
    const chatData = chats[chatId];
    const messages = chatData?.messages || {};
    const msgKeys = Object.keys(messages);

    if (msgKeys.length === 0) return;

    let unreadCount = 0;
    let lastMsg = null;
    let lastTimestamp = 0;

    const isGroup = chatId === 'group_squad' || !!groupsMap[chatId];
    let chatTitle = isGroup ? (groupsMap[chatId]?.name || 'Squad Main Group') : '';

    msgKeys.forEach((mId) => {
      const msg = messages[mId];
      if (!msg) return;

      const msgTime = msg.createdAt || 0;
      if (msgTime > lastTimestamp || !lastMsg) {
        lastTimestamp = msgTime;
        lastMsg = msg;
      }

      const isFromMe = msg.senderId === currentUser.uid;

      if (!isFromMe) {
        // Mark delivered if user is online
        if (msg.status === 'sent') {
          update(ref(db, `chats/${chatId}/messages/${mId}`), { status: 'delivered' });
        }

        // Mark read if chat is active & window visible
        if (activeChatId === chatId && document.visibilityState === 'visible') {
          if (msg.status !== 'read') {
            update(ref(db, `chats/${chatId}/messages/${mId}`), { status: 'read' });
          }
        } else {
          if (msg.status !== 'read') {
            unreadCount++;
          }
        }

        // Toast on new message
        if (!isInitialGlobalLoad && !knownMessageIds.has(mId) && chatId !== activeChatId) {
          const partner = usersMap[msg.senderId];
          const senderDisplayName = msg.senderName || partner?.username || 'Friend';
          const displayTitle = isGroup ? chatTitle : senderDisplayName;
          triggerToast(
            senderDisplayName,
            msg.text,
            senderDisplayName,
            chatId,
            isGroup ? 'group' : 'direct',
            displayTitle,
            isGroup ? null : msg.senderId,
            (cId, title, type, pUid) => openChat(cId, title, type, pUid)
          );
          playNotificationSound();
        }
      }

      knownMessageIds.add(mId);
    });

    newSummaries[chatId] = {
      lastMessage: lastMsg?.text || '',
      lastTime: lastMsg?.createdAt ? formatTime(lastMsg.createdAt) : (lastMsg?.time || ''),
      lastTimestamp: lastTimestamp,
      lastSenderName: lastMsg?.senderName || '',
      lastSenderId: lastMsg?.senderId || '',
      status: lastMsg?.status || 'sent',
      unreadCount: unreadCount
    };
  });

  isInitialGlobalLoad = false;
  chatsSummaryMap = newSummaries;
}

// Render Sidebar Conversations (WhatsApp Web Style)
export function renderSidebarList() {
  const channelsList = document.getElementById('channelsList');
  const searchInput = document.getElementById('searchChatsInput');
  if (!currentUser || !channelsList) return;

  const searchTerm = (searchInput?.value || '').toLowerCase().trim();
  channelsList.innerHTML = '';

  // 1. Squad Main Group
  const squadSummary = chatsSummaryMap['group_squad'] || {};
  const squadMatches = 'squad main group'.includes(searchTerm) || (squadSummary.lastMessage || '').toLowerCase().includes(searchTerm);
  const showSquad = currentFilter === 'all' || currentFilter === 'groups' || (currentFilter === 'unread' && squadSummary.unreadCount > 0);

  if (squadMatches && showSquad) {
    const isActive = activeChatId === 'group_squad';
    const item = document.createElement('div');
    item.className = `px-4 py-3 cursor-pointer flex items-center gap-3.5 transition-all select-none border-b border-[#222d34]/60 ${isActive ? 'bg-[#2a3942]' : 'hover:bg-[#202c33]'}`;
    item.onclick = () => openChat('group_squad', 'Squad Main Group', 'group');

    const unreadHtml = squadSummary.unreadCount > 0
      ? `<span class="bg-[#00a884] text-white text-[11px] font-semibold px-2 py-0.5 rounded-full min-w-[20px] text-center">${squadSummary.unreadCount}</span>`
      : '';

    item.innerHTML = `
      <div class="relative flex-shrink-0">
        <div class="w-12 h-12 rounded-full bg-[#6a7b83] flex items-center justify-center font-bold text-white text-lg overflow-hidden">👥</div>
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex justify-between items-baseline mb-1">
          <p class="text-[16px] font-normal text-[#e9edef] truncate">Squad Main Group</p>
          <span class="text-[12px] text-[#8696a0] font-normal">${squadSummary.lastTime || ''}</span>
        </div>
        <div class="flex justify-between items-center">
          <p class="text-[14px] text-[#8696a0] truncate pr-2 font-normal">
            ${squadSummary.lastMessage ? `${squadSummary.lastSenderId === currentUser.uid ? 'You: ' : squadSummary.lastSenderName + ': '}${escapeHtml(squadSummary.lastMessage)}` : 'Public Squad Chat'}
          </p>
          ${unreadHtml}
        </div>
      </div>
    `;
    channelsList.appendChild(item);
  }

  // 2. Custom Groups
  Object.keys(groupsMap).forEach((gId) => {
    if (gId === 'group_squad') return;
    const g = groupsMap[gId];
    const gSummary = chatsSummaryMap[gId] || {};
    const nameMatches = g.name.toLowerCase().includes(searchTerm) || (gSummary.lastMessage || '').toLowerCase().includes(searchTerm);
    const showGroup = currentFilter === 'all' || currentFilter === 'groups' || (currentFilter === 'unread' && gSummary.unreadCount > 0);

    if (!nameMatches || !showGroup) return;

    const isActive = activeChatId === gId;
    const item = document.createElement('div');
    item.className = `px-4 py-3 cursor-pointer flex items-center gap-3.5 transition-all select-none border-b border-[#222d34]/60 ${isActive ? 'bg-[#2a3942]' : 'hover:bg-[#202c33]'}`;
    item.onclick = () => openChat(gId, g.name, 'group');

    const unreadHtml = gSummary.unreadCount > 0
      ? `<span class="bg-[#00a884] text-white text-[11px] font-semibold px-2 py-0.5 rounded-full min-w-[20px] text-center">${gSummary.unreadCount}</span>`
      : '';

    item.innerHTML = `
      <div class="relative flex-shrink-0">
        <div class="w-12 h-12 rounded-full bg-[#6a7b83] flex items-center justify-center font-bold text-white text-lg overflow-hidden">💬</div>
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex justify-between items-baseline mb-1">
          <p class="text-[16px] font-normal text-[#e9edef] truncate">${escapeHtml(g.name)}</p>
          <span class="text-[12px] text-[#8696a0] font-normal">${gSummary.lastTime || ''}</span>
        </div>
        <div class="flex justify-between items-center">
          <p class="text-[14px] text-[#8696a0] truncate pr-2 font-normal">
            ${gSummary.lastMessage ? `${gSummary.lastSenderId === currentUser.uid ? 'You: ' : gSummary.lastSenderName + ': '}${escapeHtml(gSummary.lastMessage)}` : 'Group Chat'}
          </p>
          ${unreadHtml}
        </div>
      </div>
    `;
    channelsList.appendChild(item);
  });

  // 3. Direct Contacts
  if (currentFilter !== 'groups') {
    const otherUsers = Object.keys(usersMap).filter(uId => uId !== currentUser.uid);

    if (otherUsers.length === 0 && channelsList.children.length === 0) {
      const emptyNotice = document.createElement('div');
      emptyNotice.className = "p-8 text-center text-sm text-[#8696a0]";
      emptyNotice.innerText = "No other users registered yet. Open another tab in Incognito and register a 2nd user to chat!";
      channelsList.appendChild(emptyNotice);
      return;
    }

    otherUsers.sort((a, b) => {
      const chatA = getDirectChatId(currentUser.uid, a);
      const chatB = getDirectChatId(currentUser.uid, b);
      const timeA = chatsSummaryMap[chatA]?.lastTimestamp || 0;
      const timeB = chatsSummaryMap[chatB]?.lastTimestamp || 0;
      return timeB - timeA;
    });

    otherUsers.forEach((uId) => {
      const u = usersMap[uId];
      if (!u) return;

      const directChatId = getDirectChatId(currentUser.uid, uId);
      const summary = chatsSummaryMap[directChatId] || {};
      const username = u.username || u.email.split('@')[0];

      const matches = username.toLowerCase().includes(searchTerm) || (summary.lastMessage || '').toLowerCase().includes(searchTerm);
      const showContact = currentFilter === 'all' || (currentFilter === 'unread' && summary.unreadCount > 0) || currentFilter === 'favorites';

      if (!matches || !showContact) return;

      const isActive = activeChatId === directChatId;
      const isOnline = u.online === true;

      const item = document.createElement('div');
      item.className = `px-4 py-3 cursor-pointer flex items-center gap-3.5 transition-all select-none border-b border-[#222d34]/60 ${isActive ? 'bg-[#2a3942]' : 'hover:bg-[#202c33]'}`;
      item.onclick = () => openChat(directChatId, username, 'direct', uId);

      let tickSnippet = '';
      if (summary.lastSenderId === currentUser.uid && summary.lastMessage) {
        if (summary.status === 'read') {
          tickSnippet = `<span class="tick-blue font-bold mr-1 text-xs">✓✓</span>`;
        } else if (summary.status === 'delivered') {
          tickSnippet = `<span class="tick-gray font-bold mr-1 text-xs">✓✓</span>`;
        } else {
          tickSnippet = `<span class="tick-gray font-bold mr-1 text-xs">✓</span>`;
        }
      }

      const unreadHtml = summary.unreadCount > 0
        ? `<span class="bg-[#00a884] text-white text-[11px] font-semibold px-2 py-0.5 rounded-full min-w-[20px] text-center">${summary.unreadCount}</span>`
        : '';

      const avatarLetter = username.charAt(0).toUpperCase();

      item.innerHTML = `
        <div class="relative flex-shrink-0">
          <div class="w-12 h-12 rounded-full bg-[#6a7b83] flex items-center justify-center font-bold text-white uppercase text-base overflow-hidden">
            ${avatarLetter}
          </div>
          ${isOnline ? '<span class="w-3 h-3 rounded-full bg-[#00a884] border-2 border-[#111b21] absolute bottom-0 right-0"></span>' : ''}
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex justify-between items-baseline mb-1">
            <p class="text-[16px] font-normal text-[#e9edef] truncate">${escapeHtml(username)}</p>
            <span class="text-[12px] text-[#8696a0] font-normal">${summary.lastTime || ''}</span>
          </div>
          <div class="flex justify-between items-center">
            <p class="text-[14px] text-[#8696a0] truncate pr-2 flex items-center font-normal">
              ${tickSnippet}
              <span class="truncate">${summary.lastMessage ? escapeHtml(summary.lastMessage) : (isOnline ? '<span class="text-[#00a884]">online</span>' : 'offline')}</span>
            </p>
            ${unreadHtml}
          </div>
        </div>
      `;
      channelsList.appendChild(item);
    });
  }
}

// Open Chat
export function openChat(chatId, title, type, partnerUid = null) {
  activeChatId = chatId;
  activeChatType = type;
  activePartnerUid = partnerUid;

  const sidebarCol = document.getElementById('sidebarCol');
  const chatAreaCol = document.getElementById('chatAreaCol');
  if (sidebarCol && chatAreaCol) {
    sidebarCol.classList.add('hidden', 'md:flex');
    chatAreaCol.classList.remove('hidden');
  }

  updateChatHeader(title);

  if (typeof activeMessagesUnsubscribe === 'function') {
    activeMessagesUnsubscribe();
    activeMessagesUnsubscribe = null;
  }

  loadActiveChatMessages();
  renderSidebarList();
}

// Update Active Chat Header
export function updateChatHeader(overrideTitle = null) {
  const titleElem = document.getElementById('activeChatTitle');
  const subElem = document.getElementById('activeChatSubtitle');
  const avatarElem = document.getElementById('activeAvatar');
  const onlineDot = document.getElementById('activeHeaderOnlineDot');

  if (!titleElem || !subElem || !avatarElem) return;

  if (activeChatType === 'group') {
    const groupName = overrideTitle || (groupsMap[activeChatId]?.name || 'Squad Main Group');
    titleElem.innerText = groupName;
    avatarElem.innerText = '👥';
    avatarElem.className = 'w-10 h-10 rounded-full bg-[#6a7b83] flex items-center justify-center font-bold text-white text-sm uppercase overflow-hidden';
    subElem.innerHTML = `<span class="text-[#8696a0]">group chat</span>`;
    if (onlineDot) onlineDot.classList.add('hidden');
  } else {
    const partner = usersMap[activePartnerUid];
    const partnerName = overrideTitle || partner?.username || partner?.email?.split('@')[0] || 'Direct Chat';
    titleElem.innerText = partnerName;
    avatarElem.innerText = partnerName.charAt(0).toUpperCase();
    avatarElem.className = 'w-10 h-10 rounded-full bg-[#6a7b83] flex items-center justify-center font-bold text-white text-sm uppercase overflow-hidden';

    if (partner) {
      const statusText = formatLastSeen(partner.lastSeen, partner.online);
      if (partner.online) {
        subElem.innerHTML = `<span class="text-[#00a884]">online</span>`;
        if (onlineDot) onlineDot.classList.remove('hidden');
      } else {
        subElem.innerHTML = `<span class="text-[#8696a0]">${statusText}</span>`;
        if (onlineDot) onlineDot.classList.add('hidden');
      }
    } else {
      subElem.innerHTML = `<span class="text-[#8696a0]">offline</span>`;
      if (onlineDot) onlineDot.classList.add('hidden');
    }
  }
}

// Load Active Chat Messages (WhatsApp Web Exact Style)
function loadActiveChatMessages() {
  const messagesArea = document.getElementById('messagesArea');
  if (!messagesArea) return;

  const messagesRef = ref(db, `chats/${activeChatId}/messages`);
  messagesArea.innerHTML = `
    <div class="flex items-center justify-center h-32 text-xs text-[#8696a0]">
      <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-[#00a884] mr-2"></div>
      Loading messages...
    </div>
  `;

  let isInitialLoad = true;

  activeMessagesUnsubscribe = onValue(messagesRef, (snapshot) => {
    messagesArea.innerHTML = '';
    const data = snapshot.val();

    if (!data || Object.keys(data).length === 0) {
      messagesArea.innerHTML = `
        <div class="flex-1 flex flex-col items-center justify-center text-center p-6 select-none">
          <div class="w-12 h-12 rounded-full bg-[#202c33] flex items-center justify-center text-slate-400 mb-2 text-xl">💬</div>
          <p class="text-sm text-[#8696a0]">No messages here yet</p>
        </div>
      `;
      return;
    }

    const sortedMessages = Object.keys(data).map(id => ({ id, ...data[id] }))
      .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

    let lastMessageFromOther = null;

    sortedMessages.forEach((msg) => {
      const isMe = msg.senderId === currentUser.uid;

      if (!isMe && msg.status !== 'read') {
        update(ref(db, `chats/${activeChatId}/messages/${msg.id}`), { status: 'read' });
        lastMessageFromOther = msg;
      }

      const msgRow = document.createElement('div');
      msgRow.className = `flex ${isMe ? 'justify-end' : 'justify-start'} w-full my-0.5`;

      let tickElement = '';
      if (isMe) {
        if (msg.status === 'read') {
          tickElement = `<span title="Read" class="tick-blue flex items-center font-bold text-[11px] leading-none ml-1">✓✓</span>`;
        } else if (msg.status === 'delivered') {
          tickElement = `<span title="Delivered" class="tick-gray flex items-center font-bold text-[11px] leading-none ml-1">✓✓</span>`;
        } else {
          tickElement = `<span title="Sent" class="tick-gray flex items-center font-bold text-[11px] leading-none ml-1">✓</span>`;
        }
      }

      const bubbleClass = isMe ? 'msg-bubble-out' : 'msg-bubble-in';
      const senderNameDisplay = isMe
        ? ''
        : `<div class="text-[12.5px] font-medium text-[#00a884] mb-0.5">${escapeHtml(msg.senderName || 'Friend')}</div>`;

      msgRow.innerHTML = `
        <div class="max-w-[85%] sm:max-w-[65%] px-3 py-1.5 text-sm relative ${bubbleClass} break-words shadow-sm">
          ${senderNameDisplay}
          <div class="text-[14.2px] text-[#e9edef] leading-relaxed pr-14">${escapeHtml(msg.text)}</div>
          <div class="absolute bottom-1 right-2 text-[11px] text-[#8696a0] flex items-center justify-end gap-1 select-none">
            <span>${msg.time || formatTime(msg.createdAt)}</span>
            ${tickElement}
          </div>
        </div>
      `;
      messagesArea.appendChild(msgRow);
    });

    messagesArea.scrollTop = messagesArea.scrollHeight;

    if (!isInitialLoad && lastMessageFromOther) {
      playNotificationSound();
    }
    isInitialLoad = false;
  });
}

// Send Message
export async function sendMessage(text) {
  if (!text || !text.trim() || !currentUser || !activeChatId) return;

  const now = new Date();
  const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const messagesRef = ref(db, `chats/${activeChatId}/messages`);
  const newMsgRef = push(messagesRef);

  await set(newMsgRef, {
    id: newMsgRef.key,
    senderId: currentUser.uid,
    senderName: currentUser.displayName || currentUser.email.split('@')[0],
    text: text.trim(),
    createdAt: Date.now(),
    time: timeString,
    status: 'sent'
  });
}

// Create New Group
export async function createGroup(groupName) {
  if (!groupName || !groupName.trim() || !currentUser) return;
  const newGroupRef = push(ref(db, 'groups'));
  const groupId = newGroupRef.key;

  await set(newGroupRef, {
    id: groupId,
    name: groupName.trim(),
    createdBy: currentUser.uid,
    createdAt: serverTimestamp()
  });

  openChat(groupId, groupName.trim(), 'group');
}
