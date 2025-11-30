import express from 'express';
import bodyParser from 'body-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs-extra';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(bodyParser.json());
app.use(express.static('public'));

const DB_FILE = 'sms_db.json';
const SENDER_NUMBER = '+7999000001'; // +7 numarası

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

// API Endpoints
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Send SMS with 5 second delay
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
  setTimeout(() => {
    const sms = {
      id: Date.now().toString(),
      from: SENDER_NUMBER,
      to: phone.toString(),
      message: message.substring(0, 160),
      type,
      status: 'delivered',
      timestamp: new Date().toISOString(),
      charCount: message.length
    };

    db.sms.push(sms);
    saveDB();

    console.log(`✅ SMS gönderildi: ${SENDER_NUMBER} -> ${phone}`);
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
    sender: SENDER_NUMBER,
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
  console.log('✅ Kendi SMS API çalışıyor - Port 5000');
  console.log(`📱 Gönderici: ${SENDER_NUMBER}`);
  console.log('⏱️ Delay: 5 saniye');
});
