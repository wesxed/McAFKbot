import express from 'express';
import bodyParser from 'body-parser';
import twilio from 'twilio';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(bodyParser.json());
app.use(express.static('public'));

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_PHONE_NUMBER;

const client = twilio(accountSid, authToken);

console.log('✅ SMS Panel Başladı');
console.log('📱 Twilio:', fromNumber ? '✅ Bağlı' : '❌ Eksik');

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/api/send-sms', async (req, res) => {
  const { phone, message } = req.body;

  if (!phone || !message) {
    return res.status(400).json({ error: 'Telefon ve mesaj gerekli' });
  }

  if (!accountSid || !authToken || !fromNumber) {
    return res.status(500).json({ error: 'Twilio yapılandırması eksik' });
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

    console.log(`📤 SMS gönderildi: ${phone} | SID: ${sms.sid}`);
  } catch (error) {
    console.error('SMS Hatası:', error.message);
    res.status(500).json({ 
      error: error.message,
      details: 'SMS gönderilemedi. Telefon numarasını kontrol et (+90 formatında)'
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

  if (!accountSid || !authToken || !fromNumber) {
    return res.status(500).json({ error: 'Twilio yapılandırması eksik' });
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
      console.log(`📤 SMS gönderildi: ${phone}`);
    } catch (error) {
      results.push({ phone, status: 'başarısız', error: error.message });
      failed++;
      console.error(`❌ SMS başarısız: ${phone} - ${error.message}`);
    }
  }

  res.json({
    success: true,
    total: phones.length,
    sent,
    failed,
    results
  });
});

app.listen(5000, '0.0.0.0', () => {
  console.log('🚀 Port 5000 açık');
});
