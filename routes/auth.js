import express from 'express';
import { generateUserId, generateTokens, verifyToken } from '../utils/auth.js';
import { queries } from '../utils/database.js';

const router = express.Router();

// POST /v1/auth/guest - Create guest session
router.post('/guest', (req, res) => {
  try {
    const user_id = generateUserId('guest');
    const tokens = generateTokens(user_id);

    queries.createUser.run(user_id, null, null, 'guest');

    console.log(`✅ Guest created: ${user_id}`);

    res.json({
      user_id,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token
    });
  } catch (error) {
    console.error('Error creating guest:', error);
    res.status(500).json({
      error: {
        code: 'server_error',
        message: 'Failed to create guest session'
      }
    });
  }
});

// POST /v1/auth/register - Register new user
router.post('/register', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      error: {
        code: 'validation_error',
        message: 'Email and password are required'
      }
    });
  }

  try {
    // Check if email already exists
    const existingUser = queries.getUserByEmail.get(email);
    if (existingUser) {
      return res.status(409).json({
        error: {
          code: 'conflict',
          message: 'Email already registered'
        }
      });
    }

    const user_id = generateUserId('user');
    const tokens = generateTokens(user_id);

    // In production, hash password with bcrypt!
    queries.createUser.run(user_id, email, password, 'registered');

    console.log(`✅ User registered: ${user_id} (${email})`);

    res.json({
      user_id,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token
    });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({
      error: {
        code: 'server_error',
        message: 'Failed to register user'
      }
    });
  }
});

// POST /v1/auth/login - Login existing user
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      error: {
        code: 'validation_error',
        message: 'Email and password are required'
      }
    });
  }

  try {
    // Find user by email
    const user = queries.getUserByEmail.get(email);
    
    if (!user || user.password !== password) {
      return res.status(401).json({
        error: {
          code: 'unauthorized',
          message: 'Invalid email or password'
        }
      });
    }

    const tokens = generateTokens(user.id);

    console.log(`✅ User logged in: ${user.id} (${email})`);

    res.json({
      user_id: user.id,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token
    });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({
      error: {
        code: 'server_error',
        message: 'Failed to login'
      }
    });
  }
});

// POST /v1/auth/refresh - Refresh access token
router.post('/refresh', (req, res) => {
  const { refresh_token } = req.body;

  if (!refresh_token) {
    return res.status(400).json({
      error: {
        code: 'validation_error',
        message: 'Refresh token is required'
      }
    });
  }

  const decoded = verifyToken(refresh_token, 'refresh');

  if (!decoded) {
    return res.status(401).json({
      error: {
        code: 'unauthorized',
        message: 'Invalid or expired refresh token'
      }
    });
  }

  const tokens = generateTokens(decoded.userId);

  console.log(`✅ Token refreshed: ${decoded.userId}`);

  res.json({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token
  });
});

// POST /v1/auth/logout - Logout (invalidate tokens)
router.post('/logout', (req, res) => {
  // In production, you'd blacklist the tokens in Redis or similar
  console.log(`✅ User logged out`);
  
  res.json({ ok: true });
});

export default router;

