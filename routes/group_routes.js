const express = require('express');
const router = express.Router();
const group_controller = require('../controllers/group_controller');
const { protect, authorize } = require('../middleware/auth_middleware');
const validate = require('../middleware/validation_middleware');
const { create_group_schema, add_pilgrim_schema, send_alert_schema, assign_band_schema } = require('../middleware/schemas');

// All routes here require login
router.use(protect);

// Only moderators can manage groups
router.post('/create', authorize('moderator', 'admin'), validate(create_group_schema), group_controller.create_group);
router.get('/dashboard', authorize('moderator', 'admin'), group_controller.get_my_groups);
router.post('/assign-band', authorize('moderator', 'admin'), validate(assign_band_schema), group_controller.assign_band_to_pilgrim);
router.post('/send-alert', authorize('moderator', 'admin'), validate(send_alert_schema), group_controller.send_group_alert);
router.post('/send-individual-alert', authorize('moderator', 'admin'), validate(require('../middleware/schemas').send_individual_alert_schema), group_controller.send_individual_alert);
router.post('/:group_id/add-pilgrim', authorize('moderator', 'admin'), validate(add_pilgrim_schema), group_controller.add_pilgrim_to_group);
router.post('/:group_id/remove-pilgrim', authorize('moderator', 'admin'), validate(add_pilgrim_schema), group_controller.remove_pilgrim_from_group);
router.delete('/:group_id', authorize('moderator', 'admin'), group_controller.delete_group);

module.exports = router;