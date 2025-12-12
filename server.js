import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

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

function generateId() {
  return crypto.randomBytes(8).toString('hex');
}

function generateInviteCode() {
  return 'ZS-' + crypto.randomBytes(4).toString('hex').toUpperCase();
}

function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

function verifyPassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

function createLog(action, userId, details) {
  const logId = generateId();
  logs.set(logId, {
    id: logId,
    action,
    userId,
    details,
    timestamp: new Date().toISOString()
  });
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
  achievements: ['owner', 'verified'],
  expiresAt: null
};
users.set(ownerUser.id, ownerUser);

for (let i = 0; i < 5; i++) {
  const code = generateInviteCode();
  invites.set(code, { code, createdBy: 'owner_karos', usedBy: null, createdAt: new Date().toISOString() });
}

function simulateRandomVisitor() {
  const visitorId = 'visitor_' + generateId();
  const names = ['Notch', 'Herobrine', 'Steve', 'Alex', 'Dream', 'Technoblade', 'Tommy', 'Wilbur', 'Ph1LzA', 'Sapnap', 'George', 'BadBoyHalo', 'Skeppy', 'CaptainSparklez', 'Stampy'];
  const actions = ['viewed home page', 'checked bot panel', 'browsed profiles', 'viewed rules', 'checked downloads'];
  
  const visitor = {
    id: visitorId,
    name: names[Math.floor(Math.random() * names.length)] + Math.floor(Math.random() * 1000),
    action: actions[Math.floor(Math.random() * actions.length)],
    timestamp: new Date().toISOString(),
    ip: `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`
  };
  
  visitors.set(visitorId, visitor);
  visitorCount++;
  
  if (visitors.size > 100) {
    const firstKey = visitors.keys().next().value;
    visitors.delete(firstKey);
  }
  
  console.log(`🌐 Random visitor: ${visitor.name} - ${visitor.action}`);
  createLog('visitor', null, `${visitor.name} ${visitor.action}`);
}

setInterval(simulateRandomVisitor, 180000);

for (let i = 0; i < 5; i++) {
  setTimeout(() => simulateRandomVisitor(), i * 10000);
}

app.post('/api/auth/register', (req, res) => {
  const { email, username, password, inviteCode } = req.body;
  
  if (!email || !username || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  
  const existingUser = Array.from(users.values()).find(u => u.email === email);
  if (existingUser) {
    return res.status(400).json({ error: 'Email already registered' });
  }
  
  const existingUsername = Array.from(users.values()).find(u => u.username === username);
  if (existingUsername) {
    return res.status(400).json({ error: 'Username already taken' });
  }
  
  if (inviteCode) {
    const invite = invites.get(inviteCode);
    if (!invite) {
      return res.status(400).json({ error: 'Invalid invite code' });
    }
    if (invite.usedBy) {
      return res.status(400).json({ error: 'Invite code already used' });
    }
    invite.usedBy = username;
  }
  
  const userId = 'user_' + generateId();
  const user = {
    id: userId,
    username,
    email,
    password: hashPassword(password),
    role: 'member',
    hwid: null,
    hwidResetCount: 0,
    loaderAccess: true,
    banned: false,
    createdAt: new Date().toISOString(),
    lastLogin: new Date().toISOString(),
    bio: '',
    avatar: null,
    socialLinks: { discord: '', youtube: '', github: '' },
    stats: { loaderOpens: 0, botSessions: 0, usageTime: 0, forumPosts: 0 },
    achievements: ['verified'],
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  };
  
  users.set(userId, user);
  createLog('register', userId, `User ${username} registered`);
  
  const sessionId = generateId();
  sessions.set(sessionId, { userId, createdAt: new Date().toISOString() });
  onlineUsers++;
  
  res.json({ 
    success: true, 
    sessionId, 
    user: { ...user, password: undefined }
  });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  const user = Array.from(users.values()).find(u => u.email === email);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  if (!verifyPassword(password, user.password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  if (user.banned) {
    return res.status(403).json({ error: 'Account is banned' });
  }
  
  user.lastLogin = new Date().toISOString();
  
  const sessionId = generateId();
  sessions.set(sessionId, { userId: user.id, createdAt: new Date().toISOString() });
  onlineUsers++;
  
  createLog('login', user.id, `User ${user.username} logged in`);
  
  res.json({ 
    success: true, 
    sessionId, 
    user: { ...user, password: undefined }
  });
});

app.post('/api/auth/logout', (req, res) => {
  const { sessionId } = req.body;
  if (sessions.has(sessionId)) {
    sessions.delete(sessionId);
    onlineUsers = Math.max(0, onlineUsers - 1);
  }
  res.json({ success: true });
});

app.post('/api/auth/request-verification', (req, res) => {
  const { email } = req.body;
  
  const user = Array.from(users.values()).find(u => u.email === email);
  if (!user) {
    return res.status(404).json({ error: 'Email not found' });
  }
  
  const code = generateVerificationCode();
  verificationTokens.set(email, {
    code,
    userId: user.id,
    createdAt: Date.now(),
    expiresAt: Date.now() + 10 * 60 * 1000
  });
  
  console.log(`📧 Verification code for ${email}: ${code}`);
  createLog('verification_request', user.id, `Verification code sent to ${email}`);
  
  res.json({ 
    success: true, 
    message: 'Verification code sent',
    code: code
  });
});

app.post('/api/auth/verify-email', (req, res) => {
  const { email, code } = req.body;
  
  const token = verificationTokens.get(email);
  if (!token) {
    return res.status(400).json({ error: 'No verification pending for this email' });
  }
  
  if (Date.now() > token.expiresAt) {
    verificationTokens.delete(email);
    return res.status(400).json({ error: 'Verification code expired' });
  }
  
  if (token.code !== code) {
    return res.status(400).json({ error: 'Invalid verification code' });
  }
  
  const user = users.get(token.userId);
  if (user && !user.achievements.includes('verified')) {
    user.achievements.push('verified');
  }
  
  verificationTokens.delete(email);
  createLog('email_verified', token.userId, `Email ${email} verified`);
  
  res.json({ success: true, message: 'Email verified successfully' });
});

app.post('/api/auth/request-reset', (req, res) => {
  const { email } = req.body;
  
  const user = Array.from(users.values()).find(u => u.email === email);
  if (!user) {
    return res.json({ success: true, message: 'If email exists, reset code sent' });
  }
  
  const code = generateVerificationCode();
  resetTokens.set(email, {
    code,
    userId: user.id,
    createdAt: Date.now(),
    expiresAt: Date.now() + 15 * 60 * 1000
  });
  
  console.log(`🔑 Password reset code for ${email}: ${code}`);
  createLog('reset_request', user.id, `Password reset requested for ${email}`);
  
  res.json({ 
    success: true, 
    message: 'If email exists, reset code sent',
    code: code
  });
});

app.post('/api/auth/reset-password', (req, res) => {
  const { email, code, newPassword } = req.body;
  
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  
  const token = resetTokens.get(email);
  if (!token) {
    return res.status(400).json({ error: 'No reset pending for this email' });
  }
  
  if (Date.now() > token.expiresAt) {
    resetTokens.delete(email);
    return res.status(400).json({ error: 'Reset code expired' });
  }
  
  if (token.code !== code) {
    return res.status(400).json({ error: 'Invalid reset code' });
  }
  
  const user = users.get(token.userId);
  if (user) {
    user.password = hashPassword(newPassword);
  }
  
  resetTokens.delete(email);
  createLog('password_reset', token.userId, `Password reset for ${email}`);
  
  res.json({ success: true, message: 'Password reset successfully' });
});

app.post('/api/auth/login-with-code', (req, res) => {
  const { email, code } = req.body;
  
  const token = verificationTokens.get(email);
  if (!token || token.code !== code || Date.now() > token.expiresAt) {
    return res.status(401).json({ error: 'Invalid or expired code' });
  }
  
  const user = users.get(token.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  if (user.banned) {
    return res.status(403).json({ error: 'Account is banned' });
  }
  
  user.lastLogin = new Date().toISOString();
  
  const sessionId = generateId();
  sessions.set(sessionId, { userId: user.id, createdAt: new Date().toISOString() });
  onlineUsers++;
  
  verificationTokens.delete(email);
  createLog('login_with_code', user.id, `User ${user.username} logged in with code`);
  
  res.json({ 
    success: true, 
    sessionId, 
    user: { ...user, password: undefined }
  });
});

function authMiddleware(req, res, next) {
  const sessionId = req.headers['x-session-id'];
  const session = sessions.get(sessionId);
  
  if (!session) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  const user = users.get(session.userId);
  if (!user) {
    return res.status(401).json({ error: 'User not found' });
  }
  
  if (user.banned) {
    return res.status(403).json({ error: 'Account is banned' });
  }
  
  req.user = user;
  next();
}

app.get('/api/user/profile', authMiddleware, (req, res) => {
  res.json({ user: { ...req.user, password: undefined } });
});

app.put('/api/user/profile', authMiddleware, (req, res) => {
  const { bio, socialLinks, avatar } = req.body;
  const user = req.user;
  
  if (bio !== undefined) user.bio = bio;
  if (socialLinks) user.socialLinks = { ...user.socialLinks, ...socialLinks };
  if (avatar !== undefined) user.avatar = avatar;
  
  res.json({ success: true, user: { ...user, password: undefined } });
});

app.get('/api/stats', (req, res) => {
  res.json({
    totalUsers: users.size,
    onlineUsers: Math.max(1, onlineUsers),
    totalBots: bots.size,
    botsOnline: botsOnline,
    visitorCount,
    recentVisitors: Array.from(visitors.values()).slice(-10).reverse()
  });
});

app.get('/api/bots', authMiddleware, (req, res) => {
  const userBots = Array.from(bots.values()).filter(b => b.ownerId === req.user.id);
  res.json({ bots: userBots });
});

app.post('/api/bots', authMiddleware, (req, res) => {
  const { name, server, version, behavior } = req.body;
  
  const botId = 'bot_' + generateId();
  const bot = {
    id: botId,
    name: name || 'ZeyBot_' + Math.floor(Math.random() * 1000),
    server: server || 'play.hypixel.net',
    version: version || '1.20.4',
    behavior: behavior || 'idle',
    status: 'offline',
    ownerId: req.user.id,
    createdAt: new Date().toISOString(),
    lastActive: null,
    uptime: 0,
    ping: 0,
    playerCount: 0,
    logs: []
  };
  
  bots.set(botId, bot);
  req.user.stats.botSessions++;
  createLog('bot_create', req.user.id, `Created bot ${bot.name}`);
  
  res.json({ success: true, bot });
});

app.post('/api/bots/:botId/start', authMiddleware, (req, res) => {
  const bot = bots.get(req.params.botId);
  
  if (!bot) {
    return res.status(404).json({ error: 'Bot not found' });
  }
  
  if (bot.ownerId !== req.user.id && req.user.role === 'member') {
    return res.status(403).json({ error: 'Not authorized' });
  }
  
  bot.status = 'online';
  bot.lastActive = new Date().toISOString();
  bot.ping = Math.floor(Math.random() * 50) + 20;
  bot.playerCount = Math.floor(Math.random() * 100) + 10;
  bot.logs.push({ time: new Date().toISOString(), message: 'Bot connected to ' + bot.server });
  botsOnline++;
  
  createLog('bot_start', req.user.id, `Started bot ${bot.name}`);
  
  res.json({ success: true, bot });
});

app.post('/api/bots/:botId/stop', authMiddleware, (req, res) => {
  const bot = bots.get(req.params.botId);
  
  if (!bot) {
    return res.status(404).json({ error: 'Bot not found' });
  }
  
  if (bot.ownerId !== req.user.id && req.user.role === 'member') {
    return res.status(403).json({ error: 'Not authorized' });
  }
  
  bot.status = 'offline';
  bot.logs.push({ time: new Date().toISOString(), message: 'Bot disconnected' });
  botsOnline = Math.max(0, botsOnline - 1);
  
  createLog('bot_stop', req.user.id, `Stopped bot ${bot.name}`);
  
  res.json({ success: true, bot });
});

app.post('/api/bots/:botId/command', authMiddleware, (req, res) => {
  const bot = bots.get(req.params.botId);
  const { command } = req.body;
  
  if (!bot) {
    return res.status(404).json({ error: 'Bot not found' });
  }
  
  if (req.user.role === 'member') {
    return res.status(403).json({ error: 'Only admin/owner can send commands' });
  }
  
  bot.logs.push({ time: new Date().toISOString(), message: `Command sent: ${command}` });
  
  res.json({ success: true, message: 'Command sent' });
});

app.delete('/api/bots/:botId', authMiddleware, (req, res) => {
  const bot = bots.get(req.params.botId);
  
  if (!bot) {
    return res.status(404).json({ error: 'Bot not found' });
  }
  
  if (bot.ownerId !== req.user.id && req.user.role !== 'owner') {
    return res.status(403).json({ error: 'Not authorized' });
  }
  
  if (bot.status === 'online') botsOnline--;
  bots.delete(req.params.botId);
  
  createLog('bot_delete', req.user.id, `Deleted bot ${bot.name}`);
  
  res.json({ success: true });
});

app.get('/api/admin/users', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'owner') {
    return res.status(403).json({ error: 'Not authorized' });
  }
  
  const userList = Array.from(users.values()).map(u => ({ ...u, password: undefined }));
  res.json({ users: userList });
});

app.post('/api/admin/ban/:userId', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'owner') {
    return res.status(403).json({ error: 'Not authorized' });
  }
  
  const user = users.get(req.params.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  if (user.role === 'owner') {
    return res.status(403).json({ error: 'Cannot ban owner' });
  }
  
  user.banned = true;
  createLog('ban', req.user.id, `Banned user ${user.username}`);
  
  res.json({ success: true });
});

app.post('/api/admin/unban/:userId', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'owner') {
    return res.status(403).json({ error: 'Not authorized' });
  }
  
  const user = users.get(req.params.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  user.banned = false;
  createLog('unban', req.user.id, `Unbanned user ${user.username}`);
  
  res.json({ success: true });
});

app.post('/api/admin/hwid-reset/:userId', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'owner') {
    return res.status(403).json({ error: 'Not authorized' });
  }
  
  const user = users.get(req.params.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  user.hwid = null;
  user.hwidResetCount++;
  createLog('hwid_reset', req.user.id, `Reset HWID for ${user.username}`);
  
  res.json({ success: true });
});

app.post('/api/admin/invite', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'owner') {
    return res.status(403).json({ error: 'Not authorized' });
  }
  
  const code = generateInviteCode();
  invites.set(code, { 
    code, 
    createdBy: req.user.id, 
    usedBy: null, 
    createdAt: new Date().toISOString() 
  });
  
  createLog('invite_create', req.user.id, `Created invite code ${code}`);
  
  res.json({ success: true, code });
});

app.get('/api/admin/invites', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'owner') {
    return res.status(403).json({ error: 'Not authorized' });
  }
  
  res.json({ invites: Array.from(invites.values()) });
});

app.post('/api/owner/create-admin', authMiddleware, (req, res) => {
  if (req.user.role !== 'owner') {
    return res.status(403).json({ error: 'Only owner can create admins' });
  }
  
  const { userId } = req.body;
  const user = users.get(userId);
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  user.role = 'admin';
  user.achievements.push('admin');
  createLog('admin_create', req.user.id, `Made ${user.username} an admin`);
  
  res.json({ success: true });
});

app.post('/api/owner/remove-admin', authMiddleware, (req, res) => {
  if (req.user.role !== 'owner') {
    return res.status(403).json({ error: 'Only owner can remove admins' });
  }
  
  const { userId } = req.body;
  const user = users.get(userId);
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  user.role = 'member';
  user.achievements = user.achievements.filter(a => a !== 'admin');
  createLog('admin_remove', req.user.id, `Removed admin from ${user.username}`);
  
  res.json({ success: true });
});

app.post('/api/owner/add-time', authMiddleware, (req, res) => {
  if (req.user.role !== 'owner') {
    return res.status(403).json({ error: 'Only owner can add time' });
  }
  
  const { userId, days } = req.body;
  const user = users.get(userId);
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  const currentExpiry = user.expiresAt ? new Date(user.expiresAt) : new Date();
  user.expiresAt = new Date(currentExpiry.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
  createLog('add_time', req.user.id, `Added ${days} days to ${user.username}`);
  
  res.json({ success: true });
});

app.get('/api/owner/logs', authMiddleware, (req, res) => {
  if (req.user.role !== 'owner') {
    return res.status(403).json({ error: 'Only owner can view logs' });
  }
  
  const logList = Array.from(logs.values()).sort((a, b) => 
    new Date(b.timestamp) - new Date(a.timestamp)
  ).slice(0, 100);
  
  res.json({ logs: logList });
});

app.get('/api/tickets', authMiddleware, (req, res) => {
  let userTickets;
  if (req.user.role === 'admin' || req.user.role === 'owner') {
    userTickets = Array.from(tickets.values());
  } else {
    userTickets = Array.from(tickets.values()).filter(t => t.userId === req.user.id);
  }
  res.json({ tickets: userTickets });
});

app.post('/api/tickets', authMiddleware, (req, res) => {
  const { subject, message } = req.body;
  
  const ticketId = 'ticket_' + generateId();
  const ticket = {
    id: ticketId,
    userId: req.user.id,
    username: req.user.username,
    subject,
    status: 'open',
    createdAt: new Date().toISOString(),
    messages: [{
      from: req.user.username,
      message,
      timestamp: new Date().toISOString()
    }]
  };
  
  tickets.set(ticketId, ticket);
  createLog('ticket_create', req.user.id, `Created ticket: ${subject}`);
  
  res.json({ success: true, ticket });
});

app.post('/api/tickets/:ticketId/reply', authMiddleware, (req, res) => {
  const ticket = tickets.get(req.params.ticketId);
  const { message } = req.body;
  
  if (!ticket) {
    return res.status(404).json({ error: 'Ticket not found' });
  }
  
  if (ticket.userId !== req.user.id && req.user.role === 'member') {
    return res.status(403).json({ error: 'Not authorized' });
  }
  
  ticket.messages.push({
    from: req.user.username,
    message,
    timestamp: new Date().toISOString(),
    isAdmin: req.user.role === 'admin' || req.user.role === 'owner'
  });
  
  res.json({ success: true, ticket });
});

app.post('/api/tickets/:ticketId/close', authMiddleware, (req, res) => {
  const ticket = tickets.get(req.params.ticketId);
  
  if (!ticket) {
    return res.status(404).json({ error: 'Ticket not found' });
  }
  
  if (req.user.role === 'member' && ticket.userId !== req.user.id) {
    return res.status(403).json({ error: 'Not authorized' });
  }
  
  ticket.status = 'closed';
  
  res.json({ success: true });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🎮 ZeySense Hub - Port ${PORT}`);
  console.log(`👑 Owner: karos`);
  console.log(`🔐 Available invite codes: ${Array.from(invites.keys()).join(', ')}`);
});
