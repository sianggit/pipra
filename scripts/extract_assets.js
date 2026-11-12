const fs = require('fs');
const path = require('path');

const mockupPath = path.join('.reference', 'docs', 'modules', 'ui-portal', 'mockup', 'Pipra — Redesigned control plane.html');
const html = fs.readFileSync(mockupPath, 'utf8');

const symMatch = html.match(/const SYM="data:image\/png;base64,([^"]+)"/);
const wmMatch = html.match(/WM="data:image\/png;base64,([^"]+)"/);

if (!symMatch || !wmMatch) {
  console.error('Failed to find SYM or WM');
  process.exit(1);
}

fs.writeFileSync('public/assets/pipra-bird.png', Buffer.from(symMatch[1], 'base64'));
fs.writeFileSync('public/assets/pipra-wordmark.png', Buffer.from(wmMatch[1], 'base64'));
console.log('SUCCESS: Extracted assets');

