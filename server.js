import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import mc from 'minecraft-protocol';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// --- VERİ DEPOLAR ---
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

// --- YARDIMCI FONKSİYONLAR ---
function generateId() { return crypto.randomBytes(8).toString('hex'); }
function generateInviteCode() { return 'ZS-' + crypto.randomBytes(4).toString('hex').toUpperCase(); }
function generateVerificationCode() { return Math.floor(100000 + Math.random() * 900000).toString(); }
function hashPassword(password) { return bcrypt.hashSync(password, 10); }
function verifyPassword(password, hash) { return bcrypt.compareSync(password, hash); }
function createLog(action, userId, details) {
  const logId = generateId();
  logs.set(logId, { id: logId, action, userId, details, timestamp: new Date().toISOString() });
}

// --- OWNER ---
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

// --- DAVET KODLARI ---
for (let i = 0; i < 5; i++) {
  const code = generateInviteCode();
  invites.set(code, { code, createdBy: 'owner_karos', usedBy: null, createdAt: new Date().toISOString() });
}

// --- ZİYARETÇİ SİMÜLASYONU ---
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

// --- AUTH MIDDLEWARE ---
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

// --- AUTH ENDPOINTLERİ ---
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

// --- BOTS ---
function startMinecraftBot(bot){
  if(bot.mcClient) return;
  const client=mc.createClient({
    host:bot.server,
    port:25565,
    username:bot.name,
    version:bot.version
  });
  bot.mcClient=client;

  client.on('login',()=>{
    console.log(`✅ Bot ${bot.name} connected`);
    bot.status='online';
    bot.lastActive=new Date().toISOString();
    botsOnline++;
    createLog('bot_start',bot.ownerId,`Started bot ${bot.name}`);
  });
  client.on('end',()=>{
    console.log(`❌ Bot ${bot.name} disconnected`);
    bot.status='offline';
    botsOnline=Math.max(0,botsOnline-1);
  });
  client.on('error',(err)=>{
    console.log(`⚠️ Bot ${bot.name} error:`,err.message);
    bot.status='offline';
    botsOnline=Math.max(0,botsOnline-1);
  });
}

// --- BOT ENDPOINTLERİ ---
app.post('/api/bots/:botId/start',authMiddleware,(req,res)=>{
  const bot=bots.get(req.params.botId);
  if(!bot) return res.status(404).json({error:'Bot not found'});
  startMinecraftBot(bot);
  res.json({success:true, bot});
});

app.post('/api/bots/:botId/stop',authMiddleware,(req,res)=>{
  const bot=bots.get(req.params.botId);
  if(!bot) return res.status(404).json({error:'Bot not found'});
  if(bot.mcClient){ bot.mcClient.end(); bot.mcClient=null; }
  bot.status='offline';
  botsOnline=Math.max(0,botsOnline-1);
  createLog('bot_stop',bot.ownerId,`Stopped bot ${bot.name}`);
  res.json({success:true, bot});
});

// --- SUNUCU ---
app.get('/',(req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));
app.use((req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));

app.listen(PORT,'0.0.0.0',()=>{
  console.log(`🎮 ZeySense Hub - Port ${PORT}`);
  console.log(`👑 Owner: karos`);
  console.log(`🔐 Invite codes: ${Array.from(invites.keys()).join(',')}`);
});
