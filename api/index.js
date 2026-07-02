const { handler } = require('../dist/main');

module.exports = async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const body = await readBody(req);

  const event = {
    version: '2.0',
    routeKey: '$default',
    rawPath: url.pathname,
    rawQueryString: url.search.slice(1),
    headers: req.headers,
    requestContext: {
      http: {
        method: req.method,
        path: url.pathname,
      },
    },
    body: body || undefined,
    isBase64Encoded: false,
  };

  const response = await handler(event, {}, () => {});

  res.statusCode = response.statusCode;
  for (const [key, value] of Object.entries(response.headers || {})) {
    res.setHeader(key, String(value));
  }
  res.end(response.body ?? '');
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString() || ''));
    req.on('error', reject);
  });
}
