// ==========================================================================
// XHAODIN Messenger - Ultra Cyber Node.js Server & Realtime Hub
// Single Session Enforced, Call Records, Realtime Status Stories & WebSockets
// Port: 4000
// ==========================================================================

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const xhaodinAI = require('./ai-engine');
const aiCache = require('./ai-cache');

const PORT = 4000;
const DATA_DIR = path.join(__dirname, 'data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const USERS_FILE = path.join(DATA_DIR, 'users.json');
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');
const GROUPS_FILE = path.join(DATA_DIR, 'groups.json');
const STATUSES_FILE = path.join(DATA_DIR, 'statuses.json');
const CALLS_FILE = path.join(DATA_DIR, 'calls.json');

function loadJSON(file, fallback = {}) {
  try {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    }
  } catch (e) {}
  return fallback;
}

function saveJSON(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('Error saving data to', file, e);
  }
}

// In-Memory Database
let usersDb = loadJSON(USERS_FILE, {});
let messagesDb = loadJSON(MESSAGES_FILE, {});
let groupsDb = loadJSON(GROUPS_FILE, {});
let statusesDb = loadJSON(STATUSES_FILE, []);
let callsDb = loadJSON(CALLS_FILE, {});

const ADMIN_EMAIL = 'admin@gmail.com';

// Ensure all existing users have role and accountStatus
Object.keys(usersDb).forEach(uid => {
  const u = usersDb[uid];
  if (u.email && u.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
    u.role = 'admin';
    u.accountStatus = 'approved';
  } else if (!u.accountStatus) {
    u.accountStatus = 'approved';
    u.role = 'user';
  }
});
saveJSON(USERS_FILE, usersDb);

// Helper to notify connected Admin sockets
function notifyAdmins(type, data) {
  for (const [sock, client] of activeClients.entries()) {
    const u = usersDb[client.uid];
    if (u && u.email && u.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
      sendWS(sock, { type, data });
    }
  }
}

// Ensure Default Main Group (Global Community Lounge)
const MAIN_GROUP_ID = 'group_global_community';
if (!groupsDb[MAIN_GROUP_ID]) {
  groupsDb[MAIN_GROUP_ID] = {
    id: MAIN_GROUP_ID,
    name: '🌍 Global Community Lounge',
    icon: '🌍',
    createdBy: 'system',
    isMainGroup: true,
    members: ['all'],
    createdAt: 1700000000000
  };
  saveJSON(GROUPS_FILE, groupsDb);
}

if (!messagesDb[MAIN_GROUP_ID] || messagesDb[MAIN_GROUP_ID].length === 0) {
  messagesDb[MAIN_GROUP_ID] = [{
    id: 'msg_welcome_global',
    senderId: 'system',
    senderName: 'XHAODIN',
    text: '👋 Welcome to the XHAODIN Global Community! All members can chat, share voice notes, media, and status updates here.',
    time: '12:00 PM',
    timestamp: Date.now(),
    status: 'read'
  }];
  saveJSON(MESSAGES_FILE, messagesDb);
}

// Active WebSocket Clients: Map<socket, { uid: string, username: string, sessionId: string, lastActive: number }>
const activeClients = new Map();

// Online Users: Map<uid, socket> — quick lookup for sending to specific user
const onlineUsers = new Map();

// Active Calls tracker
const activeCalls = new Map(); // callId -> callData

// MIME Types
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.webm': 'audio/webm'
};

// 1. Static HTTP Server
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // REST API Bootstrap Endpoint (Protected: Only exposes public group messages, no private 1-to-1 chats)
  if (req.url === '/api/bootstrap' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    const publicMessages = {};
    if (messagesDb[MAIN_GROUP_ID]) publicMessages[MAIN_GROUP_ID] = messagesDb[MAIN_GROUP_ID];
    res.end(JSON.stringify({
      users: usersDb,
      groups: groupsDb,
      messages: publicMessages,
      statuses: statusesDb,
      calls: {}
    }));
    return;
  }

  let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 Internal Server Error');
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

// 2. WebSocket Implementation with Robust Frame Fragmentation Handling
function encodeWSFrame(data) {
  const payload = Buffer.from(typeof data === 'string' ? data : JSON.stringify(data));
  const length = payload.length;

  let header;
  if (length <= 125) {
    header = Buffer.from([0x81, length]);
  } else if (length <= 65535) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(length), 2);
  }

  return Buffer.concat([header, payload]);
}

function sendWS(socket, data) {
  try {
    if (socket && !socket.destroyed && socket.writable) {
      socket.write(encodeWSFrame(data));
    }
  } catch (e) {}
}

function broadcastWS(data, excludeSocket = null) {
  const frame = encodeWSFrame(data);
  for (const [sock] of activeClients.entries()) {
    if (sock !== excludeSocket && !sock.destroyed && sock.writable) {
      try {
        sock.write(frame);
      } catch (e) {}
    }
  }
}

function broadcastOnlineUsers() {
  const onlineList = {};
  for (const [sock, client] of activeClients.entries()) {
    if (client.uid && !sock.destroyed && sock.writable) {
      onlineList[client.uid] = true;
    }
  }
  broadcastWS({ type: 'ONLINE_USERS', data: { onlineUids: Object.keys(onlineList) } });
}

function sendToUser(uid, data) {
  for (const [sock, client] of activeClients.entries()) {
    if (client.uid === uid && !sock.destroyed && sock.writable) {
      sendWS(sock, data);
      return true;
    }
  }
  return false;
}

// WebSocket Upgrade Handler
server.on('upgrade', (req, socket) => {
  const wsKey = req.headers['sec-websocket-key'];
  if (!wsKey) {
    socket.destroy();
    return;
  }

  const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
  const acceptKey = crypto.createHash('sha1').update(wsKey + GUID).digest('base64');

  const responseHeaders = [
    'HTTP/1.1 101 Switching Protocols',
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Accept: ${acceptKey}`
  ];

  socket.write(responseHeaders.join('\r\n') + '\r\n\r\n');
  activeClients.set(socket, { uid: null, username: null, sessionId: null, lastActive: Date.now() });

  let buffer = Buffer.alloc(0);
  let fragmentedMessage = Buffer.alloc(0);

  socket.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);

    while (buffer.length >= 2) {
      const firstByte = buffer[0];
      const secondByte = buffer[1];

      const isFin = (firstByte & 0x80) !== 0;
      const opcode = firstByte & 0x0F;
      const isMasked = (secondByte & 0x80) !== 0;
      let payloadLength = secondByte & 0x7F;

      let currentOffset = 2;

      if (payloadLength === 126) {
        if (buffer.length < 4) break;
        payloadLength = buffer.readUInt16BE(2);
        currentOffset = 4;
      } else if (payloadLength === 127) {
        if (buffer.length < 10) break;
        payloadLength = Number(buffer.readBigUInt64BE(2));
        currentOffset = 10;
      }

      let maskingKey = null;
      if (isMasked) {
        if (buffer.length < currentOffset + 4) break;
        maskingKey = buffer.slice(currentOffset, currentOffset + 4);
        currentOffset += 4;
      }

      if (buffer.length < currentOffset + payloadLength) break;

      const payload = buffer.slice(currentOffset, currentOffset + payloadLength);
      buffer = buffer.slice(currentOffset + payloadLength);

      if (opcode === 0x8) {
        socket.end();
        break;
      } else if (opcode === 0x9) {
        const pong = Buffer.from([0x8A, 0x00]);
        socket.write(pong);
        continue;
      }

      if (isMasked && maskingKey) {
        for (let i = 0; i < payload.length; i++) {
          payload[i] ^= maskingKey[i % 4];
        }
      }

      fragmentedMessage = Buffer.concat([fragmentedMessage, payload]);

      if (isFin) {
        try {
          const messageStr = fragmentedMessage.toString('utf8');
          const message = JSON.parse(messageStr);
          fragmentedMessage = Buffer.alloc(0);
          handleClientMessage(socket, message);
        } catch (err) {
          fragmentedMessage = Buffer.alloc(0);
          console.error('Error handling WebSocket message:', err);
        }
      }
    }
  });

  socket.on('close', () => {
    handleClientDisconnect(socket);
  });

  socket.on('error', () => {
    handleClientDisconnect(socket);
  });
});

function isUserCurrentlyOnline(uid) {
  for (const [, client] of activeClients.entries()) {
    if (client.uid === uid) return true;
  }
  return false;
}

function logCallHistory(record) {
  const { callerUid, receiverUid } = record;
  
  if (callerUid) {
    if (!callsDb[callerUid]) callsDb[callerUid] = [];
    callsDb[callerUid].unshift({ ...record, direction: 'outgoing' });
    if (callsDb[callerUid].length > 40) callsDb[callerUid] = callsDb[callerUid].slice(0, 40);
  }
  
  if (receiverUid) {
    if (!callsDb[receiverUid]) callsDb[receiverUid] = [];
    callsDb[receiverUid].unshift({ ...record, direction: record.status === 'missed' ? 'missed' : 'incoming' });
    if (callsDb[receiverUid].length > 40) callsDb[receiverUid] = callsDb[receiverUid].slice(0, 40);
  }

  saveJSON(CALLS_FILE, callsDb);

  // Notify only the two participating users of call history updates
  for (const [sock, client] of activeClients.entries()) {
    if (client.uid === callerUid || client.uid === receiverUid) {
      sendWS(sock, {
        type: 'CALLS_UPDATED',
        data: { calls: callsDb[client.uid] || [] }
      });
    }
  }
}

// ----------------------------------------------------------------------
// Strict Privacy: Filter messages only for authenticated user
// ----------------------------------------------------------------------
function getUserFilteredMessages(uid) {
  const userMessages = {};
  if (!uid) return userMessages;
  Object.keys(messagesDb).forEach(chatId => {
    if (chatId.startsWith('group_')) {
      const group = groupsDb[chatId];
      if (!group || group.isMainGroup || !group.members || group.members.includes('all') || group.members.includes(uid)) {
        userMessages[chatId] = messagesDb[chatId];
      }
    } else if (chatId.includes(uid)) {
      userMessages[chatId] = messagesDb[chatId];
    }
  });
  return userMessages;
}

// Route message/action packets strictly and ONLY to participating sockets
function sendToChatParticipants(chatId, packet, excludeSocket = null) {
  if (!chatId) return;
  const isGroup = chatId.startsWith('group_');
  for (const [sock, client] of activeClients.entries()) {
    if (sock === excludeSocket || !client.uid) continue;
    if (isGroup) {
      const grp = groupsDb[chatId];
      if (!grp || grp.isMainGroup || !grp.members || grp.members.includes('all') || grp.members.includes(client.uid)) {
        sendWS(sock, packet);
      }
    } else {
      if (chatId.includes(client.uid)) {
        sendWS(sock, packet);
      }
    }
  }
}

function handleClientMessage(socket, msg) {
  if (!msg || typeof msg !== 'object') return;
  const { type, data } = msg;

  switch (type) {
    // 1. User Register (Always enters PENDING state for Admin Approval unless admin@gmail.com)
    case 'USER_REGISTER': {
      const { uid, username, email, avatar, status, sessionId } = data;
      if (!email) {
        sendWS(socket, { type: 'AUTH_ERROR', data: { message: 'Email is required.' } });
        return;
      }

      const userUid = uid || ('user_' + email.toLowerCase().replace(/[^a-zA-Z0-9]/g, '_'));

      // Check if user already exists
      if (usersDb[userUid]) {
        if (usersDb[userUid].accountStatus === 'approved') {
          sendWS(socket, {
            type: 'AUTH_ERROR',
            data: { message: '❌ Account already registered! Please click "Enter XHAODIN" to sign in.' }
          });
          return;
        } else if (usersDb[userUid].accountStatus === 'pending') {
          sendWS(socket, {
            type: 'AUTH_STATUS',
            data: {
              status: 'pending',
              user: usersDb[userUid],
              message: '⏳ Your registration request is already submitted and pending Admin approval.'
            }
          });
          return;
        }
      }

      const isEmailAdmin = email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
      const accountStatus = isEmailAdmin ? 'approved' : 'pending';
      const role = isEmailAdmin ? 'admin' : 'user';
      const newSessionId = sessionId || ('sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6));

      usersDb[userUid] = {
        uid: userUid,
        username: username || email.split('@')[0],
        email,
        avatar: avatar !== undefined ? avatar : null,
        status: status || 'Hey there! I am using XHAODIN.',
        online: isEmailAdmin,
        lastSeen: Date.now(),
        accountStatus,
        role,
        registeredAt: Date.now(),
        currentSessionId: newSessionId
      };
      saveJSON(USERS_FILE, usersDb);

      if (accountStatus === 'pending') {
        sendWS(socket, {
          type: 'AUTH_STATUS',
          data: {
            status: 'pending',
            user: usersDb[userUid],
            message: 'Your registration request has been submitted to the Administrator (admin@gmail.com). Please wait for approval.'
          }
        });

        // Broadcast real-time pending update to active Admin sessions
        notifyAdmins('NEW_PENDING_REGISTRATION', { user: usersDb[userUid] });
        notifyAdmins('PENDING_USERS_LIST', {
          pendingUsers: Object.values(usersDb).filter(u => u.accountStatus === 'pending')
        });
        return;
      }

      // If Admin registered, proceed with normal login
      activeClients.set(socket, {
        uid: userUid,
        username: usersDb[userUid].username,
        sessionId: newSessionId,
        lastActive: Date.now()
      });
      onlineUsers.set(userUid, socket);

      sendWS(socket, {
        type: 'AUTH_SUCCESS',
        data: {
          user: usersDb[userUid],
          sessionId: newSessionId
        }
      });

      sendWS(socket, {
        type: 'INIT_STATE',
        data: {
          sessionId: newSessionId,
          currentUser: usersDb[userUid],
          users: usersDb,
          groups: groupsDb,
          messages: getUserFilteredMessages(userUid),
          statuses: statusesDb,
          calls: callsDb[userUid] || [],
          pendingUsers: Object.values(usersDb).filter(u => u.accountStatus === 'pending'),
          hiddenChats: loadJSON(path.join(DATA_DIR, 'hidden_chats.json'), {})[userUid] || []
        }
      });

      broadcastWS({
        type: 'USER_STATUS_CHANGE',
        data: { user: usersDb[userUid] }
      }, socket);
      break;
    }

    // 2. User Sign In (Strictly checks database: ONLY existing & approved users allowed)
    case 'USER_LOGIN': {
      const { uid, username, email, avatar, status, sessionId } = data;
      if (!uid && !email) {
        sendWS(socket, { type: 'AUTH_ERROR', data: { message: 'Email is required.' } });
        return;
      }

      const lookupUid = uid || ('user_' + (email || '').toLowerCase().replace(/[^a-zA-Z0-9]/g, '_'));
      let existing = usersDb[lookupUid];

      if (!existing && email) {
        existing = Object.values(usersDb).find(u => u.email && u.email.toLowerCase() === email.toLowerCase());
      }

      const isEmailAdmin = (email && email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) || (existing && existing.email && existing.email.toLowerCase() === ADMIN_EMAIL.toLowerCase());

      // If user does not exist in database
      if (!existing && !isEmailAdmin) {
        sendWS(socket, {
          type: 'AUTH_ERROR',
          data: {
            message: '❌ Account does not exist. Please click "Create XHAODIN Account" to register first!'
          }
        });
        return;
      }

      // If user exists but is pending approval
      if (existing && existing.accountStatus === 'pending' && !isEmailAdmin) {
        sendWS(socket, {
          type: 'AUTH_STATUS',
          data: {
            status: 'pending',
            user: existing,
            message: '⏳ Your account is currently pending Admin approval. Please wait for the admin (admin@gmail.com) to approve your request.'
          }
        });
        return;
      }

      // If user was rejected
      if (existing && existing.accountStatus === 'rejected' && !isEmailAdmin) {
        sendWS(socket, {
          type: 'AUTH_ERROR',
          data: {
            message: '❌ Your registration request was rejected by the administrator.'
          }
        });
        return;
      }

      // Initialize admin account if first time logging in
      if (isEmailAdmin && !existing) {
        existing = {
          uid: 'user_admin_gmail_com',
          username: 'Master Admin',
          email: ADMIN_EMAIL,
          avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&q=80',
          status: 'System Administrator & Security Controller',
          role: 'admin',
          accountStatus: 'approved',
          online: true,
          lastSeen: Date.now()
        };
        usersDb[existing.uid] = existing;
        saveJSON(USERS_FILE, usersDb);
      }

      const targetUid = existing.uid;
      const newSessionId = sessionId || ('sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6));

      // Terminate any previous active session for this user ID
      for (const [sock, client] of activeClients.entries()) {
        if (client.uid === targetUid && sock !== socket) {
          sendWS(sock, {
            type: 'SESSION_TERMINATED',
            data: {
              reason: 'WhatsApp is open on another window or device. Click "Use Here" to use WhatsApp in this window.',
              newSessionId: newSessionId
            }
          });
          client.uid = null;
        }
      }

      existing.online = true;
      existing.lastSeen = Date.now();
      existing.currentSessionId = newSessionId;
      if (username) existing.username = username;
      if (avatar !== undefined) existing.avatar = avatar;
      if (status !== undefined) existing.status = status;
      usersDb[targetUid] = existing;
      saveJSON(USERS_FILE, usersDb);

      activeClients.set(socket, {
        uid: targetUid,
        username: existing.username,
        sessionId: newSessionId,
        lastActive: Date.now()
      });
      onlineUsers.set(targetUid, socket);

      // Deliver pending sent messages to this user
      let anyPendingDelivered = false;
      const deliveredChatIds = new Set();
      Object.keys(messagesDb).forEach(chatId => {
        const isGroup = chatId.startsWith('group_');
        const msgs = messagesDb[chatId] || [];
        msgs.forEach(m => {
          if (m.senderId !== targetUid && m.status === 'sent') {
            if (isGroup || chatId.includes(targetUid)) {
              m.status = 'delivered';
              anyPendingDelivered = true;
              deliveredChatIds.add(chatId);
            }
          }
        });
      });
      if (anyPendingDelivered) {
        saveJSON(MESSAGES_FILE, messagesDb);
        deliveredChatIds.forEach(cId => {
          sendToChatParticipants(cId, {
            type: 'MESSAGES_DELIVERED',
            data: { chatId: cId }
          });
        });
      }

      sendWS(socket, {
        type: 'AUTH_SUCCESS',
        data: {
          user: existing,
          sessionId: newSessionId
        }
      });

      // Send initial state to the client with STRICT MESSAGE FILTERING (NO PRIVACY LEAKS)
      sendWS(socket, {
        type: 'INIT_STATE',
        data: {
          sessionId: newSessionId,
          currentUser: existing,
          users: usersDb,
          groups: groupsDb,
          messages: getUserFilteredMessages(targetUid),
          statuses: statusesDb,
          calls: callsDb[targetUid] || [],
          pendingUsers: isEmailAdmin ? Object.values(usersDb).filter(u => u.accountStatus === 'pending') : [],
          hiddenChats: loadJSON(path.join(DATA_DIR, 'hidden_chats.json'), {})[targetUid] || []
        }
      });

      // Broadcast presence change
      broadcastWS({
        type: 'USER_STATUS_CHANGE',
        data: { user: existing }
      }, socket);
      break;
    }

    // 3. Admin Actions: Approve User
    case 'ADMIN_APPROVE_USER': {
      const { targetUid, adminUid } = data;
      const adminUser = usersDb[adminUid];
      if (!adminUser || adminUser.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
        sendWS(socket, { type: 'ERROR', data: { message: 'Unauthorized: Admin permission required.' } });
        return;
      }

      if (usersDb[targetUid]) {
        usersDb[targetUid].accountStatus = 'approved';
        saveJSON(USERS_FILE, usersDb);

        // Notify admins with updated pending list
        const pendingUsers = Object.values(usersDb).filter(u => u.accountStatus === 'pending');
        notifyAdmins('PENDING_USERS_LIST', { pendingUsers });

        // Broadcast approved user to all clients
        broadcastWS({
          type: 'USER_APPROVED',
          data: { user: usersDb[targetUid] }
        });

        broadcastWS({
          type: 'USER_STATUS_CHANGE',
          data: { user: usersDb[targetUid] }
        });
      }
      break;
    }

    // 4. Admin Actions: Reject User
    case 'ADMIN_REJECT_USER': {
      const { targetUid, adminUid } = data;
      const adminUser = usersDb[adminUid];
      if (!adminUser || adminUser.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
        sendWS(socket, { type: 'ERROR', data: { message: 'Unauthorized: Admin permission required.' } });
        return;
      }

      if (usersDb[targetUid]) {
        usersDb[targetUid].accountStatus = 'rejected';
        saveJSON(USERS_FILE, usersDb);

        const pendingUsers = Object.values(usersDb).filter(u => u.accountStatus === 'pending');
        notifyAdmins('PENDING_USERS_LIST', { pendingUsers });

        broadcastWS({
          type: 'USER_REJECTED',
          data: { uid: targetUid }
        });
      }
      break;
    }

    // 5. Admin Actions: Get Pending Users List
    case 'ADMIN_GET_PENDING_USERS': {
      const pendingUsers = Object.values(usersDb).filter(u => u.accountStatus === 'pending');
      sendWS(socket, {
        type: 'PENDING_USERS_LIST',
        data: { pendingUsers }
      });
      break;
    }

    // 2. Profile Update
    case 'UPDATE_PROFILE': {
      const { uid, username, avatar, status } = data;
      if (!uid || !usersDb[uid]) return;

      if (username) usersDb[uid].username = username;
      if (avatar !== undefined) usersDb[uid].avatar = avatar;
      if (status !== undefined) usersDb[uid].status = status;
      usersDb[uid].lastSeen = Date.now();
      saveJSON(USERS_FILE, usersDb);

      broadcastWS({
        type: 'USER_STATUS_CHANGE',
        data: { user: usersDb[uid] }
      });
      break;
    }

    // 3. Send Message (Strictly routed ONLY to chat participants)
    case 'SEND_MESSAGE': {
      const { chatId, message } = data;
      if (!chatId || !message) return;

      if (!messagesDb[chatId]) messagesDb[chatId] = [];

      const isGroup = chatId.startsWith('group_');
      let isReceiverOnline = false;
      if (!isGroup) {
        const parts = chatId.split('_chat_');
        const recipientUid = parts.find(u => u !== message.senderId) || (chatId !== message.senderId ? chatId : null);
        if (recipientUid) {
          isReceiverOnline = isUserCurrentlyOnline(recipientUid);
        }
      }

      message.status = isReceiverOnline || isGroup ? 'delivered' : 'sent';
      messagesDb[chatId].push(message);
      saveJSON(MESSAGES_FILE, messagesDb);

      sendToChatParticipants(chatId, {
        type: 'NEW_MESSAGE',
        data: { chatId, message }
      });

      // AI Bot: auto-respond if message is directed to the bot
      if (message.senderId !== AI_BOT_UID && chatId.includes(AI_BOT_UID)) {
        const userQuery = message.text || '';
        if (!userQuery.trim()) break;

        // Send typing indicator
        sendWS(socket, {
          type: 'TYPING_INDICATOR',
          data: { chatId, senderUid: AI_BOT_UID, senderName: 'XHAODIN AI', isTyping: true }
        });

        // Process with AI engine (with slight delay to feel natural)
        const delay = Math.min(500 + userQuery.length * 15, 2500);
        setTimeout(async () => {
          try {
            // Try fetching live data if online and needed
            let liveData = null;
            if (aiCache.isOnline && aiCache.needsRefresh()) {
              aiCache.refreshAll().catch(() => {});
            }

            // Search cache for relevant data
            liveData = aiCache.searchCache(userQuery);

            // If query is about today/trending, use cached trending data
            if (/\b(today|what happened|trending|news|events)\b/i.test(userQuery)) {
              const trending = aiCache.getTrending();
              if (trending.length > 0) {
                liveData = 'Here\'s what happened on this day:\n\n' +
                  trending.slice(0, 5).map(t => `• **${t.year || 'N/A'}**: ${t.text.substring(0, 150)}`).join('\n');
              }
            }

            // If query is about tech news
            if (/\b(tech news|programming news|latest in tech|what's new)\b/i.test(userQuery)) {
              const news = aiCache.getTechNews();
              if (news.length > 0) {
                liveData = '🔥 **Top Tech News:**\n\n' +
                  news.slice(0, 5).map(n => `• **${n.title}** (${n.score} pts)`).join('\n');
              }
            }

            // Generate AI response
            const responseText = xhaodinAI.respond(message.senderId, userQuery);

            // If we have live data, append it
            const finalResponse = liveData
              ? responseText + '\n\n---\n📡 **Live Data:**\n' + liveData
              : responseText;

            // Create bot message
            const botMsg = {
              id: 'ai_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
              senderId: AI_BOT_UID,
              senderName: 'XHAODIN AI',
              text: finalResponse,
              mediaType: 'text',
              mediaUrl: null,
              replyTo: null,
              time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
              timestamp: Date.now(),
              status: 'read',
              reactions: {},
              starredBy: [],
              isAI: true
            };

            if (!messagesDb[chatId]) messagesDb[chatId] = [];
            messagesDb[chatId].push(botMsg);
            saveJSON(MESSAGES_FILE, messagesDb);

            // Stop typing
            sendWS(socket, {
              type: 'TYPING_INDICATOR',
              data: { chatId, senderUid: AI_BOT_UID, senderName: 'XHAODIN AI', isTyping: false }
            });

            // Send AI response to chat participants
            sendToChatParticipants(chatId, {
              type: 'NEW_MESSAGE',
              data: { chatId, message: botMsg }
            });
          } catch (e) {
            console.error('[AI] Response error:', e);
            // Stop typing on error
            sendWS(socket, {
              type: 'TYPING_INDICATOR',
              data: { chatId, senderUid: AI_BOT_UID, senderName: 'XHAODIN AI', isTyping: false }
            });
          }
        }, delay);
      }
      break;
    }

    // 4. Mark Messages Delivered (Double Gray Ticks)
    case 'MARK_DELIVERED': {
      const { chatId, messageId, receiverUid } = data;
      if (!chatId) return;

      let updated = false;
      if (messagesDb[chatId]) {
        messagesDb[chatId].forEach((msg) => {
          if ((!messageId || msg.id === messageId) && msg.senderId !== receiverUid && msg.status === 'sent') {
            msg.status = 'delivered';
            updated = true;
          }
        });
      }

      if (updated) {
        saveJSON(MESSAGES_FILE, messagesDb);
        sendToChatParticipants(chatId, {
          type: 'MESSAGES_DELIVERED',
          data: { chatId, messageId }
        });
      }
      break;
    }

    // 5. Mark Messages Read (Double Blue Ticks)
    case 'MARK_READ': {
      const { chatId, readerUid } = data;
      if (!chatId || !readerUid) return;

      let updated = false;
      if (messagesDb[chatId]) {
        messagesDb[chatId].forEach((msg) => {
          if (msg.senderId !== readerUid && msg.status !== 'read') {
            msg.status = 'read';
            updated = true;
          }
        });
      }

      if (updated) {
        saveJSON(MESSAGES_FILE, messagesDb);
        sendToChatParticipants(chatId, {
          type: 'MESSAGES_READ',
          data: { chatId, readerUid }
        });
      }
      break;
    }

    // 6. Message Reactions
    case 'REACT_MESSAGE': {
      const { chatId, messageId, reaction, userUid } = data;
      if (!chatId || !messageId || !messagesDb[chatId]) return;

      const targetMsg = messagesDb[chatId].find(m => m.id === messageId);
      if (targetMsg) {
        if (!targetMsg.reactions) targetMsg.reactions = {};
        if (targetMsg.reactions[userUid] === reaction) {
          delete targetMsg.reactions[userUid];
        } else {
          targetMsg.reactions[userUid] = reaction;
        }
        saveJSON(MESSAGES_FILE, messagesDb);
        sendToChatParticipants(chatId, {
          type: 'MESSAGE_REACTED',
          data: { chatId, messageId, reactions: targetMsg.reactions }
        });
      }
      break;
    }

    // 7. Delete Message (WhatsApp style: delete for me OR delete for everyone — admin can delete ANY message)
    case 'DELETE_MESSAGE': {
      const { chatId, messageId, senderUid, deleteForEveryone } = data;
      if (!chatId || !messageId || !messagesDb[chatId]) return;

      const targetMsg = messagesDb[chatId].find(m => m.id === messageId);
      if (!targetMsg) break;

      const isAdmin = usersDb[senderUid] && usersDb[senderUid].role === 'admin';
      const isOwner = targetMsg.senderId === senderUid;

      if (deleteForEveryone && (isOwner || isAdmin)) {
        // Delete for everyone — replace content (admin can delete ANY message)
        targetMsg.deleted = true;
        targetMsg.text = isAdmin && !isOwner ? '🚫 Deleted by Admin' : '🚫 This message was deleted';
        targetMsg.mediaUrl = null;
        targetMsg.mediaType = 'deleted';
        saveJSON(MESSAGES_FILE, messagesDb);
        sendToChatParticipants(chatId, {
          type: 'MESSAGE_DELETED',
          data: { chatId, messageId, deleteForEveryone: true }
        });
      } else {
        // Delete for me — add uid to deletedFor array
        if (!targetMsg.deletedFor) targetMsg.deletedFor = [];
        if (!targetMsg.deletedFor.includes(senderUid)) {
          targetMsg.deletedFor.push(senderUid);
        }
        saveJSON(MESSAGES_FILE, messagesDb);
        // Only notify the requesting user
        sendWS(socket, {
          type: 'MESSAGE_DELETED_FOR_ME',
          data: { chatId, messageId }
        });
      }
      break;
    }

    // 7b. Admin Ban/Unban User
    case 'ADMIN_BAN_USER': {
      const { targetUid, banned, reason } = data;
      if (!targetUid || !usersDb[targetUid]) return;
      const senderUser = usersDb[senderUid];
      if (!senderUser || senderUser.role !== 'admin') {
        sendWS(socket, { type: 'ERROR', data: { message: 'Only admins can ban users' } });
        break;
      }
      if (targetUid === senderUid) {
        sendWS(socket, { type: 'ERROR', data: { message: 'You cannot ban yourself' } });
        break;
      }
      if (targetUid === 'user_admin_gmail_com') {
        sendWS(socket, { type: 'ERROR', data: { message: 'Cannot ban the main admin' } });
        break;
      }

      if (banned) {
        usersDb[targetUid].accountStatus = 'banned';
        usersDb[targetUid].banReason = reason || 'Violated terms';
        // Disconnect the banned user if online
        const sent = sendToUser(targetUid, {
          type: 'YOU_ARE_BANNED',
          data: { reason: reason || 'Violated terms' }
        });
        // Close their socket
        for (const [sock, client] of activeClients.entries()) {
          if (client.uid === targetUid) {
            setTimeout(() => { try { sock.close(); } catch(e) {} }, 1000);
          }
        }
      } else {
        usersDb[targetUid].accountStatus = 'approved';
        delete usersDb[targetUid].banReason;
      }

      saveJSON(USERS_FILE, usersDb);
      broadcastOnlineUsers();
      broadcastWS({
        type: 'USER_BANNED',
        data: { uid: targetUid, banned, reason: reason || '' }
      });
      break;
    }

    // 7c. Delete Entire Chat (WhatsApp style — hides chat from sidebar for that user)
    case 'DELETE_CHAT': {
      const { chatId, uid } = data;
      if (!chatId || !uid) return;

      // Store hidden chats in a separate JSON file
      const HIDDEN_CHATS_FILE = path.join(DATA_DIR, 'hidden_chats.json');
      let hiddenChats = loadJSON(HIDDEN_CHATS_FILE, {});
      if (!hiddenChats[uid]) hiddenChats[uid] = [];
      if (!hiddenChats[uid].includes(chatId)) {
        hiddenChats[uid].push(chatId);
      }
      saveJSON(HIDDEN_CHATS_FILE, hiddenChats);

      sendWS(socket, {
        type: 'CHAT_DELETED',
        data: { chatId }
      });
      break;
    }

    // 7d. Delete Group (Admin only — deletes group for ALL members)
    case 'DELETE_GROUP': {
      const { groupId, requesterUid } = data;
      if (!groupId || !groupId.startsWith('group_')) break;

      const reqUser = usersDb[requesterUid];
      if (!reqUser || reqUser.role !== 'admin') {
        sendWS(socket, { type: 'ERROR', data: { message: 'Only admins can delete groups' } });
        break;
      }

      // Remove group from groupsDb
      const deletedGroupName = groupsDb[groupId]?.name || 'Group';
      delete groupsDb[groupId];
      saveJSON(GROUPS_FILE, groupsDb);

      // Delete all messages for this group
      delete messagesDb[groupId];
      saveJSON(MESSAGES_FILE, messagesDb);

      // Notify all participants
      broadcastWS({
        type: 'GROUP_DELETED',
        data: { groupId, groupName: deletedGroupName }
      });
      break;
    }

    // 8. Star Message
    case 'STAR_MESSAGE': {
      const { chatId, messageId, userUid } = data;
      if (!chatId || !messageId || !messagesDb[chatId]) return;
      const targetMsg = messagesDb[chatId].find(m => m.id === messageId);
      if (targetMsg) {
        if (!targetMsg.starredBy) targetMsg.starredBy = [];
        const idx = targetMsg.starredBy.indexOf(userUid);
        if (idx > -1) {
          targetMsg.starredBy.splice(idx, 1);
        } else {
          targetMsg.starredBy.push(userUid);
        }
        saveJSON(MESSAGES_FILE, messagesDb);
        sendToChatParticipants(chatId, {
          type: 'MESSAGE_STARRED',
          data: { chatId, messageId, starredBy: targetMsg.starredBy }
        });
      }
      break;
    }

    // 9. Typing Signal
    case 'TYPING_SIGNAL': {
      const { chatId, senderUid, senderName, isTyping } = data;
      sendToChatParticipants(chatId, {
        type: 'TYPING_INDICATOR',
        data: { chatId, senderUid, senderName, isTyping }
      }, socket);
      break;
    }

    // 9. Create Group
    case 'CREATE_GROUP': {
      const { groupId, name, createdBy, members, icon } = data;
      if (!groupId || !name) return;

      groupsDb[groupId] = {
        id: groupId,
        name: name,
        icon: icon || null,
        createdBy: createdBy,
        members: members || [createdBy],
        createdAt: Date.now()
      };
      saveJSON(GROUPS_FILE, groupsDb);

      broadcastWS({
        type: 'NEW_GROUP',
        data: { group: groupsDb[groupId] }
      });
      break;
    }

    // 10. Status Stories (Post, View, Delete)
    case 'POST_STATUS': {
      const { statusItem } = data;
      if (!statusItem) return;

      if (!statusItem.views) statusItem.views = [];
      statusesDb.unshift(statusItem);
      if (statusesDb.length > 50) statusesDb = statusesDb.slice(0, 50);
      saveJSON(STATUSES_FILE, statusesDb);

      broadcastWS({
        type: 'NEW_STATUS',
        data: { statusItem }
      });
      break;
    }

    case 'VIEW_STATUS': {
      const { statusId, viewerUid, viewerName, viewerAvatar } = data;
      if (!statusId || !viewerUid) return;
      const st = statusesDb.find(s => s.id === statusId);
      if (st) {
        if (!st.views) st.views = [];
        if (!st.viewersDetails) st.viewersDetails = [];

        if (!st.views.includes(viewerUid)) {
          st.views.push(viewerUid);
        }

        const existingViewer = st.viewersDetails.find(v => v.uid === viewerUid);
        if (!existingViewer) {
          const user = usersDb[viewerUid];
          st.viewersDetails.push({
            uid: viewerUid,
            name: viewerName || user?.username || user?.displayName || 'Contact',
            avatar: viewerAvatar || user?.avatar || null,
            time: Date.now()
          });
        }

        saveJSON(STATUSES_FILE, statusesDb);
        broadcastWS({
          type: 'STATUS_VIEWED',
          data: { statusId, views: st.views, viewersDetails: st.viewersDetails, viewerUid }
        });
      }
      break;
    }

    case 'DELETE_STATUS': {
      const { statusId, authorUid } = data;
      if (!statusId || !authorUid) return;
      const idx = statusesDb.findIndex(s => s.id === statusId && s.authorUid === authorUid);
      if (idx > -1) {
        statusesDb.splice(idx, 1);
        saveJSON(STATUSES_FILE, statusesDb);
        broadcastWS({
          type: 'STATUS_DELETED',
          data: { statusId }
        });
      }
      break;
    }

    // 11. WebRTC Calling with Comprehensive Call History Logging
    case 'CALL_SIGNAL': {
      const { targetUid, signalType, callData } = data;
      if (!callData) break;

      if (signalType === 'OFFER') {
        activeCalls.set(callData.callId, {
          ...callData,
          startTime: Date.now(),
          status: 'ringing'
        });

        for (const [sock, client] of activeClients.entries()) {
          if (client.uid === targetUid) {
            sendWS(sock, {
              type: 'CALL_SIGNAL',
              data: { signalType, callData }
            });
          }
        }
      } else if (signalType === 'ANSWER') {
        const c = activeCalls.get(callData.callId);
        if (c) {
          c.status = 'connected';
          c.connectedAt = Date.now();
        }

        for (const [sock, client] of activeClients.entries()) {
          if (client.uid === targetUid) {
            sendWS(sock, {
              type: 'CALL_SIGNAL',
              data: { signalType, callData }
            });
          }
        }
      } else if (signalType === 'ICE_CANDIDATE') {
        for (const [sock, client] of activeClients.entries()) {
          if (client.uid === targetUid) {
            sendWS(sock, {
              type: 'CALL_SIGNAL',
              data: { signalType, callData }
            });
          }
        }
      } else if (signalType === 'END') {
        const c = activeCalls.get(callData.callId);
        let finalStatus = 'ended';
        let duration = '0:00';

        if (c) {
          if (c.status === 'ringing') {
            finalStatus = 'missed';
          } else if (c.connectedAt) {
            const secs = Math.floor((Date.now() - c.connectedAt) / 1000);
            const m = Math.floor(secs / 60);
            const s = (secs % 60).toString().padStart(2, '0');
            duration = `${m}:${s}`;
            finalStatus = 'completed';
          }

          logCallHistory({
            id: 'call_rec_' + Date.now(),
            callId: c.callId,
            callerUid: c.callerUid,
            callerName: c.callerName,
            receiverUid: c.receiverUid,
            receiverName: c.receiverName,
            callType: c.callType || 'voice',
            status: finalStatus,
            duration: duration,
            timestamp: Date.now()
          });

          activeCalls.delete(callData.callId);
        }

        for (const [sock, client] of activeClients.entries()) {
          if (client.uid === targetUid) {
            sendWS(sock, {
              type: 'CALL_SIGNAL',
              data: { signalType, callData }
            });
          }
        }
      }
      break;
    }

    // 12. Heartbeat
    case 'HEARTBEAT': {
      const client = activeClients.get(socket);
      if (client) client.lastActive = Date.now();
      break;
    }
  }
}

function handleClientDisconnect(socket) {
  const client = activeClients.get(socket);
  if (client && client.uid) {
    const uid = client.uid;
    activeClients.delete(socket);
    onlineUsers.delete(uid);

    if (!isUserCurrentlyOnline(uid) && usersDb[uid]) {
      usersDb[uid].online = false;
      usersDb[uid].lastSeen = Date.now();
      saveJSON(USERS_FILE, usersDb);

      broadcastWS({
        type: 'USER_STATUS_CHANGE',
        data: { user: usersDb[uid] }
      });
    }
  } else {
    activeClients.delete(socket);
  }
}

// 3. Register AI Bot User
const AI_BOT_UID = 'xhaodin_ai_bot';
if (!usersDb[AI_BOT_UID]) {
  usersDb[AI_BOT_UID] = {
    uid: AI_BOT_UID,
    username: 'XHAODIN AI',
    email: 'ai@xhaodin.local',
    avatar: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#00f5a0"/><stop offset="50%" stop-color="#00e599"/><stop offset="100%" stop-color="#38bdf8"/></linearGradient></defs><path d="M20 22 L38 22 L78 78 L60 78 Z" fill="url(#g)"/><path d="M78 22 L60 22 L20 78 L38 78 Z" fill="url(#g)" opacity="0.9"/><polygon points="49,36 61,50 49,64 37,50" fill="#ffffff"/></svg>'),
    status: '🤖 Your intelligent assistant — ask me anything!',
    online: true,
    lastSeen: Date.now(),
    accountStatus: 'approved',
    role: 'bot',
    isBot: true
  };
  saveJSON(USERS_FILE, usersDb);
}

// 4. Refresh AI Cache on startup
aiCache.refreshAll().then(() => console.log('[AI] Cache ready')).catch(() => {});

// Refresh cache every 6 hours
setInterval(() => aiCache.refreshAll().catch(() => {}), 6 * 60 * 60 * 1000);

// 5. Start Server on Port 4000
server.listen(PORT, '0.0.0.0', () => {
  const url = `http://localhost:${PORT}`;
  console.log(`=======================================================`);
  console.log(`🚀 WhatsApp Web Server & WebSocket Hub Online on Port ${PORT}`);
  console.log(`🤖 XHAODIN AI Bot registered: ${AI_BOT_UID}`);
  console.log(`👉 Single Session Enforced, Call History & Status Engine`);
  console.log(`=======================================================`);
});
