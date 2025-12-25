import express from 'express';
import { authenticate, checkBanned } from '../utils/auth.js';
import { queries } from '../utils/database.js';

const router = express.Router();

// POST /v1/leaderboards/:board/submit - Submit score
router.post('/:board/submit', authenticate, checkBanned, (req, res) => {
  const { board } = req.params;
  const { score } = req.body;

  if (typeof score !== 'number') {
    return res.status(400).json({
      error: {
        code: 'validation_error',
        message: 'Score must be a number'
      }
    });
  }

  try {
    // Get current best score
    const currentBest = queries.getUserScore.get(board, req.userId);
    const currentScore = currentBest ? currentBest.score : 0;

    // Only update if new score is better
    if (!currentBest || score > currentScore) {
      queries.submitScore.run(board, req.userId, score);
    }

    // Get user's rank
    const userRanking = queries.getUserRank.get(board, req.userId);
    const bestScore = Math.max(score, currentScore);

    console.log(`✅ Score submitted: ${req.userId} on '${board}': ${score} (rank #${userRanking.rank})`);

    res.json({
      best_score: bestScore,
      rank: userRanking.rank
    });
  } catch (error) {
    console.error('Error submitting score:', error);
    
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
        message: 'Failed to submit score'
      }
    });
  }
});

// GET /v1/leaderboards/:board/top - Get top entries
router.get('/:board/top', authenticate, checkBanned, (req, res) => {
  const { board } = req.params;
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);

  try {
    const topEntries = queries.getTopScores.all(board, limit);

    console.log(`✅ Leaderboard top ${limit}: '${board}'`);

    res.json({
      entries: topEntries.map(e => ({
        user_id: e.user_id,
        score: e.score,
        rank: e.rank
      }))
    });
  } catch (error) {
    console.error('Error getting top scores:', error);
    res.status(500).json({
      error: {
        code: 'server_error',
        message: 'Failed to get top scores'
      }
    });
  }
});

// GET /v1/leaderboards/:board/me - Get current user's rank
router.get('/:board/me', authenticate, checkBanned, (req, res) => {
  const { board } = req.params;

  try {
    const userEntry = queries.getUserRank.get(board, req.userId);

    if (!userEntry) {
      return res.status(404).json({
        error: {
          code: 'not_found',
          message: 'No score found for this user on this leaderboard'
        }
      });
    }

    console.log(`✅ Leaderboard rank: ${req.userId} on '${board}': #${userEntry.rank}`);

    res.json({
      user_id: userEntry.user_id,
      score: userEntry.score,
      rank: userEntry.rank
    });
  } catch (error) {
    console.error('Error getting user rank:', error);
    res.status(500).json({
      error: {
        code: 'server_error',
        message: 'Failed to get user rank'
      }
    });
  }
});

export default router;

