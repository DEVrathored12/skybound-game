// Animated stars in hero
const container = document.getElementById('stars');
for (let i = 0; i < 80; i++) {
  const s = document.createElement('div');
  s.className = 'star';
  const size = Math.random() * 2.5 + 0.5;
  s.style.cssText = `
    width:${size}px;height:${size}px;
    left:${Math.random()*100}%;
    top:${Math.random()*100}%;
    opacity:${Math.random()*.8+.2};
    --d:${Math.random()*3+2}s;
    animation-delay:${Math.random()*4}s
  `;
  container.appendChild(s);
}

// Highlight nav link on scroll
const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('.nav-links a[href^="#"]');
window.addEventListener('scroll', () => {
  let current = '';
  sections.forEach(s => { if (window.scrollY >= s.offsetTop - 80) current = s.id; });
  navLinks.forEach(a => {
    a.style.color = a.getAttribute('href') === '#' + current ? '#fff' : '';
  });
}, { passive: true });
