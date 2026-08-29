// ==========================================================================
// XHAODIN Chat - WebRTC Realtime Calling System (Premium UI)
// Voice & Video 1-to-1 Calls with Google STUN Servers & Firebase RTDB Signaling
// ==========================================================================

import {
  db,
  ref,
  set,
  push,
  update,
  onValue,
  onChildAdded
} from './firebase-config.js';
import { currentUser } from './auth.js';
import {
  playRingtone,
  playOutgoingTone,
  playCallConnected,
  playCallEnded,
  stopCallSounds
} from './audio-service.js';
import { recordCallLog } from './calls-history.js';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ]
};

let peerConnection = null;
let localStream = null;
let remoteStream = null;
let activeCallId = null;
let activeCallRole = null;
let currentCallType = 'voice';
let currentCallData = null;
let callTimerInterval = null;
let callSeconds = 0;
let isMicMuted = false;
let isCamOff = false;

// DOM Elements
const callOverlayModal = document.getElementById('callOverlayModal');
const callModalAvatar = document.getElementById('callModalAvatar');
const callModalName = document.getElementById('callModalName');
const callModalStatus = document.getElementById('callModalStatus');
const localVideoContainer = document.getElementById('localVideoContainer');
const localVideoEl = document.getElementById('localVideoEl');
const remoteVideoEl = document.getElementById('remoteVideoEl');
const remoteAvatarFallback = document.getElementById('remoteAvatarFallback');
const incomingCallModal = document.getElementById('incomingCallModal');
const incomingCallerName = document.getElementById('incomingCallerName');
const incomingCallTypeBadge = document.getElementById('incomingCallTypeBadge');
const incomingCallerAvatar = document.getElementById('incomingCallerAvatar');
const callToggleCamBtn = document.getElementById('callToggleCamBtn');
const callToggleMicBtn = document.getElementById('callToggleMicBtn');
const callSubstatus = document.getElementById('callSubstatus');

// 1. INITIATE CALL (Caller)
export async function initiateCall(partnerUid, partnerName, type = 'voice') {
  if (!currentUser) return alert('Please log in first.');
  if (!partnerUid) return alert('Please select a user to call.');

  currentCallType = type;
  activeCallRole = 'caller';
  callSeconds = 0;
  isMicMuted = false;
  isCamOff = false;

  // Setup UI - Premium Call Screen
  callModalName.innerText = partnerName || 'Friend';

  // Set avatar image
  const callModalAvatarImg = document.getElementById('callModalAvatarImg');
  if (callModalAvatarImg) {
    const avatarUrl = getCallAvatar(partnerName);
    callModalAvatarImg.src = avatarUrl;
  }

  callModalStatus.innerText = 'Connecting...';
  if (callSubstatus) callSubstatus.innerText = 'End-to-End Encrypted';

  // Show/hide video controls based on call type
  if (type === 'video') {
    callToggleCamBtn.classList.remove('hidden');
    callToggleCamBtn.classList.add('flex');
    localVideoContainer.classList.remove('hidden');
  } else {
    callToggleCamBtn.classList.add('hidden');
    callToggleCamBtn.classList.remove('flex');
    localVideoContainer.classList.add('hidden');
  }

  // Reset mic/cam button states
  if (callToggleMicBtn) {
    callToggleMicBtn.classList.remove('muted');
  }
  if (callToggleCamBtn) {
    callToggleCamBtn.classList.remove('muted');
  }

  callOverlayModal.classList.remove('hidden');
  callOverlayModal.classList.add('flex');
  playOutgoingTone();

  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: type === 'video' ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' } : false
    });

    if (type === 'video' && localVideoEl) {
      localVideoEl.srcObject = localStream;
    }

    peerConnection = new RTCPeerConnection(ICE_SERVERS);
    localStream.getTracks().forEach((track) => peerConnection.addTrack(track, localStream));

    peerConnection.ontrack = (event) => {
      remoteStream = event.streams[0];
      if (remoteVideoEl) {
        remoteVideoEl.srcObject = remoteStream;
        if (type === 'video') {
          remoteVideoEl.classList.remove('hidden');
          if (remoteAvatarFallback) remoteAvatarFallback.classList.add('hidden');
        }
      }
    };

    const callRef = push(ref(db, 'calls'));
    activeCallId = callRef.key;

    peerConnection.onicecandidate = (event) => {
      if (event.candidate && activeCallId) {
        push(ref(db, `calls/${activeCallId}/callerCandidates`), event.candidate.toJSON());
      }
    };

    const offerDescription = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offerDescription);

    const callPayload = {
      callId: activeCallId,
      callerUid: currentUser.uid,
      callerName: currentUser.displayName || currentUser.email.split('@')[0],
      receiverUid: partnerUid,
      receiverName: partnerName,
      callType: type,
      status: 'ringing',
      offer: {
        sdp: offerDescription.sdp,
        type: offerDescription.type
      },
      createdAt: Date.now()
    };

    await set(callRef, callPayload);

    // Listen for receiver Answer & Status Changes
    onValue(callRef, async (snapshot) => {
      const data = snapshot.val();
      if (!data) return;

      if (data.status === 'active' && data.answer && !peerConnection.currentRemoteDescription) {
        stopCallSounds();
        playCallConnected();
        const answerDescription = new RTCSessionDescription(data.answer);
        await peerConnection.setRemoteDescription(answerDescription);
        startCallTimer();
        if (callSubstatus) callSubstatus.innerText = 'Connected';
      }

      if (data.status === 'declined') {
        callModalStatus.innerText = 'Call Declined';
        if (callSubstatus) callSubstatus.innerText = 'Call was declined';
        playCallEnded();
        setTimeout(() => cleanupCall(), 1200);
      }

      if (data.status === 'ended') {
        callModalStatus.innerText = 'Call Ended';
        if (callSubstatus) callSubstatus.innerText = 'Call has ended';
        playCallEnded();
        setTimeout(() => cleanupCall(), 1200);
      }
    });

    // Listen for ICE candidates from receiver
    const receiverCandidatesRef = ref(db, `calls/${activeCallId}/receiverCandidates`);
    onChildAdded(receiverCandidatesRef, (snap) => {
      const candidateData = snap.val();
      if (candidateData && peerConnection) {
        peerConnection.addIceCandidate(new RTCIceCandidate(candidateData)).catch(() => {});
      }
    });

  } catch (err) {
    console.error('Call initiation error:', err);
    callModalStatus.innerText = 'Call Failed';
    if (callSubstatus) callSubstatus.innerText = err.message || 'Could not start call';
    playCallEnded();
    setTimeout(() => cleanupCall(), 2000);
  }
}

// 2. LISTEN FOR INCOMING CALLS (Receiver)
export function setupIncomingCallsListener() {
  if (!currentUser) return;
  const callsRef = ref(db, 'calls');

  onChildAdded(callsRef, (snapshot) => {
    const data = snapshot.val();
    if (!data || data.receiverUid !== currentUser.uid) return;
    if (data.status !== 'ringing') return;

    // Check if call is fresh (< 45s)
    if (Date.now() - (data.createdAt || 0) > 45000) return;

    activeCallId = data.callId;
    currentCallData = data;
    currentCallType = data.callType || 'voice';

    // Show Incoming Call Modal - Premium UI
    incomingCallerName.innerText = data.callerName || 'Incoming Call';
    incomingCallTypeBadge.innerText = `${currentCallType.toUpperCase()} CALL`;

    // Set avatar image
    const incomingCallerAvatarImg = document.getElementById('incomingCallerAvatarImg');
    if (incomingCallerAvatarImg) {
      const avatarUrl = getCallAvatar(data.callerName);
      incomingCallerAvatarImg.src = avatarUrl;
    }

    incomingCallModal.classList.remove('hidden');
    incomingCallModal.classList.add('flex');

    // Vibrate on mobile
    if ('vibrate' in navigator) {
      try { navigator.vibrate([400, 300, 400, 300, 1000]); } catch (e) {}
    }
    playRingtone();

    // Listen if caller cancelled
    const thisCallRef = ref(db, `calls/${activeCallId}`);
    onValue(thisCallRef, (snap) => {
      const updated = snap.val();
      if (updated && (updated.status === 'ended' || updated.status === 'declined')) {
        incomingCallModal.classList.add('hidden');
        incomingCallModal.classList.remove('flex');
        stopCallSounds();
      }
    });
  });
}

// 3. ACCEPT CALL
export async function acceptCall() {
  stopCallSounds();
  if (incomingCallModal) {
    incomingCallModal.classList.add('hidden');
    incomingCallModal.classList.remove('flex');
  }
  if (!activeCallId || !currentCallData) return;

  activeCallRole = 'receiver';
  const partnerName = currentCallData.callerName || 'Friend';

  callModalName.innerText = partnerName;

  // Set avatar
  const callModalAvatarImg = document.getElementById('callModalAvatarImg');
  if (callModalAvatarImg) {
    const avatarUrl = getCallAvatar(partnerName);
    callModalAvatarImg.src = avatarUrl;
  }

  callModalStatus.innerText = 'Connecting...';
  if (callSubstatus) callSubstatus.innerText = 'Establishing secure connection...';
  callSeconds = 0;
  isMicMuted = false;
  isCamOff = false;

  if (currentCallType === 'video') {
    callToggleCamBtn.classList.remove('hidden');
    callToggleCamBtn.classList.add('flex');
    localVideoContainer.classList.remove('hidden');
  } else {
    callToggleCamBtn.classList.add('hidden');
    callToggleCamBtn.classList.remove('flex');
    localVideoContainer.classList.add('hidden');
  }

  // Reset button states
  if (callToggleMicBtn) callToggleMicBtn.classList.remove('muted');
  if (callToggleCamBtn) callToggleCamBtn.classList.remove('muted');

  callOverlayModal.classList.remove('hidden');
  callOverlayModal.classList.add('flex');

  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: currentCallType === 'video' ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' } : false
    });

    if (currentCallType === 'video' && localVideoEl) {
      localVideoEl.srcObject = localStream;
    }

    peerConnection = new RTCPeerConnection(ICE_SERVERS);
    localStream.getTracks().forEach((track) => peerConnection.addTrack(track, localStream));

    peerConnection.ontrack = (event) => {
      remoteStream = event.streams[0];
      if (remoteVideoEl) {
        remoteVideoEl.srcObject = remoteStream;
        if (currentCallType === 'video') {
          remoteVideoEl.classList.remove('hidden');
          if (remoteAvatarFallback) remoteAvatarFallback.classList.add('hidden');
        }
      }
    };

    peerConnection.onicecandidate = (event) => {
      if (event.candidate && activeCallId) {
        push(ref(db, `calls/${activeCallId}/receiverCandidates`), event.candidate.toJSON());
      }
    };

    const offerDescription = new RTCSessionDescription(currentCallData.offer);
    await peerConnection.setRemoteDescription(offerDescription);

    const answerDescription = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answerDescription);

    await update(ref(db, `calls/${activeCallId}`), {
      status: 'active',
      answer: {
        sdp: answerDescription.sdp,
        type: answerDescription.type
      }
    });

    const callerCandidatesRef = ref(db, `calls/${activeCallId}/callerCandidates`);
    onChildAdded(callerCandidatesRef, (snap) => {
      const candidateData = snap.val();
      if (candidateData && peerConnection) {
        peerConnection.addIceCandidate(new RTCIceCandidate(candidateData)).catch(() => {});
      }
    });

    const callRef = ref(db, `calls/${activeCallId}`);
    onValue(callRef, (snap) => {
      const data = snap.val();
      if (data && data.status === 'ended') {
        callModalStatus.innerText = 'Call Ended';
        if (callSubstatus) callSubstatus.innerText = 'Call has ended';
        playCallEnded();
        setTimeout(() => cleanupCall(), 1200);
      }
    });

    playCallConnected();
    startCallTimer();
    if (callSubstatus) callSubstatus.innerText = 'Connected';

  } catch (err) {
    console.error('Accept call error:', err);
    callModalStatus.innerText = 'Connection Failed';
    if (callSubstatus) callSubstatus.innerText = err.message || 'Could not connect';
    playCallEnded();
    setTimeout(() => cleanupCall(), 2000);
  }
}

// 4. DECLINE CALL
export async function declineCall() {
  stopCallSounds();
  if (incomingCallModal) {
    incomingCallModal.classList.add('hidden');
    incomingCallModal.classList.remove('flex');
  }
  if (activeCallId && currentCallData) {
    try {
      await update(ref(db, `calls/${activeCallId}`), { status: 'declined' });
      await recordCallLog(
        currentCallData.callerUid,
        currentCallData.callerName,
        currentCallData.receiverUid,
        currentCallData.receiverName,
        currentCallType,
        'declined',
        0
      );
    } catch (e) {}
  }
  activeCallId = null;
  currentCallData = null;
}

// 5. END ACTIVE CALL
export async function endCall(partnerUid, partnerName) {
  stopCallSounds();
  playCallEnded();

  callModalStatus.innerText = 'Call Ended';
  if (callSubstatus) callSubstatus.innerText = 'Call has ended';

  if (activeCallId) {
    try {
      await update(ref(db, `calls/${activeCallId}`), { status: 'ended' });
      if (currentCallData || activeCallRole === 'caller') {
        await recordCallLog(
          currentUser.uid,
          currentUser.displayName || currentUser.email.split('@')[0],
          partnerUid,
          partnerName || 'Friend',
          currentCallType,
          callSeconds > 0 ? 'completed' : 'missed',
          callSeconds
        );
      }
    } catch (e) {}
  }
  setTimeout(() => cleanupCall(), 1500);
}

// Clean up WebRTC Streams
function cleanupCall() {
  stopCallSounds();
  if (callTimerInterval) {
    clearInterval(callTimerInterval);
    callTimerInterval = null;
  }
  if (localStream) {
    localStream.getTracks().forEach((track) => track.stop());
    localStream = null;
  }
  if (remoteVideoEl) {
    remoteVideoEl.srcObject = null;
    remoteVideoEl.classList.add('hidden');
  }
  if (remoteAvatarFallback) {
    remoteAvatarFallback.classList.remove('hidden');
  }
  if (localVideoEl) {
    localVideoEl.srcObject = null;
  }
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }

  if (callOverlayModal) {
    callOverlayModal.classList.add('hidden');
    callOverlayModal.classList.remove('flex');
  }
  if (incomingCallModal) {
    incomingCallModal.classList.add('hidden');
    incomingCallModal.classList.remove('flex');
  }

  activeCallId = null;
  currentCallData = null;
  activeCallRole = null;
  isMicMuted = false;
  isCamOff = false;
}

function startCallTimer() {
  if (callTimerInterval) clearInterval(callTimerInterval);
  callSeconds = 0;
  callModalStatus.innerText = '00:00';
  callTimerInterval = setInterval(() => {
    callSeconds++;
    const mins = Math.floor(callSeconds / 60).toString().padStart(2, '0');
    const secs = (callSeconds % 60).toString().padStart(2, '0');
    callModalStatus.innerText = `${mins}:${secs}`;
  }, 1000);
}

// Toggle Audio Track
export function toggleMic() {
  if (!localStream) return;
  isMicMuted = !isMicMuted;
  localStream.getAudioTracks().forEach((t) => (t.enabled = !isMicMuted));
  if (callToggleMicBtn) {
    callToggleMicBtn.classList.toggle('muted', isMicMuted);
  }
}

// Toggle Video Track
export function toggleCam() {
  if (!localStream) return;
  isCamOff = !isCamOff;
  localStream.getVideoTracks().forEach((t) => (t.enabled = !isCamOff));
  if (callToggleCamBtn) {
    callToggleCamBtn.classList.toggle('muted', isCamOff);
  }
}

// Helper: Get avatar URL for call screens
function getCallAvatar(name) {
  const PLACES_AVATARS = [
    'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=300&q=80',
    'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=300&q=80',
    'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?auto=format&fit=crop&w=300&q=80',
    'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=300&q=80',
    'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=300&q=80',
    'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=300&q=80'
  ];
  if (!name) return PLACES_AVATARS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return PLACES_AVATARS[Math.abs(hash) % PLACES_AVATARS.length];
}
