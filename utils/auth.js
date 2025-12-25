import jwt from 'jsonwebtoken';
import { queries } from './database.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

// Generate user ID
export function generateUserId(prefix = 'user') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Generate tokens
export function generateTokens(userId) {
  const access_token = jwt.sign(
    { userId, type: 'access' },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );

  const refresh_token = jwt.sign(
    { userId, type: 'refresh' },
    JWT_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  );

  return { access_token, refresh_token };
}

// Verify token
export function verifyToken(token, type = 'access') {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.type !== type) {
      throw new Error('Invalid token type');
    }
    return decoded;
  } catch (error) {
    return null;
  }
}

// Middleware to authenticate requests
export function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: {
        code: 'unauthorized',
        message: 'Missing or invalid Authorization header'
      }
    });
  }

  const token = authHeader.substring(7);
  const decoded = verifyToken(token, 'access');

  if (!decoded) {
    return res.status(401).json({
      error: {
        code: 'unauthorized',
        message: 'Invalid or expired access token'
      }
    });
  }

  req.userId = decoded.userId;
  next();
}

// Check if user is banned
export function checkBanned(req, res, next) {
  try {
    const user = queries.getUserById.get(req.userId);
    
    if (user && user.banned === 1) {
      return res.status(403).json({
        error: {
          code: 'banned',
          message: 'Your account has been banned',
          reason: 'Terms of service violation',
          expires_at: null // or specific date
        }
      });
    }
    
    next();
  } catch (error) {
    console.error('Error checking banned status:', error);
    // On error, allow request to proceed (fail open for availability)
    next();
  }
}

