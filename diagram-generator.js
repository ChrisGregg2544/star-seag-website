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
  let {
    subtype = 'scalene',
    sideA, sideB, sideC,
    angleA, angleB, angleC,
    angles = [],
    unknownAngle = false,
  } = opts;

  // Map angles array [a, b] or [a, b, c] to individual labels — only show what's given
  if (angles.length >= 1) angleA = angles[0] != null ? `${angles[0]}°` : undefined;
  if (angles.length >= 2) angleB = angles[1] != null ? `${angles[1]}°` : undefined;
  if (angles.length >= 3) angleC = angles[2] != null ? `${angles[2]}°` : undefined;
  if (angles.length >= 1 && !opts.subtype) {
    if (Number(angles[0]) === 90 || Number(angles[1]) === 90) subtype = 'right-angled';
    else if (Number(angles[0]) === Number(angles[1])) subtype = 'isosceles';
  }

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
  const { subtype = 'rectangle', length = '', width = '', height = '', side = '', sideLabel = '' } = opts;
  const cx = W / 2, cy = H / 2;
  let content = '';

  switch (subtype) {
    case 'square': {
      const s = 100;
      const lbl = side || width || length || sideLabel;
      content = `<rect x="${cx-s/2}" y="${cy-s/2}" width="${s}" height="${s}" fill="${FILL}" stroke="${BLUE}" stroke-width="2.5"/>`;
      if (lbl) {
        content += `<text x="${cx}" y="${cy-s/2-10}" text-anchor="middle" fill="${PURPLE}" font-size="13" font-weight="bold">${lbl}</text>`;
        content += `<text x="${cx+s/2+16}" y="${cy+5}" text-anchor="start" fill="${PURPLE}" font-size="13" font-weight="bold">${lbl}</text>`;
      }
      break;
    }
    case 'rectangle': {
      const rw = 170, rh = 80;
      // length → top label; width → right label when length present (old: width → top, height → right)
      const topLabel   = length || width;
      const rightLabel = length ? (width || height) : height;
      content = `<rect x="${cx-rw/2}" y="${cy-rh/2}" width="${rw}" height="${rh}" fill="${FILL}" stroke="${BLUE}" stroke-width="2.5"/>`;
      if (topLabel)   content += `<text x="${cx}" y="${cy-rh/2-10}" text-anchor="middle" fill="${PURPLE}" font-size="13" font-weight="bold">${topLabel}</text>`;
      if (rightLabel) content += `<text x="${cx+rw/2+16}" y="${cy+5}" text-anchor="start" fill="${PURPLE}" font-size="13" font-weight="bold">${rightLabel}</text>`;
      break;
    }
    case 'parallelogram': {
      const pw = 160, ph = 70, sl = 28;
      const pts = `${cx-pw/2+sl},${cy-ph/2} ${cx+pw/2+sl},${cy-ph/2} ${cx+pw/2-sl},${cy+ph/2} ${cx-pw/2-sl},${cy+ph/2}`;
      content = `<polygon points="${pts}" fill="${FILL}" stroke="${BLUE}" stroke-width="2.5"/>`;
      if (width)  content += `<text x="${cx}" y="${cy-ph/2-10}" text-anchor="middle" fill="${PURPLE}" font-size="13" font-weight="bold">${width}</text>`;
      if (height) content += `<text x="${cx+pw/2+sl+14}" y="${cy+5}" text-anchor="start" fill="${PURPLE}" font-size="13" font-weight="bold">${height}</text>`;
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
      if (width) content += `<text x="${cx}" y="${cy-th/2-10}" text-anchor="middle" fill="${PURPLE}" font-size="13" font-weight="bold">${width}</text>`;
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

  if (type === 'measuring-jug') {
    const maxV = highlight !== undefined && highlight <= 500 ? 500 : 1000;
    const interval = maxV === 500 ? 100 : 200;

    // Jug body geometry
    const jugL = 100, jugTop = 15, jugH = 150, jugW = 60;
    const jugR = jugL + jugW;
    const toY = v => r2(jugTop + jugH - (v / maxV) * jugH);

    // Water fill
    const fillY = highlight !== undefined ? toY(highlight) : jugTop + jugH;
    const fillH = r2(jugTop + jugH - fillY);
    const waterEl = fillH > 0
      ? `<rect x="${jugL + 2}" y="${fillY}" width="${jugW - 4}" height="${fillH}" fill="#BFDBFE" opacity="0.8"/>`
      : '';

    // Scale tick marks (right side of jug)
    let ticks = '';
    for (let v = 0; v <= maxV; v += interval) {
      const ty = toY(v);
      const isMajor = v % interval === 0;
      ticks += `<line x1="${jugR}" y1="${ty}" x2="${jugR + (isMajor ? 10 : 6)}" y2="${ty}" stroke="${GREY}" stroke-width="${isMajor ? 1.5 : 1}"/>`;
      if (isMajor) {
        ticks += `<text x="${jugR + 14}" y="${ty + 4}" fill="${GREY}" font-size="9" dominant-baseline="middle">${v}</text>`;
      }
    }

    // Minor ticks every 50ml
    const minorInterval = maxV === 500 ? 50 : 100;
    for (let v = 0; v <= maxV; v += minorInterval) {
      if (v % interval === 0) continue;
      const ty = toY(v);
      ticks += `<line x1="${jugR}" y1="${ty}" x2="${jugR + 6}" y2="${ty}" stroke="${GREY}" stroke-width="0.8"/>`;
    }

    // Highlight arrow + label
    const highlightEl = highlight !== undefined
      ? `<line x1="${jugL - 2}" y1="${toY(highlight)}" x2="${jugL - 12}" y2="${toY(highlight)}" stroke="${PURPLE}" stroke-width="1.5"/>
<text x="${jugL - 16}" y="${toY(highlight) + 4}" text-anchor="end" fill="${PURPLE}" font-size="11" font-weight="bold">${highlight} ml</text>`
      : '';

    // Spout (small rectangle top-right)
    const spoutEl = `<rect x="${jugR}" y="${jugTop}" width="10" height="18" rx="3" fill="#f1f5f9" stroke="${GREY}" stroke-width="1.2"/>`;

    // Handle (arc on left)
    const hMidY = r2(jugTop + jugH * 0.55);
    const handleEl = `<path d="M${jugL} ${jugTop + 30} Q${jugL - 22} ${hMidY} ${jugL} ${jugTop + 90}" fill="none" stroke="${GREY}" stroke-width="2"/>`;

    return wrap(`
${waterEl}
<rect x="${jugL}" y="${jugTop}" width="${jugW}" height="${jugH}" fill="none" stroke="${BLUE}" stroke-width="2" rx="3"/>
${spoutEl}
${handleEl}
${ticks}
${highlightEl}`);
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

// ── coordinate-grid ───────────────────────────────────────────────────────────

function coordinateGrid(opts = {}) {
  const { points = [] } = opts;
  const left = 30, right = 268, top = 10, bottom = 163;
  const n = 10;
  const dx = (right - left) / n;
  const dy = (bottom - top) / n;

  let content = '';

  // Grid lines + axis labels
  for (let i = 0; i <= n; i++) {
    const gx = r2(left + i * dx);
    const gy = r2(bottom - i * dy);
    // Vertical grid line
    content += `<line x1="${gx}" y1="${top}" x2="${gx}" y2="${bottom}" stroke="${i === 0 ? BLUE : '#e5e7eb'}" stroke-width="${i === 0 ? 1.5 : 0.7}"/>`;
    // Horizontal grid line
    content += `<line x1="${left}" y1="${gy}" x2="${right}" y2="${gy}" stroke="${i === 0 ? BLUE : '#e5e7eb'}" stroke-width="${i === 0 ? 1.5 : 0.7}"/>`;
    if (i > 0) {
      content += `<text x="${gx}" y="${bottom + 12}" text-anchor="middle" fill="${GREY}" font-size="9">${i}</text>`;
      content += `<text x="${left - 4}" y="${r2(gy + 3)}" text-anchor="end" fill="${GREY}" font-size="9">${i}</text>`;
    }
  }
  content += `<text x="${left - 4}" y="${bottom + 12}" text-anchor="end" fill="${GREY}" font-size="9">0</text>`;

  // Axis labels
  content += `<text x="${r2((left + right) / 2)}" y="${H - 2}" text-anchor="middle" fill="${GREY}" font-size="9">x</text>`;
  content += `<text x="8" y="${r2((top + bottom) / 2)}" text-anchor="middle" fill="${GREY}" font-size="9" transform="rotate(-90,8,${r2((top + bottom) / 2)})">y</text>`;

  // Axis arrows
  content += `<polygon points="${right},${bottom} ${right - 7},${bottom - 4} ${right - 7},${bottom + 4}" fill="${BLUE}"/>`;
  content += `<polygon points="${left},${top} ${left - 4},${top + 7} ${left + 4},${top + 7}" fill="${BLUE}"/>`;

  // Plot points
  for (const p of points) {
    if (p.x < 0 || p.x > 10 || p.y < 0 || p.y > 10) continue;
    const px = r2(left + p.x * dx);
    const py = r2(bottom - p.y * dy);
    content += `<circle cx="${px}" cy="${py}" r="5" fill="${BLUE}" opacity="0.9"/>`;
    content += `<text x="${px + 7}" y="${py - 4}" fill="${PURPLE}" font-size="10" font-weight="bold">(${p.x},${p.y})</text>`;
  }

  return wrap(content);
}

// ── cuboid ────────────────────────────────────────────────────────────────────

function cuboid(opts = {}) {
  const { width = '', height = '', depth = '' } = opts;
  const PINK = '#DB2777';

  // Front face anchor and dimensions
  const fx = 60, fy = 40, fw = 120, fh = 90;
  // Isometric offset for top/side faces (depth projection)
  const ox = 50, oy = 25;

  // Key points
  // Front face: A(top-left), B(top-right), C(bottom-right), D(bottom-left)
  const A = [fx,      fy];
  const B = [fx + fw, fy];
  const C = [fx + fw, fy + fh];
  const D = [fx,      fy + fh];
  // Back-top edge (offset by projection vector)
  const E = [A[0] + ox, A[1] - oy];  // back-top-left
  const F = [B[0] + ox, B[1] - oy];  // back-top-right
  const G = [C[0] + ox, C[1] - oy];  // back-bottom-right

  const pt = (p) => `${r2(p[0])},${r2(p[1])}`;

  // Top face (parallelogram A-B-F-E)
  const topFace = `<polygon points="${pt(A)} ${pt(B)} ${pt(F)} ${pt(E)}" fill="#D1FAE5" stroke="${BLUE}" stroke-width="2"/>`;
  // Right face (parallelogram B-C-G-F)
  const rightFace = `<polygon points="${pt(B)} ${pt(C)} ${pt(G)} ${pt(F)}" fill="#DBEAFE" stroke="${BLUE}" stroke-width="2"/>`;
  // Front face
  const frontFace = `<rect x="${fx}" y="${fy}" width="${fw}" height="${fh}" fill="${FILL}" stroke="${BLUE}" stroke-width="2.5"/>`;

  // Hidden edges (dashed): back-left vertical, back-bottom-left horizontal, back-left-to-E
  const hiddenEdges = [
    // left vertical back edge: E down to D+offset
    `<line x1="${pt(E).split(',')[0]}" y1="${pt(E).split(',')[1]}" x2="${r2(D[0]+ox)}" y2="${r2(D[1]-oy)}" stroke="${GREY}" stroke-width="1.2" stroke-dasharray="4,3"/>`,
    // bottom back horizontal: D+offset to G
    `<line x1="${r2(D[0]+ox)}" y1="${r2(D[1]-oy)}" x2="${pt(G).split(',')[0]}" y2="${pt(G).split(',')[1]}" stroke="${GREY}" stroke-width="1.2" stroke-dasharray="4,3"/>`,
    // bottom back left to D
    `<line x1="${r2(D[0]+ox)}" y1="${r2(D[1]-oy)}" x2="${pt(D).split(',')[0]}" y2="${pt(D).split(',')[1]}" stroke="${GREY}" stroke-width="1.2" stroke-dasharray="4,3"/>`,
  ].join('');

  // Dimension labels
  let labels = '';
  // width: below front face, centred
  if (width) labels += `<text x="${r2(fx + fw/2)}" y="${r2(fy + fh + 16)}" text-anchor="middle" fill="${PINK}" font-size="12" font-weight="bold">${width}</text>`;
  // height: left of front face, centred vertically
  if (height) labels += `<text x="${r2(fx - 10)}" y="${r2(fy + fh/2 + 4)}" text-anchor="end" fill="${PINK}" font-size="12" font-weight="bold">${height}</text>`;
  // depth: above and to the right of the top face's far-right corner (point F)
  if (depth) {
    labels += `<text x="${r2(F[0] + 8)}" y="${r2(F[1] - 8)}" text-anchor="start" fill="${PINK}" font-size="12" font-weight="bold">${depth}</text>`;
  }

  return wrap(topFace + rightFace + frontFace + hiddenEdges + labels);
}

// ── pie-chart ─────────────────────────────────────────────────────────────────

const PIE_COLORS = ['#2563EB', '#7C3AED', '#DB2777', '#059669', '#D97706'];

function pieChart(opts = {}) {
  const { data = [] } = opts;
  if (!data.length) return null;

  const cx = 118, cy = 82, radius = 65;
  const legendLeft = 198, legendTop = 28, legendRowH = 22;

  // Calculate proportions
  const total = data.reduce((s, d) => s + (d.value || 0), 0);
  if (total === 0) return null;

  let slices = '';
  let legend = '';
  let startAngle = -Math.PI / 2;  // start at 12 o'clock

  data.forEach((seg, i) => {
    const color = seg.color || PIE_COLORS[i % PIE_COLORS.length];
    const frac  = seg.value / total;
    const sweep = frac * 2 * Math.PI;
    const endAngle = startAngle + sweep;

    const x1 = r2(cx + radius * Math.cos(startAngle));
    const y1 = r2(cy + radius * Math.sin(startAngle));
    const x2 = r2(cx + radius * Math.cos(endAngle));
    const y2 = r2(cy + radius * Math.sin(endAngle));
    const largeArc = sweep > Math.PI ? 1 : 0;

    slices += `<path d="M${cx},${cy} L${x1},${y1} A${radius},${radius} 0 ${largeArc},1 ${x2},${y2} Z" fill="${color}" stroke="white" stroke-width="1.5"/>`;

    // Percentage label inside slice (only if segment wide enough)
    if (frac >= 0.08) {
      const midAngle = startAngle + sweep / 2;
      const lx = r2(cx + radius * 0.62 * Math.cos(midAngle));
      const ly = r2(cy + radius * 0.62 * Math.sin(midAngle));
      const pct = Math.round(frac * 100);
      slices += `<text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="middle" fill="white" font-size="11" font-weight="bold">${pct}%</text>`;
    }

    // Legend row
    const ly2 = legendTop + i * legendRowH;
    const label = (seg.label || '').slice(0, 10);
    legend += `<rect x="${legendLeft}" y="${ly2}" width="12" height="12" fill="${color}" rx="2"/>`;
    legend += `<text x="${legendLeft + 16}" y="${ly2 + 10}" fill="${GREY}" font-size="10">${label}</text>`;

    startAngle = endAngle;
  });

  return wrap(slices + legend);
}

// ── function-machine ─────────────────────────────────────────────────────────

function functionMachine({ rule = '× 3', input = '?', output = '?' } = {}) {
  // Layout: [Input] → [  Rule box  ] → [Output]
  // Centred vertically at y=90. Horizontal flow across 280px.
  const cy = 90;

  // Box dimensions
  const ioW = 52, ioH = 36, ioR = 8;      // input/output boxes
  const ruleW = 96, ruleH = 50, ruleR = 12; // rule box (larger)
  const arrowLen = 22;

  // X positions
  const ioX1 = 8;                                        // input box left
  const arr1X = ioX1 + ioW + 2;                          // arrow 1 start
  const ruleX = arr1X + arrowLen + 2;                    // rule box left
  const arr2X = ruleX + ruleW + 2;                       // arrow 2 start
  const ioX2 = arr2X + arrowLen + 2;                     // output box left

  const ioY  = cy - ioH / 2;
  const ruleY = cy - ruleH / 2;

  // Arrow helper: horizontal arrow from (x1,y) to (x2,y)
  function arrow(x1, x2, y) {
    const hx = x2 - 6;
    return `<line x1="${x1}" y1="${y}" x2="${hx}" y2="${y}" stroke="${BLUE}" stroke-width="2.5"/>
            <polygon points="${x2},${y} ${hx},${y - 5} ${hx},${y + 5}" fill="${BLUE}"/>`;
  }

  // Input box
  const inputFill  = input  === '?' ? '#FFF7ED' : FILL;
  const outputFill = output === '?' ? '#FFF7ED' : FILL;
  const inputStroke  = input  === '?' ? '#F59E0B' : BLUE;
  const outputStroke = output === '?' ? '#F59E0B' : BLUE;

  const inputBox = `
    <rect x="${ioX1}" y="${ioY}" width="${ioW}" height="${ioH}" rx="${ioR}" fill="${inputFill}" stroke="${inputStroke}" stroke-width="2"/>
    <text x="${ioX1 + ioW / 2}" y="${cy + 5}" text-anchor="middle" font-size="15" font-weight="bold" fill="${input === '?' ? '#F59E0B' : PURPLE}">${input}</text>
    <text x="${ioX1 + ioW / 2}" y="${ioY - 6}" text-anchor="middle" font-size="9" fill="${GREY}">INPUT</text>`;

  // Rule box
  const ruleBox = `
    <rect x="${ruleX}" y="${ruleY}" width="${ruleW}" height="${ruleH}" rx="${ruleR}" fill="${FILL}" stroke="${BLUE}" stroke-width="2.5"/>
    <text x="${ruleX + ruleW / 2}" y="${cy + 5}" text-anchor="middle" font-size="13" font-weight="bold" fill="${PURPLE}">${rule}</text>`;

  // Output box
  const outputBox = `
    <rect x="${ioX2}" y="${ioY}" width="${ioW}" height="${ioH}" rx="${ioR}" fill="${outputFill}" stroke="${outputStroke}" stroke-width="2"/>
    <text x="${ioX2 + ioW / 2}" y="${cy + 5}" text-anchor="middle" font-size="15" font-weight="bold" fill="${output === '?' ? '#F59E0B' : PURPLE}">${output}</text>
    <text x="${ioX2 + ioW / 2}" y="${ioY - 6}" text-anchor="middle" font-size="9" fill="${GREY}">OUTPUT</text>`;

  const arr1 = arrow(arr1X, ruleX, cy);
  const arr2 = arrow(arr2X, ioX2, cy);

  return wrap(inputBox + arr1 + ruleBox + arr2 + outputBox);
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
      case 'coordinate-grid':   return coordinateGrid(options);
      case 'cuboid':            return cuboid(options);
      case 'pie-chart':         return pieChart(options);
      case 'function-machine':  return functionMachine(options);
      default:                  return null;
    }
  } catch {
    return null;
  }
}
