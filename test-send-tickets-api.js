require('dotenv').config();
const http = require('http');

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/admin/send-tickets',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-admin-key': process.env.ADMIN_SECRET_KEY
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (d) => {
    data += d;
  });
  res.on('end', () => {
    console.log(`Status Code: ${res.statusCode}`);
    try {
      console.log(JSON.parse(data));
    } catch(e) {
      console.log(data);
    }
  });
});

req.on('error', (error) => {
  console.error(error);
});

req.end();
