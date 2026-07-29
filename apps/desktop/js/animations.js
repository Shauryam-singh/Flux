// ═══════════════════════════════════════════════════════════════
// FLUX ANIMATIONS — Particle system and visual effects
// ═══════════════════════════════════════════════════════════════

let canvas, ctx;
let particles = [];
let animFrame;
let active = false;

const PARTICLE_COUNT = 40;
const COLORS = [
  "rgba(85, 214, 255, 0.3)",
  "rgba(124, 139, 255, 0.2)",
  "rgba(85, 214, 255, 0.15)",
];

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

    if (
      this.life <= 0 ||
      this.x < -10 ||
      this.x > w + 10 ||
      this.y < -10 ||
      this.y > h + 10
    ) {
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
  canvas = document.getElementById("particles-canvas");
  if (!canvas) return;
  ctx = canvas.getContext("2d");
  resize();
  window.addEventListener("resize", resize);
}

function resize() {
  if (!canvas) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

function animate() {
  if (!active || !ctx) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  particles.forEach((p) => {
    p.update(canvas.width, canvas.height);
    p.draw(ctx);
  });

  // Draw subtle connections
  ctx.globalAlpha = 0.03;
  ctx.strokeStyle = "rgba(85, 214, 255, 1)";
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

// ─── Thought Graph Renderer — Real-time from SSE ───

let graphNodes = [];
let graphEdges = [];
let graphAnimFrame;
let graphActive = false;
let graphUpdateTimer = null;

const graphThoughtTypes = {
  observation_interpretation: { color: "#55D6FF", radius: 6 },
  pattern_recognition: { color: "#7C8BFF", radius: 8 },
  concern: { color: "#FF6B6B", radius: 7 },
  goal_evaluation: { color: "#49E38A", radius: 7 },
  user_intent: { color: "#FFC857", radius: 7 },
  suggestion: { color: "#A78BFA", radius: 6 },
  insight: { color: "#F472B6", radius: 6 },
  prediction: { color: "#38BDF8", radius: 5 },
  reflection: { color: "#FB923C", radius: 5 },
  opportunity: { color: "#34D399", radius: 6 },
};

function updateGraphFromData(thoughts, edges) {
  if (!graphActive) return;

  const canvas = document.getElementById("graph-canvas");
  const w = canvas ? canvas.parentElement.clientWidth : 800;
  const h = canvas ? canvas.parentElement.clientHeight : 500;

  // Map thoughts to nodes, keeping existing positions where possible
  const oldPosMap = new Map();
  for (const n of graphNodes) {
    oldPosMap.set(n.label, { x: n.x, y: n.y, vx: n.vx, vy: n.vy });
  }

  graphNodes = thoughts.slice(-20).map((t, i) => {
    const label = (t.content || "").slice(0, 35);
    const old = oldPosMap.get(label);
    const type = t.type || "observation_interpretation";
    const confidence = t.confidence?.value ?? 0.5;

    return {
      id: i,
      type,
      x: old?.x ?? 100 + Math.random() * (w - 200),
      y: old?.y ?? 80 + Math.random() * (h - 120),
      vx: old?.vx ?? (Math.random() - 0.5) * 0.2,
      vy: old?.vy ?? (Math.random() - 0.5) * 0.2,
      label,
      confidence: Math.round(confidence * 100),
    };
  });

  // Map edges
  graphEdges = (edges || []).slice(-30).map((e, i) => ({
    from: Math.min(e.fromIdx ?? 0, graphNodes.length - 1),
    to: Math.min(e.toIdx ?? i + 1, graphNodes.length - 1),
    type: e.type || "supports",
  }));

  // If no edges from API, create some from goalId relationships
  if (graphEdges.length === 0 && graphNodes.length > 1) {
    for (let i = 1; i < graphNodes.length; i++) {
      if (Math.random() < 0.3) {
        graphEdges.push({
          from: Math.floor(Math.random() * i),
          to: i,
          type: "supports",
        });
      }
    }
  }
}

function initGraphNodes() {
  graphNodes = [];
  graphEdges = [];

  // Start with minimal placeholder, will be replaced by SSE data
  const canvas = document.getElementById("graph-canvas");
  const w = canvas ? canvas.parentElement.clientWidth : 800;
  const h = canvas ? canvas.parentElement.clientHeight : 500;

  for (let i = 0; i < 3; i++) {
    graphNodes.push({
      id: i,
      type: "observation_interpretation",
      x: 100 + Math.random() * (w - 200),
      y: 80 + Math.random() * (h - 120),
      vx: (Math.random() - 0.5) * 0.15,
      vy: (Math.random() - 0.5) * 0.15,
      label: "Waiting for data...",
      confidence: 50,
    });
  }
}

const edgeColors = {
  supports: "rgba(73, 227, 138, 0.3)",
  contradicts: "rgba(255, 107, 107, 0.3)",
  extends: "rgba(85, 214, 255, 0.3)",
  alternative: "rgba(255, 200, 87, 0.3)",
  follows: "rgba(167, 139, 250, 0.3)",
};

function animateGraph() {
  if (!graphActive) return;

  const canvas = document.getElementById("graph-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  canvas.width = canvas.parentElement.clientWidth;
  canvas.height = canvas.parentElement.clientHeight;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Update positions (gentle drift)
  graphNodes.forEach((n) => {
    n.x += n.vx;
    n.y += n.vy;
    if (n.x < 30 || n.x > canvas.width - 30) n.vx *= -1;
    if (n.y < 30 || n.y > canvas.height - 30) n.vy *= -1;
  });

  // Draw edges
  graphEdges.forEach((e) => {
    const from = graphNodes[e.from];
    const to = graphNodes[e.to];
    if (!from || !to) return;
    ctx.strokeStyle = edgeColors[e.type] || "rgba(85, 214, 255, 0.2)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  });

  // Draw nodes
  graphNodes.forEach((n) => {
    const style =
      graphThoughtTypes[n.type] || graphThoughtTypes.observation_interpretation;

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

    // Confidence ring
    ctx.globalAlpha = 0.4;
    ctx.strokeStyle = style.color;
    ctx.lineWidth = 1.5;
    const arcLen = (n.confidence / 100) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(n.x, n.y, style.radius + 3, -Math.PI / 2, -Math.PI / 2 + arcLen);
    ctx.stroke();

    // Label
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = "#F5F7FA";
    ctx.font = "9px Inter, sans-serif";
    ctx.textAlign = "center";
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

  // Subscribe to SSE thought updates
  graphUpdateTimer = setInterval(() => {
    fetch("http://localhost:3141/state")
      .then((r) => r.json())
      .then((data) => {
        const thoughts =
          data?.recentThoughts || data?.pipelineResult?.thoughts || [];
        const edges = data?.pipelineResult?.edges || [];
        if (thoughts.length > 0) {
          updateGraphFromData(thoughts, edges);
        }
      })
      .catch(() => {});
  }, 3000);
}

export function stopGraph() {
  graphActive = false;
  if (graphAnimFrame) cancelAnimationFrame(graphAnimFrame);
  if (graphUpdateTimer) {
    clearInterval(graphUpdateTimer);
    graphUpdateTimer = null;
  }
}
