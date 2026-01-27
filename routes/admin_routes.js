const express = require('express');
const router = express.Router();
const admin_ctrl = require('../controllers/admin_controller');
const { protect, authorize } = require('../middleware/auth_middleware');
const validate = require('../middleware/validation_middleware');

// All admin routes require authentication and admin role
router.use(protect);
router.use(authorize('admin'));

// User management
router.get('/users', admin_ctrl.get_all_users);
router.post('/users/promote', validate(require('../middleware/schemas').user_action_schema), admin_ctrl.promote_user);
router.post('/users/demote', validate(require('../middleware/schemas').user_action_schema), admin_ctrl.demote_user);
router.post('/users/deactivate', validate(require('../middleware/schemas').user_action_schema), admin_ctrl.deactivate_user);
router.post('/users/activate', validate(require('../middleware/schemas').user_action_schema), admin_ctrl.activate_user);

// Group management
router.get('/groups', admin_ctrl.get_all_groups);

// System stats
router.get('/stats', admin_ctrl.get_system_stats);

module.exports = router;
