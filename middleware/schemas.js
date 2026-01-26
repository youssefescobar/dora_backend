const Joi = require('joi');

// Auth validations
exports.register_schema = Joi.object({
    full_name: Joi.string().required().min(3).max(100),
    email: Joi.string().email().required(),
    password: Joi.string().required().min(6),
    phone_number: Joi.string().optional()
});

exports.login_schema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
});

exports.update_profile_schema = Joi.object({
    full_name: Joi.string().optional().min(3).max(100),
    phone_number: Joi.string().optional()
});

exports.register_pilgrim_schema = Joi.object({
    full_name: Joi.string().required().min(3).max(100),
    national_id: Joi.string().required(),
    medical_history: Joi.string().optional().max(500),
    email: Joi.string().optional().email()
});

// Group validations
exports.create_group_schema = Joi.object({
    group_name: Joi.string().required().min(3).max(100)
});

exports.add_pilgrim_schema = Joi.object({
    user_id: Joi.string().required()
});

// Hardware validations
exports.register_band_schema = Joi.object({
    serial_number: Joi.string().required(),
    imei: Joi.string().optional()
});

exports.assign_band_schema = Joi.object({
    serial_number: Joi.string().required(),
    user_id: Joi.string().required()
});

exports.report_location_schema = Joi.object({
    serial_number: Joi.string().required(),
    lat: Joi.number().required(),
    lng: Joi.number().required()
});

exports.send_alert_schema = Joi.object({
    group_id: Joi.string().required(),
    message_text: Joi.string().required().min(1).max(500)
});

exports.send_individual_alert_schema = Joi.object({
    user_id: Joi.string().required(),
    message_text: Joi.string().required().min(1).max(500)
});
