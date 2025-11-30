import express from 'express';
import bodyParser from 'body-parser';
import twilio from 'twilio';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(bodyParser.json());
app.use(express.static('public'));

const accountSid = process.env.TWILIO_ACCOUNT_SID || '';
const authToken = process.env.TWILIO_AUTH_TOKEN || '';
const fromNumber = process.env.TWILIO_PHONE_NUMBER || '';

let client = null;
let twilioStatus = 'DEMO MODE';

// Twilio'yu bağla
if (accountSid && authToken && fromNumber) {
  try {
    client = twilio(accountSid, authToken);
    twilioStatus = '✅ BAĞLANDI';
    console.log('✅ Twilio Bağlantısı Başarılı');
  } catch (e) {
    console.error('❌ Twilio Hatası:', e.message);
    twilioStatus = '❌ ' + e.message;
  }
} else {
  console.log('⚠️ Twilio Credentials Eksik - DEMO MODE');
  twilioStatus = '❌ Credentials Eksik';
}

console.log('✅ SMS Panel Başladı - Port 5000');
console.log('📱 Durum:', twilioStatus);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/status', (req, res) => {
  res.json({ status: twilioStatus, ready: !!client });
});

app.post('/api/send-sms', async (req, res) => {
  const { phone, message } = req.body;

  if (!phone || !message) {
    return res.status(400).json({ error: 'Telefon ve mesaj gerekli' });
  }

  if (!client) {
    return res.status(500).json({ 
      error: 'SMS Gönderilemedi',
      details: 'Twilio credentials geçersiz veya eksik. Lütfen account dashboard\'ınızı kontrol edin.'
    });
  }

  try {
    const sms = await client.messages.create({
      body: message,
      from: fromNumber,
      to: phone
    });

    res.json({
      success: true,
      sid: sms.sid,
      status: sms.status,
      message: `✅ SMS gönderildi: ${phone}`
    });

    console.log(`📤 SMS: ${phone} | Status: ${sms.status}`);
  } catch (error) {
    console.error('SMS Error:', error.message);
    res.status(500).json({ 
      error: 'SMS Gönderilmedi',
      details: error.message
    });
  }
});

app.post('/api/send-bulk', async (req, res) => {
  const { phones, message } = req.body;

  if (!phones || !Array.isArray(phones) || phones.length === 0) {
    return res.status(400).json({ error: 'En az bir telefon gerekli' });
  }

  if (!message) {
    return res.status(400).json({ error: 'Mesaj gerekli' });
  }

  if (!client) {
    return res.status(500).json({ 
      error: 'SMS Gönderilemedi',
      details: 'Twilio credentials geçersiz veya eksik'
    });
  }

  const results = [];
  let sent = 0;
  let failed = 0;

  for (const phone of phones) {
    try {
      const sms = await client.messages.create({
        body: message,
        from: fromNumber,
        to: phone
      });
      results.push({ phone, status: 'başarılı', sid: sms.sid });
      sent++;
      console.log(`📤 SMS: ${phone}`);
    } catch (error) {
      results.push({ phone, status: 'başarısız', error: error.message });
      failed++;
    }
  }

  res.json({
    success: sent > 0,
    total: phones.length,
    sent,
    failed,
    results
  });
});

app.listen(5000, '0.0.0.0', () => {
  console.log('🚀 Server Çalışıyor - http://localhost:5000');
});
