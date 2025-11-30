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

let gameState = {
  players: {},
  bullets: [],
  tick: 0,
  teams: { red: [], blue: [] }
};

const playerData = new Map();

app.post('/api/join', (req, res) => {
  const { nickname, team } = req.body;
  const playerId = Math.random().toString(36).substr(2, 9);
  
  playerData.set(playerId, {
    id: playerId,
    nickname,
    team: team || (Math.random() > 0.5 ? 'red' : 'blue'),
    x: team === 'red' ? 100 : 900,
    y: 300,
    health: 100,
    alive: true,
    kills: 0,
    deaths: 0,
    ammo: 120
  });

  res.json({ playerId, player: playerData.get(playerId) });
});

app.post('/api/move', (req, res) => {
  const { playerId, x, y, angle } = req.body;
  if (playerData.has(playerId)) {
    const p = playerData.get(playerId);
    p.x = Math.max(0, Math.min(1000, x));
    p.y = Math.max(0, Math.min(600, y));
    p.angle = angle;
  }
  res.json({ ok: true });
});

app.post('/api/shoot', (req, res) => {
  const { playerId, angle } = req.body;
  const player = playerData.get(playerId);
  
  if (player && player.ammo > 0 && player.alive) {
    player.ammo--;
    gameState.bullets.push({
      x: player.x,
      y: player.y,
      angle,
      playerId,
      speed: 8,
      life: 100
    });
  }
  res.json({ ammo: player?.ammo || 0 });
});

app.get('/api/state', (req, res) => {
  const players = Array.from(playerData.values());
  gameState.bullets = gameState.bullets.filter(b => b.life > 0);
  
  gameState.bullets.forEach(b => {
    b.x += Math.cos(b.angle) * b.speed;
    b.y += Math.sin(b.angle) * b.speed;
    b.life--;

    players.forEach(p => {
      if (p.id !== b.playerId && p.alive) {
        const dist = Math.hypot(p.x - b.x, p.y - b.y);
        if (dist < 20) {
          p.health -= 25;
          if (p.health <= 0) {
            p.alive = false;
            p.deaths++;
            const shooter = playerData.get(b.playerId);
            if (shooter) shooter.kills++;
          }
          b.life = 0;
        }
      }
    });
  });

  res.json({ players, bullets: gameState.bullets.slice(0, 50), tick: gameState.tick++ });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🎮 Tactical Arena - Port ${PORT}`);
});
