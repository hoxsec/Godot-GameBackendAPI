import express from 'express';

const router = express.Router();

// GET /v1/config - Get remote configuration
router.get('/', (req, res) => {
  const { platform, app_version } = req.query;

  console.log(`✅ Config fetch: platform=${platform}, version=${app_version}`);

  // In production, customize based on platform/version
  const config = {
    config: {
      maintenance_mode: false,
      min_version: '1.0.0',
      max_players_per_room: 8,
      shop_items: [
        { id: 'coins_100', price: 0.99, amount: 100 },
        { id: 'coins_500', price: 4.99, amount: 500 },
        { id: 'coins_1000', price: 9.99, amount: 1000 }
      ],
      event_active: true,
      event_name: 'Winter Festival',
      event_end_date: '2024-12-31T23:59:59Z'
    },
    flags: {
      new_ui_enabled: true,
      social_features_enabled: true,
      analytics_enabled: true,
      debug_mode: platform === 'windows' // Enable debug on windows
    }
  };

  res.json(config);
});

export default router;

