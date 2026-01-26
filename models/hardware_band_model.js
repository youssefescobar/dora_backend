const mongoose = require('mongoose');

const hardware_band_schema = new mongoose.Schema({
    serial_number: { type: String, unique: true, required: true },
    imei: String,
    status: { type: String, enum: ['active', 'maintenance', 'inactive'], default: 'active' },
    // Reassignment Logic: Simply update this ID to pair with a new pilgrim
    current_user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    last_latitude: Number,
    last_longitude: Number,
    last_updated: Date
});

module.exports = mongoose.model('HardwareBand', hardware_band_schema);
