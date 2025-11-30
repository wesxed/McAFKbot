import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const WEAPONS = {
  pistol: { damage: 30, spread: 0.3, price: 0, ammo: 12, name: 'Glock-18', fireRate: 100 },
  ar: { damage: 30, spread: 0.15, price: 3100, ammo: 30, name: 'M4A1-S', fireRate: 90 },
  rifle: { damage: 63, spread: 0.2, price: 2900, ammo: 30, name: 'AK-47', fireRate: 100 },
  shotgun: { damage: 120, spread: 0.5, price: 1200, ammo: 8, name: 'XM1014', fireRate: 250 },
  sniper: { damage: 200, spread: 0.05, price: 4750, ammo: 10, name: 'AWP Dragon Lore', fireRate: 1500 }
};

const games = new Map();
const players = new Map();

function createGame(gameId) {
  return {
    id: gameId,
    round: 1,
    roundTime: 120,
    teamAScore: 0,
    teamBScore: 0,
    bombPlanted: false,
    bombX: 0,
    bombY: 0,
    bombZ: 0,
    bombTimer: 0,
    teamABudget: 2400,
    teamBBudget: 2400
  };
}

function getPlayerSpawn(team, existingPlayers) {
  const spawns = {
    A: [
      { x: -70, y: 1.6, z: -50 },
      { x: -60, y: 1.6, z: -60 },
      { x: -50, y: 1.6, z: -55 }
    ],
    B: [
      { x: 70, y: 1.6, z: 50 },
      { x: 60, y: 1.6, z: 60 },
      { x: 50, y: 1.6, z: 55 }
    ]
  };
  
  const teamSpawns = spawns[team];
  const spawn = teamSpawns[Math.floor(Math.random() * teamSpawns.length)];
  return { x: spawn.x + (Math.random() - 0.5) * 10, y: spawn.y, z: spawn.z + (Math.random() - 0.5) * 10 };
}

app.post('/api/join', (req, res) => {
  const { nickname, gameId } = req.body;
  const gid = gameId || 'default';
  const pid = Math.random().toString(36).substr(2, 9);

  if (!games.has(gid)) {
    games.set(gid, createGame(gid));
  }

  const game = games.get(gid);
  const gamePlayersArray = Array.from(players.values()).filter(p => p.gameId === gid);
  const teamA = gamePlayersArray.filter(p => p.team === 'A').length;
  const teamB = gamePlayersArray.filter(p => p.team === 'B').length;
  
  const team = teamA <= teamB ? 'A' : 'B';
  const spawn = getPlayerSpawn(team, gamePlayersArray);

  players.set(pid, {
    id: pid,
    nickname,
    gameId: gid,
    team,
    x: spawn.x,
    y: spawn.y,
    z: spawn.z,
    vx: 0,
    vy: 0,
    vz: 0,
    angle: team === 'A' ? 0 : Math.PI,
    pitch: 0,
    health: 100,
    armor: 0,
    money: 2400,
    weapon: 'pistol',
    ammo: WEAPONS.pistol.ammo,
    kills: 0,
    deaths: 0,
    alive: true,
    lastShot: 0,
    respawnTime: 0
  });

  res.json({
    playerId: pid,
    gameId: gid,
    player: players.get(pid),
    game: game
  });
});

app.post('/api/move', (req, res) => {
  const { playerId, x, y, z, vx, vy, vz, angle, pitch } = req.body;
  const player = players.get(playerId);
  
  if (player) {
    player.x = Math.max(-120, Math.min(120, x));
    player.y = Math.max(0, Math.min(50, y));
    player.z = Math.max(-120, Math.min(120, z));
    player.vx = vx;
    player.vy = vy;
    player.vz = vz;
    player.angle = angle;
    player.pitch = pitch;
  }
  res.json({ ok: true });
});

app.post('/api/shoot', (req, res) => {
  const { playerId, dirX, dirY, dirZ } = req.body;
  const player = players.get(playerId);
  const now = Date.now();
  
  if (!player || !player.alive) return res.json({ hit: false, ammo: 0 });
  
  const weapon = WEAPONS[player.weapon];
  if (now - player.lastShot < weapon.fireRate || player.ammo <= 0) {
    return res.json({ hit: false, ammo: player.ammo });
  }

  player.lastShot = now;
  player.ammo--;

  const gamePlayersArray = Array.from(players.values()).filter(p => p.gameId === player.gameId);
  let hitPlayer = null;

  gamePlayersArray.forEach(target => {
    if (target.id !== playerId && target.alive && target.team !== player.team) {
      const dx = target.x - player.x;
      const dy = target.y - player.y;
      const dz = target.z - player.z;
      const dist = Math.hypot(dx, dy, dz);
      
      if (dist < 2) {
        const dot = (dx * dirX + dy * dirY + dz * dirZ) / (dist || 1);
        if (dot > 0.8) {
          const spreadFactor = 1 + (Math.random() - 0.5) * weapon.spread;
          let damage = weapon.damage * spreadFactor;
          damage = Math.max(10, Math.min(damage, weapon.damage * 1.5));
          
          target.health -= damage;
          
          if (target.health <= 0) {
            target.alive = false;
            target.deaths++;
            player.kills++;
            player.money += 300;
          }
          
          hitPlayer = target.id;
        }
      }
    }
  });

  res.json({ hit: !!hitPlayer, ammo: player.ammo, health: player.health });
});

app.post('/api/buy', (req, res) => {
  const { playerId, weapon } = req.body;
  const player = players.get(playerId);
  
  if (player && WEAPONS[weapon]) {
    const price = WEAPONS[weapon].price;
    if (player.money >= price) {
      player.money -= price;
      player.weapon = weapon;
      player.ammo = WEAPONS[weapon].ammo;
    }
  }
  res.json({ 
    money: player?.money || 0, 
    weapon: player?.weapon || 'pistol', 
    ammo: player?.ammo || 0,
    weaponName: WEAPONS[player?.weapon]?.name || 'Glock-18'
  });
});

app.post('/api/plant', (req, res) => {
  const { playerId } = req.body;
  const player = players.get(playerId);
  const game = games.get(player?.gameId);
  
  if (player && player.team === 'A' && player.alive && game && !game.bombPlanted) {
    game.bombPlanted = true;
    game.bombX = player.x;
    game.bombY = player.y;
    game.bombZ = player.z;
    game.bombTimer = 40;
  }
  res.json({ planted: game?.bombPlanted || false });
});

app.post('/api/defuse', (req, res) => {
  const { playerId } = req.body;
  const player = players.get(playerId);
  const game = games.get(player?.gameId);
  
  if (player && player.team === 'B' && player.alive && game && game.bombPlanted) {
    const dist = Math.hypot(player.x - game.bombX, player.z - game.bombZ);
    if (dist < 3) {
      game.bombPlanted = false;
      player.money += 300;
    }
  }
  res.json({ defused: !game?.bombPlanted });
});

app.get('/api/state/:gameId', (req, res) => {
  const game = games.get(req.params.gameId);
  if (!game) return res.status(404).json({ error: 'Game not found' });
  
  const gamePlayers = Array.from(players.values()).filter(p => p.gameId === req.params.gameId);
  
  // Respawn logic
  gamePlayers.forEach(p => {
    if (!p.alive && p.respawnTime === 0) {
      p.respawnTime = Date.now() + 3000;
    }
    
    if (!p.alive && Date.now() > p.respawnTime) {
      const spawn = getPlayerSpawn(p.team, gamePlayers);
      p.x = spawn.x;
      p.y = spawn.y;
      p.z = spawn.z;
      p.health = 100;
      p.alive = true;
      p.respawnTime = 0;
      p.weapon = 'pistol';
      p.ammo = WEAPONS.pistol.ammo;
    }
  });

  // Bomb timer
  if (game.bombPlanted) {
    game.bombTimer--;
    if (game.bombTimer <= 0) {
      game.bombPlanted = false;
      game.teamAScore++;
    }
  }

  const teamAPlayers = gamePlayers.filter(p => p.team === 'A');
  const teamBPlayers = gamePlayers.filter(p => p.team === 'B');
  const teamAAlive = teamAPlayers.filter(p => p.alive).length;
  const teamBAlive = teamBPlayers.filter(p => p.alive).length;

  if (teamAAlive === 0 && !game.bombPlanted) game.teamBScore++;
  if (teamBAlive === 0) game.teamAScore++;

  res.json({
    game,
    players: gamePlayers,
    teamAPlayers,
    teamBPlayers,
    bombPlanted: game.bombPlanted,
    bombPos: { x: game.bombX, y: game.bombY, z: game.bombZ },
    bombTimer: game.bombTimer
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🎮 CS2 Mobile - Port ${PORT}`);
});
