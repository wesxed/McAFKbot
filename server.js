import express from 'express';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
app.use(express.static('public'));

const DATA_FILE = 'bot_data.json';
const INSTAGRAM_ACCESS_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN || '';

console.log('🔐 Instagram API:', INSTAGRAM_ACCESS_TOKEN ? '✅ Bağlı' : '❌ Eksik');

let db = loadDB();

function loadDB() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readJsonSync(DATA_FILE);
      console.log('📂 Veritabanı yüklendi');
      return data;
    }
  } catch (e) {
    console.error('DB yükleme hatası:', e.message);
  }
  return { accounts: {} };
}

function saveDB() {
  try {
    fs.writeJsonSync(DATA_FILE, db, { spaces: 2 });
  } catch (e) {
    console.error('DB kaydetme hatası:', e.message);
  }
}

// Profil oluştur
function generateProfile() {
  const names = ['Ahmet', 'Zeynep', 'Can', 'Elif', 'Murat', 'Ayşe', 'Ali', 'Seda', 'Emre', 'Gül'];
  const last = ['Kaya', 'Yıldız', 'Demir', 'Şahin', 'Özbek', 'Çelik', 'Yalçın', 'Aksoy', 'Çan', 'Demirkaya'];
  const bios = ['Mühendis • İstanbul', 'Fotoğrafçı • Doğa', 'Yazılımcı • Startup', 'Moda blogger', 'Spor tutkunu', 'Şef • Yemek', 'Seyahat blogu', 'Yoga öğretmeni', 'Müzisyen', 'İç mimar'];
  
  const fname = names[Math.floor(Math.random() * names.length)];
  const lname = last[Math.floor(Math.random() * last.length)];
  const username = `${fname.toLowerCase()}_${lname.toLowerCase()}_${Math.floor(Math.random() * 9999)}`;
  
  return {
    id: `uid_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: `${fname} ${lname}`,
    username: username,
    bio: bios[Math.floor(Math.random() * bios.length)],
    avatar: `https://ui-avatars.com/api/?name=${fname}+${lname}&background=667eea&color=fff&bold=true&size=128`,
    verified: Math.random() > 0.92,
    followers: Math.floor(Math.random() * 50000) + 100,
    posts: Math.floor(Math.random() * 1000) + 10
  };
}

// API Endpoints
app.post('/api/account', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Ad gerekli' });
  
  if (!db.accounts[name]) {
    db.accounts[name] = { 
      name, 
      followers: [], 
      created: new Date().toISOString()
    };
    saveDB();
  }
  
  res.json({ success: true });
});

app.get('/api/accounts', (req, res) => {
  const accounts = Object.values(db.accounts).map(acc => ({
    name: acc.name,
    count: acc.followers.length,
    created: acc.created
  }));
  res.json({ accounts });
});

app.get('/api/followers/:account', (req, res) => {
  const { account } = req.params;
  const acc = db.accounts[account];
  
  if (!acc) return res.status(404).json({ error: 'Hesap yok' });
  
  res.json({
    followers: acc.followers.slice(0, 50),
    total: acc.followers.length
  });
});

app.post('/api/followers/:account/add', (req, res) => {
  const { account } = req.params;
  const { count = 10 } = req.body;
  
  if (!db.accounts[account]) {
    db.accounts[account] = { 
      name: account, 
      followers: [], 
      created: new Date().toISOString()
    };
  }
  
  const acc = db.accounts[account];
  const newFollowers = [];
  
  for (let i = 0; i < Math.min(count, 1000); i++) {
    newFollowers.push(generateProfile());
  }
  
  acc.followers = [...newFollowers, ...acc.followers];
  saveDB();
  
  res.json({
    success: true,
    added: count,
    total: acc.followers.length
  });
});

app.post('/api/followers/:account/bulk', (req, res) => {
  const { account } = req.params;
  const { count = 1000 } = req.body;
  
  if (!db.accounts[account]) {
    db.accounts[account] = { 
      name: account, 
      followers: [], 
      created: new Date().toISOString()
    };
  }
  
  const acc = db.accounts[account];
  const batchSize = Math.min(parseInt(count), 50000);
  const newFollowers = [];
  
  for (let i = 0; i < batchSize; i++) {
    newFollowers.push(generateProfile());
  }
  
  acc.followers = [...newFollowers, ...acc.followers];
  saveDB();
  
  res.json({
    success: true,
    added: batchSize,
    total: acc.followers.length
  });
});

app.delete('/api/followers/:account', (req, res) => {
  const { account } = req.params;
  if (db.accounts[account]) {
    db.accounts[account].followers = [];
    saveDB();
  }
  res.json({ success: true });
});

app.delete('/api/account/:account', (req, res) => {
  const { account } = req.params;
  delete db.accounts[account];
  saveDB();
  res.json({ success: true });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(5000, '0.0.0.0', () => {
  console.log('✅ Bot başladı - Port 5000');
  console.log('📊 Instagram API:', INSTAGRAM_ACCESS_TOKEN ? '✅ Bağlı' : '⚠️ Demo');
});
