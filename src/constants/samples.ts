import { SampleImage } from '../types';

/**
 * Creates high-detail procedural retro scenes rendered to data URLs
 */
function createCyberpunkSkyline(): string {
  const c = document.createElement('canvas');
  c.width = 640;
  c.height = 400;
  const ctx = c.getContext('2d')!;

  // Sunset sky gradient
  const sky = ctx.createLinearGradient(0, 0, 0, 400);
  sky.addColorStop(0, '#0d0221');
  sky.addColorStop(0.3, '#241734');
  sky.addColorStop(0.6, '#721c5b');
  sky.addColorStop(0.85, '#cc3b5c');
  sky.addColorStop(1, '#ffaa40');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 640, 400);

  // Big retro neon sun
  const sunX = 320;
  const sunY = 240;
  const sunRadius = 90;
  const sunGrad = ctx.createLinearGradient(0, sunY - sunRadius, 0, sunY + sunRadius);
  sunGrad.addColorStop(0, '#ffff55');
  sunGrad.addColorStop(1, '#ff3366');
  ctx.fillStyle = sunGrad;
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunRadius, 0, Math.PI * 2);
  ctx.fill();

  // Sun horizontal scanline slats
  ctx.fillStyle = '#241734';
  for (let i = 0; i < 7; i++) {
    const y = sunY - 10 + i * 14;
    const h = 2 + i * 1.5;
    ctx.fillRect(sunX - sunRadius - 10, y, (sunRadius + 10) * 2, h);
  }

  // Distant mountain silhouette
  ctx.fillStyle = '#1c0c2e';
  ctx.beginPath();
  ctx.moveTo(0, 270);
  ctx.lineTo(120, 210);
  ctx.lineTo(240, 260);
  ctx.lineTo(380, 195);
  ctx.lineTo(500, 255);
  ctx.lineTo(640, 220);
  ctx.lineTo(640, 400);
  ctx.lineTo(0, 400);
  ctx.closePath();
  ctx.fill();

  // City Skyline buildings
  const buildings = [
    { x: 10, w: 50, h: 140 },
    { x: 65, w: 40, h: 180 },
    { x: 110, w: 70, h: 130 },
    { x: 190, w: 55, h: 210 },
    { x: 250, w: 45, h: 160 },
    { x: 300, w: 60, h: 230 },
    { x: 365, w: 50, h: 170 },
    { x: 420, w: 75, h: 200 },
    { x: 500, w: 40, h: 150 },
    { x: 545, w: 60, h: 190 },
    { x: 610, w: 30, h: 120 },
  ];

  ctx.fillStyle = '#06010d';
  buildings.forEach((b) => {
    ctx.fillRect(b.x, 400 - b.h, b.w, b.h);
    // Windows
    ctx.fillStyle = '#00ffff';
    for (let wy = 400 - b.h + 15; wy < 380; wy += 14) {
      for (let wx = b.x + 8; wx < b.x + b.w - 8; wx += 10) {
        if (Math.sin(wx * 7 + wy * 3) > -0.2) {
          ctx.fillStyle = Math.random() > 0.4 ? '#55ffff' : '#ff55ff';
          ctx.fillRect(wx, wy, 4, 6);
        }
      }
    }
    ctx.fillStyle = '#06010d';
  });

  // Perspective 3D Neon Grid at the bottom
  ctx.strokeStyle = '#00ffff';
  ctx.lineWidth = 2;
  const horizonY = 320;
  // Transversal lines
  for (let z = 1; z <= 10; z++) {
    const y = horizonY + Math.pow(z / 10, 2) * 80;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(640, y);
    ctx.stroke();
  }
  // Longitudinal lines
  for (let x = -200; x <= 840; x += 60) {
    ctx.beginPath();
    ctx.moveTo(x, 400);
    ctx.lineTo(320 + (x - 320) * 0.1, horizonY);
    ctx.stroke();
  }

  return c.toDataURL('image/png');
}

function createAstronautOrbit(): string {
  const c = document.createElement('canvas');
  c.width = 640;
  c.height = 400;
  const ctx = c.getContext('2d')!;

  // Deep space with stars
  ctx.fillStyle = '#04020a';
  ctx.fillRect(0, 0, 640, 400);

  // Random stars
  for (let i = 0; i < 160; i++) {
    const sx = (Math.sin(i * 991) * 0.5 + 0.5) * 640;
    const sy = (Math.cos(i * 443) * 0.5 + 0.5) * 400;
    const sr = (i % 5 === 0) ? 2 : 1;
    ctx.fillStyle = i % 3 === 0 ? '#55ffff' : i % 7 === 0 ? '#ff55ff' : '#ffffff';
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fill();
  }

  // Giant Earth curvature in corner
  const earthGrad = ctx.createRadialGradient(80, 520, 50, 80, 520, 360);
  earthGrad.addColorStop(0, '#ffffff');
  earthGrad.addColorStop(0.3, '#38bdf8');
  earthGrad.addColorStop(0.7, '#1e3a8a');
  earthGrad.addColorStop(0.95, '#0c1b40');
  earthGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = earthGrad;
  ctx.beginPath();
  ctx.arc(80, 520, 360, 0, Math.PI * 2);
  ctx.fill();

  // Astronaut helmet & suit silhouette with light glint
  ctx.save();
  ctx.translate(380, 180);

  // Torso
  ctx.fillStyle = '#e2e8f0';
  ctx.beginPath();
  ctx.roundRect(-80, 30, 160, 160, [20, 20, 0, 0]);
  ctx.fill();

  // Chest pack
  ctx.fillStyle = '#94a3b8';
  ctx.fillRect(-50, 60, 100, 90);
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(-35, 75, 20, 12);
  ctx.fillStyle = '#3b82f6';
  ctx.fillRect(-5, 75, 20, 12);
  ctx.fillStyle = '#10b981';
  ctx.fillRect(25, 75, 15, 12);

  // Helmet outer ring
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.arc(0, -20, 75, 0, Math.PI * 2);
  ctx.fill();

  // Visor (Gold / Cyan reflective mirror)
  const visorGrad = ctx.createLinearGradient(-50, -60, 50, 20);
  visorGrad.addColorStop(0, '#facc15');
  visorGrad.addColorStop(0.5, '#06b6d4');
  visorGrad.addColorStop(1, '#0f172a');
  ctx.fillStyle = visorGrad;
  ctx.beginPath();
  ctx.ellipse(0, -20, 55, 45, 0, 0, Math.PI * 2);
  ctx.fill();

  // Visor reflection glint
  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.beginPath();
  ctx.ellipse(-20, -35, 18, 9, -Math.PI / 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
  return c.toDataURL('image/png');
}

function createCgaTestPattern(): string {
  const c = document.createElement('canvas');
  c.width = 640;
  c.height = 400;
  const ctx = c.getContext('2d')!;

  ctx.fillStyle = '#18181b';
  ctx.fillRect(0, 0, 640, 400);

  // Title banner
  ctx.fillStyle = '#27272a';
  ctx.fillRect(20, 20, 600, 40);
  ctx.font = 'bold 20px monospace';
  ctx.fillStyle = '#55ffff';
  ctx.fillText('IBM PC CGA CALIBRATION TEST PATTERN (320x200 2-BIT)', 35, 46);

  // Continuous grayscale gradient bar
  const grad = ctx.createLinearGradient(20, 0, 620, 0);
  grad.addColorStop(0, '#000000');
  grad.addColorStop(0.25, '#555555');
  grad.addColorStop(0.5, '#aaaaaa');
  grad.addColorStop(0.75, '#cccccc');
  grad.addColorStop(1, '#ffffff');
  ctx.fillStyle = grad;
  ctx.fillRect(20, 75, 600, 35);

  // RGB and CMY color bars
  const colors = [
    '#ff0000',
    '#00ff00',
    '#0000ff',
    '#00ffff',
    '#ff00ff',
    '#ffff00',
    '#ffffff',
    '#000000',
  ];
  const barW = 600 / colors.length;
  colors.forEach((col, idx) => {
    ctx.fillStyle = col;
    ctx.fillRect(20 + idx * barW, 120, barW, 40);
  });

  // Spheres with smooth radial lighting
  const spheres = [
    { x: 100, y: 240, r: 55, c1: '#ffffff', c2: '#000000' },
    { x: 250, y: 240, r: 55, c1: '#55ffff', c2: '#003344' },
    { x: 390, y: 240, r: 55, c1: '#ff55ff', c2: '#330033' },
    { x: 530, y: 240, r: 55, c1: '#ffff55', c2: '#443300' },
  ];
  spheres.forEach((s) => {
    const radG = ctx.createRadialGradient(
      s.x - s.r * 0.35,
      s.y - s.r * 0.35,
      s.r * 0.1,
      s.x,
      s.y,
      s.r
    );
    radG.addColorStop(0, s.c1);
    radG.addColorStop(1, s.c2);
    ctx.fillStyle = radG;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  });

  // Fine resolution checkerboard & line grids at bottom
  ctx.fillStyle = '#ffffff';
  for (let x = 20; x < 310; x += 4) {
    for (let y = 320; y < 380; y += 4) {
      if ((x + y) % 8 === 0) {
        ctx.fillRect(x, y, 4, 4);
      }
    }
  }

  // Concentric rings
  ctx.strokeStyle = '#55ffff';
  ctx.lineWidth = 2;
  for (let r = 8; r < 50; r += 8) {
    ctx.beginPath();
    ctx.arc(470, 350, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  return c.toDataURL('image/png');
}

export function getSampleImages(): SampleImage[] {
  return [
    {
      id: 'sample_cyberpunk',
      title: 'Neon Skyline & Grid',
      category: 'Retro Synth',
      dataUrl: createCyberpunkSkyline(),
    },
    {
      id: 'sample_astronaut',
      title: 'Astronaut & Orbit',
      category: 'Sci-Fi Space',
      dataUrl: createAstronautOrbit(),
    },
    {
      id: 'sample_testcard',
      title: 'CGA Test & Gradients',
      category: 'Calibration',
      dataUrl: createCgaTestPattern(),
    },
  ];
}
