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

const games = new Map();
const players = new Map();

const WEAPON_PRICES = {
  pistol: { damage: 35, price: 500, ammo: 20 },
  rifle: { damage: 75, price: 2900, ammo: 30 },
  shotgun: { damage: 120, price: 1200, ammo: 8 },
  sniper: { damage: 150, price: 4750, ammo: 10 }
};

app.post('/api/join', (req, res) => {
  const { nickname, gameId } = req.body;
  const gid = gameId || 'default';
  const pid = Math.random().toString(36).substr(2, 9);

  if (!games.has(gid)) {
    games.set(gid, {
      id: gid,
      round: 1,
      teamA: [],
      teamB: [],
      bombPlanted: false,
      bombX: 0,
      bombY: 0,
      bombZ: 0,
      teamAMoney: 2400,
      teamBMoney: 2400,
      teamAScore: 0,
      teamBScore: 0
    });
  }

  const game = games.get(gid);
  const team = game.teamA.length <= game.teamB.length ? 'A' : 'B';
  if (team === 'A') game.teamA.push(pid);
  else game.teamB.push(pid);

  const spawnPos = team === 'A' 
    ? { x: -20, y: 2, z: -50 }
    : { x: 20, y: 2, z: 50 };

  players.set(pid, {
    id: pid,
    nickname,
    gameId: gid,
    team,
    x: spawnPos.x + (Math.random() - 0.5) * 10,
    y: spawnPos.y,
    z: spawnPos.z + (Math.random() - 0.5) * 10,
    angle: team === 'A' ? 0 : Math.PI,
    pitch: 0,
    health: 100,
    armor: 0,
    money: 2400,
    weapon: 'pistol',
    ammo: 20,
    kills: 0,
    deaths: 0,
    alive: true,
    planting: false,
    defusing: false
  });

  res.json({
    playerId: pid,
    gameId: gid,
    player: players.get(pid),
    game: game
  });
});

app.post('/api/buy', (req, res) => {
  const { playerId, weapon } = req.body;
  const player = players.get(playerId);
  
  if (player && WEAPON_PRICES[weapon]) {
    const price = WEAPON_PRICES[weapon].price;
    if (player.money >= price) {
      player.money -= price;
      player.weapon = weapon;
      player.ammo = WEAPON_PRICES[weapon].ammo;
    }
  }
  res.json({ money: player?.money || 0, weapon: player?.weapon || 'pistol', ammo: player?.ammo || 0 });
});

app.post('/api/move', (req, res) => {
  const { playerId, x, y, z, angle, pitch } = req.body;
  const player = players.get(playerId);
  
  if (player && player.alive) {
    player.x = Math.max(-100, Math.min(100, x));
    player.y = Math.max(0, Math.min(50, y));
    player.z = Math.max(-100, Math.min(100, z));
    player.angle = angle;
    player.pitch = pitch;
  }
  res.json({ ok: true });
});

app.post('/api/shoot', (req, res) => {
  const { playerId, dirX, dirY, dirZ } = req.body;
  const player = players.get(playerId);
  const game = games.get(player?.gameId);
  
  if (player && player.alive && player.ammo > 0) {
    player.ammo--;
    
    // Hit detection
    const players_in_game = Array.from(players.values()).filter(p => p.gameId === player.gameId);
    players_in_game.forEach(target => {
      if (target.id !== playerId && target.alive && target.team !== player.team) {
        const dx = target.x - player.x;
        const dy = target.y - player.y;
        const dz = target.z - player.z;
        const dist = Math.hypot(dx, dy, dz);
        
        const dot = (dx * dirX + dy * dirY + dz * dirZ) / (dist || 1);
        if (dist < 3 && dot > 0.8) {
          const damage = WEAPON_PRICES[player.weapon].damage;
          target.health -= damage;
          
          if (target.health <= 0) {
            target.alive = false;
            target.deaths++;
            player.kills++;
            player.money += 300;
          }
        }
      }
    });
  }
  res.json({ ammo: player?.ammo || 0 });
});

app.post('/api/plant', (req, res) => {
  const { playerId } = req.body;
  const player = players.get(playerId);
  const game = games.get(player?.gameId);
  
  if (player && player.team === 'A' && player.alive && game) {
    game.bombPlanted = true;
    game.bombX = player.x;
    game.bombY = player.y;
    game.bombZ = player.z;
    player.planting = false;
  }
  res.json({ planted: game?.bombPlanted || false });
});

app.post('/api/defuse', (req, res) => {
  const { playerId } = req.body;
  const player = players.get(playerId);
  const game = games.get(player?.gameId);
  
  if (player && player.team === 'B' && player.alive && game && game.bombPlanted) {
    game.bombPlanted = false;
    player.money += 300;
  }
  res.json({ defused: !game?.bombPlanted });
});

app.get('/api/state/:gameId', (req, res) => {
  const game = games.get(req.params.gameId);
  if (!game) return res.status(404).json({ error: 'Game not found' });
  
  const gamePlayers = Array.from(players.values()).filter(p => p.gameId === req.params.gameId);
  
  // Check win conditions
  const teamAAlive = gamePlayers.filter(p => p.team === 'A' && p.alive).length;
  const teamBAlive = gamePlayers.filter(p => p.team === 'B' && p.alive).length;
  
  if (teamAAlive === 0) game.teamBScore++;
  if (teamBAlive === 0 || (game.bombPlanted && Date.now() % 1000 > 500)) game.teamAScore++;

  res.json({
    game,
    players: gamePlayers,
    round: game.round,
    bombPlanted: game.bombPlanted,
    bombPos: { x: game.bombX, y: game.bombY, z: game.bombZ }
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🎮 CS-Style Mobile FPS - Port ${PORT}`);
});
