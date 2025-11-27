// Theme management
function saveTheme(theme) {
  localStorage.setItem('theme', theme);
  applyTheme(theme);
}

function applyTheme(theme) {
  const html = document.documentElement;
  html.classList.remove('dark-mode', 'light-mode', 'blue-mode', 'red-mode');
  
  switch(theme) {
    case 'light':
      html.classList.add('light-mode');
      break;
    case 'blue':
      html.classList.add('blue-mode');
      break;
    case 'red':
      html.classList.add('red-mode');
      break;
    default:
      html.classList.add('dark-mode');
  }
}

function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'dark';
  applyTheme(savedTheme);
}

// Initialize theme when page loads
document.addEventListener('DOMContentLoaded', initTheme);
