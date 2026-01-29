const express = require('express');
const router = express.Router();
const admin_ctrl = require('../controllers/admin_controller');
const { protect, authorize } = require('../middleware/auth_middleware');
const { generalLimiter } = require('../middleware/rate_limit');
const validate = require('../middleware/validation_middleware');

// All admin routes require authentication and admin role
router.use(protect);
// Apply general rate limiter for protected admin endpoints
router.use(generalLimiter);
router.use(authorize('admin'));

// User management
router.get('/users', admin_ctrl.get_all_users);
router.post('/users/promote-to-admin', validate(require('../middleware/schemas').user_action_schema), admin_ctrl.promote_to_admin);
router.post('/users/demote-to-moderator', validate(require('../middleware/schemas').user_action_schema), admin_ctrl.demote_to_moderator);
router.post('/users/demote-to-pilgrim', validate(require('../middleware/schemas').user_action_schema), admin_ctrl.demote_to_pilgrim);
router.post('/users/deactivate', validate(require('../middleware/schemas').user_action_schema), admin_ctrl.deactivate_user);
router.post('/users/activate', validate(require('../middleware/schemas').user_action_schema), admin_ctrl.activate_user);
router.delete('/users/:user_id/force', authorize('admin'), admin_ctrl.delete_user_permanently);

// Group management
router.get('/groups', admin_ctrl.get_all_groups);
router.delete('/groups/:group_id', admin_ctrl.delete_group_by_id);
router.post('/groups/:group_id/assign-bands', admin_ctrl.assign_bands_to_group);
router.post('/groups/:group_id/unassign-bands', admin_ctrl.unassign_bands_from_group);

// System stats
router.get('/stats', admin_ctrl.get_system_stats);

module.exports = router;
