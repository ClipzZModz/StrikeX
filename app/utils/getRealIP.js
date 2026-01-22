function getRealIP(req, res, next) {
    let realIP = null;
  
    // Check for IP in headers added by reverse proxies like Nginx
    if (req.headers['x-forwarded-for']) {
        realIP = req.headers['x-forwarded-for'].split(',')[0].trim();
    } else if (req.headers['x-real-ip']) {
        realIP = req.headers['x-real-ip'];
    } else {
        realIP = req.socket.remoteAddress || req.connection.remoteAddress;
    }
  
    if (realIP && realIP.startsWith('::ffff:')) {
        realIP = realIP.replace('::ffff:', '');
    }
  
    if (realIP && realIP.startsWith('::1')) {
        realIP = realIP.replace('::1', '127.0.0.1');
    }
  
    req.realIP = realIP; // Attach IP to the request object
    next();
  }

module.exports = getRealIP;