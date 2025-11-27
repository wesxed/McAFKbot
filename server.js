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

const BOTS_FILE = path.join(__dirname, 'bots.json');

let activeBots = {};
let botsData = { bots: [] };

// Load bots from file
async function loadBots() {
  try {
    if (await fs.pathExists(BOTS_FILE)) {
      botsData = await fs.readJSON(BOTS_FILE);
    } else {
      botsData = { bots: [] };
      await fs.writeJSON(BOTS_FILE, botsData, { spaces: 2 });
    }
  } catch (err) {
    console.error('Bots dosyası yükleme hatası:', err);
  }
}

async function saveBots() {
  try {
    await fs.writeJSON(BOTS_FILE, botsData, { spaces: 2 });
  } catch (err) {
    console.error('Bots dosyası kayıt hatası:', err);
  }
}

function startBotConnection(botId) {
  if (activeBots[botId]) return;

  const bot = botsData.bots.find(b => b.id === botId);
  if (!bot) return;

  const mineflayerBot = createBot({
    host: bot.host,
    port: bot.port,
    username: bot.nickname,
    version: false
  });

  let moveInterval;

  mineflayerBot.on('login', () => {
    bot.status = 'connected';
    saveBots();
    console.log(`🤖 Bot "${bot.nickname}" bağlandı: ${bot.host}:${bot.port}`);

    moveInterval = setInterval(() => {
      const moves = ['w', 'a', 's', 'd'];
      const randomMove = moves[Math.floor(Math.random() * 4)];
      mineflayerBot.setControlState(randomMove, true);
      setTimeout(() => {
        try {
          mineflayerBot.setControlState(randomMove, false);
        } catch (e) {}
      }, 100);
    }, 3000);
  });

  mineflayerBot.on('end', () => {
    bot.status = 'disconnected';
    saveBots();
    clearInterval(moveInterval);
    delete activeBots[botId];
    console.log(`❌ Bot "${bot.nickname}" koptı, 5 saniye sonra yeniden deneneceek...`);
    
    setTimeout(() => {
      const updatedBot = botsData.bots.find(b => b.id === botId);
      if (updatedBot && updatedBot.autoStart) {
        startBotConnection(botId);
      }
    }, 5000);
  });

  mineflayerBot.on('error', (err) => {
    console.error(`⚠️ Bot "${bot.nickname}" hatası:`, err.message);
  });

  mineflayerBot.on('kicked', (reason) => {
    console.log(`Bot "${bot.nickname}" atıldı:`, reason);
  });

  activeBots[botId] = mineflayerBot;
}

function stopBotConnection(botId) {
  const bot = activeBots[botId];
  if (bot) {
    bot.end();
    delete activeBots[botId];
    const botData = botsData.bots.find(b => b.id === botId);
    if (botData) {
      botData.status = 'disconnected';
      saveBots();
    }
  }
}

// API Routes

app.get('/api/bots', (req, res) => {
  const botsWithStatus = botsData.bots.map(bot => ({
    ...bot,
    status: activeBots[bot.id] ? 'connected' : 'disconnected'
  }));
  res.json(botsWithStatus);
});

app.post('/api/bots/add', (req, res) => {
  const { nickname, host, port } = req.body;

  if (!nickname || !host || !port) {
    return res.status(400).json({ error: 'Tüm alanlar gerekli' });
  }

  const botId = 'bot_' + Date.now();
  const newBot = {
    id: botId,
    nickname,
    host,
    port: parseInt(port),
    status: 'disconnected',
    autoStart: false,
    createdAt: new Date().toISOString()
  };

  botsData.bots.push(newBot);
  saveBots();

  res.json({ success: true, bot: newBot });
});

app.post('/api/bots/start', (req, res) => {
  const { botId } = req.body;

  if (!botId) {
    return res.status(400).json({ error: 'Bot ID gerekli' });
  }

  const bot = botsData.bots.find(b => b.id === botId);
  if (!bot) {
    return res.status(404).json({ error: 'Bot bulunamadı' });
  }

  if (activeBots[botId]) {
    return res.status(400).json({ error: 'Bot zaten çalışıyor' });
  }

  bot.autoStart = true;
  saveBots();
  startBotConnection(botId);

  res.json({ success: true, message: 'Bot başlatılıyor...' });
});

app.post('/api/bots/stop', (req, res) => {
  const { botId } = req.body;

  if (!botId) {
    return res.status(400).json({ error: 'Bot ID gerekli' });
  }

  const bot = botsData.bots.find(b => b.id === botId);
  if (!bot) {
    return res.status(404).json({ error: 'Bot bulunamadı' });
  }

  bot.autoStart = false;
  saveBots();
  stopBotConnection(botId);

  res.json({ success: true, message: 'Bot durduruldu' });
});

app.post('/api/bots/delete', (req, res) => {
  const { botId } = req.body;

  if (!botId) {
    return res.status(400).json({ error: 'Bot ID gerekli' });
  }

  stopBotConnection(botId);
  botsData.bots = botsData.bots.filter(b => b.id !== botId);
  saveBots();

  res.json({ success: true, message: 'Bot silindi' });
});

// Start server
app.listen(PORT, '0.0.0.0', async () => {
  await loadBots();
  console.log(`🚀 Server ${PORT} portunda çalışıyor`);
  console.log(`📊 Panel: http://localhost:${PORT}`);
});
