import express from 'express';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
app.use(express.static('public'));

const DATA_FILE = 'bot_data.json';

// Gerçek Instagram profil dataları
const REAL_PROFILES = [
  { name: 'Ahmet Kaya', username: 'ahmet.kaya.2024', bio: 'Mühendis • İstanbul', posts: 342, followers: 2850, verified: false },
  { name: 'Zeynep Yıldız', username: 'zeynep.yildiz_', bio: 'Fotoğrafçı • Doğa severim', posts: 156, followers: 5230, verified: true },
  { name: 'Can Demir', username: 'can_demir_', bio: 'Yazılımcı • Startup founder', posts: 89, followers: 8940, verified: false },
  { name: 'Elif Şahin', username: 'elif.sahin_', bio: 'Moda blogger • Stil danışmanı', posts: 523, followers: 12340, verified: true },
  { name: 'Murat Özbek', username: 'murat.ozbek_', bio: 'Spor tutkunu • Vücut geliştirme', posts: 267, followers: 4500, verified: false },
  { name: 'Ayşe Çelik', username: 'ayse_celik_', bio: 'Şef • Yemek fotografı', posts: 412, followers: 9870, verified: true },
  { name: 'Ali Yalçın', username: 'ali_yalcin_', bio: 'Seyahat blogu • Maceracı', posts: 678, followers: 15600, verified: false },
  { name: 'Seda Aksoy', username: 'seda.aksoy_', bio: 'Yoga öğretmeni • Wellness', posts: 234, followers: 6780, verified: false },
  { name: 'Emre Çan', username: 'emre_can_', bio: 'Müzisyen • Prodüktör', posts: 125, followers: 11230, verified: true },
  { name: 'Gül Demirkaya', username: 'gul_demirkaya_', bio: 'İç mimar • Tasarım tutkunu', posts: 445, followers: 7890, verified: false },
  { name: 'Kerem Yıldız', username: 'kerem_yildiz_', bio: 'Çiftçi • Organik ürünler', posts: 312, followers: 5640, verified: false },
  { name: 'Leyla Kara', username: 'leyla_kara_', bio: 'Mütercim • Dil öğretmeni', posts: 189, followers: 4230, verified: false },
  { name: 'Cem Başaran', username: 'cem.basaran_', bio: 'İş danışmanı • Entrepreneur', posts: 267, followers: 9120, verified: true },
  { name: 'Pınar Gül', username: 'pinar_gul_', bio: 'Veteriner • Hayvan bilimleri', posts: 378, followers: 6540, verified: false },
  { name: 'Oğuz Kılıç', username: 'oguz_kilic_', bio: 'Avukat • Hukuk müşaviri', posts: 145, followers: 3890, verified: false },
  { name: 'Merve Taş', username: 'merve_tas_', bio: 'Öğretmen • Eğitim aktivisti', posts: 256, followers: 5780, verified: false },
  { name: 'İbrahim Demir', username: 'ibrahim_demir_', bio: 'Mimar • Şehir plancısı', posts: 523, followers: 8340, verified: true },
  { name: 'Deniz Yüksek', username: 'deniz_yuksek_', bio: 'Bilim popülarizatörü • Podcast', posts: 412, followers: 14560, verified: false },
  { name: 'Nilda Kaya', username: 'nilda_kaya_', bio: 'Makeup artist • Beauty influencer', posts: 687, followers: 23450, verified: true },
  { name: 'Halit Rızk', username: 'halit_rizk_', bio: 'İnsan kaynakları • HR konsultant', posts: 198, followers: 4120, verified: false }
];

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
    console.log('💾 Veritabanı kaydedildi');
  } catch (e) {
    console.error('Veritabanı kaydetme hatası:', e.message);
  }
}

function getRandomProfiles(count) {
  const profiles = [];
  for (let i = 0; i < count; i++) {
    const p = REAL_PROFILES[Math.floor(Math.random() * REAL_PROFILES.length)];
    profiles.push({
      ...p,
      id: `uid_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      avatar: `https://ui-avatars.com/api/?name=${p.name}&background=667eea&color=fff&bold=true`
    });
  }
  return profiles;
}

// API Endpoints
app.post('/api/account', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Ad gerekli' });
  
  if (!db.accounts[name]) {
    db.accounts[name] = { name, followers: [], created: new Date().toISOString() };
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
    db.accounts[account] = { name: account, followers: [], created: new Date().toISOString() };
  }
  
  const acc = db.accounts[account];
  const newFollowers = getRandomProfiles(Math.min(count, 1000));
  acc.followers = [...newFollowers, ...acc.followers];
  saveDB();
  
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
    db.accounts[account] = { name: account, followers: [], created: new Date().toISOString() };
  }
  
  const acc = db.accounts[account];
  const batchSize = Math.min(parseInt(count), 50000);
  const newFollowers = getRandomProfiles(batchSize);
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
  console.log('✅ Bot başladı - Kalıcı depolama aktif');
  console.log('📊 Toplam hesap:', Object.keys(db.accounts).length);
});
