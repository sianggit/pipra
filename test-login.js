const http = require('http');

const payload = JSON.stringify({
  username: process.argv[2] || 'admin',
  password: process.argv[3] || 'aSySt_Adm!n2026#w3b'
});

const req = http.request({
  hostname: '172.25.192.11',
  port: 4200,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
}, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log(`STATUS: ${res.statusCode}`);
    console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
    console.log(`BODY: ${body}`);
  });
});

req.on('error', (e) => {
  console.error(`PROBLEM: ${e.message}`);
});

req.write(payload);
req.end();

