/**
 * diagram-generator.js
 * Generates self-contained inline SVG diagrams for SEAG maths questions.
 * No external dependencies. All SVGs are 280×180px viewBox.
 *
 * Colour palette (matches STAR brand):
 *   BLUE   #2563EB — shape strokes and fill
 *   PURPLE #7C3AED — labels and unknowns
 *   FILL   #EEF4FF — shape fill (light blue)
 *   GREY   #6B7280 — axis labels and ticks
 */

const BLUE   = '#2563EB';
const PURPLE = '#7C3AED';
const FILL   = '#EEF4FF';
const GREY   = '#6B7280';
const W = 280, H = 180;

// ── Helpers ───────────────────────────────────────────────────────────────────

function wrap(content) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><style>text{font-family:Arial,sans-serif;}</style>${content}</svg>`;
}

function r2(n) { return Math.round(n * 100) / 100; }

function polyPts(cx, cy, radius, sides, startAngleDeg = 0) {
  return Array.from({ length: sides }, (_, i) => {
    const a = (startAngleDeg + i * (360 / sides)) * Math.PI / 180;
    return `${r2(cx + radius * Math.cos(a))},${r2(cy + radius * Math.sin(a))}`;
  }).join(' ');
}

// ── triangle ─────────────────────────────────────────────────────────────────

function triangle(opts = {}) {
  const {
    subtype = 'scalene',
    sideA, sideB, sideC,
    angleA, angleB, angleC,
    unknownAngle = false,
  } = opts;

  let pts;
  switch (subtype) {
    case 'equilateral': pts = [[140, 25], [45,  160], [235, 160]]; break;
    case 'isosceles':   pts = [[140, 25], [65,  160], [215, 160]]; break;
    case 'right-angled':pts = [[55,  155], [55,  30], [225, 155]]; break;
    default:            pts = [[50,  155], [155, 25], [240, 155]]; // scalene
  }

  const [p0, p1, p2] = pts;
  const pathD = `M${p0[0]},${p0[1]} L${p1[0]},${p1[1]} L${p2[0]},${p2[1]} Z`;

  let extras = '';

  // Right-angle marker
  if (subtype === 'right-angled') {
    const [rx, ry] = p1;
    extras += `<rect x="${rx}" y="${ry}" width="16" height="16" fill="none" stroke="${BLUE}" stroke-width="1.5"/>`;
  }

  // Side labels (midpoints)
  const mids = [
    [(p1[0]+p2[0])/2, (p1[1]+p2[1])/2],  // opposite p0 (bottom)
    [(p0[0]+p2[0])/2, (p0[1]+p2[1])/2],  // opposite p1 (right)
    [(p0[0]+p1[0])/2, (p0[1]+p1[1])/2],  // opposite p2 (left)
  ];
  const sideLabels = [sideA, sideB, sideC];
  const sideOffsets = [[0, 16], [18, 0], [-24, 0]];
  sideLabels.forEach((lbl, i) => {
    if (lbl) {
      extras += `<text x="${r2(mids[i][0]+sideOffsets[i][0])}" y="${r2(mids[i][1]+sideOffsets[i][1])}" text-anchor="middle" fill="${PURPLE}" font-size="12">${lbl}</text>`;
    }
  });

  // Angle labels near vertices
  const angleOffsets = [[-16, 14], [18, -4], [12, 14]];
  const angleLabels = unknownAngle ? ['a°', angleB, angleC] : [angleA, angleB, angleC];
  angleLabels.forEach((lbl, i) => {
    if (lbl) {
      extras += `<text x="${r2(pts[i][0]+angleOffsets[i][0])}" y="${r2(pts[i][1]+angleOffsets[i][1])}" text-anchor="middle" fill="${PURPLE}" font-size="12" font-weight="bold">${lbl}</text>`;
    }
  });

  return wrap(`<path d="${pathD}" fill="${FILL}" stroke="${BLUE}" stroke-width="2.5" stroke-linejoin="round"/>${extras}`);
}

// ── shape ─────────────────────────────────────────────────────────────────────

function shape(opts = {}) {
  const { subtype = 'rectangle', width = '', height = '' } = opts;
  const cx = W / 2, cy = H / 2;
  let content = '';

  switch (subtype) {
    case 'square': {
      const s = 100;
      content = `<rect x="${cx-s/2}" y="${cy-s/2}" width="${s}" height="${s}" fill="${FILL}" stroke="${BLUE}" stroke-width="2.5"/>`;
      if (width) content += `<text x="${cx}" y="${cy-s/2-8}" text-anchor="middle" fill="${PURPLE}" font-size="12">${width}</text>`;
      break;
    }
    case 'rectangle': {
      const rw = 170, rh = 80;
      content = `<rect x="${cx-rw/2}" y="${cy-rh/2}" width="${rw}" height="${rh}" fill="${FILL}" stroke="${BLUE}" stroke-width="2.5"/>`;
      if (width) content += `<text x="${cx}" y="${cy-rh/2-8}" text-anchor="middle" fill="${PURPLE}" font-size="12">${width}</text>`;
      if (height) content += `<text x="${cx+rw/2+20}" y="${cy+5}" text-anchor="middle" fill="${PURPLE}" font-size="12">${height}</text>`;
      break;
    }
    case 'parallelogram': {
      const pw = 160, ph = 70, sl = 28;
      const pts = `${cx-pw/2+sl},${cy-ph/2} ${cx+pw/2+sl},${cy-ph/2} ${cx+pw/2-sl},${cy+ph/2} ${cx-pw/2-sl},${cy+ph/2}`;
      content = `<polygon points="${pts}" fill="${FILL}" stroke="${BLUE}" stroke-width="2.5"/>`;
      if (width) content += `<text x="${cx}" y="${cy-ph/2-8}" text-anchor="middle" fill="${PURPLE}" font-size="12">${width}</text>`;
      break;
    }
    case 'rhombus': {
      const rx = 80, ry = 68;
      content = `<polygon points="${cx},${cy-ry} ${cx+rx},${cy} ${cx},${cy+ry} ${cx-rx},${cy}" fill="${FILL}" stroke="${BLUE}" stroke-width="2.5"/>`;
      break;
    }
    case 'trapezium': {
      const tw = 110, bw = 190, th = 70;
      const pts = `${cx-tw/2},${cy-th/2} ${cx+tw/2},${cy-th/2} ${cx+bw/2},${cy+th/2} ${cx-bw/2},${cy+th/2}`;
      content = `<polygon points="${pts}" fill="${FILL}" stroke="${BLUE}" stroke-width="2.5"/>`;
      if (width) content += `<text x="${cx}" y="${cy-th/2-8}" text-anchor="middle" fill="${PURPLE}" font-size="12">${width}</text>`;
      break;
    }
    case 'pentagon': {
      const pts = polyPts(cx, cy, 75, 5, -90);
      content = `<polygon points="${pts}" fill="${FILL}" stroke="${BLUE}" stroke-width="2.5"/>`;
      break;
    }
    case 'hexagon': {
      const pts = polyPts(cx, cy, 75, 6, 0);
      content = `<polygon points="${pts}" fill="${FILL}" stroke="${BLUE}" stroke-width="2.5"/>`;
      break;
    }
    case 'octagon': {
      const pts = polyPts(cx, cy, 75, 8, 22.5);
      content = `<polygon points="${pts}" fill="${FILL}" stroke="${BLUE}" stroke-width="2.5"/>`;
      break;
    }
    default: {
      const rw = 170, rh = 80;
      content = `<rect x="${cx-rw/2}" y="${cy-rh/2}" width="${rw}" height="${rh}" fill="${FILL}" stroke="${BLUE}" stroke-width="2.5"/>`;
    }
  }

  return wrap(content);
}

// ── angle ─────────────────────────────────────────────────────────────────────

function angle(opts = {}) {
  const { value = '65°', unknown = false, type = 'single' } = opts;
  const label = unknown ? 'a°' : value;

  if (type === 'straight-line') {
    const oy = 120, lx = 30, rx = 250, mx = 140;
    const rayX = 90, rayY = 45;
    const arcR = 28;
    const angleRad = Math.atan2(oy - rayY, mx - rayX);
    const arcEx = mx + arcR, arcEy = oy;
    const arcSx = r2(mx + arcR * Math.cos(-angleRad));
    const arcSy = r2(oy + arcR * Math.sin(-angleRad));
    return wrap(`
<line x1="${lx}" y1="${oy}" x2="${rx}" y2="${oy}" stroke="${BLUE}" stroke-width="2.5"/>
<line x1="${mx}" y1="${oy}" x2="${rayX}" y2="${rayY}" stroke="${BLUE}" stroke-width="2.5"/>
<path d="M${arcEx},${arcEy} A${arcR},${arcR} 0 0 0 ${arcSx},${arcSy}" fill="none" stroke="${PURPLE}" stroke-width="1.5"/>
<text x="${mx+40}" y="${oy-18}" fill="${PURPLE}" font-size="14" font-weight="bold">${label}</text>
<circle cx="${mx}" cy="${oy}" r="3" fill="${BLUE}"/>
`);
  }

  if (type === 'around-point') {
    const px = W / 2, py = H / 2, len = 70;
    const angles = [0, 75, 145, 215, 285];
    const rays = angles.map(a => {
      const rad = a * Math.PI / 180;
      return `<line x1="${px}" y1="${py}" x2="${r2(px+len*Math.cos(rad))}" y2="${r2(py+len*Math.sin(rad))}" stroke="${BLUE}" stroke-width="2"/>`;
    }).join('');
    return wrap(`${rays}<circle cx="${px}" cy="${py}" r="3" fill="${BLUE}"/>
<text x="${px+32}" y="${py-24}" fill="${PURPLE}" font-size="14" font-weight="bold">${label}</text>`);
  }

  // Single angle — two rays from vertex, arc between them
  const ox = 90, oy = 145, len = 110;
  const deg = 55;
  const rad2 = -deg * Math.PI / 180;
  const x1 = r2(ox + len), y1 = oy;                            // ray 1 (horizontal)
  const x2 = r2(ox + len * Math.cos(rad2));
  const y2 = r2(oy + len * Math.sin(rad2));                     // ray 2 (angled up)
  const arcR = 32;
  const arcEx = r2(ox + arcR), arcEy = oy;
  const arcSx = r2(ox + arcR * Math.cos(rad2));
  const arcSy = r2(oy + arcR * Math.sin(rad2));

  return wrap(`
<line x1="${ox}" y1="${oy}" x2="${x1}" y2="${y1}" stroke="${BLUE}" stroke-width="2.5"/>
<line x1="${ox}" y1="${oy}" x2="${x2}" y2="${y2}" stroke="${BLUE}" stroke-width="2.5"/>
<path d="M${arcEx},${arcEy} A${arcR},${arcR} 0 0,0 ${arcSx},${arcSy}" fill="none" stroke="${PURPLE}" stroke-width="1.8"/>
<circle cx="${ox}" cy="${oy}" r="3" fill="${BLUE}"/>
<text x="${r2(ox+55)}" y="${r2(oy-28)}" fill="${PURPLE}" font-size="15" font-weight="bold">${label}</text>
`);
}

// ── net ───────────────────────────────────────────────────────────────────────

function net(opts = {}) {
  const { subtype = 'cube', sideLabel = '' } = opts;
  // Standard cross-net (T-shape): top, row of 4 left-to-right, bottom
  const u = 38, startX = 86, startY = 14;
  // Positions: [col, row] for each face of the cross
  const faces = [
    [1, 0],  // top
    [0, 1], [1, 1], [2, 1], [3, 1],  // middle row
    [1, 2],  // bottom
  ];
  const rects = faces.map(([c, row]) =>
    `<rect x="${startX + c*u}" y="${startY + row*u}" width="${u}" height="${u}" fill="${FILL}" stroke="${BLUE}" stroke-width="1.8"/>`
  ).join('');
  const labelEl = sideLabel
    ? `<text x="${startX + u/2}" y="${startY - 5}" text-anchor="middle" fill="${PURPLE}" font-size="11">${sideLabel}</text>`
    : '';
  return wrap(rects + labelEl);
}

// ── fraction-grid ─────────────────────────────────────────────────────────────

function fractionGrid(opts = {}) {
  const { rows = 2, cols = 4, shaded = 3, colour = '#BFDBFE' } = opts;
  const margin = 28;
  const gw = W - 2 * margin, gh = H - 2 * margin;
  const cw = gw / cols, ch = gh / rows;
  let cells = '';
  let count = 0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = margin + col * cw, y = margin + row * ch;
      const fill = count < shaded ? colour : 'white';
      cells += `<rect x="${r2(x)}" y="${r2(y)}" width="${r2(cw)}" height="${r2(ch)}" fill="${fill}" stroke="${BLUE}" stroke-width="1.5"/>`;
      count++;
    }
  }
  return wrap(cells);
}

// ── bar-chart ─────────────────────────────────────────────────────────────────

function barChart(opts = {}) {
  const {
    data   = [{ label: 'Mon', value: 4 }, { label: 'Tue', value: 7 }, { label: 'Wed', value: 5 }, { label: 'Thu', value: 3 }],
    yMax   = 10,
    title  = '',
  } = opts;

  const left = 34, bottom = 152, right = 268, top = 20;
  const pw = right - left, ph = bottom - top;
  const n = data.length;
  const slotW = pw / n;
  const bw = slotW * 0.6;

  let axes = `<line x1="${left}" y1="${top}" x2="${left}" y2="${bottom}" stroke="${GREY}" stroke-width="1.5"/>
<line x1="${left}" y1="${bottom}" x2="${right}" y2="${bottom}" stroke="${GREY}" stroke-width="1.5"/>`;

  // Y-axis ticks (5 intervals)
  for (let i = 0; i <= 5; i++) {
    const y = r2(bottom - (i / 5) * ph);
    const val = Math.round((i / 5) * yMax);
    axes += `<line x1="${left - 4}" y1="${y}" x2="${left}" y2="${y}" stroke="${GREY}" stroke-width="1"/>
<text x="${left - 6}" y="${y + 4}" text-anchor="end" fill="${GREY}" font-size="10">${val}</text>`;
  }

  const bars = data.map((d, i) => {
    const x = r2(left + i * slotW + (slotW - bw) / 2);
    const bh = r2((d.value / yMax) * ph);
    const y = r2(bottom - bh);
    return `<rect x="${x}" y="${y}" width="${r2(bw)}" height="${bh}" fill="${BLUE}" opacity="0.85"/>
<text x="${r2(x + bw/2)}" y="${bottom + 13}" text-anchor="middle" fill="${GREY}" font-size="10">${d.label}</text>`;
  }).join('');

  const titleEl = title
    ? `<text x="${W/2}" y="14" text-anchor="middle" fill="${GREY}" font-size="11">${title}</text>`
    : '';

  return wrap(titleEl + axes + bars);
}

// ── line-graph ────────────────────────────────────────────────────────────────

function lineGraph(opts = {}) {
  const {
    data      = [{ x: 1, y: 3 }, { x: 2, y: 6 }, { x: 3, y: 4 }, { x: 4, y: 8 }, { x: 5, y: 5 }],
    xLabel    = '',
    yLabel    = '',
    title     = '',
  } = opts;

  const left = 40, bottom = 150, right = 258, top = 22;
  const pw = right - left, ph = bottom - top;

  const xs = data.map(d => d.x), ys = data.map(d => d.y);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMax = Math.ceil(Math.max(...ys) * 1.15);

  const toX = v => r2(left + ((v - xMin) / (xMax - xMin || 1)) * pw);
  const toY = v => r2(bottom - (v / yMax) * ph);

  let axes = `<line x1="${left}" y1="${top}" x2="${left}" y2="${bottom}" stroke="${GREY}" stroke-width="1.5"/>
<line x1="${left}" y1="${bottom}" x2="${right}" y2="${bottom}" stroke="${GREY}" stroke-width="1.5"/>`;

  // X-axis labels
  data.forEach(d => {
    axes += `<line x1="${toX(d.x)}" y1="${bottom}" x2="${toX(d.x)}" y2="${bottom + 4}" stroke="${GREY}" stroke-width="1"/>
<text x="${toX(d.x)}" y="${bottom + 13}" text-anchor="middle" fill="${GREY}" font-size="10">${d.x}</text>`;
  });

  // Y-axis ticks
  for (let i = 0; i <= 4; i++) {
    const v = Math.round((i / 4) * yMax);
    const y = toY(v);
    axes += `<text x="${left - 4}" y="${y + 4}" text-anchor="end" fill="${GREY}" font-size="10">${v}</text>`;
  }

  const pts = data.map(d => `${toX(d.x)},${toY(d.y)}`).join(' ');
  const dots = data.map(d => `<circle cx="${toX(d.x)}" cy="${toY(d.y)}" r="4" fill="${BLUE}"/>`).join('');
  const line = `<polyline points="${pts}" fill="none" stroke="${BLUE}" stroke-width="2.5"/>`;

  const titleEl = title ? `<text x="${W/2}" y="15" text-anchor="middle" fill="${GREY}" font-size="11">${title}</text>` : '';
  const xLabelEl = xLabel ? `<text x="${W/2}" y="${H - 3}" text-anchor="middle" fill="${GREY}" font-size="10">${xLabel}</text>` : '';
  const yLabelEl = yLabel ? `<text x="10" y="${H/2}" text-anchor="middle" fill="${GREY}" font-size="10" transform="rotate(-90,10,${H/2})">${yLabel}</text>` : '';

  return wrap(titleEl + axes + line + dots + xLabelEl + yLabelEl);
}

// ── pictogram ─────────────────────────────────────────────────────────────────

function pictogram(opts = {}) {
  const {
    data     = [{ label: 'Cats', count: 3 }, { label: 'Dogs', count: 5 }, { label: 'Birds', count: 2 }],
    keyValue = 1,
  } = opts;

  const left = 55, top = 18, symSize = 16, symGap = 4, rowH = 36;
  let rows = '';

  data.forEach((d, i) => {
    const y = top + i * rowH;
    rows += `<text x="${left - 6}" y="${y + symSize - 2}" text-anchor="end" fill="${GREY}" font-size="11">${d.label}</text>`;
    const count = Math.round(d.count / keyValue);
    for (let s = 0; s < count && s < 12; s++) {
      const sx = left + s * (symSize + symGap);
      rows += `<circle cx="${r2(sx + symSize/2)}" cy="${r2(y + symSize/2)}" r="${symSize/2 - 1}" fill="${BLUE}" opacity="0.8"/>`;
    }
  });

  const keyEl = `<text x="${left}" y="${H - 8}" fill="${GREY}" font-size="10">● = ${keyValue}</text>`;
  return wrap(rows + keyEl);
}

// ── number-line ───────────────────────────────────────────────────────────────

function numberLine(opts = {}) {
  const { start = 0, end = 10, interval = 1, mark, missing } = opts;

  const lx = 28, rx = 252, y = H / 2;
  const range = end - start;
  const toX = v => r2(lx + ((v - start) / range) * (rx - lx));

  let ticks = '';
  let v = start;
  while (v <= end + 0.0001) {
    const x = toX(v);
    const isMissing = missing !== undefined && Math.abs(v - missing) < 0.0001;
    const labelColour = isMissing ? PURPLE : GREY;
    const labelText  = isMissing ? '?' : v % 1 === 0 ? v : v.toFixed(1);
    ticks += `<line x1="${x}" y1="${y - 8}" x2="${x}" y2="${y + 8}" stroke="${GREY}" stroke-width="1.5"/>
<text x="${x}" y="${y + 22}" text-anchor="middle" fill="${labelColour}" font-size="11" font-weight="${isMissing ? 'bold' : 'normal'}">${labelText}</text>`;
    v = Math.round((v + interval) * 1000) / 1000;
  }

  let arrow = '';
  if (mark !== undefined) {
    const mx = toX(mark);
    arrow = `<polygon points="${mx},${y-22} ${mx-6},${y-12} ${mx+6},${y-12}" fill="${PURPLE}"/>
<text x="${mx}" y="${y - 28}" text-anchor="middle" fill="${PURPLE}" font-size="12" font-weight="bold">${mark}</text>`;
  }

  return wrap(`
<line x1="${lx}" y1="${y}" x2="${rx}" y2="${y}" stroke="${BLUE}" stroke-width="2.5"/>
<polygon points="${rx},${y} ${rx-8},${y-5} ${rx-8},${y+5}" fill="${BLUE}"/>
${ticks}${arrow}`);
}

// ── measurement-scale ─────────────────────────────────────────────────────────

function measurementScale(opts = {}) {
  const { type = 'ruler', highlight } = opts;

  if (type === 'thermometer') {
    const tx = W / 2, tubeTop = 18, tubeBot = 145, tubeW = 18, bulbR = 14;
    const minV = -10, maxV = 40, range = maxV - minV;
    const toY = v => r2(tubeBot - ((v - minV) / range) * (tubeBot - tubeTop));
    const fillY = highlight !== undefined ? toY(highlight) : tubeBot - 10;
    const fillH = r2(tubeBot - fillY);

    let scale = '';
    for (let t = minV; t <= maxV; t += 10) {
      const ty = toY(t);
      scale += `<line x1="${tx - 18}" y1="${ty}" x2="${tx - 9}" y2="${ty}" stroke="${GREY}" stroke-width="1"/>
<text x="${tx - 22}" y="${ty + 4}" text-anchor="end" fill="${GREY}" font-size="9">${t}°</text>`;
    }

    const arrowEl = highlight !== undefined
      ? `<line x1="${tx + 14}" y1="${fillY}" x2="${tx + 24}" y2="${fillY}" stroke="${PURPLE}" stroke-width="1.5"/>
<text x="${tx + 28}" y="${fillY + 4}" fill="${PURPLE}" font-size="12" font-weight="bold">${highlight}°C</text>`
      : '';

    return wrap(`
<rect x="${tx - tubeW/2}" y="${tubeTop}" width="${tubeW}" height="${tubeBot - tubeTop}" rx="9" fill="#f1f5f9" stroke="${GREY}" stroke-width="1.5"/>
<rect x="${tx - tubeW/2 + 2}" y="${fillY}" width="${tubeW - 4}" height="${fillH}" rx="7" fill="#EF4444"/>
<circle cx="${tx}" cy="${tubeBot}" r="${bulbR}" fill="#EF4444" stroke="${GREY}" stroke-width="1.5"/>
${scale}${arrowEl}`);
  }

  if (type === 'weighing-dial') {
    const cx = W / 2, cy = H / 2 + 22, dialR = 62;
    const startA = 210, endA = -30; // degrees
    const maxV = 1000;
    const toAngle = v => ((startA + (v / maxV) * (endA - startA + 360) % 360)) * Math.PI / 180;

    let marks = '';
    for (let t = 0; t <= maxV; t += 200) {
      const a = toAngle(t);
      const x1 = r2(cx + (dialR - 10) * Math.cos(a)), y1 = r2(cy + (dialR - 10) * Math.sin(a));
      const x2 = r2(cx + dialR * Math.cos(a)), y2 = r2(cy + dialR * Math.sin(a));
      const tx = r2(cx + (dialR - 22) * Math.cos(a)), ty = r2(cy + (dialR - 22) * Math.sin(a));
      marks += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${GREY}" stroke-width="1.5"/>
<text x="${tx}" y="${ty + 4}" text-anchor="middle" fill="${GREY}" font-size="9">${t}</text>`;
    }

    let needle = '';
    if (highlight !== undefined) {
      const na = toAngle(highlight);
      const nx = r2(cx + 50 * Math.cos(na)), ny = r2(cy + 50 * Math.sin(na));
      needle = `<line x1="${cx}" y1="${cy}" x2="${nx}" y2="${ny}" stroke="${PURPLE}" stroke-width="2.5"/>
<circle cx="${cx}" cy="${cy}" r="5" fill="${PURPLE}"/>`;
    }

    return wrap(`<circle cx="${cx}" cy="${cy}" r="${dialR}" fill="white" stroke="${GREY}" stroke-width="1.5"/>${marks}${needle}`);
  }

  // Default: ruler (0–15 cm)
  const ry = H / 2 - 12, lx = 18, rx = 262, rh = 38, maxCm = 15;
  const toX = v => r2(lx + (v / maxCm) * (rx - lx));

  let marks = '';
  for (let cm = 0; cm <= maxCm; cm++) {
    const x = toX(cm);
    marks += `<line x1="${x}" y1="${ry}" x2="${x}" y2="${ry + 20}" stroke="${GREY}" stroke-width="1.2"/>
<text x="${x}" y="${ry - 4}" text-anchor="middle" fill="${GREY}" font-size="9">${cm}</text>`;
    if (cm < maxCm) {
      const hx = toX(cm + 0.5);
      marks += `<line x1="${hx}" y1="${ry}" x2="${hx}" y2="${ry + 10}" stroke="${GREY}" stroke-width="0.8"/>`;
    }
  }

  const arrowEl = highlight !== undefined
    ? `<polygon points="${toX(highlight)},${ry+rh} ${toX(highlight)-5},${ry+rh+10} ${toX(highlight)+5},${ry+rh+10}" fill="${PURPLE}"/>
<text x="${toX(highlight)}" y="${ry+rh+26}" text-anchor="middle" fill="${PURPLE}" font-size="12" font-weight="bold">${highlight} cm</text>`
    : '';

  return wrap(`<rect x="${lx}" y="${ry}" width="${rx - lx}" height="${rh}" fill="#FEF9C3" stroke="${GREY}" stroke-width="1.5" rx="3"/>
${marks}${arrowEl}`);
}

// ── Main export ───────────────────────────────────────────────────────────────

export function generateDiagram(type, options = {}) {
  try {
    switch (type) {
      case 'triangle':          return triangle(options);
      case 'shape':             return shape(options);
      case 'angle':             return angle(options);
      case 'net':               return net(options);
      case 'fraction-grid':     return fractionGrid(options);
      case 'bar-chart':         return barChart(options);
      case 'line-graph':        return lineGraph(options);
      case 'pictogram':         return pictogram(options);
      case 'number-line':       return numberLine(options);
      case 'measurement-scale': return measurementScale(options);
      default:                  return null;
    }
  } catch {
    return null;
  }
}
