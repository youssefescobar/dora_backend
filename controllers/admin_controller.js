const User = require('../models/user_model');
const Group = require('../models/group_model');
const HardwareBand = require('../models/hardware_band_model');

// Get all users with pagination
exports.get_all_users = async (req, res) => {
    try {
        const { page = 1, limit = 50, role } = req.query;

        const pageNum = Math.max(1, parseInt(page) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50));
        const skip = (pageNum - 1) * limitNum;

        const query = role ? { role } : {};

        const users = await User.find(query)
            .select('_id full_name email phone_number role active created_at')
            .skip(skip)
            .limit(limitNum)
            .lean();

        const total = await User.countDocuments(query);

        res.json({
            success: true,
            data: users,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                pages: Math.ceil(total / limitNum)
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get all groups with pagination
exports.get_all_groups = async (req, res) => {
    try {
        const { page = 1, limit = 30 } = req.query;

        const pageNum = Math.max(1, parseInt(page) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 30));
        const skip = (pageNum - 1) * limitNum;

        const groups = await Group.find()
            .populate('moderator_ids', 'full_name email')
            .populate('created_by', 'full_name email')
            .skip(skip)
            .limit(limitNum)
            .lean();

        const total = await Group.countDocuments();

        res.json({
            success: true,
            data: groups,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                pages: Math.ceil(total / limitNum)
            }
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
        const active_users = await User.countDocuments({ active: true });
        const inactive_users = await User.countDocuments({ active: false });

        const total_groups = await Group.countDocuments();
        const total_bands = await HardwareBand.countDocuments();
        const active_bands = await HardwareBand.countDocuments({ status: 'active' });
        const maintenance_bands = await HardwareBand.countDocuments({ status: 'maintenance' });
        const inactive_bands = await HardwareBand.countDocuments({ status: 'inactive' });
        const bands_assigned = await HardwareBand.countDocuments({ current_user_id: { $ne: null } });

        // Calculate average pilgrims per group
        const groups_with_pilgrims_aggregation = await Group.aggregate([
            {
                $group: {
                    _id: null,
                    avg_pilgrims: { $avg: { $size: '$pilgrim_ids' } }
                }
            }
        ]);
        const avg_pilgrims_per_group = groups_with_pilgrims_aggregation[0]?.avg_pilgrims || 0;

        res.json({
            success: true,
            stats: {
                total_users,
                admins,
                moderators,
                pilgrims,
                active_users,
                inactive_users,
                total_groups,
                avg_pilgrims_per_group,
                total_bands,
                active_bands,
                maintenance_bands,
                inactive_bands,
                assigned_bands: bands_assigned,
                unassigned_bands: total_bands - bands_assigned
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

// Permanently delete a user (admin only)
exports.delete_user_permanently = async (req, res) => {
    try {
        const { user_id } = req.params;

        const deleted_user = await User.findOneAndDelete({ _id: user_id });

        if (!deleted_user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Also remove the user from any groups they might be moderating or be a pilgrim in
        await Group.updateMany(
            { $or: [{ moderator_ids: user_id }, { pilgrim_ids: user_id }] },
            { $pull: { moderator_ids: user_id, pilgrim_ids: user_id } }
        );

        // Also unassign any hardware bands from this user
        await HardwareBand.updateMany(
            { current_user_id: user_id },
            { $set: { current_user_id: null, status: 'inactive' } } // Set band to inactive if user is deleted
        );

        res.status(200).json({ message: `User with ID ${user_id} has been permanently deleted.` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
