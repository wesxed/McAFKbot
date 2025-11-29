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
const gameSimulations = {};

const playerNames = ['Oyuncu', 'Takım', 'Pilot', 'Ninja', 'Asker', 'Şef', 'Kahraman', 'Zirve', 'Phoenix', 'Sigma', 'Alpha', 'Delta', 'Echo', 'Falcon'];

function createGameState(serverId) {
  return {
    round: 1,
    tScore: 0,
    ctScore: 0,
    inRound: true,
    roundTime: 35 * 60,
    players: []
  };
}

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
      const data = await fs.readJSON(SERVERS_FILE);
      servers = Array.isArray(data) ? data : (data.servers || []);
    } else {
      servers = [
        {
          id: 'server-1',
          name: 'Türkiye #1 - CS2 Sunucu',
          status: 'running',
          map: 'de_dust2',
          tickrate: 128,
          maxPlayers: 10,
          ip: '127.0.0.1',
          port: 27015,
          players: [],
          logs: ['[✅] Sunucu başlatıldı', '[✅] Oyuncu bağlantıları aktif'],
          specs: { cpu: '4.0 GHz', ram: '12 GB', storage: '100 GB', lag: 'Yok' },
          config: { sv_gravity: 800, mp_freezetime: 15, mp_roundtime: 35 }
        },
        {
          id: 'server-2',
          name: 'Practice Sunucu',
          status: 'running',
          map: 'de_mirage',
          tickrate: 128,
          maxPlayers: 5,
          ip: '127.0.0.2',
          port: 27016,
          players: [],
          logs: ['[✅] Sunucu başlatıldı'],
          specs: { cpu: '4.0 GHz', ram: '12 GB', storage: '100 GB', lag: 'Yok' },
          config: { sv_gravity: 800, mp_freezetime: 0, mp_roundtime: 20 }
        }
      ];
      await fs.writeJSON(SERVERS_FILE, servers, { spaces: 2 });
    }

    // Initialize game simulations for running servers
    servers.forEach(server => {
      if (server.status === 'running') {
        gameSimulations[server.id] = createGameState(server.id);
        startGameSimulation(server.id);
      }
    });

    if (await fs.pathExists(MAPS_FILE)) {
      maps = await fs.readJSON(MAPS_FILE);
    } else {
      maps = ['de_dust2', 'de_inferno', 'de_mirage', 'de_nuke', 'de_train', 'de_cache', 'de_vertigo', 'cs_office', 'de_cbble'];
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

// Create server
app.post('/api/server/create', authenticate, (req, res) => {
  const { name, map, tickrate, maxPlayers } = req.body;
  
  if (!name || !map) {
    return res.status(400).json({ error: 'Sunucu adı ve harita gerekli' });
  }
  
  const serverId = 'server-' + Date.now();
  const newServer = {
    id: serverId,
    name,
    status: 'stopped',
    map,
    tickrate: tickrate || 128,
    maxPlayers: maxPlayers || 10,
    ip: 'play.custom-' + Math.floor(Math.random() * 9000 + 1000) + '.net',
    port: 27000 + servers.length,
    players: [],
    logs: [`[${new Date().toLocaleTimeString()}] Sunucu oluşturuldu`],
    specs: {
      cpu: '4.0 GHz',
      ram: '12 GB',
      storage: '100 GB',
      lag: 'Yok'
    },
    config: { sv_gravity: 800, mp_freezetime: 15, mp_roundtime: 35 }
  };
  
  servers.push(newServer);
  saveServers();
  res.json({ server: newServer });
});

// Get all servers
app.get('/api/servers', authenticate, (req, res) => {
  res.json(servers);
});

// Get single server
app.get('/api/server/:id', authenticate, (req, res) => {
  const server = servers.find(s => s.id === req.params.id);
  if (!server) return res.status(404).json({ error: 'Sunucu bulunamadı' });
  
  res.json(server);
});

// Get maps
app.get('/api/maps', authenticate, (req, res) => {
  res.json(maps);
});

// Start game simulation
function startGameSimulation(serverId) {
  const server = servers.find(s => s.id === serverId);
  if (!server) return;
  
  if (!gameSimulations[serverId]) {
    gameSimulations[serverId] = createGameState(serverId);
  }

  // Add initial players
  for (let i = 0; i < 3; i++) {
    const name = playerNames[Math.floor(Math.random() * playerNames.length)] + Math.floor(Math.random() * 999);
    server.players.push({
      id: 'player-' + Date.now() + '-' + i,
      name: name,
      score: Math.floor(Math.random() * 100),
      kills: Math.floor(Math.random() * 30),
      deaths: Math.floor(Math.random() * 20),
      ping: Math.floor(Math.random() * 40) + 15
    });
  }

  // Simulate ongoing player activity
  setInterval(() => {
    if (server.status === 'running') {
      // Add new player randomly
      if (server.players.length < server.maxPlayers && Math.random() > 0.75) {
        const name = playerNames[Math.floor(Math.random() * playerNames.length)] + Math.floor(Math.random() * 999);
        server.players.push({
          id: 'player-' + Date.now(),
          name: name,
          score: 0,
          kills: 0,
          deaths: 0,
          ping: Math.floor(Math.random() * 40) + 15
        });
        server.logs.push(`[${new Date().toLocaleTimeString()}] ✅ ${name} sunucuya katıldı`);
      }

      // Remove player randomly
      if (server.players.length > 1 && Math.random() > 0.8) {
        const idx = Math.floor(Math.random() * server.players.length);
        const removed = server.players.splice(idx, 1)[0];
        server.logs.push(`[${new Date().toLocaleTimeString()}] 🔴 ${removed.name} ayrıldı`);
      }

      // Update player stats
      server.players.forEach(p => {
        if (Math.random() > 0.7) p.kills += Math.floor(Math.random() * 3);
        if (Math.random() > 0.8) p.deaths += 1;
        p.score = p.kills * 25 - p.deaths * 10;
        p.ping = Math.max(15, p.ping + Math.floor(Math.random() * 20) - 10);
      });

      saveServers();
    }
  }, 5000);
}

// Server controls
app.post('/api/server/:id/start', authenticate, (req, res) => {
  const server = servers.find(s => s.id === req.params.id);
  if (!server) return res.status(404).json({ error: 'Sunucu bulunamadı' });
  
  server.status = 'running';
  server.logs.push(`[${new Date().toLocaleTimeString()}] ✅ Sunucu başlatıldı`);
  startGameSimulation(server.id);
  saveServers();
  res.json({ success: true });
});

app.post('/api/server/:id/stop', authenticate, (req, res) => {
  const server = servers.find(s => s.id === req.params.id);
  if (!server) return res.status(404).json({ error: 'Sunucu bulunamadı' });
  
  server.status = 'stopped';
  server.players = [];
  server.logs.push(`[${new Date().toLocaleTimeString()}] 🛑 Sunucu durduruldu`);
  delete gameSimulations[server.id];
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
