// ==============================================================================
// XHAODIN TWO-WAY SMS BRIDGE - 3-CHANNEL INCOMING WEBHOOK HANDLER
// Receives SMS from Nokia / Button / Feature phones & routes to:
// Channel 1: XHAODIN AI Assistant (Auto AI response via SMS)
// Channel 2: Direct VIP 1-on-1 Chat (Nokia to Android User A)
// Channel 3: Squad Group Broadcast (Nokia to Squad Group / VIP 2)
// ==============================================================================

const FIREBASE_DB_URL = process.env.FIREBASE_DATABASE_URL || 
                        process.env.VITE_FIREBASE_DATABASE_URL || 
                        'https://our-chat-46-default-rtdb.firebaseio.com';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 
                       process.env.FIREBASE_AI_API_KEY || 
                       '';

// 3 Default / Configured Virtual Gateway Numbers (Customizable via env/headers/params)
const ROUTE_NUMBERS = {
  channel1_ai: (process.env.SMS_CHANNEL1_AI_NUMBER || '+18005550101').replace(/[^0-9+]/g, ''),
  channel2_user: (process.env.SMS_CHANNEL2_USER_NUMBER || '+18005550102').replace(/[^0-9+]/g, ''),
  channel3_group: (process.env.SMS_CHANNEL3_GROUP_NUMBER || '+18005550103').replace(/[^0-9+]/g, '')
};

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    let body = req.body || {};
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch(e) {}
    }

    // Extract Sender Phone, Destination (To), Message Text, and Channel indicator
    const senderPhone = (
      body.From || 
      body.from || 
      body.sender || 
      body.phone || 
      body.phoneNumber || 
      body.fromPhone || 
      req.query.from || 
      req.query.sender || 
      req.query.From || 
      ''
    ).toString().trim();

    const destinationPhone = (
      body.To || 
      body.to || 
      body.receiver || 
      body.recipient || 
      body.toPhone || 
      req.query.to || 
      req.query.receiver || 
      req.query.To || 
      ''
    ).toString().trim();

    let messageText = (
      body.Body || 
      body.body || 
      body.message || 
      body.text || 
      body.content || 
      body.msg || 
      req.query.body || 
      req.query.message || 
      req.query.text || 
      ''
    ).toString().trim();

    const explicitChannel = (
      body.channel || 
      req.query.channel || 
      ''
    ).toString().trim().toLowerCase();

    if (!senderPhone || !messageText) {
      return res.status(400).json({ 
        error: 'Missing required parameters: sender phone (From) or message text (Body)',
        received: { senderPhone, destinationPhone, messageText }
      });
    }

    // Clean Phone Numbers
    const cleanSenderPhone = senderPhone.replace(/[^0-9]/g, '');
    const cleanDestPhone = destinationPhone.replace(/[^0-9]/g, '');
    const smsChatId = `sms_${cleanSenderPhone}`;
    const smsUserId = `sms_${cleanSenderPhone}`;

    const now = Date.now();
    const timeFormatted = new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

    // Determine Active Channel Routing (1 = AI, 2 = Direct User, 3 = Squad Group)
    let activeChannel = 'channel2_user'; // default 1-on-1 direct chat
    let cleanedMessage = messageText;

    if (
      explicitChannel === '1' || explicitChannel === 'ai' || explicitChannel === 'bot' ||
      cleanDestPhone === ROUTE_NUMBERS.channel1_ai.replace(/[^0-9]/g, '') ||
      messageText.toUpperCase().startsWith('AI ') || messageText.toUpperCase().startsWith('BOT ')
    ) {
      activeChannel = 'channel1_ai';
      if (messageText.toUpperCase().startsWith('AI ')) {
        cleanedMessage = messageText.substring(3).trim();
      } else if (messageText.toUpperCase().startsWith('BOT ')) {
        cleanedMessage = messageText.substring(4).trim();
      }
    } else if (
      explicitChannel === '3' || explicitChannel === 'group' || explicitChannel === 'squad' ||
      cleanDestPhone === ROUTE_NUMBERS.channel3_group.replace(/[^0-9]/g, '') ||
      messageText.toUpperCase().startsWith('GROUP ') || messageText.toUpperCase().startsWith('SQUAD ')
    ) {
      activeChannel = 'channel3_group';
      if (messageText.toUpperCase().startsWith('GROUP ')) {
        cleanedMessage = messageText.substring(6).trim();
      } else if (messageText.toUpperCase().startsWith('SQUAD ')) {
        cleanedMessage = messageText.substring(6).trim();
      }
    } else if (
      explicitChannel === '2' || explicitChannel === 'user' || explicitChannel === 'direct' ||
      cleanDestPhone === ROUTE_NUMBERS.channel2_user.replace(/[^0-9]/g, '')
    ) {
      activeChannel = 'channel2_user';
    }

    // 1. Create or Update Nokia SMS Contact in Firebase RTDB Users Directory
    const contactProfile = {
      uid: smsUserId,
      displayName: `📱 Nokia (${senderPhone})`,
      username: `📱 Nokia (${senderPhone})`,
      phoneNumber: senderPhone,
      email: `${smsUserId}@sms.xhaodin.local`,
      avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanSenderPhone}`,
      isSmsContact: true,
      lastSeen: now,
      online: true,
      status: `Nokia SMS (${activeChannel === 'channel1_ai' ? '🤖 AI Channel' : activeChannel === 'channel3_group' ? '👥 Squad Channel' : '👤 Direct Channel'})`
    };

    await fetch(`${FIREBASE_DB_URL}/users/${smsUserId}.json`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(contactProfile)
    }).catch(err => console.warn('User patch error:', err));

    // 2. Post Incoming SMS Message into Firebase Realtime Database
    const msgId = `msg_sms_${now}_${Math.random().toString(36).substring(2, 6)}`;
    const msgPayload = {
      id: msgId,
      text: cleanedMessage,
      senderId: smsUserId,
      senderName: `📱 Nokia (${senderPhone})`,
      timestamp: now,
      time: timeFormatted,
      isSms: true,
      channel: activeChannel,
      mediaType: 'text',
      status: 'delivered'
    };

    // Always store under the Nokia user's dedicated SMS chat
    await fetch(`${FIREBASE_DB_URL}/messages/${smsChatId}/${msgId}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(msgPayload)
    });

    let aiReplyText = null;

    // --------------------------------------------------------------------------
    // CHANNEL 1: AI ASSISTANT PROCESSING & AUTO-REPLY
    // --------------------------------------------------------------------------
    if (activeChannel === 'channel1_ai') {
      aiReplyText = await generateAiReply(cleanedMessage);
      
      const aiMsgId = `msg_ai_${now + 1}_${Math.random().toString(36).substring(2, 6)}`;
      const aiMsgPayload = {
        id: aiMsgId,
        text: aiReplyText,
        senderId: 'xhaodin_ai_bot',
        senderName: '🤖 XHAODIN AI',
        timestamp: now + 100,
        time: new Date(now + 100).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }),
        isSms: true,
        isAI: true,
        mediaType: 'text',
        status: 'delivered'
      };

      // Store AI reply in the chat
      await fetch(`${FIREBASE_DB_URL}/messages/${smsChatId}/${aiMsgId}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(aiMsgPayload)
      });

      // Dispatch outbound SMS back to the Nokia phone
      await dispatchOutboundSms({
        to: senderPhone,
        message: `🤖 XHAODIN AI:\n${aiReplyText}`,
        chatId: smsChatId
      }).catch(err => console.warn('Outbound AI SMS dispatch notice:', err.message));
    }

    // --------------------------------------------------------------------------
    // CHANNEL 3: SQUAD GROUP BROADCAST
    // --------------------------------------------------------------------------
    if (activeChannel === 'channel3_group') {
      const groupMsgId = `msg_group_sms_${now}_${Math.random().toString(36).substring(2, 6)}`;
      const groupMsgPayload = {
        id: groupMsgId,
        text: `📱 [Nokia SMS] ${cleanedMessage}`,
        senderId: smsUserId,
        senderName: `📱 Nokia (${senderPhone})`,
        timestamp: now,
        time: timeFormatted,
        isSms: true,
        mediaType: 'text',
        status: 'delivered'
      };

      // Store in Squad Group
      await fetch(`${FIREBASE_DB_URL}/messages/group_squad/${groupMsgId}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(groupMsgPayload)
      });
    }

    // 3. Return Response (Twilio TwiML or Clean JSON)
    const isTwilio = (req.headers['user-agent'] && req.headers['user-agent'].includes('Twilio')) ||
                     req.headers['content-type']?.includes('application/x-www-form-urlencoded');

    if (isTwilio) {
      res.setHeader('Content-Type', 'text/xml');
      if (activeChannel === 'channel1_ai' && aiReplyText) {
        return res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>🤖 XHAODIN AI:\n${escapeXml(aiReplyText)}</Message></Response>`);
      }
      return res.status(200).send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    }

    return res.status(200).json({
      success: true,
      message: 'Incoming SMS successfully processed & dispatched to XHAODIN',
      channel: activeChannel,
      chatId: smsChatId,
      messageId: msgId,
      sender: senderPhone,
      text: cleanedMessage,
      aiReply: aiReplyText || null,
      routes: {
        channel1_ai: ROUTE_NUMBERS.channel1_ai,
        channel2_user: ROUTE_NUMBERS.channel2_user,
        channel3_group: ROUTE_NUMBERS.channel3_group
      }
    });

  } catch (error) {
    console.error('Error handling incoming SMS webhook:', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}

// -----------------------------------------------------------------------------
// Helper: AI Response Generator (Multilingual Urdu/Hindi/English)
// -----------------------------------------------------------------------------
async function generateAiReply(userPrompt) {
  const cleanPrompt = (userPrompt || '').trim();
  const lower = cleanPrompt.toLowerCase();

  // 1. Try Google Gemini API if key is available
  if (GEMINI_API_KEY) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `You are XHAODIN AI Assistant replying via SMS to a Nokia / Button phone user. Keep your reply concise, ultra-clear, polite, and under 140 words. Reply in the same language as the user (Roman Urdu, Urdu, or English).\n\nUser: ${cleanPrompt}`
            }]
          }]
        })
      });
      const data = await response.json();
      const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (generatedText) return generatedText.trim();
    } catch (e) {
      console.warn('Gemini API query error, falling back to smart engine:', e.message);
    }
  }

  // 2. Intelligent Smart Rule Engine (Offline / Standalone Fallback)
  if (/\b(hello|hi|hey|salam|assalam|namaste|kasa ho|kese ho|ki haal)\b/i.test(lower)) {
    return "Assalam-o-Alaikum! Main XHAODIN AI Assistant hoon. Main aapki kya madad kar sakta hoon? Aap mujhse sawalat, math calculation, ya koi bhi baat pooch sakte hain.";
  }
  if (/\b(joke|latifa|mazak|chutkula)\b/i.test(lower)) {
    const jokes = [
      "Programmer ne biwi se kaha: Market se doodh lao, agar ande milein to 10 le aana. Programmer 10 doodh ke dabbe le aya kyunke market me ande the! 😄",
      "Teacher: 4 aur 4 kitne hotay hain? Student: Sochne ki baat hai sir, agar mil jayein to 8, na milein to 44! 😂"
    ];
    return jokes[Math.floor(Math.random() * jokes.length)];
  }
  if (/\b(calculate|math|solve|\d+\s*[\+\-\*\/]\s*\d+)\b/i.test(lower)) {
    try {
      const mathExpr = lower.replace(/[^0-9\+\-\*\/\.\(\)\s]/g, '').trim();
      if (mathExpr && /^[\d\+\-\*\/\.\(\)\s]+$/.test(mathExpr)) {
        const result = Function('"use strict"; return (' + mathExpr + ')')();
        return `🧮 Jawab: ${result}`;
      }
    } catch (e) {}
  }
  if (/\b(time|waqt|date|tareekh)\b/i.test(lower)) {
    const d = new Date();
    return `🕒 Current Time: ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}, Date: ${d.toLocaleDateString()}`;
  }
  if (cleanPrompt.length < 5) {
    return "XHAODIN AI: Baraye meharbani apna sawal tafseel se likhein ta ke main aapki behtar madad kar sakoon.";
  }

  return `XHAODIN AI: Aapka paigham mila: "${cleanPrompt}". Main aapki poori madad karne ke liye hazir hoon. Aap coding, math, ya general knowledge pooch saktay hain!`;
}

// -----------------------------------------------------------------------------
// Helper: Outbound SMS Dispatcher
// -----------------------------------------------------------------------------
async function dispatchOutboundSms({ to, message, chatId }) {
  const gatewayUrl = process.env.SMS_GATEWAY_URL;
  if (gatewayUrl) {
    await fetch(gatewayUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, phone: to, message, text: message })
    });
    return;
  }

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER || ROUTE_NUMBERS.channel1_ai;

  if (sid && token && fromNumber) {
    const authHeader = 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64');
    const formData = new URLSearchParams();
    formData.append('To', to);
    formData.append('From', fromNumber);
    formData.append('Body', message);

    await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formData.toString()
    });
  }
}

function escapeXml(unsafe) {
  return (unsafe || '').replace(/[<>&'"]/g, function (c) {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
    }
  });
}
