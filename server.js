import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createBot } from 'mineflayer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

const DB_FILE = path.join(__dirname, 'database.json');
const CLOUD_DIR = path.join(__dirname, 'cloud');
const BOTS_DIR = path.join(__dirname, 'bots');

if (!fs.existsSync(CLOUD_DIR)) fs.mkdirSync(CLOUD_DIR, { recursive: true });
if (!fs.existsSync(BOTS_DIR)) fs.mkdirSync(BOTS_DIR, { recursive: true });

let db = { users: {}, bots: {} };
if (fs.existsSync(DB_FILE)) {
  db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
} else {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

const bots = {};

function saveDB() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function generateToken() {
  return Math.random().toString(36).substr(2) + Date.now().toString(36);
}

function verifyToken(token) {
  for (const userId in db.users) {
    if (db.users[userId].token === token) {
      return userId;
    }
  }
  return null;
}

// AUTH ROUTES
app.post('/api/register', (req, res) => {
  const { username, password, email } = req.body;
  
  if (!username || !password || !email) {
    return res.status(400).json({ error: 'Tüm alanlar gerekli' });
  }

  if (db.users[username]) {
    return res.status(400).json({ error: 'Kullanıcı zaten var' });
  }

  const userId = username;
  db.users[userId] = {
    username,
    password,
    email,
    token: generateToken(),
    theme: 'dark',
    bots: [],
    createdAt: Date.now()
  };

  if (!fs.existsSync(path.join(CLOUD_DIR, userId))) {
    fs.mkdirSync(path.join(CLOUD_DIR, userId), { recursive: true });
  }

  saveDB();
  res.cookie('token', db.users[userId].token, { httpOnly: true, maxAge: 30 * 24 * 60 * 60 * 1000 });
  res.json({ success: true, userId });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Kullanıcı adı ve şifre gerekli' });
  }

  const user = db.users[username];
  if (!user || user.password !== password) {
    return res.status(400).json({ error: 'Yanlış kullanıcı adı veya şifre' });
  }

  user.token = generateToken();
  saveDB();
  res.cookie('token', user.token, { httpOnly: true, maxAge: 30 * 24 * 60 * 60 * 1000 });
  res.json({ success: true, userId: username });
});

app.post('/api/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true });
});

app.get('/api/me', (req, res) => {
  const token = req.cookies.token;
  const userId = verifyToken(token);
  
  if (!userId) {
    return res.status(401).json({ error: 'Giriş yapmanız gerekli' });
  }

  const user = db.users[userId];
  res.json({
    userId,
    username: user.username,
    email: user.email,
    theme: user.theme,
    bots: user.bots
  });
});

app.patch('/api/theme', (req, res) => {
  const token = req.cookies.token;
  const userId = verifyToken(token);
  const { theme } = req.body;

  if (!userId) return res.status(401).json({ error: 'Giriş yapmanız gerekli' });
  if (!['dark', 'light', 'blue', 'red'].includes(theme)) {
    return res.status(400).json({ error: 'Geçersiz tema' });
  }

  db.users[userId].theme = theme;
  saveDB();
  res.json({ success: true, theme });
});

// BOT ROUTES
app.post('/api/bots/create', (req, res) => {
  const token = req.cookies.token;
  const userId = verifyToken(token);
  const { host, port, nickname } = req.body;

  if (!userId) return res.status(401).json({ error: 'Giriş yapmanız gerekli' });
  if (!host || !port || !nickname) return res.status(400).json({ error: 'Tüm alanlar gerekli' });

  const botId = 'bot_' + Date.now();
  const botData = {
    id: botId,
    userId,
    host,
    port: parseInt(port),
    nickname,
    status: 'disconnected',
    createdAt: Date.now()
  };

  db.bots[botId] = botData;
  db.users[userId].bots.push(botId);
  saveDB();

  res.json({ success: true, botId, bot: botData });
});

app.post('/api/bots/:botId/connect', (req, res) => {
  const token = req.cookies.token;
  const userId = verifyToken(token);
  const { botId } = req.params;

  if (!userId) return res.status(401).json({ error: 'Giriş yapmanız gerekli' });
  if (!db.bots[botId] || db.bots[botId].userId !== userId) {
    return res.status(403).json({ error: 'Bu bota erişimi yok' });
  }

  const botData = db.bots[botId];

  if (bots[botId]) {
    return res.status(400).json({ error: 'Bot zaten çalışıyor' });
  }

  const bot = createBot({
    host: botData.host,
    port: botData.port,
    username: botData.nickname,
    version: '1.20.1'
  });

  let moveInterval;

  bot.on('login', () => {
    db.bots[botId].status = 'connected';
    saveDB();
    console.log(`Bot ${botId} bağlandı`);

    moveInterval = setInterval(() => {
      const moves = ['w', 'a', 's', 'd'];
      const randomMove = moves[Math.floor(Math.random() * moves.length)];
      bot.setControlState(randomMove, true);
      setTimeout(() => bot.setControlState(randomMove, false), 100);
    }, 3000);
  });

  bot.on('end', () => {
    db.bots[botId].status = 'disconnected';
    saveDB();
    clearInterval(moveInterval);
    delete bots[botId];
    console.log(`Bot ${botId} koptı, yeniden bağlanılıyor...`);
    setTimeout(() => {
      const req2 = { cookies: { token }, params: { botId } };
      const res2 = {
        status: () => ({ json: () => {} }),
        json: () => {}
      };
      if (db.users[userId]) {
        connectBotAuto(botId, userId);
      }
    }, 5000);
  });

  bot.on('error', (err) => {
    console.error(`Bot ${botId} hatasında:`, err.message);
  });

  bots[botId] = bot;
  res.json({ success: true, status: 'connecting' });
});

function connectBotAuto(botId, userId) {
  if (bots[botId]) return;
  
  const botData = db.bots[botId];
  const bot = createBot({
    host: botData.host,
    port: botData.port,
    username: botData.nickname,
    version: '1.20.1'
  });

  let moveInterval;

  bot.on('login', () => {
    db.bots[botId].status = 'connected';
    saveDB();

    moveInterval = setInterval(() => {
      const moves = ['w', 'a', 's', 'd'];
      const randomMove = moves[Math.floor(Math.random() * moves.length)];
      bot.setControlState(randomMove, true);
      setTimeout(() => bot.setControlState(randomMove, false), 100);
    }, 3000);
  });

  bot.on('end', () => {
    db.bots[botId].status = 'disconnected';
    saveDB();
    clearInterval(moveInterval);
    delete bots[botId];
    setTimeout(() => connectBotAuto(botId, userId), 5000);
  });

  bot.on('error', () => {});

  bots[botId] = bot;
}

app.post('/api/bots/:botId/disconnect', (req, res) => {
  const token = req.cookies.token;
  const userId = verifyToken(token);
  const { botId } = req.params;

  if (!userId) return res.status(401).json({ error: 'Giriş yapmanız gerekli' });
  if (!db.bots[botId] || db.bots[botId].userId !== userId) {
    return res.status(403).json({ error: 'Bu bota erişimi yok' });
  }

  if (bots[botId]) {
    bots[botId].end();
    delete bots[botId];
  }

  db.bots[botId].status = 'disconnected';
  saveDB();
  res.json({ success: true });
});

app.delete('/api/bots/:botId', (req, res) => {
  const token = req.cookies.token;
  const userId = verifyToken(token);
  const { botId } = req.params;

  if (!userId) return res.status(401).json({ error: 'Giriş yapmanız gerekli' });
  if (!db.bots[botId] || db.bots[botId].userId !== userId) {
    return res.status(403).json({ error: 'Bu bota erişimi yok' });
  }

  if (bots[botId]) {
    bots[botId].end();
    delete bots[botId];
  }

  delete db.bots[botId];
  db.users[userId].bots = db.users[userId].bots.filter(id => id !== botId);
  saveDB();
  res.json({ success: true });
});

app.get('/api/bots', (req, res) => {
  const token = req.cookies.token;
  const userId = verifyToken(token);

  if (!userId) return res.status(401).json({ error: 'Giriş yapmanız gerekli' });

  const userBots = db.users[userId].bots.map(botId => db.bots[botId]);
  res.json(userBots);
});

// CLOUD ROUTES
app.post('/api/cloud/upload', (req, res) => {
  const token = req.cookies.token;
  const userId = verifyToken(token);
  const { filename, content } = req.body;

  if (!userId) return res.status(401).json({ error: 'Giriş yapmanız gerekli' });
  if (!filename || !content) return res.status(400).json({ error: 'Dosya adı ve içerik gerekli' });

  const userCloudDir = path.join(CLOUD_DIR, userId);
  if (!fs.existsSync(userCloudDir)) {
    fs.mkdirSync(userCloudDir, { recursive: true });
  }

  const filePath = path.join(userCloudDir, filename);
  fs.writeFileSync(filePath, content);
  res.json({ success: true, filename });
});

app.get('/api/cloud/files', (req, res) => {
  const token = req.cookies.token;
  const userId = verifyToken(token);

  if (!userId) return res.status(401).json({ error: 'Giriş yapmanız gerekli' });

  const userCloudDir = path.join(CLOUD_DIR, userId);
  if (!fs.existsSync(userCloudDir)) {
    return res.json([]);
  }

  const files = fs.readdirSync(userCloudDir).map(filename => ({
    filename,
    size: fs.statSync(path.join(userCloudDir, filename)).size,
    createdAt: fs.statSync(path.join(userCloudDir, filename)).birthtime
  }));

  res.json(files);
});

app.get('/api/cloud/file/:filename', (req, res) => {
  const token = req.cookies.token;
  const userId = verifyToken(token);
  const { filename } = req.params;

  if (!userId) return res.status(401).json({ error: 'Giriş yapmanız gerekli' });

  const filePath = path.join(CLOUD_DIR, userId, filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Dosya bulunamadı' });
  }

  const content = fs.readFileSync(filePath, 'utf8');
  res.json({ filename, content });
});

app.delete('/api/cloud/file/:filename', (req, res) => {
  const token = req.cookies.token;
  const userId = verifyToken(token);
  const { filename } = req.params;

  if (!userId) return res.status(401).json({ error: 'Giriş yapmanız gerekli' });

  const filePath = path.join(CLOUD_DIR, userId, filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Dosya bulunamadı' });
  }

  fs.unlinkSync(filePath);
  res.json({ success: true });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Sunucu ${PORT} portunda çalışıyor`);
});
