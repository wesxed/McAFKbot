import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { createBot } from 'mineflayer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 5000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

const USERS_FILE = path.join(__dirname, 'users.json');
const BOTS_FILE = path.join(__dirname, 'bots.json');
const CLOUD_FILE = path.join(__dirname, 'cloud.json');

let users = { users: {} };
let bots = { bots: [] };
let cloud = { files: {} };
let activeBots = {};
let userSessions = {};

// Initialize files
async function initFiles() {
  try {
    if (await fs.pathExists(USERS_FILE)) {
      users = await fs.readJSON(USERS_FILE);
    } else {
      await fs.writeJSON(USERS_FILE, users, { spaces: 2 });
    }

    if (await fs.pathExists(BOTS_FILE)) {
      bots = await fs.readJSON(BOTS_FILE);
    } else {
      await fs.writeJSON(BOTS_FILE, bots, { spaces: 2 });
    }

    if (await fs.pathExists(CLOUD_FILE)) {
      cloud = await fs.readJSON(CLOUD_FILE);
    } else {
      await fs.writeJSON(CLOUD_FILE, cloud, { spaces: 2 });
    }
  } catch (err) {
    console.error('Dosya yükleme hatası:', err);
  }
}

async function saveUsers() {
  try {
    await fs.writeJSON(USERS_FILE, users, { spaces: 2 });
  } catch (err) {
    console.error('Users dosyası kayıt hatası:', err);
  }
}

async function saveBots() {
  try {
    await fs.writeJSON(BOTS_FILE, bots, { spaces: 2 });
  } catch (err) {
    console.error('Bots dosyası kayıt hatası:', err);
  }
}

async function saveCloud() {
  try {
    await fs.writeJSON(CLOUD_FILE, cloud, { spaces: 2 });
  } catch (err) {
    console.error('Cloud dosyası kayıt hatası:', err);
  }
}

function generateToken() {
  return Math.random().toString(36).substr(2) + Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function verifyToken(token) {
  for (const userId in userSessions) {
    if (userSessions[userId] === token) {
      return userId;
    }
  }
  return null;
}

// AUTH ENDPOINTS

app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Kullanıcı adı ve şifre gerekli' });
  }

  if (users.users[username]) {
    return res.status(400).json({ error: 'Kullanıcı zaten var' });
  }

  const token = generateToken();
  users.users[username] = {
    username,
    password,
    createdAt: new Date().toISOString(),
    theme: 'theme-dark'
  };

  userSessions[username] = token;
  await saveUsers();

  res.json({ success: true, token, username });
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Kullanıcı adı ve şifre gerekli' });
  }

  const user = users.users[username];
  if (!user || user.password !== password) {
    return res.status(400).json({ error: 'Yanlış kullanıcı adı veya şifre' });
  }

  const token = generateToken();
  userSessions[username] = token;

  res.json({ success: true, token, username });
});

app.post('/api/logout', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const userId = verifyToken(token);

  if (userId) {
    delete userSessions[userId];
  }

  res.json({ success: true });
});

app.get('/api/me', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const userId = verifyToken(token);

  if (!userId) {
    return res.status(401).json({ error: 'Giriş yapmanız gerekli' });
  }

  const user = users.users[userId];
  res.json({
    username: userId,
    theme: user.theme,
    createdAt: user.createdAt
  });
});

app.patch('/api/theme', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const userId = verifyToken(token);
  const { theme } = req.body;

  if (!userId) {
    return res.status(401).json({ error: 'Giriş yapmanız gerekli' });
  }

  if (!['theme-dark', 'theme-light', 'theme-blue', 'theme-red'].includes(theme)) {
    return res.status(400).json({ error: 'Geçersiz tema' });
  }

  users.users[userId].theme = theme;
  await saveUsers();

  res.json({ success: true, theme });
});

// BOT ENDPOINTS

app.get('/api/bots', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const userId = verifyToken(token);

  if (!userId) {
    return res.status(401).json({ error: 'Giriş yapmanız gerekli' });
  }

  const userBots = bots.bots.filter(b => b.userId === userId).map(bot => ({
    ...bot,
    status: activeBots[bot.id] ? 'connected' : 'disconnected'
  }));

  res.json(userBots);
});

app.post('/api/bots/add', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const userId = verifyToken(token);
  const { nickname, host, port, version } = req.body;

  if (!userId) {
    return res.status(401).json({ error: 'Giriş yapmanız gerekli' });
  }

  if (!nickname || !host || !port) {
    return res.status(400).json({ error: 'Tüm alanlar gerekli' });
  }

  const botId = 'bot_' + Date.now() + Math.random().toString(36).substr(2, 9);
  const newBot = {
    id: botId,
    userId,
    nickname,
    host,
    port: parseInt(port),
    version: version || false,
    status: 'disconnected',
    autoStart: false,
    createdAt: new Date().toISOString()
  };

  bots.bots.push(newBot);
  await saveBots();

  res.json({ success: true, bot: newBot });
});

function stopBotConnectionSilent(botId) {
  const bot = activeBots[botId];
  if (bot) {
    try {
      bot.end();
    } catch (e) {}
    delete activeBots[botId];
  }
}

function startBotConnection(botId) {
  // Eğer bot zaten bağlıysa yeni bağlantı yapma
  if (activeBots[botId]) {
    return;
  }

  const bot = bots.bots.find(b => b.id === botId);
  if (!bot) return;

  // Eski bağlantıyı temizle
  stopBotConnectionSilent(botId);

  const options = {
    host: bot.host,
    port: bot.port,
    username: bot.nickname,
    version: bot.version || false,
    hideErrors: false,
    keepAlive: true
  };

  const mineflayerBot = createBot(options);
  let moveInterval;
  let isMoving = false;
  let hasSpawned = false;

  mineflayerBot.on('login', () => {
    bot.status = 'connected';
    saveBots();
    console.log(`🤖 Bot "${bot.nickname}" bağlandı: ${bot.host}:${bot.port}`);
  });

  mineflayerBot.on('spawn', () => {
    if (hasSpawned) return; // Spawn sadece bir kez işle
    hasSpawned = true;
    
    console.log(`✅ Bot "${bot.nickname}" oyunda görünüyor`);
    
    // Bot oyunda bir merhaba mesajı gönder
    setTimeout(() => {
      try {
        if (mineflayerBot.entity) {
          mineflayerBot.chat('Merhaba, Ben afk botuyum.');
        }
      } catch (e) {}
    }, 2000);
    
    // Hareketi başlat
    startAFKMovement();
  });

  function startAFKMovement() {
    if (moveInterval) clearInterval(moveInterval);
    isMoving = true;
    
    // Her 3 saniyede rastgele hareket
    moveInterval = setInterval(() => {
      if (!mineflayerBot.entity) return;
      
      try {
        // Rasgele yön seç
        const actions = [
          () => {
            mineflayerBot.setControlState('forward', true);
            setTimeout(() => {
              if (mineflayerBot.entity) mineflayerBot.setControlState('forward', false);
            }, 1500);
          },
          () => {
            mineflayerBot.setControlState('left', true);
            setTimeout(() => {
              if (mineflayerBot.entity) mineflayerBot.setControlState('left', false);
            }, 1500);
          },
          () => {
            mineflayerBot.setControlState('right', true);
            setTimeout(() => {
              if (mineflayerBot.entity) mineflayerBot.setControlState('right', false);
            }, 1500);
          },
          () => {
            mineflayerBot.setControlState('back', true);
            setTimeout(() => {
              if (mineflayerBot.entity) mineflayerBot.setControlState('back', false);
            }, 1500);
          }
        ];
        
        const randomAction = actions[Math.floor(Math.random() * actions.length)];
        randomAction();
        
        // Rasgele baş dönüşü
        const yaw = Math.random() * Math.PI * 2;
        const pitch = (Math.random() - 0.5) * 0.5;
        mineflayerBot.look(yaw, pitch, false);
      } catch (e) {
        // Hata olursa sessiz geç
      }
    }, 3000);
  }

  mineflayerBot.on('end', () => {
    clearInterval(moveInterval);
    isMoving = false;
    
    const wasAutoStart = bot.autoStart;
    bot.status = 'disconnected';
    saveBots();
    
    // Bağlantı listesinden kaldır
    if (activeBots[botId] === mineflayerBot) {
      delete activeBots[botId];
    }
    
    console.log(`❌ Bot "${bot.nickname}" bağlantısı koptu`);

    // Eğer autoStart açıksa yeniden bağlan
    if (wasAutoStart) {
      const reconnectDelay = 10000; // 10 saniye bekle
      console.log(`⏳ Bot "${bot.nickname}" ${reconnectDelay/1000}s sonra yeniden bağlanacak...`);
      
      setTimeout(() => {
        const currentBot = bots.bots.find(b => b.id === botId);
        if (currentBot && currentBot.autoStart && !activeBots[botId]) {
          console.log(`🔄 Bot "${bot.nickname}" yeniden bağlanılıyor...`);
          startBotConnection(botId);
        }
      }, reconnectDelay);
    }
  });

  mineflayerBot.on('error', (err) => {
    // Hata mesajlarını sessiz tut
  });

  mineflayerBot.on('kicked', (reason) => {
    console.log(`⚠️ Bot "${bot.nickname}" sunucudan atıldı, yeniden denenecek...`);
  });

  activeBots[botId] = mineflayerBot;
}

function stopBotConnection(botId) {
  const bot = activeBots[botId];
  if (bot) {
    try {
      bot.end();
    } catch (e) {}
    delete activeBots[botId];
    const botData = bots.bots.find(b => b.id === botId);
    if (botData) {
      botData.status = 'disconnected';
      saveBots();
    }
  }
}

app.post('/api/bots/start', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const userId = verifyToken(token);
  const { botId } = req.body;

  if (!userId) {
    return res.status(401).json({ error: 'Giriş yapmanız gerekli' });
  }

  const bot = bots.bots.find(b => b.id === botId && b.userId === userId);
  if (!bot) {
    return res.status(404).json({ error: 'Bot bulunamadı' });
  }

  if (activeBots[botId]) {
    return res.status(400).json({ error: 'Bot zaten çalışıyor' });
  }

  bot.autoStart = true;
  await saveBots();
  startBotConnection(botId);

  res.json({ success: true, message: 'Bot başlatılıyor...' });
});

app.post('/api/bots/stop', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const userId = verifyToken(token);
  const { botId } = req.body;

  if (!userId) {
    return res.status(401).json({ error: 'Giriş yapmanız gerekli' });
  }

  const bot = bots.bots.find(b => b.id === botId && b.userId === userId);
  if (!bot) {
    return res.status(404).json({ error: 'Bot bulunamadı' });
  }

  bot.autoStart = false;
  await saveBots();
  stopBotConnection(botId);

  res.json({ success: true, message: 'Bot durduruldu' });
});

app.post('/api/bots/delete', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const userId = verifyToken(token);
  const { botId } = req.body;

  if (!userId) {
    return res.status(401).json({ error: 'Giriş yapmanız gerekli' });
  }

  const botIndex = bots.bots.findIndex(b => b.id === botId && b.userId === userId);
  if (botIndex === -1) {
    return res.status(404).json({ error: 'Bot bulunamadı' });
  }

  stopBotConnection(botId);
  bots.bots.splice(botIndex, 1);
  await saveBots();

  res.json({ success: true, message: 'Bot silindi' });
});

// CLOUD ENDPOINTS

app.post('/api/cloud/upload', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const userId = verifyToken(token);
  const { filename, content } = req.body;

  if (!userId) {
    return res.status(401).json({ error: 'Giriş yapmanız gerekli' });
  }

  if (!filename || !content) {
    return res.status(400).json({ error: 'Dosya adı ve içerik gerekli' });
  }

  if (!cloud.files[userId]) {
    cloud.files[userId] = [];
  }

  cloud.files[userId].push({
    filename,
    content,
    uploadedAt: new Date().toISOString()
  });

  await saveCloud();
  res.json({ success: true, filename });
});

app.get('/api/cloud/files', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const userId = verifyToken(token);

  if (!userId) {
    return res.status(401).json({ error: 'Giriş yapmanız gerekli' });
  }

  const userFiles = cloud.files[userId] || [];
  res.json(userFiles);
});

app.delete('/api/cloud/file/:filename', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const userId = verifyToken(token);
  const { filename } = req.params;

  if (!userId) {
    return res.status(401).json({ error: 'Giriş yapmanız gerekli' });
  }

  if (!cloud.files[userId]) {
    return res.status(404).json({ error: 'Dosya bulunamadı' });
  }

  const index = cloud.files[userId].findIndex(f => f.filename === filename);
  if (index === -1) {
    return res.status(404).json({ error: 'Dosya bulunamadı' });
  }

  cloud.files[userId].splice(index, 1);
  await saveCloud();

  res.json({ success: true, message: 'Dosya silindi' });
});

// Auto-start bots on server startup
async function autoStartBots() {
  console.log('\n⏳ Kaydedilmiş botlar kontrol ediliyor...');
  
  const autoStartBots = bots.bots.filter(bot => bot.autoStart);
  
  if (autoStartBots.length === 0) {
    console.log('ℹ️ Auto-start için işaretlenen bot yok');
    return;
  }
  
  console.log(`🔄 ${autoStartBots.length} bot otomatik başlatılacak...\n`);
  
  for (const bot of autoStartBots) {
    setTimeout(() => {
      startBotConnection(bot.id);
      console.log(`✅ Bot "${bot.nickname}" otomatik başlatıldı`);
    }, 1000);
  }
}

// Start server
app.listen(PORT, '0.0.0.0', async () => {
  await initFiles();
  autoStartBots();
  console.log(`\n🚀 Server ${PORT} portunda çalışıyor`);
  console.log(`📊 Panel: http://localhost:${PORT}`);
  console.log(`🌐 Bot Paneli: http://localhost:${PORT}\n`);
});
