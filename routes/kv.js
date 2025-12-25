import express from 'express';
import { authenticate, checkBanned } from '../utils/auth.js';
import { queries } from '../utils/database.js';

const router = express.Router();

// GET /v1/kv/:key - Get value
router.get('/:key', authenticate, checkBanned, (req, res) => {
  const { key } = req.params;

  try {
    const data = queries.getKV.get(req.userId, key);

    if (!data) {
      return res.status(404).json({
        error: {
          code: 'not_found',
          message: `Key '${key}' not found`
        }
      });
    }

    console.log(`✅ KV GET: ${req.userId}/${key}`);

    res.json({
      key: data.key,
      value: JSON.parse(data.value),
      version: data.version
    });
  } catch (error) {
    console.error('Error getting KV:', error);
    res.status(500).json({
      error: {
        code: 'server_error',
        message: 'Failed to get value'
      }
    });
  }
});

// PUT /v1/kv/:key - Set value
router.put('/:key', authenticate, checkBanned, (req, res) => {
  const { key } = req.params;
  const { value, expected_version } = req.body;

  if (value === undefined) {
    return res.status(400).json({
      error: {
        code: 'validation_error',
        message: 'Value is required'
      }
    });
  }

  try {
    const existing = queries.getKVWithVersion.get(req.userId, key);

    // Check version for optimistic locking
    if (expected_version !== undefined && expected_version !== null) {
      if (!existing) {
        return res.status(409).json({
          error: {
            code: 'conflict',
            message: 'Key does not exist, cannot match expected_version'
          }
        });
      }
      if (existing.version !== expected_version) {
        return res.status(409).json({
          error: {
            code: 'conflict',
            message: `Version mismatch. Expected ${expected_version}, got ${existing.version}`
          }
        });
      }
    }

    const newVersion = (existing?.version || 0) + 1;
    const valueJson = JSON.stringify(value);

    queries.setKV.run(req.userId, key, valueJson, newVersion);

    console.log(`✅ KV SET: ${req.userId}/${key} (v${newVersion})`);

    res.json({
      key,
      value,
      version: newVersion
    });
  } catch (error) {
    console.error('Error setting KV:', error);
    
    // Handle foreign key constraint errors
    if (error.code === 'SQLITE_CONSTRAINT_FOREIGNKEY' || 
        (error.message && error.message.includes('FOREIGN KEY constraint failed'))) {
      return res.status(401).json({
        error: {
          code: 'invalid_session',
          message: 'Your session is invalid. Please login again.',
          details: 'User no longer exists in database. Logout and login again to fix this.'
        }
      });
    }
    
    res.status(500).json({
      error: {
        code: 'server_error',
        message: 'Failed to set value'
      }
    });
  }
});

// DELETE /v1/kv/:key - Delete value
router.delete('/:key', authenticate, checkBanned, (req, res) => {
  const { key } = req.params;
  const { expected_version } = req.query;

  try {
    const existing = queries.getKVWithVersion.get(req.userId, key);

    if (!existing) {
      return res.status(404).json({
        error: {
          code: 'not_found',
          message: `Key '${key}' not found`
        }
      });
    }

    // Check version for optimistic locking
    if (expected_version !== undefined) {
      if (existing.version !== parseInt(expected_version)) {
        return res.status(409).json({
          error: {
            code: 'conflict',
            message: `Version mismatch. Expected ${expected_version}, got ${existing.version}`
          }
        });
      }
    }

    queries.deleteKV.run(req.userId, key);

    console.log(`✅ KV DELETE: ${req.userId}/${key}`);

    res.json({ ok: true });
  } catch (error) {
    console.error('Error deleting KV:', error);
    res.status(500).json({
      error: {
        code: 'server_error',
        message: 'Failed to delete value'
      }
    });
  }
});

export default router;

