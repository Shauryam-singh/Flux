// ═══════════════════════════════════════════════════════════════
// FLUX ANIMATIONS — Particle system and visual effects
// ═══════════════════════════════════════════════════════════════

let canvas, ctx;
let particles = [];
let animFrame;
let active = false;

const PARTICLE_COUNT = 40;
const COLORS = ['rgba(85, 214, 255, 0.3)', 'rgba(124, 139, 255, 0.2)', 'rgba(85, 214, 255, 0.15)'];

class Particle {
  constructor(w, h) {
    this.reset(w, h);
  }

  reset(w, h) {
    this.x = Math.random() * w;
    this.y = Math.random() * h;
    this.size = Math.random() * 1.5 + 0.5;
    this.speedX = (Math.random() - 0.5) * 0.3;
    this.speedY = (Math.random() - 0.5) * 0.3;
    this.opacity = Math.random() * 0.5 + 0.1;
    this.color = COLORS[Math.floor(Math.random() * COLORS.length)];
    this.life = Math.random() * 200 + 100;
    this.maxLife = this.life;
  }

  update(w, h) {
    this.x += this.speedX;
    this.y += this.speedY;
    this.life--;

    if (this.life <= 0 || this.x < -10 || this.x > w + 10 || this.y < -10 || this.y > h + 10) {
      this.reset(w, h);
    }
  }

  draw(ctx) {
    const fade = Math.min(1, this.life / (this.maxLife * 0.3));
    ctx.globalAlpha = this.opacity * fade;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

function initParticles() {
  canvas = document.getElementById('particles-canvas');
  if (!canvas) return;
  ctx = canvas.getContext('2d');
  resize();
  window.addEventListener('resize', resize);
}

function resize() {
  if (!canvas) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

function animate() {
  if (!active || !ctx) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  particles.forEach(p => {
    p.update(canvas.width, canvas.height);
    p.draw(ctx);
  });

  // Draw subtle connections
  ctx.globalAlpha = 0.03;
  ctx.strokeStyle = 'rgba(85, 214, 255, 1)';
  ctx.lineWidth = 0.5;
  for (let i = 0; i < particles.length; i++) {
    for (let j = i + 1; j < particles.length; j++) {
      const dx = particles[i].x - particles[j].x;
      const dy = particles[i].y - particles[j].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 120) {
        ctx.globalAlpha = 0.03 * (1 - dist / 120);
        ctx.beginPath();
        ctx.moveTo(particles[i].x, particles[i].y);
        ctx.lineTo(particles[j].x, particles[j].y);
        ctx.stroke();
      }
    }
  }

  ctx.globalAlpha = 1;
  animFrame = requestAnimationFrame(animate);
}

export function startParticles() {
  if (active) return;
  initParticles();
  if (!canvas) return;

  particles = [];
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particles.push(new Particle(canvas.width, canvas.height));
  }

  active = true;
  animate();
}

export function stopParticles() {
  active = false;
  if (animFrame) cancelAnimationFrame(animFrame);
  particles = [];
  if (ctx && canvas) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

// ─── Thought Graph Renderer ───

let graphNodes = [];
let graphEdges = [];
let graphAnimFrame;
let graphActive = false;

const graphThoughtTypes = {
  observed: { color: '#55D6FF', radius: 6 },
  thought: { color: '#7C8BFF', radius: 8 },
  evidence: { color: '#49E38A', radius: 5 },
  decision: { color: '#FFC857', radius: 7 },
  confidence: { color: '#A0AEC0', radius: 4 },
};

function initGraphNodes() {
  graphNodes = [];
  graphEdges = [];

  const types = Object.keys(graphThoughtTypes);
  for (let i = 0; i < 15; i++) {
    const type = types[Math.floor(Math.random() * types.length)];
    graphNodes.push({
      id: i,
      type,
      x: 100 + Math.random() * 600,
      y: 80 + Math.random() * 400,
      vx: (Math.random() - 0.5) * 0.2,
      vy: (Math.random() - 0.5) * 0.2,
      label: ['Modified runtime.ts', 'Dependency complex', '18 imports', 'Wait for user', '91% confident', 'Git event', 'Memory pattern', 'Goal stalled', 'Docker restart', 'File changed', 'Idle 5m', 'Build OK', 'Optimize?', 'Skill learned', 'Reflect'][i],
      confidence: 50 + Math.floor(Math.random() * 50),
    });
  }

  // Create edges
  for (let i = 1; i < graphNodes.length; i++) {
    const from = Math.floor(Math.random() * i);
    const types = ['supports', 'contradicts', 'extends', 'alternative'];
    graphEdges.push({
      from,
      to: i,
      type: types[Math.floor(Math.random() * types.length)],
    });
  }
}

const edgeColors = {
  supports: 'rgba(73, 227, 138, 0.3)',
  contradicts: 'rgba(255, 107, 107, 0.3)',
  extends: 'rgba(85, 214, 255, 0.3)',
  alternative: 'rgba(255, 200, 87, 0.3)',
};

function animateGraph() {
  if (!graphActive) return;

  const canvas = document.getElementById('graph-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  canvas.width = canvas.parentElement.clientWidth;
  canvas.height = canvas.parentElement.clientHeight;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Update positions (gentle drift)
  graphNodes.forEach(n => {
    n.x += n.vx;
    n.y += n.vy;
    if (n.x < 30 || n.x > canvas.width - 30) n.vx *= -1;
    if (n.y < 30 || n.y > canvas.height - 30) n.vy *= -1;
  });

  // Draw edges
  graphEdges.forEach(e => {
    const from = graphNodes[e.from];
    const to = graphNodes[e.to];
    ctx.strokeStyle = edgeColors[e.type] || 'rgba(85, 214, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  });

  // Draw nodes
  graphNodes.forEach(n => {
    const style = graphThoughtTypes[n.type];

    // Glow
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = style.color;
    ctx.beginPath();
    ctx.arc(n.x, n.y, style.radius + 6, 0, Math.PI * 2);
    ctx.fill();

    // Node
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = style.color;
    ctx.beginPath();
    ctx.arc(n.x, n.y, style.radius, 0, Math.PI * 2);
    ctx.fill();

    // Label
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = '#F5F7FA';
    ctx.font = '9px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(n.label, n.x, n.y + style.radius + 12);
  });

  ctx.globalAlpha = 1;
  graphAnimFrame = requestAnimationFrame(animateGraph);
}

export function startGraph() {
  if (graphActive) return;
  graphActive = true;
  initGraphNodes();
  animateGraph();
}

export function stopGraph() {
  graphActive = false;
  if (graphAnimFrame) cancelAnimationFrame(graphAnimFrame);
}
