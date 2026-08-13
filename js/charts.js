import { formatXp } from './data.js';

const NS = 'http://www.w3.org/2000/svg';

function node(name, attrs = {}, content) {
  const element = document.createElementNS(NS, name);
  for (const [key, value] of Object.entries(attrs)) {
    if (value != null) element.setAttribute(key, String(value));
  }
  if (content != null) element.textContent = content;
  return element;
}

const text = (value, attrs) => node('text', attrs, value);

const htmlNode = (tag, value) =>
  Object.assign(document.createElement(tag), { textContent: value });

const scale = (value, dMin, dMax, rMin, rMax) =>
  dMax === dMin ? rMin : rMin + ((value - dMin) / (dMax - dMin)) * (rMax - rMin);

function niceTicks(max, count = 4) {
  if (!(max > 0)) return [0];
  const magnitude = 10 ** Math.floor(Math.log10(max / count));
  const normalized = max / count / magnitude;
  const step = (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10) * magnitude;
  const ticks = [];
  for (let value = 0; value <= max + step / 1000; value += step) ticks.push(value);
  return ticks;
}

function barPath(x, y, width, height, radius = 4) {
  const r = Math.max(0, Math.min(radius, width, height / 2));
  return `M${x},${y} H${x + width - r} Q${x + width},${y} ${x + width},${y + r}` +
    ` V${y + height - r} Q${x + width},${y + height} ${x + width - r},${y + height} H${x} Z`;
}

function frame(container, viewBox, title, description) {
  container.replaceChildren();
  container.classList.add('chart-host');
  const svg = node('svg', { viewBox, role: 'img', 'aria-label': title });
  svg.append(node('title', {}, title));
  if (description) svg.append(node('desc', {}, description));
  container.append(svg);
  return svg;
}

function emptyState(container, message) {
  const p = htmlNode('p', message);
  p.className = 'placeholder';
  container.replaceChildren(p);
}

function attachTooltip(container) {
  const tip = document.createElement('div');
  tip.className = 'tooltip';
  tip.hidden = true;
  container.append(tip);

  return {
    show(rows, event) {
      tip.replaceChildren(...rows);
      tip.hidden = false;
      const bounds = container.getBoundingClientRect();
      const x = event.clientX - bounds.left;
      const y = event.clientY - bounds.top;
      const flip = x > bounds.width - tip.offsetWidth - 16;
      tip.style.left = `${flip ? x - tip.offsetWidth - 12 : x + 12}px`;
      tip.style.top = `${Math.max(0, y - tip.offsetHeight - 12)}px`;
    },
    hide() {
      tip.hidden = true;
    },
  };
}

function tipLines(title, ...rows) {
  return [htmlNode('strong', title), ...rows.map((row) => htmlNode('span', row))];
}

export function xpOverTime(container, timeline) {
  if (!timeline.length) {
    emptyState(container, 'No XP transactions to plot.');
    return;
  }

  const W = 800, H = 320;
  const M = { top: 20, right: 84, bottom: 40, left: 76 };
  const plotW = W - M.left - M.right;
  const plotH = H - M.top - M.bottom;

  const total = timeline[timeline.length - 1].total;
  const t0 = timeline[0].date.getTime();
  const t1 = timeline[timeline.length - 1].date.getTime();
  const ticks = niceTicks(total, 6);
  const yMax = Math.max(total, ticks[ticks.length - 1]);

  const px = (date) => scale(date.getTime(), t0, t1, M.left, M.left + plotW);
  const py = (value) => scale(value, 0, yMax, M.top + plotH, M.top);

  const svg = frame(
    container,
    `0 0 ${W} ${H}`,
    'Cumulative XP over time',
    `Total ${formatXp(total)} across ${timeline.length} transactions.`,
  );
  const tooltip = attachTooltip(container);

  for (const value of ticks) {
    const y = py(value);
    svg.append(node('line', { x1: M.left, y1: y, x2: M.left + plotW, y2: y, class: 'c-grid' }));
    svg.append(text(formatXp(value), {
      x: M.left - 12, y: y + 4, class: 'c-axis', 'text-anchor': 'end',
    }));
  }

  const dateFmt = (date) => date.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
  const xTickCount = Math.min(6, timeline.length);
  for (let i = 0; i <= xTickCount; i++) {
    const time = t0 + ((t1 - t0) * i) / xTickCount;
    const anchor = i === 0 ? 'start' : i === xTickCount ? 'end' : 'middle';
    svg.append(text(dateFmt(new Date(time)), {
      x: px(new Date(time)), y: M.top + plotH + 24, class: 'c-axis', 'text-anchor': anchor,
    }));
  }

  const points = timeline.map((point) => [px(point.date), py(point.total)]);
  const line = points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const baseline = M.top + plotH;

  svg.append(node('path', {
    d: `${line} L${points[points.length - 1][0].toFixed(1)},${baseline} L${points[0][0].toFixed(1)},${baseline} Z`,
    class: 'c-area',
  }));
  svg.append(node('path', { d: line, class: 'c-line', pathLength: 1 }));

  const [ex, ey] = points[points.length - 1];
  svg.append(node('circle', { cx: ex, cy: ey, r: 4.5, class: 'c-dot' }));
  svg.append(text(formatXp(total), { x: ex + 12, y: ey + 4, class: 'c-label' }));

  const crosshair = node('line', { class: 'c-crosshair', y1: M.top, y2: baseline, opacity: 0 });
  const marker = node('circle', { r: 5, class: 'c-dot c-dot-hover', opacity: 0 });
  svg.append(crosshair, marker);

  const overlay = node('rect', {
    x: M.left, y: M.top, width: plotW, height: plotH, fill: 'transparent', class: 'c-overlay',
  });
  overlay.addEventListener('pointermove', (event) => {
    const bounds = svg.getBoundingClientRect();
    const svgX = ((event.clientX - bounds.left) / bounds.width) * W;
    let best = 0;
    for (let i = 1; i < points.length; i++) {
      if (Math.abs(points[i][0] - svgX) < Math.abs(points[best][0] - svgX)) best = i;
    }
    const [hx, hy] = points[best];
    const entry = timeline[best];
    crosshair.setAttribute('x1', hx);
    crosshair.setAttribute('x2', hx);
    crosshair.setAttribute('opacity', 1);
    marker.setAttribute('cx', hx);
    marker.setAttribute('cy', hy);
    marker.setAttribute('opacity', 1);
    tooltip.show(
      tipLines(entry.name, `+${formatXp(entry.amount)}`, `${formatXp(entry.total)} total`,
        entry.date.toLocaleDateString()),
      event,
    );
  });
  overlay.addEventListener('pointerleave', () => {
    crosshair.setAttribute('opacity', 0);
    marker.setAttribute('opacity', 0);
    tooltip.hide();
  });
  svg.append(overlay);
}

export function xpByProject(container, projects) {
  if (!projects.length) {
    emptyState(container, 'No project XP to plot.');
    return;
  }

  const rows = projects.slice(0, 10);
  const W = 800;
  const band = 34;
  const M = { top: 8, right: 96, bottom: 8, left: 168 };
  const H = M.top + M.bottom + band * rows.length;
  const plotW = W - M.left - M.right;
  const max = Math.max(...rows.map((row) => row.amount));

  const svg = frame(
    container,
    `0 0 ${W} ${H}`,
    'XP by project',
    rows.map((row) => `${row.name}: ${formatXp(row.amount)}`).join('. '),
  );
  const tooltip = attachTooltip(container);

  rows.forEach((row, index) => {
    const height = Math.min(24, band - 10);
    const y = M.top + index * band + (band - height) / 2;
    const width = Math.max(2, scale(row.amount, 0, max, 0, plotW));
    const group = node('g', { class: 'c-bar-group' });

    group.append(text(truncate(row.name, 22), {
      x: M.left - 14, y: y + height / 2 + 4, class: 'c-axis', 'text-anchor': 'end',
    }));
    group.append(node('path', { d: barPath(M.left, y, width, height), class: 'c-bar' }));
    group.append(text(formatXp(row.amount), {
      x: M.left + width + 10, y: y + height / 2 + 4, class: 'c-label',
    }));

    const hit = node('rect', {
      x: 0, y: M.top + index * band, width: W, height: band, fill: 'transparent',
    });
    hit.addEventListener('pointermove', (event) => {
      tooltip.show(tipLines(row.name, formatXp(row.amount)), event);
    });
    hit.addEventListener('pointerleave', () => tooltip.hide());
    group.append(hit);

    svg.append(group);
  });
}

export function auditRatio(container, audits) {
  const { up, down, ratio } = audits;

  if (up == null && down == null) {
    emptyState(container, 'No audit data available.');
    return;
  }

  const rows = [
    { name: 'Audits done', amount: up ?? 0 },
    { name: 'Audits received', amount: down ?? 0 },
  ];
  const max = Math.max(...rows.map((row) => row.amount));

  if (max <= 0) {
    emptyState(container, 'No audit activity yet.');
    return;
  }

  const W = 800;
  const band = 46;
  const M = { top: 12, right: 96, left: 152 };
  const captionH = 34;
  const H = M.top + band * rows.length + captionH;
  const plotW = W - M.left - M.right;

  const svg = frame(
    container,
    `0 0 ${W} ${H}`,
    'Audit ratio',
    `Done ${formatXp(rows[0].amount)}, received ${formatXp(rows[1].amount)}` +
      (ratio == null ? '.' : `, ratio ${ratio.toFixed(2)}.`),
  );
  const tooltip = attachTooltip(container);

  
  rows.forEach((row, index) => {
    const height = 24;
    const y = M.top + index * band + (band - height) / 2;
    const width = Math.max(2, scale(row.amount, 0, max, 0, plotW));
    const group = node('g', { class: 'c-bar-group' });

    group.append(text(row.name, {
      x: M.left - 14, y: y + height / 2 + 4, class: 'c-axis', 'text-anchor': 'end',
    }));
    group.append(node('path', { d: barPath(M.left, y, width, height), class: 'c-bar' }));
    group.append(text(formatXp(row.amount), {
      x: M.left + width + 10, y: y + height / 2 + 4, class: 'c-label',
    }));

    const hit = node('rect', {
      x: 0, y: M.top + index * band, width: W, height: band, fill: 'transparent',
    });
    hit.addEventListener('pointermove', (event) => {
      tooltip.show(tipLines(row.name, formatXp(row.amount)), event);
    });
    hit.addEventListener('pointerleave', () => tooltip.hide());
    group.append(hit);

    svg.append(group);
  });

  svg.append(text(
    ratio == null ? 'Ratio unavailable' : `Ratio ${ratio.toFixed(2)}`,
    { x: M.left, y: M.top + band * rows.length + 20, class: 'c-label' },
  ));
}

const truncate = (value, max) => (value.length > max ? `${value.slice(0, max - 1)}…` : value);
