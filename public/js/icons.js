// The few icons the interface needs, as SVG shapes on a 24x24 grid. Drawn with
// stroke and no fill so they take the colour of the surrounding text.

const SHAPES = {
  activity: [['path', { d: 'M22 12h-4l-3 9L9 3l-3 9H2' }]],
  dashboard: [
    ['rect', { x: 3, y: 3, width: 7, height: 9, rx: 1 }],
    ['rect', { x: 14, y: 3, width: 7, height: 5, rx: 1 }],
    ['rect', { x: 14, y: 12, width: 7, height: 9, rx: 1 }],
    ['rect', { x: 3, y: 16, width: 7, height: 5, rx: 1 }],
  ],
  alert: [
    ['path', { d: 'M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z' }],
    ['path', { d: 'M12 9v4M12 17h.01' }],
  ],
  server: [
    ['rect', { x: 2, y: 3, width: 20, height: 8, rx: 2 }],
    ['rect', { x: 2, y: 13, width: 20, height: 8, rx: 2 }],
    ['path', { d: 'M6 7h.01M6 17h.01' }],
  ],
  settings: [['path', { d: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6' }]],
  globe: [
    ['circle', { cx: 12, cy: 12, r: 10 }],
    ['path', { d: 'M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z' }],
  ],
  lock: [
    ['rect', { x: 3, y: 11, width: 18, height: 11, rx: 2 }],
    ['path', { d: 'M7 11V7a5 5 0 0 1 10 0v4' }],
  ],
  logout: [['path', { d: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9' }]],
  menu: [['path', { d: 'M3 6h18M3 12h18M3 18h18' }]],
  close: [['path', { d: 'M18 6 6 18M6 6l12 12' }]],
  plus: [['path', { d: 'M12 5v14M5 12h14' }]],
  copy: [
    ['rect', { x: 9, y: 9, width: 13, height: 13, rx: 2 }],
    ['path', { d: 'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1' }],
  ],
  external: [['path', { d: 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3' }]],
  check: [['path', { d: 'M20 6 9 17l-5-5' }]],
  checkCircle: [['path', { d: 'M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4 12 14.01l-3-3' }]],
  xCircle: [['circle', { cx: 12, cy: 12, r: 10 }], ['path', { d: 'm15 9-6 6M9 9l6 6' }]],
  userPlus: [
    ['path', { d: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2' }],
    ['circle', { cx: 9, cy: 7, r: 4 }],
    ['path', { d: 'M19 8v6M22 11h-6' }],
  ],
  trash: [['path', { d: 'M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2' }]],
  pencil: [['path', { d: 'M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z' }]],
  chevronRight: [['path', { d: 'm9 18 6-6-6-6' }]],
  search: [['circle', { cx: 11, cy: 11, r: 8 }], ['path', { d: 'm21 21-4.3-4.3' }]],
};

const SVG_NS = 'http://www.w3.org/2000/svg';

// icon('alert') -> <svg class="icon">. Pass 'sm' or 'lg' for the other sizes.
export function icon(name, size) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', size ? `icon icon-${size}` : 'icon');

  for (const [tag, attributes] of SHAPES[name] ?? []) {
    const shape = document.createElementNS(SVG_NS, tag);
    for (const [key, value] of Object.entries(attributes)) shape.setAttribute(key, value);
    svg.append(shape);
  }
  return svg;
}
