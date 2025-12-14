import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import mineflayer from 'mineflayer';
import OpenAI from 'openai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const users = new Map();
const sessions = new Map();
const invites = new Map();
const bots = new Map();
const tickets = new Map();
const logs = new Map();
const visitors = new Map();
const verificationTokens = new Map();
const resetTokens = new Map();
let visitorCount = 0;
let onlineUsers = 0;
let botsOnline = 0;

function generateId() { return crypto.randomBytes(8).toString('hex'); }
function generateInviteCode() { return 'ZS-' + crypto.randomBytes(4).toString('hex').toUpperCase(); }
function generateVerificationCode() { return Math.floor(100000 + Math.random() * 900000).toString(); }
function hashPassword(password) { return bcrypt.hashSync(password, 10); }
function verifyPassword(password, hash) { return bcrypt.compareSync(password, hash); }
function createLog(action, userId, details) {
  const logId = generateId();
  logs.set(logId, { id: logId, action, userId, details, timestamp: new Date().toISOString() });
}

const ownerUser = {
  id: 'owner_karos',
  username: 'karos',
  email: 'karos@gmail.com',
  password: hashPassword('ruzgar20101903'),
  role: 'owner',
  hwid: null,
  hwidResetCount: 0,
  loaderAccess: true,
  banned: false,
  createdAt: new Date().toISOString(),
  lastLogin: new Date().toISOString(),
  bio: 'ZeySense Hub Founder',
  avatar: null,
  socialLinks: { discord: '', youtube: '', github: '' },
  stats: { loaderOpens: 0, botSessions: 0, usageTime: 0, forumPosts: 0 },
  achievements: ['owner','verified'],
  expiresAt: null
};
users.set(ownerUser.id, ownerUser);

for (let i = 0; i < 5; i++) {
  const code = generateInviteCode();
  invites.set(code, { code, createdBy: 'owner_karos', usedBy: null, createdAt: new Date().toISOString() });
}

function simulateRandomVisitor() {
  const visitorId = 'visitor_' + generateId();
  const names = ['Notch','Herobrine','Steve','Alex','Dream','Technoblade','Tommy','Wilbur','Ph1LzA','Sapnap','George','BadBoyHalo','Skeppy','CaptainSparklez','Stampy'];
  const actions = ['viewed home page','checked bot panel','browsed profiles','viewed rules','checked downloads'];
  const visitor = {
    id: visitorId,
    name: names[Math.floor(Math.random()*names.length)] + Math.floor(Math.random()*1000),
    action: actions[Math.floor(Math.random()*actions.length)],
    timestamp: new Date().toISOString(),
    ip: `${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}`
  };
  visitors.set(visitorId, visitor);
  visitorCount++;
  if(visitors.size > 100) {
    const firstKey = visitors.keys().next().value;
    visitors.delete(firstKey);
  }
  console.log(`🌐 Random visitor: ${visitor.name} - ${visitor.action}`);
  createLog('visitor', null, `${visitor.name} ${visitor.action}`);
}
setInterval(simulateRandomVisitor, 180000);
for(let i=0;i<5;i++) setTimeout(()=>simulateRandomVisitor(), i*10000);

function authMiddleware(req,res,next){
  const sessionId = req.headers['x-session-id'];
  const session = sessions.get(sessionId);
  if(!session) return res.status(401).json({error:'Not authenticated'});
  const user = users.get(session.userId);
  if(!user) return res.status(401).json({error:'User not found'});
  if(user.banned) return res.status(403).json({error:'Account is banned'});
  req.user=user;
  next();
}

app.post('/api/auth/register',(req,res)=>{
  const { email, username, password, inviteCode } = req.body;
  if(!email||!username||!password) return res.status(400).json({error:'All fields required'});
  if(Array.from(users.values()).find(u=>u.email===email)) return res.status(400).json({error:'Email already registered'});
  if(Array.from(users.values()).find(u=>u.username===username)) return res.status(400).json({error:'Username taken'});

  if(inviteCode){
    const invite=invites.get(inviteCode);
    if(!invite) return res.status(400).json({error:'Invalid invite code'});
    if(invite.usedBy) return res.status(400).json({error:'Invite already used'});
    invite.usedBy=username;
  }

  const userId='user_'+generateId();
  const user={
    id:userId, username, email,
    password:hashPassword(password),
    role:'member', hwid:null, hwidResetCount:0,
    loaderAccess:true, banned:false,
    createdAt:new Date().toISOString(),
    lastLogin:new Date().toISOString(),
    bio:'', avatar:null,
    socialLinks:{discord:'',youtube:'',github:''},
    stats:{loaderOpens:0,botSessions:0,usageTime:0,forumPosts:0},
    achievements:['verified'],
    expiresAt:new Date(Date.now()+30*24*60*60*1000).toISOString()
  };
  users.set(userId,user);
  createLog('register',userId,`User ${username} registered`);

  const sessionId=generateId();
  sessions.set(sessionId,{userId,createdAt:new Date().toISOString()});
  onlineUsers++;
  res.json({success:true, sessionId, user:{...user,password:undefined}});
});

app.post('/api/auth/login',(req,res)=>{
  const { email,password } = req.body;
  const user=Array.from(users.values()).find(u=>u.email===email);
  if(!user||!verifyPassword(password,user.password)) return res.status(401).json({error:'Invalid credentials'});
  if(user.banned) return res.status(403).json({error:'Account banned'});
  user.lastLogin=new Date().toISOString();
  const sessionId=generateId();
  sessions.set(sessionId,{userId:user.id,createdAt:new Date().toISOString()});
  onlineUsers++;
  createLog('login',user.id,`User ${user.username} logged in`);
  res.json({success:true, sessionId, user:{...user,password:undefined}});
});

app.get('/api/user/profile', authMiddleware, (req, res) => {
  res.json({ user: { ...req.user, password: undefined } });
});

app.get('/api/stats', (req, res) => {
  res.json({
    totalUsers: users.size,
    onlineUsers,
    botsOnline,
    visitorCount,
    recentVisitors: Array.from(visitors.values()).slice(-10).reverse()
  });
});

async function parseCommandWithAI(message, botName) {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Sen bir Minecraft bot komut ayrıştırıcısısın. Oyuncu mesajlarını analiz et ve hangi eylemi yapacağını belirle.
Mümkün eylemler: mine, gather_wood, build_house, make_portal, go_spawn, follow, stop, put_chest, random_walk, idle
Yanıtını JSON formatında ver: {"action": "eylem_adı", "target": "hedef_varsa", "language": "mesajin_dili"}
Mesaj komut değilse: {"action": "chat", "response": "yanıt", "language": "mesajin_dili"}
Bot adı: ${botName}`
        },
        { role: 'user', content: message }
      ],
      max_tokens: 200
    });
    return JSON.parse(response.choices[0].message.content);
  } catch (e) {
    console.error('AI parse error:', e.message);
    return { action: 'none' };
  }
}

async function generateAIResponse(message, botName, lang = 'tr') {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Sen ${botName} adında bir Minecraft botusun. Karos tarafından yaratıldın. Oyuncularla sohbet et, yardımcı ol.
Dil: ${lang === 'tr' ? 'Türkçe' : 'English'}. Kısa ve samimi yanıtlar ver. Minecraft konularında bilgilisin.`
        },
        { role: 'user', content: message }
      ],
      max_tokens: 150
    });
    return response.choices[0].message.content;
  } catch (e) {
    console.error('AI response error:', e.message);
    return lang === 'tr' ? 'Şu an yanıt veremiyorum.' : "I can't respond right now.";
  }
}

function executeBotAction(mcBot, action, target) {
  if (!mcBot) return;
  
  switch (action) {
    case 'stop':
      mcBot.pathfinder?.stop?.();
      mcBot.clearControlStates();
      mcBot.chat(target?.language === 'tr' ? 'Durdum!' : 'Stopped!');
      break;
      
    case 'random_walk':
      performRandomWalk(mcBot);
      break;
      
    case 'mine':
      mcBot.chat(target?.language === 'tr' ? 'Maden arıyorum...' : 'Looking for ores...');
      performMining(mcBot);
      break;
      
    case 'gather_wood':
      mcBot.chat(target?.language === 'tr' ? 'Odun topluyorum...' : 'Gathering wood...');
      performWoodGathering(mcBot);
      break;
      
    case 'follow':
      if (target?.target) {
        const player = mcBot.players[target.target];
        if (player?.entity) {
          mcBot.chat(target?.language === 'tr' ? `${target.target} takip ediyorum!` : `Following ${target.target}!`);
          performFollow(mcBot, player.entity);
        }
      }
      break;
      
    case 'go_spawn':
      mcBot.chat(target?.language === 'tr' ? "Spawn'a gidiyorum..." : 'Going to spawn...');
      if (mcBot.spawnPoint) {
        moveToPosition(mcBot, mcBot.spawnPoint);
      }
      break;
      
    case 'build_house':
      mcBot.chat(target?.language === 'tr' ? 'Ev yapıyorum...' : 'Building house...');
      performBuildHouse(mcBot, target?.language);
      break;
      
    case 'make_portal':
      mcBot.chat(target?.language === 'tr' ? 'Nether portalı yapıyorum...' : 'Building nether portal...');
      performBuildPortal(mcBot, target?.language);
      break;
      
    case 'put_chest':
      mcBot.chat(target?.language === 'tr' ? 'Eşyaları sandığa koyuyorum...' : 'Putting items in chest...');
      performPutChest(mcBot, target?.language);
      break;
  }
}

function performRandomWalk(mcBot) {
  const randomX = mcBot.entity.position.x + (Math.random() - 0.5) * 10;
  const randomZ = mcBot.entity.position.z + (Math.random() - 0.5) * 10;
  moveToPosition(mcBot, { x: randomX, y: mcBot.entity.position.y, z: randomZ });
}

function moveToPosition(mcBot, pos) {
  const dx = pos.x - mcBot.entity.position.x;
  const dz = pos.z - mcBot.entity.position.z;
  const yaw = Math.atan2(-dx, -dz);
  mcBot.look(yaw, 0);
  mcBot.setControlState('forward', true);
  setTimeout(() => mcBot.setControlState('forward', false), 2000);
}

function performMining(mcBot) {
  const oreBlocks = ['diamond_ore', 'iron_ore', 'coal_ore', 'gold_ore', 'copper_ore', 'emerald_ore', 'lapis_ore', 'redstone_ore'];
  const block = mcBot.findBlock({
    matching: b => oreBlocks.includes(b.name),
    maxDistance: 32
  });
  if (block) {
    mcBot.dig(block).catch(() => {});
  }
}

function performWoodGathering(mcBot) {
  const woodBlocks = ['oak_log', 'birch_log', 'spruce_log', 'jungle_log', 'acacia_log', 'dark_oak_log'];
  const block = mcBot.findBlock({
    matching: b => woodBlocks.includes(b.name),
    maxDistance: 32
  });
  if (block) {
    mcBot.dig(block).catch(() => {});
  }
}

function performFollow(mcBot, entity) {
  const followInterval = setInterval(() => {
    if (!entity || !mcBot.entity) {
      clearInterval(followInterval);
      return;
    }
    const dx = entity.position.x - mcBot.entity.position.x;
    const dz = entity.position.z - mcBot.entity.position.z;
    const distance = Math.sqrt(dx*dx + dz*dz);
    if (distance > 3) {
      const yaw = Math.atan2(-dx, -dz);
      mcBot.look(yaw, 0);
      mcBot.setControlState('forward', true);
    } else {
      mcBot.setControlState('forward', false);
    }
  }, 500);
  
  setTimeout(() => {
    clearInterval(followInterval);
    mcBot.setControlState('forward', false);
  }, 60000);
}

async function performBuildHouse(mcBot, lang) {
  try {
    const dirtBlock = mcBot.registry.blocksByName['dirt'];
    const cobbleBlock = mcBot.registry.blocksByName['cobblestone'];
    const plankBlock = mcBot.registry.blocksByName['oak_planks'];
    
    const buildMaterial = mcBot.inventory.items().find(item => 
      item.name.includes('planks') || item.name.includes('cobblestone') || item.name.includes('dirt')
    );
    
    if (!buildMaterial || buildMaterial.count < 20) {
      mcBot.chat(lang === 'tr' ? 'Yeterli yapı malzemem yok!' : 'Not enough building materials!');
      return;
    }
    
    await mcBot.equip(buildMaterial, 'hand');
    
    const pos = mcBot.entity.position.floored();
    const buildPositions = [
      { x: pos.x + 2, y: pos.y, z: pos.z },
      { x: pos.x + 2, y: pos.y + 1, z: pos.z },
      { x: pos.x + 2, y: pos.y, z: pos.z + 2 },
      { x: pos.x + 2, y: pos.y + 1, z: pos.z + 2 },
      { x: pos.x, y: pos.y, z: pos.z + 2 },
      { x: pos.x, y: pos.y + 1, z: pos.z + 2 },
    ];
    
    for (const buildPos of buildPositions) {
      const refBlock = mcBot.blockAt({ x: buildPos.x, y: buildPos.y - 1, z: buildPos.z });
      if (refBlock && !refBlock.name.includes('air')) {
        await mcBot.placeBlock(refBlock, { x: 0, y: 1, z: 0 }).catch(() => {});
        await new Promise(r => setTimeout(r, 300));
      }
    }
    
    mcBot.chat(lang === 'tr' ? 'Basit yapı oluşturdum!' : 'Built a simple structure!');
  } catch (e) {
    mcBot.chat(lang === 'tr' ? 'Ev yapamadım: ' + e.message : 'Could not build: ' + e.message);
  }
}

async function performBuildPortal(mcBot, lang) {
  try {
    const obsidian = mcBot.inventory.items().find(item => item.name === 'obsidian');
    
    if (!obsidian || obsidian.count < 14) {
      mcBot.chat(lang === 'tr' ? 'Yeterli obsidiyen yok (14 gerekli)!' : 'Not enough obsidian (need 14)!');
      return;
    }
    
    await mcBot.equip(obsidian, 'hand');
    
    const pos = mcBot.entity.position.floored();
    let placed = 0;
    
    const portalFrame = [
      { x: 0, y: 0, z: 2, ref: 'below' },
      { x: 1, y: 0, z: 2, ref: 'below' },
      { x: 2, y: 0, z: 2, ref: 'below' },
      { x: 3, y: 0, z: 2, ref: 'below' },
      { x: 0, y: 1, z: 2, ref: 'side' },
      { x: 0, y: 2, z: 2, ref: 'side' },
      { x: 0, y: 3, z: 2, ref: 'side' },
      { x: 3, y: 1, z: 2, ref: 'side' },
      { x: 3, y: 2, z: 2, ref: 'side' },
      { x: 3, y: 3, z: 2, ref: 'side' },
      { x: 0, y: 4, z: 2, ref: 'top' },
      { x: 1, y: 4, z: 2, ref: 'top' },
      { x: 2, y: 4, z: 2, ref: 'top' },
      { x: 3, y: 4, z: 2, ref: 'top' },
    ];
    
    for (const block of portalFrame) {
      const targetPos = { x: pos.x + block.x, y: pos.y + block.y, z: pos.z + block.z };
      let refBlock = null;
      let face = { x: 0, y: 1, z: 0 };
      
      if (block.ref === 'below') {
        refBlock = mcBot.blockAt({ x: targetPos.x, y: targetPos.y - 1, z: targetPos.z });
        face = { x: 0, y: 1, z: 0 };
      } else if (block.ref === 'side') {
        refBlock = mcBot.blockAt({ x: targetPos.x, y: targetPos.y - 1, z: targetPos.z });
        if (!refBlock || refBlock.name === 'air') {
          refBlock = mcBot.blockAt({ x: targetPos.x - 1, y: targetPos.y, z: targetPos.z });
          face = { x: 1, y: 0, z: 0 };
        }
      } else if (block.ref === 'top') {
        refBlock = mcBot.blockAt({ x: targetPos.x, y: targetPos.y - 1, z: targetPos.z });
        if (refBlock && refBlock.name !== 'air') {
          face = { x: 0, y: 1, z: 0 };
        } else {
          refBlock = mcBot.blockAt({ x: targetPos.x - 1, y: targetPos.y, z: targetPos.z });
          face = { x: 1, y: 0, z: 0 };
        }
      }
      
      if (refBlock && refBlock.name !== 'air') {
        try {
          await mcBot.placeBlock(refBlock, face);
          placed++;
          await new Promise(r => setTimeout(r, 250));
        } catch (e) {}
      }
    }
    
    if (placed === 14) {
      mcBot.chat(lang === 'tr' ? 'Portal çerçevesi tamamlandı! Flint & Steel ile yak.' : 'Portal frame complete! Light with Flint & Steel.');
    } else if (placed > 0) {
      mcBot.chat(lang === 'tr' ? `${placed}/14 blok yerleştirdim, portal tamamlanamadı.` : `Placed ${placed}/14 blocks, portal incomplete.`);
    } else {
      mcBot.chat(lang === 'tr' ? 'Blok yerleştiremedim, alan uygun değil.' : 'Could not place blocks, area not suitable.');
    }
  } catch (e) {
    mcBot.chat(lang === 'tr' ? 'Portal yapamadım: ' + e.message : 'Could not build portal: ' + e.message);
  }
}

async function performPutChest(mcBot, lang) {
  try {
    const chestBlock = mcBot.findBlock({
      matching: b => b.name === 'chest' || b.name === 'trapped_chest',
      maxDistance: 16
    });
    
    if (!chestBlock) {
      mcBot.chat(lang === 'tr' ? 'Yakında sandık bulamadım!' : 'No chest found nearby!');
      return;
    }
    
    const chest = await mcBot.openContainer(chestBlock);
    
    const itemsToDeposit = mcBot.inventory.items().filter(item => 
      !item.name.includes('sword') && !item.name.includes('pickaxe') && 
      !item.name.includes('axe') && !item.name.includes('shovel')
    );
    
    let depositedCount = 0;
    for (const item of itemsToDeposit.slice(0, 10)) {
      try {
        await chest.deposit(item.type, null, item.count);
        depositedCount++;
        await new Promise(r => setTimeout(r, 100));
      } catch (e) {}
    }
    
    chest.close();
    mcBot.chat(lang === 'tr' ? `${depositedCount} eşya sandığa konuldu!` : `Deposited ${depositedCount} items!`);
  } catch (e) {
    mcBot.chat(lang === 'tr' ? 'Sandığa koyamadım: ' + e.message : 'Could not deposit: ' + e.message);
  }
}

function startMinecraftBot(bot) {
  if (bot.mcBot) return;
  
  const mcBot = mineflayer.createBot({
    host: bot.server,
    port: bot.port || 25565,
    username: bot.name,
    version: bot.version,
    auth: bot.authMode === 'premium' ? 'microsoft' : 'offline'
  });
  
  bot.mcBot = mcBot;
  bot.logs = bot.logs || [];
  
  mcBot.on('spawn', () => {
    console.log(`✅ Bot ${bot.name} connected to ${bot.server}:${bot.port}`);
    bot.status = 'online';
    bot.lastActive = new Date().toISOString();
    botsOnline++;
    bot.logs.push({ time: new Date().toISOString(), message: `Connected to ${bot.server}` });
    createLog('bot_start', bot.ownerId, `Started bot ${bot.name}`);
    
    if (bot.aiEnabled) {
      startAutoAnnouncement(bot);
    }
    
    if (bot.behavior === 'random_walk') {
      startAntiAFK(bot);
    }
  });
  
  mcBot.on('chat', async (username, message) => {
    if (username === mcBot.username) return;
    
    bot.logs.push({ time: new Date().toISOString(), message: `[CHAT] ${username}: ${message}` });
    
    if (!bot.aiEnabled) return;
    
    const mentionsBot = message.toLowerCase().includes(bot.name.toLowerCase());
    
    if (mentionsBot && bot.commandsEnabled) {
      const parsed = await parseCommandWithAI(message, bot.name);
      
      if (parsed.action && parsed.action !== 'chat' && parsed.action !== 'none') {
        executeBotAction(mcBot, parsed.action, { target: username, language: parsed.language });
        bot.logs.push({ time: new Date().toISOString(), message: `[AI] Executing: ${parsed.action}` });
      } else if (parsed.action === 'chat' || mentionsBot) {
        const response = await generateAIResponse(message, bot.name, parsed.language || 'tr');
        mcBot.chat(response);
        bot.logs.push({ time: new Date().toISOString(), message: `[AI] Response: ${response}` });
      }
    } else if (mentionsBot) {
      const lang = /[a-zA-Z]/.test(message) ? 'en' : 'tr';
      const response = await generateAIResponse(message, bot.name, lang);
      mcBot.chat(response);
      bot.logs.push({ time: new Date().toISOString(), message: `[AI] Response: ${response}` });
    }
  });
  
  mcBot.on('kicked', (reason) => {
    console.log(`⚠️ Bot ${bot.name} kicked:`, reason);
    if (bot.status === 'online') botsOnline = Math.max(0, botsOnline - 1);
    bot.status = 'kicked';
    if (bot.announcementInterval) { clearInterval(bot.announcementInterval); bot.announcementInterval = null; }
    if (bot.antiAFKInterval) { clearInterval(bot.antiAFKInterval); bot.antiAFKInterval = null; }
    bot.logs.push({ time: new Date().toISOString(), message: `Kicked: ${reason}` });
    
    if (bot.autoReconnect) {
      setTimeout(() => {
        console.log(`🔄 Auto-reconnecting bot ${bot.name}...`);
        bot.mcBot = null;
        startMinecraftBot(bot);
      }, 5000);
    }
  });
  
  mcBot.on('end', () => {
    if (bot.status === 'stopped' || bot.status === 'kicked') return;
    console.log(`❌ Bot ${bot.name} disconnected`);
    if (bot.status === 'online') botsOnline = Math.max(0, botsOnline - 1);
    bot.status = 'offline';
    if (bot.announcementInterval) { clearInterval(bot.announcementInterval); bot.announcementInterval = null; }
    if (bot.antiAFKInterval) { clearInterval(bot.antiAFKInterval); bot.antiAFKInterval = null; }
    bot.logs.push({ time: new Date().toISOString(), message: 'Disconnected' });
    
    if (bot.autoReconnect) {
      setTimeout(() => {
        console.log(`🔄 Auto-reconnecting bot ${bot.name}...`);
        bot.mcBot = null;
        startMinecraftBot(bot);
      }, 5000);
    }
  });
  
  mcBot.on('error', (err) => {
    console.log(`⚠️ Bot ${bot.name} error:`, err.message);
    if (bot.status === 'online') botsOnline = Math.max(0, botsOnline - 1);
    bot.status = 'error';
    bot.logs.push({ time: new Date().toISOString(), message: `Error: ${err.message}` });
  });
  
  mcBot.on('health', () => {
    bot.health = mcBot.health;
    bot.food = mcBot.food;
  });
}

function startAutoAnnouncement(bot) {
  if (bot.announcementInterval) clearInterval(bot.announcementInterval);
  
  bot.announcementInterval = setInterval(() => {
    if (bot.mcBot && bot.status === 'online') {
      bot.mcBot.chat("Ben Karos tarafından yazılan bir yapay zekâyım.");
      bot.logs.push({ time: new Date().toISOString(), message: '[AUTO] Sent announcement' });
    }
  }, 30 * 60 * 1000);
}

function startAntiAFK(bot) {
  if (bot.antiAFKInterval) clearInterval(bot.antiAFKInterval);
  
  bot.antiAFKInterval = setInterval(() => {
    if (bot.mcBot && bot.status === 'online') {
      performRandomWalk(bot.mcBot);
    }
  }, 30000);
}

app.get('/api/bots', authMiddleware, (req, res) => {
  const userBots = Array.from(bots.values())
    .filter(b => b.ownerId === req.user.id)
    .map(b => ({
      ...b,
      mcBot: undefined,
      announcementInterval: undefined,
      antiAFKInterval: undefined
    }));
  res.json({ bots: userBots });
});

app.post('/api/bots', authMiddleware, (req, res) => {
  const { name, server, port, version, behavior, authMode, aiEnabled, commandsEnabled, autoReconnect } = req.body;
  
  if (!server) return res.status(400).json({ error: 'Server address required' });
  
  const botId = 'bot_' + generateId();
  const bot = {
    id: botId,
    name: name || `Bot_${Math.floor(Math.random() * 1000)}`,
    server,
    port: parseInt(port) || 25565,
    version: version || '1.20.4',
    behavior: behavior || 'idle',
    authMode: authMode || 'cracked',
    aiEnabled: aiEnabled !== false,
    commandsEnabled: commandsEnabled !== false,
    autoReconnect: autoReconnect !== false,
    ownerId: req.user.id,
    status: 'offline',
    createdAt: new Date().toISOString(),
    lastActive: null,
    ping: 0,
    health: 20,
    food: 20,
    logs: []
  };
  
  bots.set(botId, bot);
  createLog('bot_create', req.user.id, `Created bot ${bot.name}`);
  res.json({ success: true, bot: { ...bot, mcBot: undefined } });
});

app.post('/api/bots/:botId/start', authMiddleware, (req, res) => {
  const bot = bots.get(req.params.botId);
  if (!bot) return res.status(404).json({ error: 'Bot not found' });
  if (bot.ownerId !== req.user.id) return res.status(403).json({ error: 'Not your bot' });
  
  bot.status = 'connecting';
  startMinecraftBot(bot);
  res.json({ success: true, bot: { ...bot, mcBot: undefined, announcementInterval: undefined, antiAFKInterval: undefined } });
});

app.post('/api/bots/:botId/stop', authMiddleware, (req, res) => {
  const bot = bots.get(req.params.botId);
  if (!bot) return res.status(404).json({ error: 'Bot not found' });
  if (bot.ownerId !== req.user.id) return res.status(403).json({ error: 'Not your bot' });
  
  const wasOnline = bot.status === 'online';
  bot.status = 'stopped';
  if (bot.announcementInterval) { clearInterval(bot.announcementInterval); bot.announcementInterval = null; }
  if (bot.antiAFKInterval) { clearInterval(bot.antiAFKInterval); bot.antiAFKInterval = null; }
  if (bot.mcBot) {
    bot.mcBot.quit();
    bot.mcBot = null;
  }
  
  if (wasOnline) botsOnline = Math.max(0, botsOnline - 1);
  createLog('bot_stop', bot.ownerId, `Stopped bot ${bot.name}`);
  res.json({ success: true, bot: { ...bot, mcBot: undefined, announcementInterval: undefined, antiAFKInterval: undefined } });
});

app.delete('/api/bots/:botId', authMiddleware, (req, res) => {
  const bot = bots.get(req.params.botId);
  if (!bot) return res.status(404).json({ error: 'Bot not found' });
  if (bot.ownerId !== req.user.id) return res.status(403).json({ error: 'Not your bot' });
  
  if (bot.mcBot) {
    bot.mcBot.quit();
  }
  if (bot.announcementInterval) clearInterval(bot.announcementInterval);
  if (bot.antiAFKInterval) clearInterval(bot.antiAFKInterval);
  
  bots.delete(req.params.botId);
  createLog('bot_delete', req.user.id, `Deleted bot ${bot.name}`);
  res.json({ success: true });
});

app.post('/api/bots/:botId/command', authMiddleware, async (req, res) => {
  const bot = bots.get(req.params.botId);
  if (!bot) return res.status(404).json({ error: 'Bot not found' });
  if (bot.ownerId !== req.user.id) return res.status(403).json({ error: 'Not your bot' });
  if (!bot.mcBot) return res.status(400).json({ error: 'Bot not online' });
  
  const { command } = req.body;
  if (!command) return res.status(400).json({ error: 'Command required' });
  
  if (command.startsWith('/')) {
    bot.mcBot.chat(command);
  } else {
    const parsed = await parseCommandWithAI(command, bot.name);
    if (parsed.action && parsed.action !== 'none') {
      executeBotAction(bot.mcBot, parsed.action, parsed);
    }
  }
  
  bot.logs.push({ time: new Date().toISOString(), message: `[CMD] ${command}` });
  res.json({ success: true });
});

app.post('/api/bots/:botId/chat', authMiddleware, (req, res) => {
  const bot = bots.get(req.params.botId);
  if (!bot) return res.status(404).json({ error: 'Bot not found' });
  if (bot.ownerId !== req.user.id) return res.status(403).json({ error: 'Not your bot' });
  if (!bot.mcBot) return res.status(400).json({ error: 'Bot not online' });
  
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'Message required' });
  
  bot.mcBot.chat(message);
  bot.logs.push({ time: new Date().toISOString(), message: `[SENT] ${message}` });
  res.json({ success: true });
});

app.patch('/api/bots/:botId/settings', authMiddleware, (req, res) => {
  const bot = bots.get(req.params.botId);
  if (!bot) return res.status(404).json({ error: 'Bot not found' });
  if (bot.ownerId !== req.user.id) return res.status(403).json({ error: 'Not your bot' });
  
  const { aiEnabled, commandsEnabled, autoReconnect, behavior, name } = req.body;
  
  if (typeof aiEnabled === 'boolean') bot.aiEnabled = aiEnabled;
  if (typeof commandsEnabled === 'boolean') bot.commandsEnabled = commandsEnabled;
  if (typeof autoReconnect === 'boolean') bot.autoReconnect = autoReconnect;
  if (behavior) bot.behavior = behavior;
  if (name) bot.name = name;
  
  res.json({ success: true, bot: { ...bot, mcBot: undefined, announcementInterval: undefined, antiAFKInterval: undefined } });
});

app.get('/api/tickets', authMiddleware, (req, res) => {
  const userTickets = Array.from(tickets.values()).filter(t => t.userId === req.user.id);
  res.json({ tickets: userTickets });
});

app.post('/api/tickets', authMiddleware, (req, res) => {
  const { subject, message } = req.body;
  if (!subject || !message) return res.status(400).json({ error: 'Subject and message required' });
  
  const ticketId = 'ticket_' + generateId();
  const ticket = {
    id: ticketId,
    userId: req.user.id,
    username: req.user.username,
    subject,
    status: 'open',
    createdAt: new Date().toISOString(),
    messages: [{ from: req.user.username, message, time: new Date().toISOString() }]
  };
  
  tickets.set(ticketId, ticket);
  createLog('ticket_create', req.user.id, `Created ticket: ${subject}`);
  res.json({ success: true, ticket });
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.use((req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🎮 ZeySense Hub - Port ${PORT}`);
  console.log(`👑 Owner: karos`);
  console.log(`🤖 AI-Powered Bot System Active`);
  console.log(`🔐 Invite codes: ${Array.from(invites.keys()).join(',')}`);
});
