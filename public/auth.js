async function checkAuth() {
  try {
    const res = await fetch('/api/me');
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.error(err);
  }
  return null;
}

async function initializeNav() {
  const user = await checkAuth();
  const loginLink = document.getElementById('loginLink');
  const registerLink = document.getElementById('registerLink');
  const panelLink = document.getElementById('panelLink');
  const logoutBtn = document.getElementById('logoutBtn');
  const usernameSpan = document.getElementById('username');

  if (user) {
    if (loginLink) loginLink.style.display = 'none';
    if (registerLink) registerLink.style.display = 'none';
    if (panelLink) panelLink.style.display = 'inline';
    if (logoutBtn) logoutBtn.style.display = 'inline-block';
    if (usernameSpan) usernameSpan.textContent = `Hoşgeldiniz, ${user.username}!`;
  } else {
    if (loginLink) loginLink.style.display = 'inline';
    if (registerLink) registerLink.style.display = 'inline';
    if (panelLink) panelLink.style.display = 'none';
    if (logoutBtn) logoutBtn.style.display = 'none';
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await fetch('/api/logout', { method: 'POST' });
      window.location.href = '/';
    });
  }
}

async function requireAuth() {
  const user = await checkAuth();
  if (!user) {
    window.location.href = '/login.html';
  }
  return user;
}

document.addEventListener('DOMContentLoaded', initializeNav);
