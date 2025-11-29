let token = localStorage.getItem('csToken');
let username = localStorage.getItem('csUsername');
let currentServer = 'server-1'; // Always use first server
let servers = [];
let serverIP = '';
let serverPort = '';

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  if (token) {
    showDashboard();
    loadServers();
  } else {
    // Check if remember-me data exists
    const savedUsername = localStorage.getItem('csUsername');
    const savedPassword = localStorage.getItem('csPassword');
    if (savedUsername && savedPassword) {
      autoLogin(savedUsername, savedPassword);
    } else {
      setupLogin();
    }
  }
});

async function autoLogin(loginUsername, password) {
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: loginUsername, password })
    });

    const data = await res.json();
    if (res.ok) {
      token = data.token;
      username = loginUsername;
      localStorage.setItem('csToken', token);
      showDashboard();
      loadServers();
    } else {
      setupLogin();
    }
  } catch (err) {
    setupLogin();
  }
}

// LOGIN & REGISTER
function setupLogin() {
  // Tab switching
  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;
      document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(tabName + 'Form').classList.add('active');
    });
  });

  // Login form
  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const loginUsername = document.getElementById('adminUsername').value;
    const password = document.getElementById('adminPassword').value;
    const rememberMe = document.getElementById('rememberMe').checked;
    const errorMsg = document.getElementById('loginError');
    errorMsg.classList.remove('show');

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername, password })
      });

      const data = await res.json();
      if (res.ok) {
        token = data.token;
        username = loginUsername;
        localStorage.setItem('csToken', token);
        if (rememberMe) {
          localStorage.setItem('csUsername', loginUsername);
          localStorage.setItem('csPassword', password);
        }
        showDashboard();
        loadServers();
      } else {
        errorMsg.textContent = data.error;
        errorMsg.classList.add('show');
      }
    } catch (err) {
      errorMsg.textContent = 'Hata: ' + err.message;
      errorMsg.classList.add('show');
    }
  });

  // Register form
  document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('regUsername').value;
    const password = document.getElementById('regPassword').value;
    const password2 = document.getElementById('regPassword2').value;
    const errorMsg = document.getElementById('registerError');
    errorMsg.classList.remove('show');

    if (password !== password2) {
      errorMsg.textContent = 'Şifreler eşleşmiyor';
      errorMsg.classList.add('show');
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
        localStorage.setItem('csToken', token);
        showDashboard();
        loadServers();
      } else {
        errorMsg.textContent = data.error;
        errorMsg.classList.add('show');
      }
    } catch (err) {
      errorMsg.textContent = 'Hata: ' + err.message;
      errorMsg.classList.add('show');
    }
  });
}

function showDashboard() {
  document.getElementById('loginPage').style.display = 'none';
  document.getElementById('dashboard').style.display = 'block';
  setupDashboard();
}

// DASHBOARD
function setupDashboard() {
  document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('csToken');
    token = null;
    location.reload();
  });

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(tab + '-tab').classList.add('active');
    });
  });

  document.getElementById('startBtn').addEventListener('click', () => startServer());
  document.getElementById('stopBtn').addEventListener('click', () => stopServer());
  document.getElementById('restartBtn').addEventListener('click', () => restartServer());
  document.getElementById('changeMapBtn').addEventListener('click', () => changeMap());
  document.getElementById('executeBtn').addEventListener('click', () => executeRCON());
}

async function loadServers() {
  try {
    const res = await fetch('/api/servers', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    servers = await res.json();
    renderServerList();
    
    if (servers.length > 0) {
      if (!currentServer || !servers.find(s => s.id === currentServer)) {
        selectServer(servers[0].id);
      } else {
        updateServerDisplay();
      }
    }

    // Auto-refresh every 3 seconds
    if (!window.refreshInterval) {
      window.refreshInterval = setInterval(refreshServers, 3000);
    }
  } catch (err) {
    console.error(err);
  }
}

async function refreshServers() {
  try {
    const res = await fetch('/api/servers', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    servers = await res.json();
    renderServerList();
    if (currentServer) {
      updateServerDisplay();
    }
  } catch (err) {}
}

function renderServerList() {
  const list = document.getElementById('serversList');
  if (servers.length === 0) {
    list.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 20px;">Sunucu yok. Yeni sunucu oluştur.</p>';
    return;
  }
  
  list.innerHTML = servers.map(server => `
    <div class="server-item ${currentServer === server.id ? 'active' : ''}" onclick="selectServer('${server.id}')">
      <span class="server-status ${server.status === 'running' ? 'running' : 'stopped'}"></span>
      <strong>${server.name}</strong>
      <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 4px;">
        ${server.players.length}/${server.maxPlayers} oyuncu
      </div>
    </div>
  `).join('');
}

function selectServer(serverId) {
  currentServer = serverId;
  renderServerList();
  updateServerDisplay();
}

async function updateServerDisplay() {
  try {
    const res = await fetch(`/api/server/${currentServer}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const server = await res.json();

    document.getElementById('serverTitle').textContent = server.name;
    document.getElementById('statusValue').textContent = server.status === 'running' ? '🟢 Çalışıyor' : '🔴 Durmuş';
    document.getElementById('playerCount').textContent = `${server.players.length}/${server.maxPlayers}`;
    document.getElementById('mapValue').textContent = server.map;
    document.getElementById('tickrateValue').textContent = server.tickrate + ' Hz';
    
    // Update connection info
    serverIP = server.ip || 'play.server' + Math.floor(Math.random() * 9000 + 1000) + '.com';
    serverPort = server.port || (25000 + Math.floor(Math.random() * 5000));
    document.getElementById('connectionIP').textContent = `${serverIP}:${serverPort}`;

    // Update players table
    const tbody = document.getElementById('playersBody');
    if (server.players.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center">Oyuncu yok</td></tr>';
    } else {
      tbody.innerHTML = server.players.map(player => `
        <tr>
          <td>${player.name}</td>
          <td>${player.score}</td>
          <td>${player.kills}</td>
          <td>${player.deaths}</td>
          <td>${player.ping}ms</td>
          <td>
            <button class="btn btn-danger action-btn" onclick="kickPlayer('${player.id}')">Kick</button>
            <button class="btn btn-danger action-btn" onclick="banPlayer('${player.id}')">Ban</button>
          </td>
        </tr>
      `).join('');
    }

    // Update logs
    const logsContainer = document.getElementById('logsContainer');
    logsContainer.innerHTML = server.logs.reverse().map(log => `
      <div class="log-entry">${log}</div>
    `).join('');
    logsContainer.scrollTop = logsContainer.scrollHeight;

    // Update map selector
    const mapSelect = document.getElementById('mapSelect');
    if (mapSelect.options.length === 0) {
      const mapsRes = await fetch('/api/maps', { headers: { 'Authorization': `Bearer ${token}` } });
      const maps = await mapsRes.json();
      mapSelect.innerHTML = maps.map(map => `<option value="${map}" ${server.map === map ? 'selected' : ''}>${map}</option>`).join('');
    }

    // Update config
    document.getElementById('configEditor').value = JSON.stringify(server.config, null, 2);
  } catch (err) {
    console.error(err);
  }
}

async function startServer() {
  if (!currentServer) return;
  try {
    await fetch(`/api/server/${currentServer}/start`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    await new Promise(r => setTimeout(r, 500));
    updateServerDisplay();
  } catch (err) {
    alert('Hata: ' + err.message);
  }
}

async function stopServer() {
  if (!currentServer) return;
  try {
    await fetch(`/api/server/${currentServer}/stop`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    await new Promise(r => setTimeout(r, 500));
    updateServerDisplay();
  } catch (err) {
    alert('Hata: ' + err.message);
  }
}

async function restartServer() {
  if (!currentServer) return;
  try {
    await fetch(`/api/server/${currentServer}/restart`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    await new Promise(r => setTimeout(r, 2500));
    updateServerDisplay();
  } catch (err) {
    alert('Hata: ' + err.message);
  }
}

async function changeMap() {
  if (!currentServer) return;
  const map = document.getElementById('mapSelect').value;
  try {
    await fetch(`/api/server/${currentServer}/changemap`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ map })
    });
    updateServerDisplay();
  } catch (err) {
    alert('Hata: ' + err.message);
  }
}

async function executeRCON() {
  if (!currentServer) return;
  const command = document.getElementById('rconInput').value;
  if (!command) return;

  try {
    await fetch(`/api/server/${currentServer}/rcon`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ command })
    });
    document.getElementById('rconInput').value = '';
    await new Promise(r => setTimeout(r, 500));
    updateServerDisplay();
  } catch (err) {
    alert('Hata: ' + err.message);
  }
}

async function kickPlayer(playerId) {
  if (!currentServer) return;
  try {
    await fetch(`/api/server/${currentServer}/player/${playerId}/kick`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    updateServerDisplay();
  } catch (err) {
    alert('Hata: ' + err.message);
  }
}

async function banPlayer(playerId) {
  if (!currentServer) return;
  try {
    await fetch(`/api/server/${currentServer}/player/${playerId}/ban`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    updateServerDisplay();
  } catch (err) {
    alert('Hata: ' + err.message);
  }
}

function copyIP() {
  const ip = document.getElementById('connectionIP').textContent;
  navigator.clipboard.writeText(ip).then(() => {
    alert('✅ Kopyalandı: ' + ip);
  }).catch(() => {
    alert('IP: ' + ip);
  });
}

// Create Server Functions
function showCreateServerForm() {
  document.getElementById('createServerModal').style.display = 'flex';
  
  // Populate map options
  const mapSelect = document.getElementById('newServerMap');
  if (mapSelect.options.length <= 1) {
    fetch('/api/maps', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => res.json())
      .then(maps => {
        maps.forEach(map => {
          const opt = document.createElement('option');
          opt.value = map;
          opt.textContent = map;
          mapSelect.appendChild(opt);
        });
      });
  }
}

function hideCreateServerForm() {
  document.getElementById('createServerModal').style.display = 'none';
}

document.addEventListener('DOMContentLoaded', () => {
  const createForm = document.getElementById('createServerForm');
  if (createForm) {
    createForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('newServerName').value;
      const map = document.getElementById('newServerMap').value;
      const tickrate = parseInt(document.getElementById('newServerTickrate').value);
      const maxPlayers = parseInt(document.getElementById('newServerMaxPlayers').value);

      try {
        const res = await fetch('/api/server/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ name, map, tickrate, maxPlayers })
        });

        const data = await res.json();
        if (res.ok) {
          hideCreateServerForm();
          document.getElementById('createServerForm').reset();
          await loadServers();
          selectServer(data.server.id);
          alert('✅ Sunucu oluşturuldu!');
        } else {
          alert('Hata: ' + data.error);
        }
      } catch (err) {
        alert('Hata: ' + err.message);
      }
    });
  }
});
