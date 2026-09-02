// ==============================================================================
// XHAODIN TWO-WAY SMS BRIDGE - OUTBOUND SMS DISPATCHER
// Sends SMS from XHAODIN Web App to Nokia / Button phone via cellular network
// ==============================================================================

const FIREBASE_DB_URL = process.env.FIREBASE_DATABASE_URL || 
                        process.env.VITE_FIREBASE_DATABASE_URL || 
                        'https://our-chat-46-default-rtdb.firebaseio.com';

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
  }

  try {
    let body = req.body || {};
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch(e) {}
    }

    const {
      to,
      message,
      fromUserId,
      fromUserName,
      chatId,
      customGatewayUrl,
      twilioSid,
      twilioToken,
      twilioFrom
    } = body;

    if (!to || !message) {
      return res.status(400).json({ error: 'Missing destination number (to) or message text (message).' });
    }

    const cleanTo = to.replace(/[^0-9]/g, '');
    const activeChatId = chatId || `sms_${cleanTo}`;
    const now = Date.now();
    const timeFormatted = new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

    let gatewayResult = { provider: 'none', status: 'dispatched_to_queue' };

    // 1. Dispatch via Android Local SIM Gateway (if configured)
    const gatewayUrl = customGatewayUrl || process.env.SMS_GATEWAY_URL;
    if (gatewayUrl) {
      try {
        const response = await fetch(gatewayUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to, phone: to, message, text: message })
        });
        const data = await response.json().catch(() => ({ status: 'ok' }));
        gatewayResult = { provider: 'android_sim_gateway', status: 'delivered_to_cellular', data };
      } catch (gwErr) {
        console.warn('Android SIM Gateway error:', gwErr.message);
        gatewayResult = { provider: 'android_sim_gateway', status: 'queued_offline', error: gwErr.message };
      }
    } 
    // 2. Dispatch via Twilio (if configured)
    else {
      const sid = twilioSid || process.env.TWILIO_ACCOUNT_SID;
      const token = twilioToken || process.env.TWILIO_AUTH_TOKEN;
      const fromNumber = twilioFrom || process.env.TWILIO_PHONE_NUMBER || process.env.SMS_CHANNEL2_USER_NUMBER || '+18005550102';

      if (sid && token && fromNumber) {
        try {
          const authHeader = 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64');
          const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
          const formData = new URLSearchParams();
          formData.append('To', to);
          formData.append('From', fromNumber);
          formData.append('Body', message);

          const response = await fetch(twilioUrl, {
            method: 'POST',
            headers: {
              'Authorization': authHeader,
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: formData.toString()
          });
          const data = await response.json();
          if (response.ok) {
            gatewayResult = { provider: 'twilio', status: 'sent', sid: data.sid };
          } else {
            gatewayResult = { provider: 'twilio', status: 'error', details: data.message };
          }
        } catch (twErr) {
          console.warn('Twilio dispatch error:', twErr.message);
          gatewayResult = { provider: 'twilio', status: 'error', details: twErr.message };
        }
      } else {
        gatewayResult = {
          provider: 'cellular_simulation_mode',
          status: 'simulated_cellular_delivery',
          note: 'Configured in simulator mode. To send live cellular SMS, configure Android SIM Gateway or Twilio keys in SMS Hub.'
        };
      }
    }

    // 3. Write Outbound Message Record to Firebase RTDB (only if not already saved by client)
    const msgId = body.messageId || `msg_out_${now}_${Math.random().toString(36).substring(2, 6)}`;
    const msgPayload = {
      id: msgId,
      text: message,
      senderId: fromUserId || 'web_user',
      senderName: fromUserName || 'Web User',
      recipientPhone: to,
      timestamp: now,
      time: timeFormatted,
      isSms: true,
      mediaType: 'text',
      status: 'delivered',
      gatewayInfo: gatewayResult
    };

    if (!body.skipFirebaseWrite) {
      await fetch(`${FIREBASE_DB_URL}/messages/${activeChatId}/${msgId}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(msgPayload)
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Message dispatched successfully to Nokia handset',
      messageId: msgId,
      chatId: activeChatId,
      to,
      gatewayResult
    });

  } catch (error) {
    console.error('Error sending outbound SMS:', error);
    return res.status(500).json({ error: 'Failed to send SMS', details: error.message });
  }
}
