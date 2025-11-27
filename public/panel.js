let currentUser = null;

async function loadPanel() {
  currentUser = await requireAuth();
  if (!currentUser) return;

  // Load user theme
  applyTheme(currentUser.theme);
  
  loadStats();
  setupMenuListeners();
  setupThemeListeners();
  setupBotListeners();
  setupCloudListeners();
}

async function loadStats() {
  try {
    const bots = await fetch('/api/bots').then(r => r.json());
    const files = await fetch('/api/cloud/files').then(r => r.json());
    
    document.getElementById('botCount').textContent = bots.length;
    document.getElementById('cloudFiles').textContent = files.length;
  } catch (err) {
    console.error(err);
  }
}

function setupMenuListeners() {
  document.querySelectorAll('.menu-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const section = item.dataset.section;
      
      document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));
      document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
      
      item.classList.add('active');
      document.getElementById(section).classList.add('active');
      
      if (section === 'bots') loadBots();
      if (section === 'cloud') loadCloudFiles();
    });
  });
}

function setupThemeListeners() {
  document.querySelectorAll('.theme-option').forEach(option => {
    option.addEventListener('click', async () => {
      const theme = option.dataset.theme;
      try {
        await fetch('/api/theme', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ theme })
        });
        saveTheme(theme);
      } catch (err) {
        console.error(err);
      }
    });
  });
}

function setupBotListeners() {
  const addBotBtn = document.getElementById('addBotBtn');
  const createBotForm = document.getElementById('createBotForm');
  
  addBotBtn.addEventListener('click', () => {
    document.getElementById('addBotForm').style.display = 'block';
  });

  createBotForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const nickname = document.getElementById('botNickname').value;
    const host = document.getElementById('botHost').value;
    const port = document.getElementById('botPort').value;

    try {
      const res = await fetch('/api/bots/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname, host, port })
      });

      if (res.ok) {
        document.getElementById('addBotForm').style.display = 'none';
        createBotForm.reset();
        loadBots();
        loadStats();
      }
    } catch (err) {
      console.error(err);
    }
  });
}

async function loadBots() {
  try {
    const bots = await fetch('/api/bots').then(r => r.json());
    const botsList = document.getElementById('botsList');
    
    if (bots.length === 0) {
      botsList.innerHTML = '<p style="color: var(--text-secondary);">Henüz bot eklememişsiniz</p>';
      return;
    }

    botsList.innerHTML = bots.map(bot => `
      <div class="bot-card">
        <div class="bot-info">
          <h3>${bot.nickname}</h3>
          <p>${bot.host}:${bot.port}</p>
          <span class="bot-status ${bot.status}">${bot.status === 'connected' ? '🟢 Bağlı' : '🔴 Bağlı Değil'}</span>
        </div>
        <div class="bot-actions">
          ${bot.status === 'disconnected' ? `
            <button class="btn btn-primary btn-sm" onclick="connectBot('${bot.id}')">Bağlan</button>
          ` : `
            <button class="btn btn-secondary btn-sm" onclick="disconnectBot('${bot.id}')">Bağlantıyı Kes</button>
          `}
          <button class="btn btn-danger btn-sm" onclick="deleteBot('${bot.id}')">Sil</button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error(err);
  }
}

async function connectBot(botId) {
  try {
    const res = await fetch(`/api/bots/${botId}/connect`, { method: 'POST' });
    if (res.ok) {
      setTimeout(loadBots, 1000);
    }
  } catch (err) {
    console.error(err);
  }
}

async function disconnectBot(botId) {
  try {
    const res = await fetch(`/api/bots/${botId}/disconnect`, { method: 'POST' });
    if (res.ok) {
      loadBots();
    }
  } catch (err) {
    console.error(err);
  }
}

async function deleteBot(botId) {
  if (!confirm('Botu silmek istediğinize emin misiniz?')) return;
  
  try {
    const res = await fetch(`/api/bots/${botId}`, { method: 'DELETE' });
    if (res.ok) {
      loadBots();
      loadStats();
    }
  } catch (err) {
    console.error(err);
  }
}

function setupCloudListeners() {
  const uploadFileBtn = document.getElementById('uploadFileBtn');
  const uploadForm = document.getElementById('uploadForm');
  
  uploadFileBtn.addEventListener('click', () => {
    document.getElementById('uploadFileForm').style.display = 'block';
  });

  uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const filename = document.getElementById('fileName').value;
    const content = document.getElementById('fileContent').value;

    try {
      const res = await fetch('/api/cloud/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, content })
      });

      if (res.ok) {
        document.getElementById('uploadFileForm').style.display = 'none';
        uploadForm.reset();
        loadCloudFiles();
        loadStats();
      }
    } catch (err) {
      console.error(err);
    }
  });
}

async function loadCloudFiles() {
  try {
    const files = await fetch('/api/cloud/files').then(r => r.json());
    const filesList = document.getElementById('filesList');
    
    if (files.length === 0) {
      filesList.innerHTML = '<p style="color: var(--text-secondary);">Henüz dosya yüklememisiniz</p>';
      return;
    }

    filesList.innerHTML = files.map(file => `
      <div class="file-card">
        <div class="file-info">
          <h3>${file.filename}</h3>
          <p>${(file.size / 1024).toFixed(2)} KB</p>
        </div>
        <div class="file-actions">
          <button class="btn btn-secondary btn-sm" onclick="viewFile('${file.filename}')">Görüntüle</button>
          <button class="btn btn-danger btn-sm" onclick="deleteFile('${file.filename}')">Sil</button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error(err);
  }
}

async function viewFile(filename) {
  try {
    const file = await fetch(`/api/cloud/file/${filename}`).then(r => r.json());
    alert(`${filename}:\n\n${file.content}`);
  } catch (err) {
    console.error(err);
  }
}

async function deleteFile(filename) {
  if (!confirm('Dosyayı silmek istediğinize emin misiniz?')) return;
  
  try {
    const res = await fetch(`/api/cloud/file/${filename}`, { method: 'DELETE' });
    if (res.ok) {
      loadCloudFiles();
      loadStats();
    }
  } catch (err) {
    console.error(err);
  }
}

document.addEventListener('DOMContentLoaded', loadPanel);
