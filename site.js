// Animated stars
const container = document.getElementById('stars');
for (let i = 0; i < 80; i++) {
  const s = document.createElement('div');
  s.className = 'star';
  const size = Math.random() * 2.5 + 0.5;
  s.style.cssText = `width:${size}px;height:${size}px;left:${Math.random()*100}%;top:${Math.random()*100}%;opacity:${Math.random()*.8+.2};--d:${Math.random()*3+2}s;animation-delay:${Math.random()*4}s`;
  container.appendChild(s);
}

// Game modal
const modal = document.getElementById('gameModal');
const frame = document.getElementById('gameFrame');
const closeBtn = document.getElementById('closeGame');

function openGame() {
  frame.src = 'game/index.html';
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeGame() {
  modal.classList.remove('open');
  frame.src = '';
  document.body.style.overflow = '';
}

document.getElementById('heroPlayBtn').addEventListener('click', openGame);
document.getElementById('navPlayBtn').addEventListener('click', openGame);
document.getElementById('openGame').addEventListener('click', openGame);
closeBtn.addEventListener('click', closeGame);
modal.addEventListener('click', e => { if (e.target === modal) closeGame(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeGame(); });

// Nav highlight on scroll
const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('.nav-links a[href^="#"]');
window.addEventListener('scroll', () => {
  let current = '';
  sections.forEach(s => { if (window.scrollY >= s.offsetTop - 80) current = s.id; });
  navLinks.forEach(a => { a.style.color = a.getAttribute('href') === '#' + current ? '#fff' : ''; });
}, { passive: true });
