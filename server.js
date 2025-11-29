import express from 'express';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
app.use(express.static('public'));

const DATA_FILE = 'instagram_bot_data.json';

const TURKISH_FIRST_NAMES = [
  'Elif', 'Aylin', 'Seda', 'Zeynep', 'Merve', 'Leyla', 'Gül', 'Nur', 'Ayşe', 'Fatma',
  'Şule', 'Neşe', 'Demet', 'Deniz', 'İris', 'Hande', 'Ceren', 'Buse', 'Yasemin', 'Ece',
  'Buğra', 'Cem', 'Emre', 'Ercüment', 'Erkan', 'Ersin', 'Ertuğrul', 'Ferit', 'Fırat',
  'Gökay', 'Gökhan', 'Gürkan', 'Halil', 'Hasan', 'Hüseyin', 'İbrahim', 'İlker', 'İsmail', 'İvan',
  'Kadir', 'Kamil', 'Kemal', 'Kerem', 'Kılıç', 'Kürşat', 'Levent', 'Lütfi', 'Mahmut', 'Maliş',
  'Mehmet', 'Metin', 'Murat', 'Naci', 'Nazım', 'Necip', 'Nedim', 'Nergin', 'Nevzat', 'Nihat'
];

const TURKISH_LAST_NAMES = [
  'Yılmaz', 'Kaya', 'Demir', 'Çelik', 'Öztürk', 'Aydın', 'Şahin', 'Aktuğ', 'Albayrak', 'Altay',
  'Altıparmak', 'Altuğ', 'Aluç', 'Alver', 'Alyanak', 'Aman', 'Amca', 'Amir', 'Amoğlu', 'Amrahçı',
  'Anbarcı', 'Anbir', 'Anbuş', 'Andaç', 'Andahan', 'Andak', 'Andal', 'Andam', 'Andan', 'Andantı',
  'Baçik', 'Badem', 'Badıllı', 'Bağ', 'Bağbay', 'Bağbazı', 'Bağbozan', 'Bağcı', 'Bağdat', 'Bağıçsülü',
  'Çakır', 'Çalış', 'Çamlı', 'Çarıkçı', 'Çasım', 'Çaydaş', 'Çaygıl', 'Çaykur', 'Dağ', 'Daldal',
  'Danış', 'Danışman', 'Darıcı', 'Dava', 'Davaş', 'Davran', 'Dayak', 'Dayı', 'Dedeş', 'Dedik'
];

const BIO_TEMPLATES = [
  'Yaşam sevmeyi seviyorum 🌟', 'Moda ve seyahat tutkunu ✈️', 'Fotoğraf ve doğa severim 📸',
  'Müzik benim dilim 🎵', 'Spor ve sağlık 💪', 'Yemek ve kültür 🍜', 'Yazı ve edebiyat 📚',
  'Tasarım ve sanat 🎨', 'Teknoloji meraklısı 💻', 'Doğa rehberi 🏕️'
];

function generateRealisticProfile() {
  const firstName = TURKISH_FIRST_NAMES[Math.floor(Math.random() * TURKISH_FIRST_NAMES.length)];
  const lastName = TURKISH_LAST_NAMES[Math.floor(Math.random() * TURKISH_LAST_NAMES.length)];
  const username = `${firstName.toLowerCase()}.${lastName.toLowerCase()}_${Math.floor(Math.random() * 9999)}`;
  
  return {
    id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    fullName: `${firstName} ${lastName}`,
    username: username,
    bio: BIO_TEMPLATES[Math.floor(Math.random() * BIO_TEMPLATES.length)],
    followers: Math.floor(Math.random() * 5000) + 100,
    following: Math.floor(Math.random() * 2000) + 50,
    posts: Math.floor(Math.random() * 500) + 10,
    isVerified: Math.random() > 0.95,
    profileImage: `https://i.pravatar.cc/150?img=${Math.floor(Math.random() * 70)}`,
    joinDate: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
    addedAt: new Date().toISOString()
  };
}

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return fs.readJsonSync(DATA_FILE);
    }
  } catch (error) {
    console.error('Veri yükleme hatası:', error.message);
  }
  return { accounts: {}, stats: { totalAdded: 0, lastUpdated: new Date() } };
}

function saveData(data) {
  fs.writeJsonSync(DATA_FILE, data, { spaces: 2 });
}

function getOrCreateAccount(accountName) {
  const data = loadData();
  if (!data.accounts) data.accounts = {};
  
  if (!data.accounts[accountName]) {
    data.accounts[accountName] = {
      name: accountName,
      followers: [],
      stats: { totalAdded: 0, createdAt: new Date() }
    };
    saveData(data);
  }
  return data.accounts[accountName];
}

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/accounts', (req, res) => {
  const data = loadData();
  const accounts = Object.keys(data.accounts || {}).map(name => ({
    name,
    followerCount: (data.accounts[name].followers || []).length
  }));
  res.json({ accounts });
});

app.get('/api/followers', (req, res) => {
  const { account } = req.query;
  const limit = parseInt(req.query.limit) || 50;
  
  if (!account) {
    return res.status(400).json({ error: 'Hesap adı gerekli' });
  }
  
  const accountData = getOrCreateAccount(account);
  const followers = accountData.followers || [];
  
  res.json({
    followers: followers.slice(0, limit),
    total: followers.length,
    stats: accountData.stats
  });
});

app.post('/api/followers/add', (req, res) => {
  const { account, count = 1 } = req.body;
  
  if (!account) {
    return res.status(400).json({ error: 'Hesap adı gerekli' });
  }
  
  const data = loadData();
  const accountData = getOrCreateAccount(account);
  
  const newFollowers = [];
  for (let i = 0; i < Math.min(count, 1000); i++) {
    newFollowers.push(generateRealisticProfile());
  }
  
  accountData.followers = [...newFollowers, ...accountData.followers];
  accountData.stats.totalAdded = (accountData.stats.totalAdded || 0) + count;
  data.stats.totalAdded = (data.stats.totalAdded || 0) + count;
  data.stats.lastUpdated = new Date();
  
  saveData(data);
  
  res.json({
    success: true,
    addedCount: count,
    totalFollowers: accountData.followers.length,
    newFollowers: newFollowers.slice(0, 10)
  });
});

app.post('/api/followers/bulk-add', (req, res) => {
  const { account, count = 100 } = req.body;
  
  if (!account) {
    return res.status(400).json({ error: 'Hesap adı gerekli' });
  }
  
  const data = loadData();
  const accountData = getOrCreateAccount(account);
  
  const batchSize = Math.min(parseInt(count), 50000);
  const newFollowers = [];
  
  for (let i = 0; i < batchSize; i++) {
    newFollowers.push(generateRealisticProfile());
  }
  
  accountData.followers = [...newFollowers, ...accountData.followers];
  accountData.stats.totalAdded = (accountData.stats.totalAdded || 0) + batchSize;
  data.stats.totalAdded = (data.stats.totalAdded || 0) + batchSize;
  data.stats.lastUpdated = new Date();
  
  saveData(data);
  
  res.json({
    success: true,
    addedCount: batchSize,
    totalFollowers: accountData.followers.length,
    preview: newFollowers.slice(0, 5)
  });
});

app.get('/api/stats', (req, res) => {
  const { account } = req.query;
  
  if (!account) {
    return res.status(400).json({ error: 'Hesap adı gerekli' });
  }
  
  const accountData = getOrCreateAccount(account);
  const totalFollowers = (accountData.followers || []).length;
  const verifiedFollowers = (accountData.followers || []).filter(f => f.isVerified).length;
  const avgFollowerCount = totalFollowers > 0 
    ? Math.round(accountData.followers.reduce((sum, f) => sum + f.followers, 0) / totalFollowers)
    : 0;
  
  res.json({
    totalFollowers,
    verifiedFollowers,
    avgFollowerCount,
    totalAdded: accountData.stats.totalAdded || 0,
    lastUpdated: accountData.stats.createdAt
  });
});

app.post('/api/followers/reset', (req, res) => {
  const { account } = req.body;
  
  if (!account) {
    return res.status(400).json({ error: 'Hesap adı gerekli' });
  }
  
  const data = loadData();
  if (data.accounts && data.accounts[account]) {
    data.accounts[account].followers = [];
    data.accounts[account].stats.totalAdded = 0;
    saveData(data);
  }
  
  res.json({ success: true, message: 'Hesap takipçileri silindi' });
});

app.get('/api/followers/export', (req, res) => {
  const { account } = req.query;
  
  if (!account) {
    return res.status(400).json({ error: 'Hesap adı gerekli' });
  }
  
  const accountData = getOrCreateAccount(account);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${account}_followers.json"`);
  res.send(JSON.stringify(accountData.followers || [], null, 2));
});

const PORT = 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`📱 Instagram Bot çalışıyor: http://localhost:${PORT}`);
  console.log(`👥 Sınırsız takipçi ekle, gerçekçi profiller!`);
});
