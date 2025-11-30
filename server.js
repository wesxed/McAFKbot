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

// Send SMS
app.post('/api/sms/send', (req, res) => {
  const { phone, message, type = 'manual' } = req.body;

  if (!phone || !message) {
    return res.status(400).json({ error: 'Telefon ve mesaj gerekli' });
  }

  const sms = {
    id: Date.now().toString(),
    phone: phone.toString(),
    message: message.substring(0, 160),
    type,
    status: 'sent',
    timestamp: new Date().toISOString(),
    charCount: message.length
  };

  db.sms.push(sms);
  saveDB();

  res.json({
    success: true,
    sms: sms,
    message: `✅ SMS gönderildi: ${phone}`
  });

  console.log(`📤 SMS: ${phone}`);
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
  console.log('✅ Kendi SMS API\'nız çalışıyor - Port 5000');
  console.log('📊 SMS Database: sms_db.json');
});
