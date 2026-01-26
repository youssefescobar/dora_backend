const mongoose = require('mongoose');

const group_schema = new mongoose.Schema({
    group_name: { type: String, required: true },
    moderator_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Multiple moderators allowed
    pilgrim_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

module.exports = mongoose.model('Group', group_schema);