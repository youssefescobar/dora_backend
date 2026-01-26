const mongoose = require('mongoose');

const user_schema = new mongoose.Schema({
    full_name: { type: String, required: true },
    email: { type: String, unique: true, sparse: true }, // Sparse allows optional unique field
    password: { type: String }, // Optional for pilgrim-only accounts
    national_id: { type: String, unique: true, sparse: true }, // National/State ID for pilgrims
    role: { 
        type: String, 
        enum: ['admin', 'moderator', 'pilgrim'], 
        default: 'pilgrim' 
    },
    phone_number: { type: String, unique: true, sparse: true }, // Each user has unique phone number
    medical_history: String, // Optional medical information for pilgrims
    created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', user_schema);