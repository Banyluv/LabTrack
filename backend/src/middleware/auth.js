const jwt = require('jsonwebtoken');

const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};

const adminOnly = (req, res, next) => {
  const role = (req.user.role || '').toLowerCase();
  if (role !== 'admin' && role !== 'super_admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

module.exports = { auth, adminOnly };
