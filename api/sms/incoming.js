// ==============================================================================
// XHAODIN TWO-WAY SMS BRIDGE - INCOMING WEBHOOK HANDLER
// Receives SMS from Nokia / Button / Feature phones & posts to Firebase RTDB
// ==============================================================================

const FIREBASE_DB_URL = process.env.FIREBASE_DATABASE_URL || 
                        process.env.VITE_FIREBASE_DATABASE_URL || 
                        'https://our-chat-46-default-rtdb.firebaseio.com';

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    let body = req.body || {};
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch(e) {}
    }

    // Extract Sender Phone & Message Text from various SMS Gateway formats
    // (Twilio, Android SMS Gateway, Vonage, Generic Webhook, Query Params)
    const senderPhone = (
      body.From || 
      body.from || 
      body.sender || 
      body.phone || 
      body.phoneNumber || 
      req.query.from || 
      req.query.sender || 
      req.query.From || 
      ''
    ).toString().trim();

    const messageText = (
      body.Body || 
      body.body || 
      body.message || 
      body.text || 
      body.content || 
      req.query.body || 
      req.query.message || 
      req.query.text || 
      ''
    ).toString().trim();

    if (!senderPhone || !messageText) {
      return res.status(400).json({ 
        error: 'Missing required parameters: sender phone (From) or message text (Body)',
        received: { senderPhone, messageText }
      });
    }

    // Clean Phone Number for Firebase Key
    const cleanPhone = senderPhone.replace(/[^0-9]/g, '');
    const smsChatId = `sms_${cleanPhone}`;
    const smsUserId = `sms_${cleanPhone}`;

    const now = Date.now();
    const timeFormatted = new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

    // 1. Create or Update SMS Contact in Firebase Users Directory
    const contactProfile = {
      uid: smsUserId,
      displayName: `📱 Nokia (${senderPhone})`,
      name: `📱 Nokia (${senderPhone})`,
      phoneNumber: senderPhone,
      email: `${smsUserId}@sms.xhaodin.local`,
      photoURL: `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanPhone}`,
      isSmsContact: true,
      lastSeen: now,
      status: 'Cellular SMS Connected'
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
      text: messageText,
      senderId: smsUserId,
      senderName: `📱 Nokia (${senderPhone})`,
      timestamp: now,
      time: timeFormatted,
      isSms: true,
      mediaType: 'text',
      deliveryStatus: 'read'
    };

    // Store in global messages table under smsChatId
    await fetch(`${FIREBASE_DB_URL}/messages/${smsChatId}/${msgId}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(msgPayload)
    });

    // 3. Return response (TwiML if requested, otherwise clean JSON)
    const isTwilio = req.headers['user-agent'] && req.headers['user-agent'].includes('Twilio');
    if (isTwilio || req.headers['content-type']?.includes('application/x-www-form-urlencoded')) {
      res.setHeader('Content-Type', 'text/xml');
      return res.status(200).send('<Response></Response>');
    }

    return res.status(200).json({
      success: true,
      message: 'Incoming SMS successfully dispatched to XHAODIN chat',
      chatId: smsChatId,
      messageId: msgId,
      sender: senderPhone,
      text: messageText
    });

  } catch (error) {
    console.error('Error handling incoming SMS webhook:', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}
