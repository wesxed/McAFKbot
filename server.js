import express from 'express';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
app.use(express.static('public'));

// Instagram Bot Storage
const DATA_FILE = 'instagram_bot_data.json';

// Gerçekçi Türkçe adlar
const TURKISH_FIRST_NAMES = [
  'Elif', 'Aylin', 'Seda', 'Zeynep', 'Merve', 'Leyla', 'Gül', 'Nur', 'Ayşe', 'Fatma',
  'Şule', 'Neşe', 'Demet', 'Deniz', 'İris', 'Hande', 'Ceren', 'Buse', 'Yasemin', 'Ece',
  'Buğra', 'Cem', 'Deniz', 'Emre', 'Ercüment', 'Erkan', 'Ersin', 'Ertuğrul', 'Ferit', 'Fırat',
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
  'Yaşam sevmeyi seviyorum 🌟',
  'Moda ve seyahat tutkunu ✈️',
  'Fotoğraf ve doğa severim 📸',
  'Müzik benim dilim 🎵',
  'Spor ve sağlık 💪',
  'Yemek ve kültür 🍜',
  'Yazı ve edebiyat 📚',
  'Tasarım ve sanat 🎨',
  'Teknoloji meraklısı 💻',
  'Doğa rehberi 🏕️'
];

// Gerçekçi profil oluştur
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

// Veri yükle/kaydet
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return fs.readJsonSync(DATA_FILE);
    }
  } catch (error) {
    console.error('Veri yükleme hatası:', error.message);
  }
  return { followers: [], stats: { totalAdded: 0, lastUpdated: new Date() } };
}

function saveData(data) {
  fs.writeJsonSync(DATA_FILE, data, { spaces: 2 });
}

// API Endpoints

// Ana sayfa
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Takipçileri getir
app.get('/api/followers', (req, res) => {
  const data = loadData();
  const limit = parseInt(req.query.limit) || 50;
  res.json({
    followers: data.followers.slice(0, limit),
    total: data.followers.length,
    stats: data.stats
  });
});

// Rastgele takipçi ekle
app.post('/api/followers/add', (req, res) => {
  const { count = 1 } = req.body;
  const data = loadData();
  
  const newFollowers = [];
  for (let i = 0; i < Math.min(count, 1000); i++) {
    newFollowers.push(generateRealisticProfile());
  }
  
  data.followers = [...newFollowers, ...data.followers];
  data.stats.totalAdded += count;
  data.stats.lastUpdated = new Date();
  
  saveData(data);
  
  res.json({
    success: true,
    addedCount: count,
    totalFollowers: data.followers.length,
    newFollowers: newFollowers.slice(0, 10)
  });
});

// Toplu takipçi ekle (sınırsız)
app.post('/api/followers/bulk-add', (req, res) => {
  const { count = 100 } = req.body;
  const data = loadData();
  
  const batchSize = Math.min(parseInt(count), 50000);
  const newFollowers = [];
  
  for (let i = 0; i < batchSize; i++) {
    newFollowers.push(generateRealisticProfile());
  }
  
  data.followers = [...newFollowers, ...data.followers];
  data.stats.totalAdded += batchSize;
  data.stats.lastUpdated = new Date();
  
  saveData(data);
  
  res.json({
    success: true,
    addedCount: batchSize,
    totalFollowers: data.followers.length,
    preview: newFollowers.slice(0, 5)
  });
});

// İstatistikler
app.get('/api/stats', (req, res) => {
  const data = loadData();
  const totalFollowers = data.followers.length;
  const verifiedFollowers = data.followers.filter(f => f.isVerified).length;
  const avgFollowerCount = data.followers.length > 0 
    ? Math.round(data.followers.reduce((sum, f) => sum + f.followers, 0) / data.followers.length)
    : 0;
  
  res.json({
    totalFollowers,
    verifiedFollowers,
    avgFollowerCount,
    totalAdded: data.stats.totalAdded,
    lastUpdated: data.stats.lastUpdated
  });
});

// Takipçileri sıfırla
app.post('/api/followers/reset', (req, res) => {
  saveData({ followers: [], stats: { totalAdded: 0, lastUpdated: new Date() } });
  res.json({ success: true, message: 'Tüm takipçiler silindi' });
});

// Takipçi arama
app.get('/api/followers/search', (req, res) => {
  const { q } = req.query;
  const data = loadData();
  
  if (!q) {
    return res.json({ followers: [] });
  }
  
  const results = data.followers.filter(f => 
    f.fullName.toLowerCase().includes(q.toLowerCase()) ||
    f.username.toLowerCase().includes(q.toLowerCase())
  ).slice(0, 20);
  
  res.json({ followers: results });
});

// Export takipçiler (JSON)
app.get('/api/followers/export', (req, res) => {
  const data = loadData();
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="followers.json"');
  res.send(JSON.stringify(data.followers, null, 2));
});

const PORT = 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`📱 Instagram Bot çalışıyor: http://localhost:${PORT}`);
  console.log(`👥 Sınırsız takipçi ekle, gerçekçi profiller!`);
});
