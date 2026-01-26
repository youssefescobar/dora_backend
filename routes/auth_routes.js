const express = require('express');
const router = express.Router();
const auth_ctrl = require('../controllers/auth_controller');
const { protect, authorize } = require('../middleware/auth_middleware');
const validate = require('../middleware/validation_middleware');
const { register_schema, login_schema, update_profile_schema } = require('../middleware/schemas');

// Public routes
router.post('/register', validate(register_schema), auth_ctrl.register_user);
router.post('/login', validate(login_schema), auth_ctrl.login_user);

// Protected routes
router.use(protect);
router.get('/me', auth_ctrl.get_profile);
router.put('/update-profile', validate(update_profile_schema), auth_ctrl.update_profile);

// Moderator/Admin routes
router.post('/register-pilgrim', authorize('moderator', 'admin'), validate(require('../middleware/schemas').register_pilgrim_schema), auth_ctrl.register_pilgrim);
router.get('/search-pilgrims', authorize('moderator', 'admin'), auth_ctrl.search_pilgrims);

module.exports = router;
