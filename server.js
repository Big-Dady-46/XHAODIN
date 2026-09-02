// ==============================================================================
// XHAODIN ALL-IN-ONE REALTIME SERVER & NOKIA CELLULAR SMS GATEWAY BRIDGE
// Runs on Port 5050 (HTTP + Real-time WebSockets / SSE + Cellular SMS Relay)
// ==============================================================================

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import incomingSmsHandler from './api/sms/incoming.js';
import outboundSmsHandler from './api/sms/send.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 5050;

// Connected Android Relay Clients (Phone Browser SIM Forwarders)
const connectedRelayClients = new Set();
const pendingOutboundSmsQueue = [];

// MIME types dictionary
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.ico': 'image/x-icon'
};

const server = http.createServer(async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    return res.end();
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // --------------------------------------------------------------------------
  // 1. API: Inbound SMS Webhook (/api/sms/incoming or /incoming)
  // --------------------------------------------------------------------------
  if (pathname === '/api/sms/incoming' || pathname === '/incoming') {
    let body = await parseRequestBody(req);
    const mockReq = {
      method: req.method,
      headers: req.headers,
      query: Object.fromEntries(parsedUrl.searchParams),
      body
    };
    const mockRes = createMockResponse(res);
    return incomingSmsHandler(mockReq, mockRes);
  }

  // --------------------------------------------------------------------------
  // 2. API: Outbound SMS Dispatcher (/api/sms/send or /send)
  // --------------------------------------------------------------------------
  if (pathname === '/api/sms/send' || pathname === '/send') {
    let body = await parseRequestBody(req);

    // Notify all connected Android relay phones via SSE
    if (body && (body.to || body.phone) && (body.message || body.text)) {
      const targetPhone = body.to || body.phone;
      const smsText = body.message || body.text;
      const smsTask = {
        id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        to: targetPhone,
        message: smsText,
        timestamp: Date.now()
      };

      pendingOutboundSmsQueue.push(smsTask);

      // Broadcast to connected Android phones
      const payloadString = `data: ${JSON.stringify({ type: 'NEW_OUTBOUND_SMS', task: smsTask })}\n\n`;
      connectedRelayClients.forEach(clientRes => {
        try { clientRes.write(payloadString); } catch(e) { connectedRelayClients.delete(clientRes); }
      });
      console.log(`📡 Dispatched outbound SMS task to ${connectedRelayClients.size} connected Android relay phone(s):`, targetPhone);
    }

    const mockReq = {
      method: req.method,
      headers: req.headers,
      query: Object.fromEntries(parsedUrl.searchParams),
      body
    };
    const mockRes = createMockResponse(res);
    return outboundSmsHandler(mockReq, mockRes);
  }

  // --------------------------------------------------------------------------
  // 3. ANDROID PHONE REALTIME RELAY STREAM (/relay-stream)
  // --------------------------------------------------------------------------
  if (pathname === '/relay-stream') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    res.write('data: {"type":"CONNECTED","message":"Android Phone SIM Relay Connected"}\n\n');
    connectedRelayClients.add(res);

    req.on('close', () => {
      connectedRelayClients.delete(res);
      console.log('📱 Android Relay phone disconnected. Active relays:', connectedRelayClients.size);
    });
    return;
  }

  // --------------------------------------------------------------------------
  // 4. ANDROID PHONE RELAY WEB INTERFACE (/relay or /gateway)
  // --------------------------------------------------------------------------
  if (pathname === '/relay' || pathname === '/gateway' || pathname === '/phone') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(getRelayPhoneHtml(req.headers.host));
  }

  // --------------------------------------------------------------------------
  // 5. GATEWAY STATUS MONITOR (/status)
  // --------------------------------------------------------------------------
  if (pathname === '/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      status: 'online',
      service: 'XHAODIN Cellular SMS Gateway Bridge',
      port: PORT,
      activeRelayPhones: connectedRelayClients.size,
      pendingTasks: pendingOutboundSmsQueue.length,
      routes: {
        channel1_ai: '+1 (800) 555-0101',
        channel2_user: '+1 (800) 555-0102',
        channel3_group: '+1 (800) 555-0103'
      },
      time: new Date().toISOString()
    }));
  }

  // --------------------------------------------------------------------------
  // 6. STATIC FILE SERVER (index.html, css, js, mp3, images)
  // --------------------------------------------------------------------------
  let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);
  if (!fs.existsSync(filePath)) {
    filePath = path.join(__dirname, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

// Helper: Parse JSON or Form Request Body
function parseRequestBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', chunk => { raw += chunk; });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        try {
          const params = new URLSearchParams(raw);
          const obj = {};
          for (const [k, v] of params.entries()) obj[k] = v;
          resolve(obj);
        } catch (e2) {
          resolve({});
        }
      }
    });
  });
}

// Helper: Create Express/Serverless-like response mock
function createMockResponse(res) {
  return {
    setHeader: (k, v) => res.setHeader(k, v),
    status: (statusCode) => ({
      json: (data) => {
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
      },
      send: (data) => {
        res.writeHead(statusCode);
        res.end(data);
      },
      end: () => {
        res.writeHead(statusCode);
        res.end();
      }
    })
  };
}

// Android Phone Bridge Web Application UI
function getRelayPhoneHtml(host) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>📱 XHAODIN Android Cellular SIM Relay</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { background-color: #06090c; color: #f8fafc; font-family: system-ui, -apple-system, sans-serif; }
    .pulse-glow { box-shadow: 0 0 25px rgba(0, 229, 153, 0.4); }
  </style>
</head>
<body class="min-h-screen flex flex-col items-center justify-between p-4 select-none">
  <div class="w-full max-w-md space-y-4">
    <!-- Header -->
    <div class="bg-[#10191f] p-5 rounded-3xl border border-emerald-500/30 text-center relative overflow-hidden">
      <div class="w-16 h-16 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-3xl mx-auto mb-3 pulse-glow">
        📱
      </div>
      <h1 class="text-xl font-bold text-white tracking-tight">Android Cellular SIM Gateway</h1>
      <p class="text-xs text-emerald-400 font-mono mt-1 flex items-center justify-center gap-1.5">
        <span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
        <span id="connStatus">CONNECTED TO XHAODIN ENGINE</span>
      </p>
      <p class="text-[11px] text-[#94a3b8] mt-2">Any SMS sent from computer will instantly trigger your Android SIM card to send real cellular SMS to Nokia!</p>
    </div>

    <!-- Live Action Buttons -->
    <div class="bg-[#10191f] p-5 rounded-3xl border border-white/10 space-y-3">
      <div class="flex justify-between items-center text-xs font-bold text-amber-400 uppercase tracking-wider">
        <span>Incoming Outbound Queue</span>
        <span id="queueBadge" class="bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full font-mono">0 Queued</span>
      </div>

      <div id="latestTaskBox" class="p-3.5 rounded-2xl bg-[#0b1115] border border-white/10 text-xs font-mono text-[#94a3b8]">
        Waiting for computer to send message to Nokia...
      </div>

      <button id="sendLatestBtn" class="hidden w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#00e599] to-[#00b87a] text-black font-bold text-xs active:scale-95 transition flex items-center justify-center gap-2">
        <span>🚀 FIRE REAL SMS FROM THIS SIM</span>
      </button>
    </div>

    <!-- Manual Simulator Inbound Forwarder -->
    <div class="bg-[#10191f] p-5 rounded-3xl border border-white/10 space-y-3">
      <h2 class="text-xs font-bold text-white uppercase tracking-wider">Forward Received Nokia SMS</h2>
      <form id="fwdForm" class="space-y-2.5">
        <input type="text" id="fwdFrom" placeholder="Nokia Phone (e.g. +923001234567)" required class="w-full px-3.5 py-2.5 rounded-xl bg-[#0b1115] border border-white/10 text-xs text-white">
        <input type="text" id="fwdText" placeholder="Message content..." required class="w-full px-3.5 py-2.5 rounded-xl bg-[#0b1115] border border-white/10 text-xs text-white">
        <button type="submit" class="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition">
          Forward Nokia SMS to App 📡
        </button>
      </form>
    </div>
  </div>

  <p class="text-[10px] text-[#64748b] text-center my-4 font-mono">XHAODIN GSM Engine v2.0 • Running on ${host || 'localhost'}</p>

  <script>
    let currentTask = null;
    const evtSource = new EventSource('/relay-stream');

    evtSource.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'NEW_OUTBOUND_SMS') {
          currentTask = data.task;
          document.getElementById('queueBadge').innerText = '1 Ready';
          document.getElementById('latestTaskBox').innerHTML = '<div class="text-white font-bold">🎯 Destination: ' + currentTask.to + '</div><div class="text-emerald-400 mt-1">Message: "' + currentTask.message + '"</div>';
          const btn = document.getElementById('sendLatestBtn');
          btn.classList.remove('hidden');
          
          // Auto-trigger Android SMS Intent
          window.location.href = 'sms:' + encodeURIComponent(currentTask.to) + '?body=' + encodeURIComponent(currentTask.message);
        }
      } catch(err) {}
    };

    document.getElementById('sendLatestBtn').addEventListener('click', () => {
      if (currentTask) {
        window.location.href = 'sms:' + encodeURIComponent(currentTask.to) + '?body=' + encodeURIComponent(currentTask.message);
      }
    });

    document.getElementById('fwdForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const from = document.getElementById('fwdFrom').value.trim();
      const text = document.getElementById('fwdText').value.trim();
      await fetch('/api/sms/incoming', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ From: from, Body: text, channel: 'channel2_user' })
      });
      alert('✅ Nokia SMS forwarded to XHAODIN chat system!');
      document.getElementById('fwdText').value = '';
    });
  </script>
</body>
</html>`;
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n=============================================================`);
  console.log(`🚀 XHAODIN SERVER & NOKIA CELLULAR SMS GATEWAY ACTIVE!`);
  console.log(`📡 Web Application & Chat: http://localhost:${PORT}`);
  console.log(`📱 Android SIM Relay Hub:  http://localhost:${PORT}/relay`);
  console.log(`⚡ Inbound Webhook:        http://localhost:${PORT}/api/sms/incoming`);
  console.log(`=============================================================\n`);
});
