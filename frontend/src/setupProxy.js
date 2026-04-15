const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
  app.use(
    ['/api', '/webhook'],
    createProxyMiddleware({
      target: 'http://backend:4000',
      changeOrigin: true,
    })
  );
};
