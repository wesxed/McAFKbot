import express from 'express';
import bodyParser from 'body-parser';
import twilio from 'twilio';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs-extra';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(bodyParser.json());
app.use(express.static('public'));

const DB_FILE = 'sms_db.json';

// Twilio credentials
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_PHONE_NUMBER;

let client = null;
let twilioReady = false;

// Initialize Twilio
if (accountSid && authToken && fromNumber) {
  try {
    client = twilio(accountSid, authToken);
    twilioReady = true;
    console.log('✅ Twilio Bağlı');
  } catch (e) {
    console.log('❌ Twilio Error:', e.message);
  }
} else {
  console.log('⚠️ Twilio Credentials Eksik');
}

let db = {
  sms: [],
  templates: []
};

function loadDB() {
  try {
    if (fs.existsSync(DB_FILE)) {
      db = fs.readJsonSync(DB_FILE);
    }
  } catch (e) {
    console.error('DB load error:', e.message);
  }
}

function saveDB() {
  try {
    fs.writeJsonSync(DB_FILE, db, { spaces: 2 });
  } catch (e) {
    console.error('DB save error:', e.message);
  }
}

loadDB();

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Send SMS with Twilio
app.post('/api/sms/send', async (req, res) => {
  const { phone, message, type = 'manual' } = req.body;

  if (!phone || !message) {
    return res.status(400).json({ error: 'Telefon ve mesaj gerekli' });
  }

  // Send immediate response
  res.json({
    success: true,
    message: `⏳ SMS 5 saniye içinde gönderilecek: ${phone}`,
    scheduled: true
  });

  // Schedule SMS sending after 5 seconds
  setTimeout(async () => {
    try {
      let twilioStatus = 'pending';
      let sid = 'LOCAL_' + Date.now();

      // If Twilio is ready, send real SMS
      if (twilioReady && client) {
        try {
          const result = await client.messages.create({
            body: message.substring(0, 160),
            from: fromNumber,
            to: phone
          });
          
          twilioStatus = result.status;
          sid = result.sid;
          console.log(`✅ Twilio SMS gönderildi: ${phone} | SID: ${sid}`);
        } catch (twilioError) {
          console.error(`❌ Twilio Error: ${twilioError.message}`);
          twilioStatus = 'failed';
        }
      } else {
        console.log(`📤 SMS Kaydedildi (Twilio Yok): ${phone}`);
      }

      // Save to database
      const sms = {
        id: sid,
        from: fromNumber || '+7999000001',
        to: phone.toString(),
        message: message.substring(0, 160),
        type,
        status: twilioStatus,
        timestamp: new Date().toISOString(),
        charCount: message.length
      };

      db.sms.push(sms);
      saveDB();

    } catch (e) {
      console.error('SMS Error:', e.message);
    }
  }, 5000);
});

// Get SMS list
app.get('/api/sms', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const sms = db.sms.reverse().slice(0, limit);
  
  res.json({
    success: true,
    total: db.sms.length,
    sms: sms
  });
});

// Get SMS stats
app.get('/api/sms/stats', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const todaySms = db.sms.filter(s => s.timestamp.startsWith(today));
  
  res.json({
    total: db.sms.length,
    today: todaySms.length,
    twilio: twilioReady ? '✅ Aktif' : '❌ Yok',
    sender: fromNumber || '+7999000001',
    byType: {
      manual: db.sms.filter(s => s.type === 'manual').length,
      automated: db.sms.filter(s => s.type === 'automated').length
    }
  });
});

// Delete SMS
app.delete('/api/sms/:id', (req, res) => {
  const { id } = req.params;
  db.sms = db.sms.filter(s => s.id !== id);
  saveDB();
  res.json({ success: true, message: 'SMS silindi' });
});

// Clear all SMS
app.delete('/api/sms', (req, res) => {
  db.sms = [];
  saveDB();
  res.json({ success: true, message: 'Tüm SMS silindi' });
});

// Save template
app.post('/api/templates', (req, res) => {
  const { name, message } = req.body;

  if (!name || !message) {
    return res.status(400).json({ error: 'İsim ve mesaj gerekli' });
  }

  const template = {
    id: Date.now().toString(),
    name,
    message: message.substring(0, 160)
  };

  db.templates.push(template);
  saveDB();

  res.json({ success: true, template });
});

// Get templates
app.get('/api/templates', (req, res) => {
  res.json({ success: true, templates: db.templates });
});

// Delete template
app.delete('/api/templates/:id', (req, res) => {
  db.templates = db.templates.filter(t => t.id !== req.params.id);
  saveDB();
  res.json({ success: true });
});

app.listen(5000, '0.0.0.0', () => {
  console.log('✅ SMS API çalışıyor - Port 5000');
  console.log('📊 Database: sms_db.json');
  console.log(`📱 Twilio: ${twilioReady ? '✅ Aktif' : '❌ Yapılandırılmamış'}`);
});
