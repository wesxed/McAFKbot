// Theme Management
const THEME_KEY = 'minecraft-bot-theme';
const DEFAULT_THEME = 'theme-dark';

function initTheme() {
  const savedTheme = localStorage.getItem(THEME_KEY) || DEFAULT_THEME;
  setTheme(savedTheme);
}

function setTheme(theme) {
  document.body.classList.remove('theme-dark', 'theme-light', 'theme-blue', 'theme-red');
  document.body.classList.add(theme);
  localStorage.setItem(THEME_KEY, theme);
  document.getElementById('themeSelect').value = theme;
}

// Bot Management
let botsData = [];

async function loadBots() {
  try {
    const response = await fetch('/api/bots');
    botsData = await response.json();
    renderBots();
  } catch (err) {
    console.error('Bots yüklenirken hata:', err);
    showError('Botlar yüklenemedi');
  }
}

function renderBots() {
  const botsList = document.getElementById('botsList');
  
  if (botsData.length === 0) {
    botsList.innerHTML = '<p class="empty-message">📭 Henüz bot eklenmemiş. Yukarıdan yeni bir bot ekleyiniz.</p>';
    return;
  }

  botsList.innerHTML = botsData.map(bot => `
    <div class="bot-card">
      <div class="bot-card-header">
        <div class="bot-card-title">${escapeHtml(bot.nickname)}</div>
        <span class="bot-status ${bot.status}">${bot.status === 'connected' ? '🟢 Bağlı' : '🔴 Bağlı Değil'}</span>
      </div>
      <div class="bot-info">
        <p><strong>Host:</strong> ${escapeHtml(bot.host)}</p>
        <p><strong>Port:</strong> ${bot.port}</p>
        <p><strong>Durum:</strong> ${bot.autoStart ? '⚙️ Otomatik başlangıç açık' : '⏸️ Manuel kontrol'}</p>
      </div>
      <div class="bot-actions">
        ${bot.status === 'disconnected' 
          ? `<button class="btn btn-success btn-sm" onclick="startBot('${bot.id}')">▶️ Başlat</button>`
          : `<button class="btn btn-warning btn-sm" onclick="stopBot('${bot.id}')">⏹️ Durdur</button>`
        }
        <button class="btn btn-danger btn-sm" onclick="deleteBot('${bot.id}')">🗑️ Sil</button>
      </div>
    </div>
  `).join('');
}

async function addBot(nickname, host, port) {
  try {
    const response = await fetch('/api/bots/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname, host, port })
    });

    const result = await response.json();
    if (result.success) {
      showSuccess(`✅ Bot "${nickname}" başarıyla eklendi!`);
      document.getElementById('addBotForm').reset();
      await loadBots();
    } else {
      showError(result.error || 'Bot eklenemedi');
    }
  } catch (err) {
    console.error('Bot eklenirken hata:', err);
    showError('Bot eklenemedi');
  }
}

async function startBot(botId) {
  try {
    const response = await fetch('/api/bots/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ botId })
    });

    const result = await response.json();
    if (result.success) {
      showSuccess('✅ Bot başlatılıyor...');
      setTimeout(loadBots, 1000);
    } else {
      showError(result.error || 'Bot başlatılamadı');
    }
  } catch (err) {
    console.error('Bot başlatılırken hata:', err);
    showError('Bot başlatılamadı');
  }
}

async function stopBot(botId) {
  try {
    const response = await fetch('/api/bots/stop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ botId })
    });

    const result = await response.json();
    if (result.success) {
      showSuccess('✅ Bot durduruldu');
      await loadBots();
    } else {
      showError(result.error || 'Bot durdurulamadı');
    }
  } catch (err) {
    console.error('Bot durdurulurken hata:', err);
    showError('Bot durdurulamadı');
  }
}

async function deleteBot(botId) {
  if (!confirm('Bu botu silmek istediğinize emin misiniz?')) return;

  try {
    const response = await fetch('/api/bots/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ botId })
    });

    const result = await response.json();
    if (result.success) {
      showSuccess('✅ Bot silindi');
      await loadBots();
    } else {
      showError(result.error || 'Bot silinemedi');
    }
  } catch (err) {
    console.error('Bot silinirken hata:', err);
    showError('Bot silinemedi');
  }
}

// Notifications
function showSuccess(message) {
  showNotification(message, 'success');
}

function showError(message) {
  showNotification(message, 'error');
}

function showNotification(message, type) {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 15px 20px;
    border-radius: 8px;
    font-weight: 600;
    z-index: 9999;
    animation: slideIn 0.3s ease;
    max-width: 350px;
    word-wrap: break-word;
  `;

  if (type === 'success') {
    notification.style.background = 'rgba(16, 185, 129, 0.9)';
    notification.style.color = '#fff';
  } else {
    notification.style.background = 'rgba(239, 68, 68, 0.9)';
    notification.style.color = '#fff';
  }

  notification.textContent = message;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// Utilities
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  // Initialize theme
  initTheme();

  // Theme selector
  document.getElementById('themeSelect').addEventListener('change', (e) => {
    setTheme(e.target.value);
  });

  // Add bot form
  document.getElementById('addBotForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const nickname = document.getElementById('botNickname').value.trim();
    const host = document.getElementById('botHost').value.trim();
    const port = document.getElementById('botPort').value.trim();

    if (!nickname || !host || !port) {
      showError('Tüm alanları doldurunuz');
      return;
    }

    addBot(nickname, host, parseInt(port));
  });

  // Refresh button
  document.getElementById('refreshBtn').addEventListener('click', () => {
    loadBots();
    showSuccess('✅ Botlar yenilendi');
  });

  // Initial load
  loadBots();

  // Auto-refresh every 5 seconds
  setInterval(loadBots, 5000);
});

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(400px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(400px);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);
