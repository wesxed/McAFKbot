import express from 'express';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import dgram from 'dgram';
import os from 'os';
import { execSync } from 'child_process';
import OpenAI from 'openai';

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

const serverPackages = [
  { id: 'pkg-10', slots: 10, price: 855, features: ['Web FTP', 'RCON'] },
  { id: 'pkg-12', slots: 12, price: 920, features: ['Web FTP', 'RCON'] },
  { id: 'pkg-14', slots: 14, price: 980, features: ['Web FTP', 'RCON', 'MySQL'] },
  { id: 'pkg-16', slots: 16, price: 1040, features: ['Web FTP', 'RCON', 'MySQL', 'Bot'] },
  { id: 'pkg-20', slots: 20, price: 1160, features: ['Web FTP', 'RCON', 'MySQL', 'Bot', 'Retake'] },
  { id: 'pkg-32', slots: 32, price: 1520, features: ['Web FTP', 'RCON', 'MySQL', 'Bot', 'Retake', 'Workshop'] }
];

const gameModes = {
  'competitive': { name: 'Competitive', roundTime: 120, bombTime: 40, economyEnabled: true, teamBalance: true },
  'casual': { name: 'Casual', roundTime: 120, bombTime: 40, economyEnabled: false, teamBalance: false },
  'deathmatch': { name: 'Deathmatch', roundTime: 60, bombTime: 0, economyEnabled: false, teamBalance: false },
  'awponly': { name: 'AWP Only', roundTime: 120, bombTime: 40, economyEnabled: true, restrictedWeapons: ['awp'] }
};

// Discord webhook - set via env or hardcode test
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK || null;

// OpenAI Client - the newest OpenAI model is "gpt-5" which was released August 7, 2025
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const chatHistories = {}; // Store chat histories per user

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
          package: 'pkg-32',
          status: 'running',
          map: 'de_dust2',
          tickrate: 128,
          maxPlayers: 32,
          ip: '127.0.0.1',
          port: 27015,
          players: [],
          logs: ['[✅] Sunucu başlatıldı', '[✅] Oyuncu bağlantıları aktif'],
          specs: { cpu: '4.0 GHz', ram: '12 GB', storage: '100 GB', lag: 'Yok' },
          location: 'Türkiye',
          uptime: '99.9%',
          config: { sv_gravity: 800, mp_freezetime: 15, mp_roundtime: 35 }
        },
        {
          id: 'server-2',
          name: 'Practice Sunucu',
          package: 'pkg-16',
          status: 'running',
          map: 'de_mirage',
          tickrate: 128,
          maxPlayers: 16,
          ip: '127.0.0.2',
          port: 27016,
          players: [],
          logs: ['[✅] Sunucu başlatıldı'],
          specs: { cpu: '4.0 GHz', ram: '12 GB', storage: '100 GB', lag: 'Yok' },
          location: 'Türkiye',
          uptime: '99.9%',
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

// Get packages
app.get('/api/packages', authenticate, (req, res) => {
  res.json(serverPackages);
});

// Get system info
app.get('/api/system-info', authenticate, (req, res) => {
  const cpus = os.cpus();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  
  let diskSpace = { total: 0, free: 0, used: 0 };
  try {
    const result = execSync('df -B1 / 2>/dev/null | tail -1').toString().split(/\s+/);
    if (result.length >= 3) {
      diskSpace.total = parseInt(result[1]) || 0;
      diskSpace.free = parseInt(result[3]) || 0;
      diskSpace.used = diskSpace.total - diskSpace.free;
    }
  } catch (e) {
    try {
      const result = execSync('wmic logicaldisk get size,freespace | findstr C:').toString().split(/\s+/);
      if (result.length >= 2) {
        diskSpace.total = parseInt(result[0]) || 0;
        diskSpace.free = parseInt(result[1]) || 0;
        diskSpace.used = diskSpace.total - diskSpace.free;
      }
    } catch (e2) {}
  }

  res.json({
    os: os.type() + ' ' + os.release(),
    arch: os.arch(),
    cpuCores: cpus.length,
    cpuModel: cpus[0].model,
    cpuSpeed: (cpus[0].speed / 1000).toFixed(2) + ' GHz',
    totalMemGB: (totalMem / 1024 / 1024 / 1024).toFixed(2),
    usedMemGB: (usedMem / 1024 / 1024 / 1024).toFixed(2),
    freeMemGB: (freeMem / 1024 / 1024 / 1024).toFixed(2),
    memPercent: ((usedMem / totalMem) * 100).toFixed(1),
    totalDiskGB: (diskSpace.total / 1024 / 1024 / 1024).toFixed(2),
    usedDiskGB: (diskSpace.used / 1024 / 1024 / 1024).toFixed(2),
    freeDiskGB: (diskSpace.free / 1024 / 1024 / 1024).toFixed(2),
    diskPercent: diskSpace.total > 0 ? ((diskSpace.used / diskSpace.total) * 100).toFixed(1) : 0,
    uptime: (os.uptime() / 3600).toFixed(1) + ' hours',
    hostname: os.hostname()
  });
});

// Game simulation object to manage loops per server
const gameLoops = {};

// Advanced game loop and physics simulation
function startGameSimulation(serverId) {
  const server = servers.find(s => s.id === serverId);
  if (!server) return;
  
  // Stop any existing loop
  if (gameLoops[serverId]) clearInterval(gameLoops[serverId]);
  
  // Initialize game state
  if (!server.gameState) {
    const mode = gameModes[server.gameMode || 'competitive'];
    server.gameState = {
      roundNum: 0,
      matchState: 'WaitingForPlayers',
      ticksInRound: 0,
      gameMode: server.gameMode || 'competitive',
      teamA: { name: 'Terrorists', score: 0, money: 2400, players: [] },
      teamB: { name: 'Counter-Terrorists', score: 0, money: 2400, players: [] },
      mapStartTime: Date.now(),
      subtickRate: server.tickrate || 128,
      bombPlanted: false,
      bombPlantTime: 0,
      modeSettings: mode,
      configFile: `// ${server.name} Config\nsv_gravity 800\nbot_quota 0\ntv_enable 1`
    };
  }

  // Add initial players to teams
  if (server.players.length === 0) {
    for (let i = 0; i < Math.min(server.maxPlayers / 2, 5); i++) {
      const name = playerNames[Math.floor(Math.random() * playerNames.length)] + Math.floor(Math.random() * 999);
      const team = i % 2 === 0 ? 'T' : 'CT';
      const baseScore = Math.floor(Math.random() * 50);
      server.players.push({
        id: 'player-' + Date.now() + '-' + i,
        name: name,
        score: baseScore,
        kills: 0,
        deaths: 0,
        ping: Math.floor(Math.random() * 40) + 15,
        team: team,
        health: 100,
        armor: 100,
        hasArmor: true,
        money: 2400,
        weapon: ['ak47', 'm4a4', 'awp'][Math.floor(Math.random() * 3)],
        x: Math.random() * 1000 - 500,
        y: Math.random() * 1000 - 500,
        z: 0,
        velocityX: 0,
        velocityY: 0,
        velocityZ: 0
      });
    }
    server.logs.push(`[${new Date().toLocaleTimeString()}] 🎮 Oyun başlatıldı - ${server.players.length} oyuncu`);
  }

  // Main game loop - runs at subtick rate
  let tickCounter = 0;
  const tickInterval = 1000 / (server.tickrate || 128); // Calculate tick time
  
  gameLoops[serverId] = setInterval(() => {
    if (server.status !== 'running') return;

    const state = server.gameState;
    tickCounter++;

    // === PLAYER MANAGEMENT ===
    // Random player join
    if (server.players.length < server.maxPlayers && Math.random() > 0.90) {
      const name = playerNames[Math.floor(Math.random() * playerNames.length)] + Math.floor(Math.random() * 999);
      const team = Math.random() > 0.5 ? 'T' : 'CT';
      server.players.push({
        id: 'player-' + Date.now(),
        name: name,
        score: 0,
        kills: 0,
        deaths: 0,
        ping: Math.floor(Math.random() * 40) + 15,
        team: team,
        health: 100,
        armor: 100,
        hasArmor: true,
        money: 2400,
        weapon: ['ak47', 'm4a4', 'deagle'][Math.floor(Math.random() * 3)],
        x: Math.random() * 1000 - 500,
        y: Math.random() * 1000 - 500,
        z: 0,
        velocityX: 0,
        velocityY: 0,
        velocityZ: 0
      });
      server.logs.push(`[${new Date().toLocaleTimeString()}] ✅ ${name} (${team}) katıldı - Toplam: ${server.players.length}`);
    }

    // Random player leave
    if (server.players.length > 2 && Math.random() > 0.92) {
      const idx = Math.floor(Math.random() * server.players.length);
      const removed = server.players.splice(idx, 1)[0];
      server.logs.push(`[${new Date().toLocaleTimeString()}] 🔴 ${removed.name} ayrıldı`);
    }

    // === PHYSICS SIMULATION - SUBTICK BASED ===
    server.players.forEach(p => {
      // Movement simulation
      p.velocityX += (Math.random() - 0.5) * 10; // Random direction
      p.velocityY += (Math.random() - 0.5) * 10;
      p.velocityX *= 0.95; // Friction
      p.velocityY *= 0.95;
      
      // Clamp velocity
      const maxVel = 250; // CS2 max player speed
      const velMag = Math.sqrt(p.velocityX ** 2 + p.velocityY ** 2);
      if (velMag > maxVel) {
        p.velocityX = (p.velocityX / velMag) * maxVel;
        p.velocityY = (p.velocityY / velMag) * maxVel;
      }

      // Update position
      p.x += p.velocityX * (tickInterval / 1000);
      p.y += p.velocityY * (tickInterval / 1000);

      // Map boundaries
      p.x = Math.max(-1024, Math.min(1024, p.x));
      p.y = Math.max(-1024, Math.min(1024, p.y));

      // === COMBAT SIMULATION ===
      if (Math.random() > 0.98) { // 2% chance to fire
        // Random hit
        const enemies = server.players.filter(e => e.team !== p.team);
        if (enemies.length > 0) {
          const target = enemies[Math.floor(Math.random() * enemies.length)];
          const damageRange = { 'ak47': [20, 35], 'awp': [90, 100], 'm4a4': [20, 30], 'deagle': [50, 70] };
          const damage = damageRange[p.weapon] || [20, 30];
          const dmg = Math.floor(Math.random() * (damage[1] - damage[0]) + damage[0]);
          
          target.health = Math.max(0, target.health - dmg);
          
          // Armor damage reduction
          if (target.hasArmor && target.armor > 0) {
            target.armor = Math.max(0, target.armor - dmg * 0.75);
          }

          if (p.health > 0) {
            p.kills++;
            p.score += 300;
          }
          if (target.health <= 0) {
            target.deaths++;
            target.health = 0;
            server.logs.push(`[${new Date().toLocaleTimeString()}] 💥 ${p.name} tarafından ${target.name} öldürüldü`);
            
            // Respawn after 5 seconds
            setTimeout(() => {
              if (server.players.find(pl => pl.id === target.id)) {
                target.health = 100;
                target.armor = 100;
                target.x = Math.random() * 1000 - 500;
                target.y = Math.random() * 1000 - 500;
              }
            }, 5000);
          }
        }
      }

      // Ping fluctuation
      p.ping = Math.max(5, p.ping + Math.floor(Math.random() * 10) - 5);
      
      // Score calculation
      p.score = p.kills * 300 - p.deaths * 50 + Math.floor(p.health);
    });

    // === ROUND MANAGEMENT ===
    state.ticksInRound++;
    
    if (state.matchState === 'WaitingForPlayers' && server.players.length >= 2) {
      state.matchState = 'RoundStarted';
      state.roundNum++;
      state.ticksInRound = 0;
      server.logs.push(`[${new Date().toLocaleTimeString()}] 🎬 Round ${state.roundNum} başladı!`);
    }

    // Round ends after 2 minutes (120 seconds / tickInterval)
    if (state.matchState === 'RoundStarted' && state.ticksInRound > (120000 / tickInterval)) {
      state.matchState = 'RoundEnded';
      const tScore = server.players.filter(p => p.team === 'T').reduce((a, b) => a + b.kills, 0);
      const ctScore = server.players.filter(p => p.team === 'CT').reduce((a, b) => a + b.kills, 0);
      state.teamA.score = tScore;
      state.teamB.score = ctScore;
      server.logs.push(`[${new Date().toLocaleTimeString()}] ✅ Round Sonu - T: ${tScore} | CT: ${ctScore}`);
      
      // New round starts
      setTimeout(() => {
        state.matchState = 'RoundStarted';
        state.ticksInRound = 0;
      }, 3000);
    }

    // Match ends after 30 rounds
    if (state.roundNum >= 30) {
      state.matchState = 'MatchEnded';
      server.logs.push(`[${new Date().toLocaleTimeString()}] 🏆 MATCH SONU - T: ${state.teamA.score} | CT: ${state.teamB.score}`);
    }

    saveServers();
  }, tickInterval);
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

// A2S Protocol Buffer helpers
function writeString(str) {
  const buf = Buffer.alloc(str.length + 1);
  buf.write(str, 0, str.length, 'utf8');
  buf[str.length] = 0;
  return buf;
}

function buildA2SInfoResponse(gameServer) {
  const serverName = gameServer.name || 'CS2 Server';
  const mapName = gameServer.map || 'de_dust2';
  const protocol = 17; // CS2 protocol version
  const playerCount = gameServer.players?.length || 0;
  const maxPlayers = gameServer.maxPlayers || 32;
  const serverType = 'd'; // Dedicated server
  const environment = 'l'; // Linux
  const visibility = 0; // Public
  const vac = 1; // VAC enabled
  const version = '1.0.0.0';
  
  let buf = Buffer.alloc(1024);
  let offset = 0;
  
  // Header
  buf.writeUInt32BE(0xFFFFFFFF, offset);
  offset += 4;
  
  // Type (I for info)
  buf.writeUInt8(0x49, offset); // 'I'
  offset += 1;
  
  // Protocol version
  buf.writeUInt8(protocol, offset);
  offset += 1;
  
  // Server name
  const nameBuf = Buffer.from(serverName + '\0');
  nameBuf.copy(buf, offset);
  offset += nameBuf.length;
  
  // Map
  const mapBuf = Buffer.from(mapName + '\0');
  mapBuf.copy(buf, offset);
  offset += mapBuf.length;
  
  // Game dir
  const gameBuf = Buffer.from('csgo\0');
  gameBuf.copy(buf, offset);
  offset += gameBuf.length;
  
  // Game description
  const descBuf = Buffer.from('Counter-Strike 2\0');
  descBuf.copy(buf, offset);
  offset += descBuf.length;
  
  // App ID (730 for CS2)
  buf.writeUInt16LE(730, offset);
  offset += 2;
  
  // Player count
  buf.writeUInt8(playerCount, offset);
  offset += 1;
  
  // Max players
  buf.writeUInt8(maxPlayers, offset);
  offset += 1;
  
  // Bot count
  buf.writeUInt8(0, offset);
  offset += 1;
  
  // Server type
  buf.writeUInt8(serverType.charCodeAt(0), offset);
  offset += 1;
  
  // Environment
  buf.writeUInt8(environment.charCodeAt(0), offset);
  offset += 1;
  
  // Visibility
  buf.writeUInt8(visibility, offset);
  offset += 1;
  
  // VAC
  buf.writeUInt8(vac, offset);
  offset += 1;
  
  // Version
  const verBuf = Buffer.from(version + '\0');
  verBuf.copy(buf, offset);
  offset += verBuf.length;
  
  return buf.slice(0, offset);
}

// UDP Game Server Simulator for each game server
function createGameServerListener(serverId, port) {
  const socket = dgram.createSocket('udp4');
  let connectionAttempts = 0;
  const challengeCode = Math.floor(Math.random() * 0xFFFFFFFF);
  
  socket.on('message', (msg, rinfo) => {
    try {
      if (msg.length < 4) return;
      
      const header = msg.readUInt32BE(0);
      if (header !== 0xFFFFFFFF) return;
      
      if (msg.length < 5) return;
      const type = msg[4];
      const gameServer = servers.find(s => s.id === serverId);
      
      if (!gameServer) return;
      
      // A2A_PING (0x69)
      if (type === 0x69) {
        const response = Buffer.alloc(5);
        response.writeUInt32BE(0xFFFFFFFF, 0);
        response[4] = 0x6A; // A2A_ACK
        socket.send(response, rinfo.port, rinfo.address);
      }
      
      // A2S_INFO (0x54)
      else if (type === 0x54) {
        if (gameServer.status !== 'running') return;
        connectionAttempts++;
        const response = buildA2SInfoResponse(gameServer);
        socket.send(response, rinfo.port, rinfo.address);
        gameServer.logs.push(`[${new Date().toLocaleTimeString()}] ✅ A2S_INFO İsteği`);
      }
      
      // A2S_PLAYER (0x55) - Challenge required
      else if (type === 0x55) {
        if (gameServer.status !== 'running') return;
        
        let challenge = null;
        if (msg.length >= 9) {
          challenge = msg.readUInt32LE(5);
        }
        
        if (!challenge || challenge === 0xFFFFFFFF) {
          // Return challenge
          const challengeResp = Buffer.alloc(9);
          challengeResp.writeUInt32BE(0xFFFFFFFF, 0);
          challengeResp[4] = 0x41; // 'A' = S2C_CHALLENGE
          challengeResp.writeUInt32LE(challengeCode, 5);
          socket.send(challengeResp, rinfo.port, rinfo.address);
          return;
        }
        
        // Send player list
        let buf = Buffer.alloc(1024);
        let offset = 0;
        buf.writeUInt32BE(0xFFFFFFFF, offset);
        offset += 4;
        buf[offset++] = 0x44; // 'D'
        buf.writeUInt8(gameServer.players?.length || 0, offset);
        offset += 1;
        
        (gameServer.players || []).forEach((p, idx) => {
          buf.writeUInt8(idx, offset);
          offset += 1;
          const name = p.name.substring(0, 31) + '\0';
          const nameBuf = Buffer.from(name);
          nameBuf.copy(buf, offset);
          offset += nameBuf.length;
          buf.writeUInt32LE(p.score || 0, offset);
          offset += 4;
          buf.writeFloatLE(Math.random() * 600, offset);
          offset += 4;
        });
        
        socket.send(buf.slice(0, offset), rinfo.port, rinfo.address);
      }
      
      // A2S_RULES (0x56) - Challenge required
      else if (type === 0x56) {
        if (gameServer.status !== 'running') return;
        
        let challenge = null;
        if (msg.length >= 9) {
          challenge = msg.readUInt32LE(5);
        }
        
        if (!challenge || challenge === 0xFFFFFFFF) {
          // Return challenge
          const challengeResp = Buffer.alloc(9);
          challengeResp.writeUInt32BE(0xFFFFFFFF, 0);
          challengeResp[4] = 0x41; // 'A' = S2C_CHALLENGE
          challengeResp.writeUInt32LE(challengeCode, 5);
          socket.send(challengeResp, rinfo.port, rinfo.address);
          return;
        }
        
        // Send empty rules
        let buf = Buffer.alloc(2048);
        let offset = 0;
        buf.writeUInt32BE(0xFFFFFFFF, offset);
        offset += 4;
        buf[offset++] = 0x45; // 'E'
        buf.writeUInt16LE(0, offset); // No rules
        offset += 2;
        socket.send(buf.slice(0, offset), rinfo.port, rinfo.address);
      }
    } catch (e) {
      console.error('UDP Hata:', e);
    }
  });

  socket.on('error', (err) => {
    console.error(`Port ${port} UDP Hata:`, err.message);
  });

  try {
    socket.bind(port, '127.0.0.1');
    console.log(`🎮 UDP Sunucu Port ${port} açıldı (A2S protokol)`);
  } catch (err) {
    console.error(`Port ${port} açılamadı:`, err.message);
  }

  return socket;
}

// AI Chat API Endpoint
app.post('/api/chat', async (req, res) => {
  const { message, username } = req.body;
  if (!message || !username) return res.status(400).json({ error: 'Mesaj gerekli' });
  
  try {
    // Initialize chat history for user
    if (!chatHistories[username]) {
      chatHistories[username] = [];
    }
    
    // Add user message to history
    chatHistories[username].push({ role: 'user', content: message });
    
    // Keep only last 20 messages for context
    if (chatHistories[username].length > 20) {
      chatHistories[username] = chatHistories[username].slice(-20);
    }
    
    // Call OpenAI - the newest OpenAI model is "gpt-5" which was released August 7, 2025
    const response = await openai.chat.completions.create({
      model: 'gpt-5',
      messages: chatHistories[username],
      max_completion_tokens: 1024
    });
    
    const assistantMessage = response.choices[0].message.content;
    
    // Add assistant response to history
    chatHistories[username].push({ role: 'assistant', content: assistantMessage });
    
    res.json({ response: assistantMessage });
  } catch (error) {
    console.error('AI Hata:', error);
    res.status(500).json({ error: 'AI yanıt verilemedi: ' + error.message });
  }
});

// Clear chat history
app.post('/api/chat/clear', (req, res) => {
  const { username } = req.body;
  if (username) delete chatHistories[username];
  res.json({ success: true });
});

// Start
const PORT = 5000;
app.listen(PORT, '0.0.0.0', async () => {
  await initData();
  
  // Start UDP game servers for each server
  servers.forEach(server => {
    if (server.status === 'running') {
      createGameServerListener(server.id, server.port);
    }
  });
  
  console.log(`🎮 CS Server Manager ${PORT} portunda çalışıyor`);
  console.log(`📊 Panel: http://localhost:${PORT}`);
  console.log(`📝 Giriş: admin / password123`);
  console.log(`🎮 Oyun Sunucuları UDP portlarında dinlemede`);
});
