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

const players = new Map();
const bullets = [];
const enemies = [];

let tick = 0;

// Initialize enemies
for (let i = 0; i < 15; i++) {
  enemies.push({
    id: `enemy_${i}`,
    x: Math.random() * 100 - 50,
    y: 2,
    z: Math.random() * 100 - 50,
    health: 100,
    vx: (Math.random() - 0.5) * 0.2,
    vz: (Math.random() - 0.5) * 0.2,
    angle: Math.random() * Math.PI * 2
  });
}

app.post('/api/join', (req, res) => {
  const { nickname } = req.body;
  const playerId = Math.random().toString(36).substr(2, 9);
  
  players.set(playerId, {
    id: playerId,
    nickname,
    x: 0,
    y: 1.6,
    z: 0,
    angle: 0,
    pitch: 0,
    health: 100,
    ammo: 300,
    kills: 0,
    score: 0
  });

  res.json({ playerId, player: players.get(playerId) });
});

app.post('/api/move', (req, res) => {
  const { playerId, x, y, z, angle, pitch } = req.body;
  if (players.has(playerId)) {
    const p = players.get(playerId);
    p.x = x;
    p.y = y;
    p.z = z;
    p.angle = angle;
    p.pitch = pitch;
  }
  res.json({ ok: true });
});

app.post('/api/shoot', (req, res) => {
  const { playerId, startX, startY, startZ, dirX, dirY, dirZ } = req.body;
  const player = players.get(playerId);
  
  if (player && player.ammo > 0 && player.health > 0) {
    player.ammo--;
    bullets.push({
      playerId,
      x: startX,
      y: startY,
      z: startZ,
      dx: dirX,
      dy: dirY,
      dz: dirZ,
      life: 150,
      speed: 1.5
    });
  }
  res.json({ ammo: player?.ammo || 0 });
});

app.get('/api/state', (req, res) => {
  // Update bullets
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.dx * b.speed;
    b.y += b.dy * b.speed;
    b.z += b.dz * b.speed;
    b.life--;

    // Check collision with enemies
    for (let j = enemies.length - 1; j >= 0; j--) {
      const e = enemies[j];
      const dist = Math.hypot(b.x - e.x, b.y - e.y, b.z - e.z);
      
      if (dist < 1) {
        e.health -= 25;
        const shooter = players.get(b.playerId);
        if (e.health <= 0) {
          enemies.splice(j, 1);
          if (shooter) {
            shooter.kills++;
            shooter.score += 100;
          }
          bullets.splice(i, 1);
          break;
        } else {
          bullets.splice(i, 1);
          break;
        }
      }
    }

    if (b.life <= 0) bullets.splice(i, 1);
  }

  // Update enemies
  enemies.forEach(e => {
    e.x += e.vx;
    e.z += e.vz;
    e.angle += 0.02;

    // Boundary
    if (e.x > 60 || e.x < -60) e.vx *= -1;
    if (e.z > 60 || e.z < -60) e.vz *= -1;
  });

  res.json({
    players: Array.from(players.values()),
    enemies,
    bullets: bullets.slice(0, 100),
    tick: tick++
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🎮 FPS Arena - Port ${PORT}`);
});
