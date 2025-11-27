// State
let token = localStorage.getItem('token');
let username = localStorage.getItem('username');
let currentTheme = localStorage.getItem('theme') || 'theme-dark';

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  applyTheme(currentTheme);
  document.getElementById('themeSelect').value = currentTheme;

  if (token) {
    showMainPanel();
    loadUserData();
  } else {
    setupAuthListeners();
  }
});

// Theme Management
function applyTheme(theme) {
  document.body.classList.remove('theme-dark', 'theme-light', 'theme-blue', 'theme-red');
  document.body.classList.add(theme);
  localStorage.setItem('theme', theme);
}

document.addEventListener('change', (e) => {
  if (e.target.id === 'themeSelect') {
    const theme = e.target.value;
    applyTheme(theme);
    if (token) {
      fetch('/api/theme', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ theme })
      }).catch(err => console.error(err));
    }
  }
});

// Auth Listeners
function setupAuthListeners() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(tab).classList.add('active');
    });
  });

  document.getElementById('loginForm').addEventListener('submit', handleLogin);
  document.getElementById('registerForm').addEventListener('submit', handleRegister);
}

async function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('loginUsername').value;
  const password = document.getElementById('loginPassword').value;

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();
    if (res.ok) {
      token = data.token;
      window.username = username;
      localStorage.setItem('token', token);
      localStorage.setItem('username', username);
      showMainPanel();
      loadUserData();
      showNotification('✅ Giriş başarılı!', 'success');
    } else {
      showMessage(data.error, 'error');
    }
  } catch (err) {
    showMessage('Hata: ' + err.message, 'error');
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const username = document.getElementById('registerUsername').value;
  const password = document.getElementById('registerPassword').value;
  const confirm = document.getElementById('registerPasswordConfirm').value;

  if (password !== confirm) {
    showMessage('Şifreler eşleşmiyor!', 'error');
    return;
  }

  try {
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();
    if (res.ok) {
      token = data.token;
      window.username = username;
      localStorage.setItem('token', token);
      localStorage.setItem('username', username);
      showMainPanel();
      loadUserData();
      showNotification('✅ Kayıt başarılı!', 'success');
    } else {
      showMessage(data.error, 'error');
    }
  } catch (err) {
    showMessage('Hata: ' + err.message, 'error');
  }
}

function showMainPanel() {
  document.getElementById('authSection').style.display = 'none';
  document.getElementById('mainSection').style.display = 'block';
  document.getElementById('userGreeting').textContent = `Hoşgeldiniz, ${window.username}!`;

  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const section = btn.dataset.section;
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(section).classList.add('active');

      if (section === 'bots') loadBots();
      if (section === 'cloud') loadCloudFiles();
    });
  });

  document.getElementById('logoutBtn').addEventListener('click', logout);
  document.getElementById('refreshBotsBtn').addEventListener('click', loadBots);
  document.getElementById('refreshCloudBtn').addEventListener('click', loadCloudFiles);
  document.getElementById('addBotForm').addEventListener('submit', handleAddBot);
  document.getElementById('uploadFileForm').addEventListener('submit', handleUploadFile);

  loadBots();
}

async function loadUserData() {
  try {
    const res = await fetch('/api/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (res.ok) {
      applyTheme(data.theme);
      document.getElementById('themeSelect').value = data.theme;
    }
  } catch (err) {
    console.error(err);
  }
}

// Bot Management
async function loadBots() {
  const botsList = document.getElementById('botsList');
  botsList.innerHTML = '<p class="empty-message">Botlar yükleniyor...</p>';

  try {
    const res = await fetch('/api/bots', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (res.status === 401) {
      logout();
      return;
    }

    const bots = await res.json();

    if (bots.length === 0) {
      botsList.innerHTML = '<p class="empty-message">📭 Henüz bot eklenmemiş</p>';
      return;
    }

    botsList.innerHTML = bots.map(bot => `
      <div class="bot-card">
        <div class="card-header">
          <div class="card-title">${escapeHtml(bot.nickname)}</div>
          <span class="status-badge ${bot.status === 'connected' ? 'status-connected' : 'status-disconnected'}">
            ${bot.status === 'connected' ? '🟢 Bağlı' : '🔴 Bağlı Değil'}
          </span>
        </div>
        <div class="card-info">
          <p><strong>Host:</strong> ${escapeHtml(bot.host)}:${bot.port}</p>
          <p><strong>Versiyon:</strong> ${bot.version || 'Otomatik'}</p>
          <p><strong>Durum:</strong> ${bot.autoStart ? '⚙️ Otomatik' : '⏸️ Manuel'}</p>
        </div>
        <div class="card-actions">
          ${bot.status === 'disconnected'
            ? `<button class="btn btn-success btn-sm" onclick="startBot('${bot.id}')">▶️ Başlat</button>`
            : `<button class="btn btn-secondary btn-sm" onclick="stopBot('${bot.id}')">⏹️ Durdur</button>`
          }
          <button class="btn btn-danger btn-sm" onclick="deleteBot('${bot.id}')">🗑️ Sil</button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    botsList.innerHTML = '<p class="empty-message">❌ Hata: Botlar yüklenemedi</p>';
    console.error(err);
  }
}

async function handleAddBot(e) {
  e.preventDefault();
  const nickname = document.getElementById('botNickname').value;
  const host = document.getElementById('botHost').value;
  const port = document.getElementById('botPort').value;
  const version = document.getElementById('botVersion').value || null;

  try {
    const res = await fetch('/api/bots/add', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ nickname, host, port: parseInt(port), version })
    });

    const data = await res.json();
    if (res.ok) {
      document.getElementById('addBotForm').reset();
      loadBots();
      showNotification('✅ Bot eklendi!', 'success');
    } else {
      showNotification(data.error, 'error');
    }
  } catch (err) {
    showNotification('Hata: ' + err.message, 'error');
  }
}

async function startBot(botId) {
  try {
    const res = await fetch('/api/bots/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ botId })
    });

    if (res.ok) {
      showNotification('✅ Bot başlatılıyor...', 'success');
      setTimeout(loadBots, 1000);
    } else {
      const data = await res.json();
      showNotification(data.error, 'error');
    }
  } catch (err) {
    showNotification('Hata: ' + err.message, 'error');
  }
}

async function stopBot(botId) {
  try {
    const res = await fetch('/api/bots/stop', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ botId })
    });

    if (res.ok) {
      showNotification('✅ Bot durduruldu', 'success');
      loadBots();
    } else {
      const data = await res.json();
      showNotification(data.error, 'error');
    }
  } catch (err) {
    showNotification('Hata: ' + err.message, 'error');
  }
}

async function deleteBot(botId) {
  if (!confirm('Botu silmek istediğinize emin misiniz?')) return;

  try {
    const res = await fetch('/api/bots/delete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ botId })
    });

    if (res.ok) {
      showNotification('✅ Bot silindi', 'success');
      loadBots();
    } else {
      const data = await res.json();
      showNotification(data.error, 'error');
    }
  } catch (err) {
    showNotification('Hata: ' + err.message, 'error');
  }
}

// Cloud Management
async function loadCloudFiles() {
  const filesList = document.getElementById('filesList');
  filesList.innerHTML = '<p class="empty-message">Dosyalar yükleniyor...</p>';

  try {
    const res = await fetch('/api/cloud/files', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (res.status === 401) {
      logout();
      return;
    }

    const files = await res.json();

    if (files.length === 0) {
      filesList.innerHTML = '<p class="empty-message">📭 Henüz dosya yüklememisiniz</p>';
      return;
    }

    filesList.innerHTML = files.map(file => `
      <div class="file-card">
        <div class="card-header">
          <div class="card-title">${escapeHtml(file.filename)}</div>
        </div>
        <div class="card-info">
          <p><strong>Yüklenme:</strong> ${new Date(file.uploadedAt).toLocaleDateString('tr-TR')}</p>
        </div>
        <div class="card-actions">
          <button class="btn btn-secondary btn-sm" onclick="viewFile('${escapeHtml(file.filename)}')">👁️ Görüntüle</button>
          <button class="btn btn-danger btn-sm" onclick="deleteFile('${escapeHtml(file.filename)}')">🗑️ Sil</button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    filesList.innerHTML = '<p class="empty-message">❌ Hata: Dosyalar yüklenemedi</p>';
    console.error(err);
  }
}

async function handleUploadFile(e) {
  e.preventDefault();
  const filename = document.getElementById('fileName').value;
  const content = document.getElementById('fileContent').value;

  try {
    const res = await fetch('/api/cloud/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ filename, content })
    });

    const data = await res.json();
    if (res.ok) {
      document.getElementById('uploadFileForm').reset();
      loadCloudFiles();
      showNotification('✅ Dosya yüklendi!', 'success');
    } else {
      showNotification(data.error, 'error');
    }
  } catch (err) {
    showNotification('Hata: ' + err.message, 'error');
  }
}

async function viewFile(filename) {
  try {
    const res = await fetch(`/api/cloud/files`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const files = await res.json();
    const file = files.find(f => f.filename === filename);
    if (file) {
      alert(`${filename}:\n\n${file.content}`);
    }
  } catch (err) {
    showNotification('Hata: ' + err.message, 'error');
  }
}

async function deleteFile(filename) {
  if (!confirm('Dosyayı silmek istediğinize emin misiniz?')) return;

  try {
    const res = await fetch(`/api/cloud/file/${encodeURIComponent(filename)}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (res.ok) {
      showNotification('✅ Dosya silindi', 'success');
      loadCloudFiles();
    } else {
      const data = await res.json();
      showNotification(data.error, 'error');
    }
  } catch (err) {
    showNotification('Hata: ' + err.message, 'error');
  }
}

// Logout
function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('username');
  token = null;
  window.username = null;
  location.reload();
}

// Utilities
function showMessage(message, type) {
  const msg = document.getElementById('authMessage');
  msg.textContent = message;
  msg.className = `message show ${type}`;
  setTimeout(() => msg.classList.remove('show'), 5000);
}

function showNotification(message, type) {
  const notif = document.getElementById('notification');
  notif.textContent = message;
  notif.className = `notification show ${type}`;
  setTimeout(() => notif.classList.remove('show'), 3000);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
