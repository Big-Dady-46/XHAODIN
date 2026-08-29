// ==========================================================================
// A&H Chat - Main Application Coordinator (WhatsApp Web Style)
// ==========================================================================

import {
  currentUser,
  initAuthObserver,
  loginUser,
  registerUser,
  logoutUser
} from './auth.js';

import {
  soundEnabled,
  setSoundEnabled
} from './audio-service.js';

import {
  requestNotificationPermission
} from './notifications.js';

import {
  initChatsListeners,
  renderSidebarList,
  openChat,
  sendMessage,
  createGroup,
  setActiveFilter,
  currentFilter,
  activeChatId,
  activePartnerUid,
  usersMap
} from './chats.js';

import {
  initiateCall,
  setupIncomingCallsListener,
  acceptCall,
  declineCall,
  endCall,
  toggleMic,
  toggleCam
} from './webrtc-call.js';

import {
  setupCallLogsListener,
  renderCallsHistory
} from './calls-history.js';

// DOM Elements
const authScreen = document.getElementById('authScreen');
const chatScreen = document.getElementById('chatScreen');
const authForm = document.getElementById('authForm');
const tabLogin = document.getElementById('tabLogin');
const tabRegister = document.getElementById('tabRegister');
const authHeading = document.getElementById('authHeading');
const authSubheading = document.getElementById('authSubheading');
const authSubmitBtn = document.getElementById('authSubmitBtn');
const usernameFieldWrapper = document.getElementById('usernameFieldWrapper');
const usernameInput = document.getElementById('usernameInput');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const authError = document.getElementById('authError');
const logoutBtn = document.getElementById('logoutBtn');
const soundToggleBtn = document.getElementById('soundToggleBtn');
const menuDotsBtn = document.getElementById('menuDotsBtn');
const menuDropdown = document.getElementById('menuDropdown');
const myAvatarMini = document.getElementById('myAvatarMini');
const myUsernameMini = document.getElementById('myUsernameMini');

// Filter Chips
const filterChipAll = document.getElementById('filterChipAll');
const filterChipUnread = document.getElementById('filterChipUnread');
const filterChipFavorites = document.getElementById('filterChipFavorites');
const filterChipGroups = document.getElementById('filterChipGroups');
const filterChipCalls = document.getElementById('filterChipCalls');

const channelsList = document.getElementById('channelsList');
const callsList = document.getElementById('callsList');
const searchChatsInput = document.getElementById('searchChatsInput');
const newGroupBtn = document.getElementById('newGroupBtn');
const mobileBackBtn = document.getElementById('mobileBackBtn');
const sidebarCol = document.getElementById('sidebarCol');
const chatAreaCol = document.getElementById('chatAreaCol');
const chatForm = document.getElementById('chatForm');
const messageInput = document.getElementById('messageInput');
const startVideoCallBtn = document.getElementById('startVideoCallBtn');
const startVoiceCallBtn = document.getElementById('startVoiceCallBtn');
const callEndBtn = document.getElementById('callEndBtn');
const acceptCallBtn = document.getElementById('acceptCallBtn');
const declineCallBtn = document.getElementById('declineCallBtn');
const callToggleMicBtn = document.getElementById('callToggleMicBtn');
const callToggleCamBtn = document.getElementById('callToggleCamBtn');

let isRegisterMode = false;

// 1. Initialize Auth
initAuthObserver(
  // On Logged In
  (user, displayName) => {
    if (myAvatarMini) myAvatarMini.innerText = displayName.charAt(0).toUpperCase();
    if (myUsernameMini) myUsernameMini.innerText = displayName;

    authScreen.classList.add('hidden');
    chatScreen.classList.remove('hidden');

    requestNotificationPermission();

    // Start Realtime Listeners
    initChatsListeners(() => {
      renderSidebarList();
    });

    setupIncomingCallsListener();
    setupCallLogsListener(() => {
      if (currentFilter === 'calls') {
        renderCallsHistory((partnerUid, partnerName, callType) => {
          const directChatId = [currentUser.uid, partnerUid].sort().join('_');
          openChat(directChatId, partnerName, 'direct', partnerUid);
          initiateCall(partnerUid, partnerName, callType);
        });
      }
    });

    // Default open Squad Chat
    openChat('group_squad', 'Squad Main Group', 'group');
  },
  // On Logged Out
  () => {
    authScreen.classList.remove('hidden');
    chatScreen.classList.add('hidden');
  }
);

// 2. Auth Tab Switchers
tabLogin.addEventListener('click', () => {
  isRegisterMode = false;
  tabLogin.className = 'flex-1 py-1.5 text-xs font-semibold rounded-md bg-[#00a884] text-white transition';
  tabRegister.className = 'flex-1 py-1.5 text-xs font-semibold rounded-md text-[#8696a0] hover:text-white transition';
  authHeading.innerText = 'Sign In to WhatsApp Web';
  authSubheading.innerText = 'Apna email aur password enter karein';
  authSubmitBtn.innerHTML = '<span>Login Now</span>';
  usernameFieldWrapper.classList.add('hidden');
  authError.classList.add('hidden');
});

tabRegister.addEventListener('click', () => {
  isRegisterMode = true;
  tabRegister.className = 'flex-1 py-1.5 text-xs font-semibold rounded-md bg-[#00a884] text-white transition';
  tabLogin.className = 'flex-1 py-1.5 text-xs font-semibold rounded-md text-[#8696a0] hover:text-white transition';
  authHeading.innerText = 'Create WhatsApp Account';
  authSubheading.innerText = 'Naya account banayein aur chat start karein';
  authSubmitBtn.innerHTML = '<span>Create Account</span>';
  usernameFieldWrapper.classList.remove('hidden');
  authError.classList.add('hidden');
});

// 3. Auth Form Submit
authForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  authError.classList.add('hidden');
  authSubmitBtn.disabled = true;
  authSubmitBtn.classList.add('opacity-70');

  const email = emailInput.value.trim();
  const password = passwordInput.value;
  const username = usernameInput.value.trim();

  try {
    if (isRegisterMode) {
      await registerUser(email, password, username);
    } else {
      await loginUser(email, password);
    }
  } catch (err) {
    console.error('Auth error:', err);
    authError.innerText = err.message.replace('Firebase: ', '');
    authError.classList.remove('hidden');
  } finally {
    authSubmitBtn.disabled = false;
    authSubmitBtn.classList.remove('opacity-70');
  }
});

// 4. Menu Dropdown Toggle
if (menuDotsBtn && menuDropdown) {
  menuDotsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    menuDropdown.classList.toggle('hidden');
  });

  document.addEventListener('click', () => {
    menuDropdown.classList.add('hidden');
  });
}

// 5. Logout
if (logoutBtn) {
  logoutBtn.addEventListener('click', () => logoutUser());
}

// 6. Sound Toggle
if (soundToggleBtn) {
  soundToggleBtn.addEventListener('click', () => {
    setSoundEnabled(!soundEnabled);
    const statusText = soundToggleBtn.querySelector('span:last-child');
    if (statusText) statusText.innerText = soundEnabled ? 'ON' : 'OFF';
  });
}

// 7. WhatsApp Filter Chips Switching
function setFilter(filterName) {
  setActiveFilter(filterName);

  const chips = [filterChipAll, filterChipUnread, filterChipFavorites, filterChipGroups, filterChipCalls];
  chips.forEach(chip => {
    if (chip) chip.classList.remove('active');
  });

  if (filterName === 'all' && filterChipAll) filterChipAll.classList.add('active');
  if (filterName === 'unread' && filterChipUnread) filterChipUnread.classList.add('active');
  if (filterName === 'favorites' && filterChipFavorites) filterChipFavorites.classList.add('active');
  if (filterName === 'groups' && filterChipGroups) filterChipGroups.classList.add('active');
  if (filterName === 'calls' && filterChipCalls) filterChipCalls.classList.add('active');

  if (filterName === 'calls') {
    channelsList.classList.add('hidden');
    callsList.classList.remove('hidden');
    renderCallsHistory((partnerUid, partnerName, callType) => {
      const directChatId = [currentUser.uid, partnerUid].sort().join('_');
      openChat(directChatId, partnerName, 'direct', partnerUid);
      initiateCall(partnerUid, partnerName, callType);
    });
  } else {
    callsList.classList.add('hidden');
    channelsList.classList.remove('hidden');
    renderSidebarList();
  }
}

if (filterChipAll) filterChipAll.addEventListener('click', () => setFilter('all'));
if (filterChipUnread) filterChipUnread.addEventListener('click', () => setFilter('unread'));
if (filterChipFavorites) filterChipFavorites.addEventListener('click', () => setFilter('favorites'));
if (filterChipGroups) filterChipGroups.addEventListener('click', () => setFilter('groups'));
if (filterChipCalls) filterChipCalls.addEventListener('click', () => setFilter('calls'));

// 8. Search Input
searchChatsInput.addEventListener('input', () => {
  if (currentFilter === 'calls') {
    renderCallsHistory((partnerUid, partnerName, callType) => {
      const directChatId = [currentUser.uid, partnerUid].sort().join('_');
      openChat(directChatId, partnerName, 'direct', partnerUid);
      initiateCall(partnerUid, partnerName, callType);
    });
  } else {
    renderSidebarList();
  }
});

// 9. Create New Group
if (newGroupBtn) {
  newGroupBtn.addEventListener('click', () => {
    const name = prompt('Naya Group ka Name enter karein (e.g. Squad, Family):');
    if (name) createGroup(name);
  });
}

// 10. Mobile Back Button
mobileBackBtn.addEventListener('click', () => {
  sidebarCol.classList.remove('hidden');
  chatAreaCol.classList.add('hidden');
});

// 11. Send Message Form Submit
chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = messageInput.value;
  if (text.trim()) {
    sendMessage(text);
    messageInput.value = '';
    messageInput.focus();
  }
});

// 12. Calling Controls Trigger
startVideoCallBtn.addEventListener('click', () => {
  if (activePartnerUid) {
    const partner = usersMap[activePartnerUid];
    const partnerName = partner?.username || partner?.email?.split('@')[0] || 'Friend';
    initiateCall(activePartnerUid, partnerName, 'video');
  } else {
    alert('Direct Contact select karein video call karne ke liye.');
  }
});

startVoiceCallBtn.addEventListener('click', () => {
  if (activePartnerUid) {
    const partner = usersMap[activePartnerUid];
    const partnerName = partner?.username || partner?.email?.split('@')[0] || 'Friend';
    initiateCall(activePartnerUid, partnerName, 'voice');
  } else {
    alert('Direct Contact select karein voice call karne ke liye.');
  }
});

callEndBtn.addEventListener('click', () => {
  const partner = usersMap[activePartnerUid];
  const partnerName = partner?.username || partner?.email?.split('@')[0] || 'Friend';
  endCall(activePartnerUid, partnerName);
});

acceptCallBtn.addEventListener('click', acceptCall);
declineCallBtn.addEventListener('click', declineCall);
callToggleMicBtn.addEventListener('click', toggleMic);
callToggleCamBtn.addEventListener('click', toggleCam);
