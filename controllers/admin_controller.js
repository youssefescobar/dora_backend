const User = require('../models/user_model');
const Group = require('../models/group_model');
const HardwareBand = require('../models/hardware_band_model');

// Get all users with pagination
exports.get_all_users = async (req, res) => {
    try {
        const { page = 1, limit = 20, role } = req.query;

        const pageNum = Math.max(1, parseInt(page) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
        const skip = (pageNum - 1) * limitNum;

        const query = role ? { role } : {};

        const users = await User.find(query)
            .select('-password')
            .skip(skip)
            .limit(limitNum);

        const total = await User.countDocuments(query);

        res.json({
            users,
            page: pageNum,
            limit: limitNum,
            total,
            pages: Math.ceil(total / limitNum)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get all groups with pagination
exports.get_all_groups = async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;

        const pageNum = Math.max(1, parseInt(page) || 1);
        const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 20));
        const skip = (pageNum - 1) * limitNum;

        const groups = await Group.find()
            .populate('moderator_ids', 'full_name email')
            .populate('created_by', 'full_name email')
            .skip(skip)
            .limit(limitNum);

        const total = await Group.countDocuments();

        res.json({
            groups,
            page: pageNum,
            limit: limitNum,
            total,
            pages: Math.ceil(total / limitNum)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get system statistics
exports.get_system_stats = async (req, res) => {
    try {
        const total_users = await User.countDocuments();
        const moderators = await User.countDocuments({ role: 'moderator' });
        const pilgrims = await User.countDocuments({ role: 'pilgrim' });
        const admins = await User.countDocuments({ role: 'admin' });

        const total_groups = await Group.countDocuments();
        const total_bands = await HardwareBand.countDocuments();
        const active_bands = await HardwareBand.countDocuments({ status: 'active' });
        const bands_assigned = await HardwareBand.countDocuments({ current_user_id: { $ne: null } });

        // Calculate average pilgrims per group
        const groups_with_pilgrims = await Group.aggregate([
            {
                $group: {
                    _id: null,
                    avg_pilgrims: { $avg: { $size: '$pilgrim_ids' } }
                }
            }
        ]);

        res.json({
            users: {
                total: total_users,
                moderators,
                pilgrims,
                admins
            },
            groups: {
                total: total_groups,
                avg_pilgrims_per_group: groups_with_pilgrims[0]?.avg_pilgrims || 0
            },
            bands: {
                total: total_bands,
                active: active_bands,
                assigned: bands_assigned,
                unassigned: total_bands - bands_assigned
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Promote user to moderator
exports.promote_user = async (req, res) => {
    try {
        const { user_id } = req.body;

        const user = await User.findById(user_id);
        if (!user) return res.status(404).json({ message: "User not found" });

        if (user.role === 'admin') {
            return res.status(400).json({ message: "User is already an admin" });
        }

        user.role = 'moderator';
        await user.save();

        res.json({ message: `User promoted to moderator`, user });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Demote moderator to pilgrim
exports.demote_user = async (req, res) => {
    try {
        const { user_id } = req.body;

        const user = await User.findById(user_id);
        if (!user) return res.status(404).json({ message: "User not found" });

        if (user.role === 'pilgrim') {
            return res.status(400).json({ message: "User is already a pilgrim" });
        }

        // Remove them from group moderator lists
        await Group.updateMany(
            { moderator_ids: user_id },
            { $pull: { moderator_ids: user_id } }
        );

        user.role = 'pilgrim';
        await user.save();

        res.json({ message: "User demoted to pilgrim", user });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Deactivate user account
exports.deactivate_user = async (req, res) => {
    try {
        const { user_id } = req.body;

        const user = await User.findById(user_id);
        if (!user) return res.status(404).json({ message: "User not found" });

        // Add an 'active' field to track status
        user.active = false;
        await user.save();

        res.json({ message: "User deactivated", user });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Activate user account
exports.activate_user = async (req, res) => {
    try {
        const { user_id } = req.body;

        const user = await User.findById(user_id);
        if (!user) return res.status(404).json({ message: "User not found" });

        user.active = true;
        await user.save();

        res.json({ message: "User activated", user });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
