const express = require('express');
const router = express.Router();
const hard_ctrl = require('../controllers/hardware_controller');
const { protect, authorize } = require('../middleware/auth_middleware');
const { generalLimiter } = require('../middleware/rate_limit');
const validate = require('../middleware/validation_middleware');
const { report_location_schema, register_band_schema } = require('../middleware/schemas');
const { hardwareLimiter } = require('../middleware/rate_limit');

// Public endpoint for wristband to report location with rate limiting
router.post('/ping', hardwareLimiter, validate(report_location_schema), hard_ctrl.report_location);

// Protected endpoints
router.use(protect);
// Apply general rate limiter for protected hardware endpoints
router.use(generalLimiter);

// Admin only
router.post('/register', authorize('admin'), validate(register_band_schema), hard_ctrl.register_band);
router.get('/bands', authorize('admin', 'moderator'), hard_ctrl.get_all_bands);
router.get('/bands/:serial_number', authorize('admin'), hard_ctrl.get_band);
router.delete('/bands/:serial_number', authorize('admin'), hard_ctrl.deactivate_band);
router.delete('/bands/:serial_number/force', authorize('admin'), hard_ctrl.delete_band_permanently);
router.post('/bands/:serial_number/activate', authorize('admin'), hard_ctrl.activate_band);

module.exports = router;
