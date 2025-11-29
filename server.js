import express from 'express';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
app.use(express.static('public'));

const SERVERS_FILE = path.join(__dirname, 'servers.json');
const MAPS_FILE = path.join(__dirname, 'maps.json');
const USERS_FILE = path.join(__dirname, 'users.json');

let servers = [];
let maps = [];
let users = {};

// Initialize data
async function initData() {
  try {
    if (await fs.pathExists(USERS_FILE)) {
      users = await fs.readJSON(USERS_FILE);
    } else {
      users = {
        'admin': 'password123',
        'root': 'admin'
      };
      await fs.writeJSON(USERS_FILE, users, { spaces: 2 });
    }

    if (await fs.pathExists(SERVERS_FILE)) {
      servers = await fs.readJSON(SERVERS_FILE);
    } else {
      servers = [
        {
          id: 'server-1',
          name: 'Türkiye #1 - CS2 Sunucu',
          status: 'running',
          map: 'de_dust2',
          tickrate: 128,
          maxPlayers: 10,
          ip: 'play.tr-' + Math.floor(Math.random() * 9000 + 1000) + '.net',
          port: 27015,
          players: [],
          logs: ['[Sunucu başlatıldı]'],
          config: { sv_gravity: 800, mp_freezetime: 15, mp_roundtime: 35 }
        },
        {
          id: 'server-2',
          name: 'Practice Sunucu',
          status: 'stopped',
          map: 'awp_lego_2',
          tickrate: 128,
          maxPlayers: 5,
          ip: 'play.practice-' + Math.floor(Math.random() * 9000 + 1000) + '.net',
          port: 27016,
          players: [],
          logs: ['[Sunucu başlatıldı]'],
          config: { sv_gravity: 800, mp_freezetime: 0, mp_roundtime: 20 }
        }
      ];
      await fs.writeJSON(SERVERS_FILE, servers, { spaces: 2 });
    }

    if (await fs.pathExists(MAPS_FILE)) {
      maps = await fs.readJSON(MAPS_FILE);
    } else {
      maps = ['de_dust2', 'de_inferno', 'de_mirage', 'awp_lego_2', 'awp_lego_3', 'cs_office', 'de_cache'];
      await fs.writeJSON(MAPS_FILE, maps, { spaces: 2 });
    }
  } catch (err) {
    console.error('Init hatası:', err);
  }
}

function saveServers() {
  fs.writeJSON(SERVERS_FILE, servers, { spaces: 2 }).catch(console.error);
}

function saveUsers() {
  fs.writeJSON(USERS_FILE, users, { spaces: 2 }).catch(console.error);
}

function generateToken() {
  return Math.random().toString(36).substr(2) + Date.now().toString(36);
}

const sessions = {};

// Login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Kullanıcı adı ve şifre gerekli' });
  }
  
  if (users[username] === password) {
    const token = generateToken();
    sessions[token] = username;
    res.json({ token });
  } else {
    res.status(401).json({ error: 'Yanlış kullanıcı adı veya şifre' });
  }
});

// Register
app.post('/api/register', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Kullanıcı adı ve şifre gerekli' });
  }
  
  if (username.length < 3) {
    return res.status(400).json({ error: 'Kullanıcı adı en az 3 karakter olmalı' });
  }
  
  if (password.length < 4) {
    return res.status(400).json({ error: 'Şifre en az 4 karakter olmalı' });
  }
  
  if (users[username]) {
    return res.status(400).json({ error: 'Bu kullanıcı adı zaten var' });
  }
  
  users[username] = password;
  saveUsers();
  
  const token = generateToken();
  sessions[token] = username;
  res.json({ token, message: 'Kayıt başarılı!' });
});

function authenticate(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!sessions[token]) {
    return res.status(401).json({ error: 'Giriş gerekli' });
  }
  next();
}

// Get all servers
app.get('/api/servers', authenticate, (req, res) => {
  res.json(servers);
});

// Get single server
app.get('/api/server/:id', authenticate, (req, res) => {
  const server = servers.find(s => s.id === req.params.id);
  if (!server) return res.status(404).json({ error: 'Sunucu bulunamadı' });
  
  // Simulate player activity
  if (server.status === 'running' && Math.random() > 0.7) {
    if (server.players.length < server.maxPlayers && Math.random() > 0.5) {
      server.players.push({
        id: 'player-' + Date.now(),
        name: `Oyuncu${Math.floor(Math.random() * 9999)}`,
        score: Math.floor(Math.random() * 100),
        kills: Math.floor(Math.random() * 50),
        deaths: Math.floor(Math.random() * 30),
        ping: Math.floor(Math.random() * 100) + 20
      });
      server.logs.push(`[${new Date().toLocaleTimeString()}] Oyuncu katıldı`);
    } else if (server.players.length > 0 && Math.random() > 0.6) {
      server.players.splice(Math.floor(Math.random() * server.players.length), 1);
      server.logs.push(`[${new Date().toLocaleTimeString()}] Oyuncu ayrıldı`);
    }
  }

  // Keep only last 50 logs
  if (server.logs.length > 50) server.logs = server.logs.slice(-50);
  saveServers();
  res.json(server);
});

// Get maps
app.get('/api/maps', authenticate, (req, res) => {
  res.json(maps);
});

// Server controls
app.post('/api/server/:id/start', authenticate, (req, res) => {
  const server = servers.find(s => s.id === req.params.id);
  if (!server) return res.status(404).json({ error: 'Sunucu bulunamadı' });
  
  server.status = 'running';
  server.logs.push(`[${new Date().toLocaleTimeString()}] ✅ Sunucu başlatıldı`);
  saveServers();
  res.json({ success: true });
});

app.post('/api/server/:id/stop', authenticate, (req, res) => {
  const server = servers.find(s => s.id === req.params.id);
  if (!server) return res.status(404).json({ error: 'Sunucu bulunamadı' });
  
  server.status = 'stopped';
  server.players = [];
  server.logs.push(`[${new Date().toLocaleTimeString()}] 🛑 Sunucu durduruldu`);
  saveServers();
  res.json({ success: true });
});

app.post('/api/server/:id/restart', authenticate, (req, res) => {
  const server = servers.find(s => s.id === req.params.id);
  if (!server) return res.status(404).json({ error: 'Sunucu bulunamadı' });
  
  server.players = [];
  server.logs.push(`[${new Date().toLocaleTimeString()}] 🔄 Sunucu yeniden başlatılıyor...`);
  setTimeout(() => {
    server.status = 'running';
    server.logs.push(`[${new Date().toLocaleTimeString()}] ✅ Sunucu başladı`);
    saveServers();
  }, 2000);
  
  res.json({ success: true });
});

// Change map
app.post('/api/server/:id/changemap', authenticate, (req, res) => {
  const server = servers.find(s => s.id === req.params.id);
  if (!server) return res.status(404).json({ error: 'Sunucu bulunamadı' });
  
  server.map = req.body.map;
  server.logs.push(`[${new Date().toLocaleTimeString()}] 🗺️ Harita değişti: ${req.body.map}`);
  saveServers();
  res.json({ success: true });
});

// RCON
app.post('/api/server/:id/rcon', authenticate, (req, res) => {
  const server = servers.find(s => s.id === req.params.id);
  if (!server) return res.status(404).json({ error: 'Sunucu bulunamadı' });
  
  const command = req.body.command;
  server.logs.push(`[${new Date().toLocaleTimeString()}] > ${command}`);

  if (command.includes('changelevel')) {
    const map = command.split(' ')[1];
    if (maps.includes(map)) {
      server.map = map;
      server.logs.push(`[${new Date().toLocaleTimeString()}] Harita değişti: ${map}`);
    }
  } else if (command.includes('kick')) {
    const parts = command.split(' ');
    if (parts[1]) {
      server.players = server.players.filter(p => !p.name.includes(parts[1]));
      server.logs.push(`[${new Date().toLocaleTimeString()}] Oyuncu atıldı`);
    }
  } else if (command.includes('ban')) {
    server.logs.push(`[${new Date().toLocaleTimeString()}] Oyuncu yasaklandı`);
  } else if (command.includes('say')) {
    const msg = command.split('say')[1]?.trim() || '';
    server.logs.push(`[${new Date().toLocaleTimeString()}] [SERVER]: ${msg}`);
  } else if (command.includes('sv_gravity')) {
    const val = command.split(' ')[1];
    server.config.sv_gravity = parseInt(val);
    server.logs.push(`[${new Date().toLocaleTimeString()}] sv_gravity = ${val}`);
  } else {
    server.logs.push(`[${new Date().toLocaleTimeString()}] Komut çalıştırıldı`);
  }

  saveServers();
  res.json({ success: true });
});

// Player actions
app.post('/api/server/:id/player/:playerId/kick', authenticate, (req, res) => {
  const server = servers.find(s => s.id === req.params.id);
  if (!server) return res.status(404).json({ error: 'Sunucu bulunamadı' });
  
  const player = server.players.find(p => p.id === req.params.playerId);
  if (player) {
    server.players = server.players.filter(p => p.id !== req.params.playerId);
    server.logs.push(`[${new Date().toLocaleTimeString()}] 👋 ${player.name} atıldı`);
    saveServers();
  }
  
  res.json({ success: true });
});

app.post('/api/server/:id/player/:playerId/ban', authenticate, (req, res) => {
  const server = servers.find(s => s.id === req.params.id);
  if (!server) return res.status(404).json({ error: 'Sunucu bulunamadı' });
  
  const player = server.players.find(p => p.id === req.params.playerId);
  if (player) {
    server.players = server.players.filter(p => p.id !== req.params.playerId);
    server.logs.push(`[${new Date().toLocaleTimeString()}] 🚫 ${player.name} yasaklandı`);
    saveServers();
  }
  
  res.json({ success: true });
});

// Start
const PORT = 5000;
app.listen(PORT, '0.0.0.0', async () => {
  await initData();
  console.log(`🎮 CS Server Manager ${PORT} portunda çalışıyor`);
  console.log(`📊 Panel: http://localhost:${PORT}`);
  console.log(`📝 Giriş: admin / password123`);
});
