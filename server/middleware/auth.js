const jwt = require('jsonwebtoken');

module.exports = function auth(req, res, next) {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    return res.status(500).json({ error: 'Server authentication is not configured' });
  }

  const authHeader = req.headers.authorization || '';
  const parts = authHeader.split(' ');

  if (parts.length !== 2 || parts[0] !== 'Bearer' || !parts[1]) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const decoded = jwt.verify(parts[1], process.env.JWT_SECRET);
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      display_name: decoded.display_name
    };
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
};
