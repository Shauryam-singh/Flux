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
let lastCanvasWidth = 0;
let lastCanvasHeight = 0;

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

function clampNode(n, w, h) {
  const padding = 40;
  if (n.x < padding) { n.x = padding; n.vx = Math.abs(n.vx) * 0.5; }
  if (n.x > w - padding) { n.x = w - padding; n.vx = -Math.abs(n.vx) * 0.5; }
  if (n.y < padding) { n.y = padding; n.vy = Math.abs(n.vy) * 0.5; }
  if (n.y > h - padding) { n.y = h - padding; n.vy = -Math.abs(n.vy) * 0.5; }
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
    n.x = Math.max(40, Math.min(w - 40, n.x * scaleX));
    n.y = Math.max(40, Math.min(h - 40, n.y * scaleY));
  }
  lastCanvasWidth = w;
  lastCanvasHeight = h;
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

    const node = {
      id: i,
      type,
      x: old?.x ?? 40 + Math.random() * (w - 80),
      y: old?.y ?? 40 + Math.random() * (h - 80),
      vx: old?.vx ?? (Math.random() - 0.5) * 0.15,
      vy: old?.vy ?? (Math.random() - 0.5) * 0.15,
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
  graphNodes = [];
  graphEdges = [];
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
  const gCtx = canvas.getContext("2d");

  const w = canvas.parentElement?.clientWidth || 800;
  const h = canvas.parentElement?.clientHeight || 500;

  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;

  adjustNodePositions(w, h);

  gCtx.clearRect(0, 0, w, h);

  // Draw "no data" message if empty
  if (graphNodes.length === 0) {
    gCtx.globalAlpha = 0.3;
    gCtx.fillStyle = "#F5F7FA";
    gCtx.font = "14px Inter, sans-serif";
    gCtx.textAlign = "center";
    gCtx.fillText("Waiting for thought data...", w / 2, h / 2);
    gCtx.globalAlpha = 1;
    graphAnimFrame = requestAnimationFrame(animateGraph);
    return;
  }

  // Update positions (gentle drift)
  graphNodes.forEach((n) => {
    n.x += n.vx;
    n.y += n.vy;
    clampNode(n, w, h);
  });

  // Draw edges
  gCtx.lineWidth = 1;
  graphEdges.forEach((e) => {
    const from = graphNodes[e.from];
    const to = graphNodes[e.to];
    if (!from || !to) return;
    gCtx.strokeStyle = edgeColors[e.type] || "rgba(85, 214, 255, 0.2)";
    gCtx.beginPath();
    gCtx.moveTo(from.x, from.y);
    gCtx.lineTo(to.x, to.y);
    gCtx.stroke();
  });

  // Draw nodes
  graphNodes.forEach((n) => {
    const style =
      graphThoughtTypes[n.type] || graphThoughtTypes.observation_interpretation;

    // Glow
    gCtx.globalAlpha = 0.15;
    gCtx.fillStyle = style.color;
    gCtx.beginPath();
    gCtx.arc(n.x, n.y, style.radius + 6, 0, Math.PI * 2);
    gCtx.fill();

    // Node
    gCtx.globalAlpha = 0.9;
    gCtx.fillStyle = style.color;
    gCtx.beginPath();
    gCtx.arc(n.x, n.y, style.radius, 0, Math.PI * 2);
    gCtx.fill();

    // Confidence ring
    gCtx.globalAlpha = 0.4;
    gCtx.strokeStyle = style.color;
    gCtx.lineWidth = 1.5;
    const arcLen = (n.confidence / 100) * Math.PI * 2;
    gCtx.beginPath();
    gCtx.arc(n.x, n.y, style.radius + 3, -Math.PI / 2, -Math.PI / 2 + arcLen);
    gCtx.stroke();

    // Label
    gCtx.globalAlpha = 0.6;
    gCtx.fillStyle = "#F5F7FA";
    gCtx.font = "9px Inter, sans-serif";
    gCtx.textAlign = "center";
    gCtx.fillText(n.label, n.x, n.y + style.radius + 12);
  });

  gCtx.globalAlpha = 1;
  graphAnimFrame = requestAnimationFrame(animateGraph);
}

export function startGraph() {
  if (graphActive) return;
  graphActive = true;
  initGraphNodes();
  animateGraph();

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
