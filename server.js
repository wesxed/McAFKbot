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

// Instagram API Config
const INSTAGRAM_ACCESS_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN || '';
const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID || '';

console.log('🔐 Instagram API:', INSTAGRAM_ACCESS_TOKEN ? '✅ Bağlı' : '❌ Eksik');

// Kalıcı bellek depolama
let db = loadDB();

function loadDB() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readJsonSync(DATA_FILE);
      console.log('📂 Veritabanı yüklendi');
      return data;
    }
  } catch (e) {
    console.error('Veritabanı yükleme hatası:', e.message);
  }
  return { accounts: {} };
}

function saveDB() {
  try {
    fs.writeJsonSync(DATA_FILE, db, { spaces: 2 });
  } catch (e) {
    console.error('Veritabanı kaydetme hatası:', e.message);
  }
}

// Gerçek Instagram API'den takipçi verisi çek
async function fetchInstagramFollowers(accountId, limit = 50) {
  if (!INSTAGRAM_ACCESS_TOKEN) {
    return null;
  }

  try {
    const url = `https://graph.instagram.com/${accountId}/followers?fields=id,username,name,profile_picture_url&limit=${limit}&access_token=${INSTAGRAM_ACCESS_TOKEN}`;
    const res = await fetch(url, { timeout: 10000 });
    
    if (res.ok) {
      const data = await res.json();
      return data.data || [];
    }
  } catch (e) {
    console.error('Instagram API hatası:', e.message);
  }
  return null;
}

// Profil verilerini formatla
function formatProfile(igData) {
  return {
    id: igData.id,
    name: igData.name || igData.username,
    username: igData.username,
    avatar: igData.profile_picture_url || `https://ui-avatars.com/api/?name=${igData.username}&background=667eea&color=fff`,
    verified: false,
    bio: 'Instagram kullanıcısı',
    followers: Math.floor(Math.random() * 50000),
    posts: Math.floor(Math.random() * 1000)
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
      created: new Date().toISOString(),
      igAccount: null 
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
      created: new Date().toISOString(),
      igAccount: null 
    };
  }
  
  const acc = db.accounts[account];
  const newFollowers = [];
  
  for (let i = 0; i < Math.min(count, 1000); i++) {
    newFollowers.push({
      id: `uid_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: `Kullanıcı ${Math.floor(Math.random() * 9999)}`,
      username: `user_${Math.floor(Math.random() * 999999)}`,
      avatar: `https://ui-avatars.com/api/?name=User&background=667eea&color=fff&rand=${Math.random()}`,
      verified: Math.random() > 0.95,
      bio: 'Instagram kullanıcısı',
      followers: Math.floor(Math.random() * 50000),
      posts: Math.floor(Math.random() * 1000)
    });
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
      created: new Date().toISOString(),
      igAccount: null 
    };
  }
  
  const acc = db.accounts[account];
  const batchSize = Math.min(parseInt(count), 50000);
  const newFollowers = [];
  
  for (let i = 0; i < batchSize; i++) {
    newFollowers.push({
      id: `uid_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: `Kullanıcı ${Math.floor(Math.random() * 9999)}`,
      username: `user_${Math.floor(Math.random() * 999999)}`,
      avatar: `https://ui-avatars.com/api/?name=User&background=667eea&color=fff&rand=${Math.random()}`,
      verified: Math.random() > 0.95,
      bio: 'Instagram kullanıcısı',
      followers: Math.floor(Math.random() * 50000),
      posts: Math.floor(Math.random() * 1000)
    });
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

app.get('/api/stats', (req, res) => {
  const totalAccounts = Object.keys(db.accounts).length;
  const totalFollowers = Object.values(db.accounts).reduce((sum, acc) => sum + acc.followers.length, 0);
  
  res.json({
    totalAccounts,
    totalFollowers,
    apiStatus: INSTAGRAM_ACCESS_TOKEN ? '✅ Bağlı' : '⚠️ Demo Mode'
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(5000, '0.0.0.0', () => {
  console.log('✅ Instagram Bot başladı - Port 5000');
  console.log('📊 Instagram API:', INSTAGRAM_ACCESS_TOKEN ? '✅ Bağlı' : '⚠️ Demo Mode');
});
