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

// ─── Thought Graph Renderer — Real-time from SSE with force layout ───

let graphNodes = [];
let graphEdges = [];
let graphAnimFrame;
let graphActive = false;
let graphUpdateTimer = null;
let lastCanvasWidth = 0;
let lastCanvasHeight = 0;

const graphThoughtTypes = {
  observation_interpretation: { color: "#55D6FF", radius: 12 },
  pattern_recognition: { color: "#7C8BFF", radius: 15 },
  concern: { color: "#FF6B6B", radius: 14 },
  goal_evaluation: { color: "#49E38A", radius: 14 },
  user_intent: { color: "#FFC857", radius: 14 },
  suggestion: { color: "#A78BFA", radius: 12 },
  insight: { color: "#F472B6", radius: 13 },
  prediction: { color: "#38BDF8", radius: 11 },
  reflection: { color: "#FB923C", radius: 11 },
  opportunity: { color: "#34D399", radius: 12 },
};

function clampNode(n, w, h) {
  const padding = 60;
  if (n.x < padding) { n.x = padding; n.vx = Math.abs(n.vx) * 0.3; }
  if (n.x > w - padding) { n.x = w - padding; n.vx = -Math.abs(n.vx) * 0.3; }
  if (n.y < padding) { n.y = padding; n.vy = Math.abs(n.vy) * 0.3; }
  if (n.y > h - padding) { n.y = h - padding; n.vy = -Math.abs(n.vy) * 0.3; }
}

function adjustNodePositions(w, h) {
  if (lastCanvasWidth === 0 || lastCanvasHeight === 0) {
    lastCanvasWidth = w;
    lastCanvasHeight = h;
    return;
  }
  if (lastCanvasWidth === w && lastCanvasHeight === h) return;

  const scaleX = w / lastCanvasWidth;
  const scaleY = h / lastCanvasHeight;
  for (const n of graphNodes) {
    n.x = Math.max(60, Math.min(w - 60, n.x * scaleX));
    n.y = Math.max(60, Math.min(h - 60, n.y * scaleY));
  }
  lastCanvasWidth = w;
  lastCanvasHeight = h;
}

// Simple force-directed layout: repulsion between all nodes, attraction along edges
function applyForces(w, h) {
  const repulsionRadius = 150;
  const repulsionStrength = 0.8;
  const attractionStrength = 0.005;
  const centerGravity = 0.001;
  const damping = 0.85;
  const cx = w / 2;
  const cy = h / 2;

  for (let i = 0; i < graphNodes.length; i++) {
    const a = graphNodes[i];

    // Center gravity — prevents clusters from drifting to edges
    a.vx += (cx - a.x) * centerGravity;
    a.vy += (cy - a.y) * centerGravity;

    // Repulsion from other nodes
    for (let j = i + 1; j < graphNodes.length; j++) {
      const b = graphNodes[j];
      let dx = a.x - b.x;
      let dy = a.y - b.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      if (dist < repulsionRadius) {
        const force = (repulsionStrength * (repulsionRadius - dist)) / repulsionRadius;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.vx += fx;
        a.vy += fy;
        b.vx -= fx;
        b.vy -= fy;
      }
    }
  }

  // Attraction along edges
  for (const e of graphEdges) {
    const from = graphNodes[e.from];
    const to = graphNodes[e.to];
    if (!from || !to) continue;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const force = (dist - 100) * attractionStrength;
    const fx = (dx / dist) * force;
    const fy = (dy / dist) * force;
    from.vx += fx;
    from.vy += fy;
    to.vx -= fx;
    to.vy -= fy;
  }

  // Apply velocity with damping and clamp
  for (const n of graphNodes) {
    n.vx *= damping;
    n.vy *= damping;
    n.x += n.vx;
    n.y += n.vy;
    clampNode(n, w, h);
  }
}

function updateGraphFromData(thoughts, edges) {
  if (!graphActive) return;

  const canvas = document.getElementById("graph-canvas");
  if (!canvas) return;
  const w = canvas.parentElement?.clientWidth || 800;
  const h = canvas.parentElement?.clientHeight || 500;

  adjustNodePositions(w, h);

  const oldPosMap = new Map();
  for (const n of graphNodes) {
    if (n.label !== "...") {
      oldPosMap.set(n.label, { x: n.x, y: n.y, vx: n.vx, vy: n.vy });
    }
  }

  const newNodes = thoughts.slice(-20).map((t, i) => {
    const label = (t.content || "").slice(0, 35);
    const old = oldPosMap.get(label);
    const type = t.type || "observation_interpretation";
    const confidence = t.confidence?.value ?? 0.5;

    // If existing node, keep position; otherwise distribute in a spiral pattern
    let x, y;
    if (old) {
      x = old.x;
      y = old.y;
    } else {
      const angle = i * 2.39996; // golden angle in radians
      const radius = 50 + i * 18;
      x = w / 2 + Math.cos(angle) * Math.min(radius, w / 3);
      y = h / 2 + Math.sin(angle) * Math.min(radius, h / 3);
    }

    const node = {
      id: i,
      type,
      x,
      y,
      vx: old?.vx ?? 0,
      vy: old?.vy ?? 0,
      label,
      confidence: Math.round(confidence * 100),
    };

    clampNode(node, w, h);
    return node;
  });

  graphNodes = newNodes;

  graphEdges = (edges || []).slice(-30).map((e, i) => ({
    from: Math.min(e.fromIdx ?? 0, graphNodes.length - 1),
    to: Math.min(e.toIdx ?? i + 1, graphNodes.length - 1),
    type: e.type || "supports",
  }));
}

function initGraphNodes() {
  if (graphNodes.length === 0) {
    graphNodes = [];
    graphEdges = [];
  }
}

const edgeColors = {
  supports: "rgba(73, 227, 138, 0.6)",
  contradicts: "rgba(255, 107, 107, 0.6)",
  extends: "rgba(85, 214, 255, 0.6)",
  alternative: "rgba(255, 200, 87, 0.6)",
  follows: "rgba(167, 139, 250, 0.6)",
};

function animateGraph() {
  if (!graphActive) return;

  const canvas = document.getElementById("graph-canvas");
  if (!canvas) return;
  const gCtx = canvas.getContext("2d");

  const w = canvas.parentElement?.clientWidth || 800;
  const h = canvas.parentElement?.clientHeight || 500;

  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;

  adjustNodePositions(w, h);

  gCtx.clearRect(0, 0, w, h);

  if (graphNodes.length === 0) {
    gCtx.globalAlpha = 0.4;
    gCtx.fillStyle = "#F5F7FA";
    gCtx.font = "14px Inter, sans-serif";
    gCtx.textAlign = "center";
    gCtx.fillText("Waiting for thought data...", w / 2, h / 2);
    gCtx.globalAlpha = 1;
    graphAnimFrame = requestAnimationFrame(animateGraph);
    return;
  }

  // Apply force-directed layout
  applyForces(w, h);

  // Draw edges with glow
  for (const e of graphEdges) {
    const from = graphNodes[e.from];
    const to = graphNodes[e.to];
    if (!from || !to) continue;

    const color = edgeColors[e.type] || "rgba(85, 214, 255, 0.4)";

    // Edge glow (wider, more transparent)
    gCtx.globalAlpha = 0.15;
    gCtx.strokeStyle = color;
    gCtx.lineWidth = 4;
    gCtx.beginPath();
    gCtx.moveTo(from.x, from.y);
    gCtx.lineTo(to.x, to.y);
    gCtx.stroke();

    // Edge line
    gCtx.globalAlpha = 0.6;
    gCtx.lineWidth = 1.5;
    gCtx.beginPath();
    gCtx.moveTo(from.x, from.y);
    gCtx.lineTo(to.x, to.y);
    gCtx.stroke();
  }

  // Draw nodes
  for (const n of graphNodes) {
    const style = graphThoughtTypes[n.type] || graphThoughtTypes.observation_interpretation;

    // Outer glow
    gCtx.globalAlpha = 0.2;
    gCtx.fillStyle = style.color;
    gCtx.beginPath();
    gCtx.arc(n.x, n.y, style.radius + 8, 0, Math.PI * 2);
    gCtx.fill();

    // Main circle
    gCtx.globalAlpha = 0.95;
    gCtx.fillStyle = style.color;
    gCtx.beginPath();
    gCtx.arc(n.x, n.y, style.radius, 0, Math.PI * 2);
    gCtx.fill();

    // Confidence arc ring
    gCtx.globalAlpha = 0.5;
    gCtx.strokeStyle = "#fff";
    gCtx.lineWidth = 2;
    const arcLen = (n.confidence / 100) * Math.PI * 2;
    gCtx.beginPath();
    gCtx.arc(n.x, n.y, style.radius + 4, -Math.PI / 2, -Math.PI / 2 + arcLen);
    gCtx.stroke();

    // Label with background for readability
    const labelText = n.label;
    if (labelText) {
      gCtx.font = "11px Inter, sans-serif";
      gCtx.textAlign = "center";
      const textWidth = gCtx.measureText(labelText).width;
      const labelY = n.y + style.radius + 16;

      // Background pill
      gCtx.globalAlpha = 0.7;
      gCtx.fillStyle = "rgba(15, 23, 42, 0.8)";
      const pad = 4;
      gCtx.beginPath();
      gCtx.roundRect(n.x - textWidth / 2 - pad, labelY - 10, textWidth + pad * 2, 16, 4);
      gCtx.fill();

      // Text
      gCtx.globalAlpha = 0.9;
      gCtx.fillStyle = "#F5F7FA";
      gCtx.fillText(labelText, n.x, labelY);
    }
  }

  gCtx.globalAlpha = 1;
  graphAnimFrame = requestAnimationFrame(animateGraph);
}

export function startGraph() {
  if (graphActive) {
    resizeGraphCanvas();
    return;
  }
  graphActive = true;
  initGraphNodes();
  setTimeout(() => {
    resizeGraphCanvas();
    animateGraph();
  }, 50);
}

function resizeGraphCanvas() {
  const canvas = document.getElementById("graph-canvas");
  if (!canvas) return;
  const w = canvas.parentElement?.clientWidth || 800;
  const h = canvas.parentElement?.clientHeight || 500;
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  lastCanvasWidth = w;
  lastCanvasHeight = h;
}

export function updateGraphFromThoughts(thoughts) {
  if (!thoughts || thoughts.length === 0) return;
  if (!graphActive) {
    updateGraphFromData(thoughts, []);
    return;
  }
  const edges = [];
  updateGraphFromData(thoughts, edges);
}

export function stopGraph() {
  graphActive = false;
  if (graphAnimFrame) cancelAnimationFrame(graphAnimFrame);
  if (graphUpdateTimer) {
    clearInterval(graphUpdateTimer);
    graphUpdateTimer = null;
  }
}
