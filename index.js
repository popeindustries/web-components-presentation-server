'use strict';

const { createServer } = require('http');

const DEFAULT_RETRY = 10000;

const clients = new Set();
const event = 'index';
const port = process.env.PORT || 3000;
let index = 0;

const server = createServer(async (req, res) => {
  if (req.method === 'GET' && req.headers.accept !== 'text/event-stream') {
    res.writeHead(404);
    res.end();
    return;
  }

  let body = '';

  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET,OPTIONS,POST',
      'Access-Control-Allow-Headers':
        'Access-Control-Allow-Headers, Origin,Accept, X-Requested-With, Content-Type, Access-Control-Request-Method, Access-Control-Request-Headers',
    });
    res.end();
    return;
  }

  if (req.method === 'POST') {
    for await (const chunk of req) {
      body += chunk;
    }

    try {
      body = JSON.parse(body);
      if (body === false) {
        console.log('event finished');
        index = 0;
      } else {
        index = body;
        console.log(`got index: ${index}`);
        send();
      }
      res.writeHead(200, {
        'Access-Control-Allow-Origin': '*',
      });
      res.end();
    } catch (err) {
      res.writeHead(500);
      res.end(err);
    }
    return;
  }

  const client = {
    connection: req.connection,
    req,
    res,
  };

  clients.add(client);
  console.log('added client');

  req.socket.setNoDelay(true);
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=UTF-8',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });
  res.write(':ok\n\n');
  // res.write(`event: ${event}\n`);
  res.write(`retry: ${DEFAULT_RETRY}\n`);
  res.write(`data: ${index}\n\n`);

  res.on('close', () => {
    console.log('removing client on close');
    res.removeAllListeners();
    clients.delete(client);
  });
}).listen(port);

server.timeout = server.keepAliveTimeout = 0;
server.on('listening', () => {
  console.log(`listening on ${port}`);
});
server.on('error', (err) => {
  console.error(err);
});

function send() {
  if (clients.size) {
    for (const client of clients) {
      console.log(`sending data to client: ${index}`);
      // client.res.write(`event: ${event}\n`);
      client.res.write(`retry: ${DEFAULT_RETRY}\n`);
      client.res.write(`data: ${index}\n\n`);
    }
  }
}
