import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
app.use(express.static('public'));

// Basit bellek depolama
const db = {
  accounts: {}
};

// Türkçe isimler
const NAMES = {
  first: ['Ahmet', 'Mehmet', 'Ayşe', 'Fatma', 'Ali', 'Veli', 'Gül', 'Zeynep', 'Cem', 'Demet', 'Ercan', 'Elif', 'Buğra', 'Ceren', 'Hüseyin', 'Işık', 'Kadir', 'Leyla', 'Murat', 'Neşe', 'Özer', 'Pınar', 'Recep', 'Selma', 'Tarık', 'Uygun', 'Veda', 'Yıldız', 'Zafer', 'Ayla'],
  last: ['Yılmaz', 'Kaya', 'Demir', 'Çelik', 'Aydın', 'Şahin', 'Akman', 'Bayram', 'Coş', 'Duman', 'Eren', 'Fidan', 'Gökmen', 'Hekim', 'İlhan', 'Jasinski', 'Kandemir', 'Lale', 'Maden', 'Nalbur', 'Olgun', 'Pehlevan', 'Qazi', 'Ramazan', 'Sezer', 'Temiz', 'Ural', 'Vargı', 'Wagner', 'Yılmaz']
};

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateProfile() {
  const first = NAMES.first[randomInt(0, NAMES.first.length - 1)];
  const last = NAMES.last[randomInt(0, NAMES.last.length - 1)];
  const username = `${first.toLowerCase()}_${last.toLowerCase()}_${randomInt(100, 9999)}`;
  
  return {
    id: `uid_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: `${first} ${last}`,
    username: username,
    followers: randomInt(100, 5000),
    posts: randomInt(10, 500),
    verified: Math.random() > 0.92,
    avatar: `https://ui-avatars.com/api/?name=${first}+${last}&background=667eea&color=fff`
  };
}

// API endpoints
app.post('/api/account', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Ad gerekli' });
  
  if (!db.accounts[name]) {
    db.accounts[name] = { name, followers: [], created: new Date() };
  }
  
  res.json({ success: true, account: db.accounts[name] });
});

app.get('/api/accounts', (req, res) => {
  const accounts = Object.values(db.accounts).map(acc => ({
    name: acc.name,
    count: acc.followers.length
  }));
  res.json({ accounts });
});

app.get('/api/followers/:account', (req, res) => {
  const { account } = req.params;
  const acc = db.accounts[account];
  
  if (!acc) return res.status(404).json({ error: 'Hesap bulunamadı' });
  
  res.json({ 
    followers: acc.followers.slice(0, 50),
    total: acc.followers.length 
  });
});

app.post('/api/followers/:account/add', (req, res) => {
  const { account } = req.params;
  const { count = 10 } = req.body;
  
  if (!db.accounts[account]) {
    db.accounts[account] = { name: account, followers: [], created: new Date() };
  }
  
  const acc = db.accounts[account];
  const newFollowers = [];
  
  for (let i = 0; i < Math.min(count, 1000); i++) {
    newFollowers.push(generateProfile());
  }
  
  acc.followers = [...newFollowers, ...acc.followers];
  
  res.json({ 
    success: true, 
    added: count,
    total: acc.followers.length,
    new: newFollowers.slice(0, 5)
  });
});

app.post('/api/followers/:account/bulk', (req, res) => {
  const { account } = req.params;
  const { count = 1000 } = req.body;
  
  if (!db.accounts[account]) {
    db.accounts[account] = { name: account, followers: [], created: new Date() };
  }
  
  const acc = db.accounts[account];
  const batchSize = Math.min(count, 50000);
  const newFollowers = [];
  
  for (let i = 0; i < batchSize; i++) {
    newFollowers.push(generateProfile());
  }
  
  acc.followers = [...newFollowers, ...acc.followers];
  
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
  }
  
  res.json({ success: true });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(5000, '0.0.0.0', () => {
  console.log('✅ Instagram Bot başladı: http://localhost:5000');
});
