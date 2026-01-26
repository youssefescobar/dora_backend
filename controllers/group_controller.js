const Group = require('../models/group_model');
const User = require('../models/user_model');
const HardwareBand = require('../models/hardware_band_model');

// 1. Create a group and assign the moderator
exports.create_group = async (req, res) => {
    try {
        const { group_name } = req.body;
        
        // Check if this moderator already has a group with the same name
        const existing = await Group.findOne({
            group_name,
            moderator_ids: req.user.id
        });
        
        if (existing) {
            return res.status(400).json({ message: "You already have a group with this name" });
        }

        const new_group = await Group.create({
            group_name,
            moderator_ids: [req.user.id], // The creator is the first moderator
            created_by: req.user.id
        });
        res.status(201).json(new_group);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 2. Dashboard: Get groups I belong to + Pilgrim info + Locations
exports.get_my_groups = async (req, res) => {
    try {
        // Populates pilgrims and their specific hardware bands to see real-time data
        const groups = await Group.find({ moderator_ids: req.user.id })
            .populate({
                path: 'pilgrim_ids',
                select: 'full_name email phone_number'
            })
            .populate('moderator_ids', 'full_name email');
        
        // Fetch band data for each pilgrim in the groups
        const enriched_groups = await Promise.all(groups.map(async (group) => {
            const pilgrims_with_locations = await Promise.all(group.pilgrim_ids.map(async (pilgrim) => {
                const band = await HardwareBand.findOne({ current_user_id: pilgrim._id });
                return {
                    ...pilgrim._doc,
                    band_info: band ? {
                        serial_number: band.serial_number,
                        last_location: { lat: band.last_latitude, lng: band.last_longitude },
                        last_updated: band.last_updated
                    } : null
                };
            }));
            return { ...group._doc, pilgrims: pilgrims_with_locations };
        }));

        res.json(enriched_groups);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 3. Band Reassignment: Link a physical band to a pilgrim
exports.assign_band_to_pilgrim = async (req, res) => {
    try {
        const { serial_number, user_id } = req.body;

        // Validate the pilgrim exists and is a pilgrim
        const user = await User.findById(user_id);
        if (!user) {
            return res.status(404).json({ message: "Pilgrim not found" });
        }
        if (user.role !== 'pilgrim') {
            return res.status(400).json({ message: "User must be a pilgrim" });
        }

        // Validate the band exists
        const band = await HardwareBand.findOne({ serial_number });
        if (!band) {
            return res.status(404).json({ message: "Band not found" });
        }

        // Unassign from any previous user
        await HardwareBand.findOneAndUpdate(
            { serial_number },
            { current_user_id: null }
        );

        // Assign to the new user
        const updated_band = await HardwareBand.findOneAndUpdate(
            { serial_number },
            { current_user_id: user_id, status: 'active' },
            { new: true }
        );

        res.json({ message: "Band successfully assigned to pilgrim", band: updated_band });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 4. Send Message to Group (for later Voice processing)
exports.send_group_alert = async (req, res) => {
    try {
        const { group_id, message_text } = req.body;

        // Validate group exists
        const group = await Group.findById(group_id);
        if (!group) {
            return res.status(404).json({ message: "Group not found" });
        }

        // Logic for Option 3 hardware: This text would be pushed to the hardware SDK
        // For now, we return a success status
        res.json({ 
            status: "queued", 
            message: `Alert "${message_text}" sent to group ${group_id}`,
            recipients: group.pilgrim_ids.length
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 4.5 Send Message to Individual Pilgrim
exports.send_individual_alert = async (req, res) => {
    try {
        const { user_id, message_text } = req.body;

        // Validate pilgrim exists and is a pilgrim
        const user = await User.findById(user_id);
        if (!user) {
            return res.status(404).json({ message: "Pilgrim not found" });
        }
        if (user.role !== 'pilgrim') {
            return res.status(400).json({ message: "User must be a pilgrim" });
        }

        // Get the band assigned to this pilgrim
        const band = await HardwareBand.findOne({ current_user_id: user_id });
        if (!band) {
            return res.status(400).json({ message: "Pilgrim does not have a band assigned" });
        }

        // Logic for sending alert to specific wristband
        res.json({ 
            status: "queued", 
            message: `Alert "${message_text}" sent to pilgrim ${user.full_name}`,
            band_serial: band.serial_number
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 5. Add pilgrim to group
exports.add_pilgrim_to_group = async (req, res) => {
    try {
        const { group_id } = req.params; // Get from URL parameter, not body
        const { user_id } = req.body;

        // Prevent moderator from adding themselves as a pilgrim
        if (user_id === req.user.id) {
            return res.status(400).json({ message: "You cannot add yourself as a pilgrim to the group" });
        }

        const user = await User.findById(user_id);
        if (!user || user.role !== 'pilgrim') {
            return res.status(400).json({ message: "User must be a pilgrim" });
        }

        const group = await Group.findByIdAndUpdate(
            group_id,
            { $addToSet: { pilgrim_ids: user_id } },
            { new: true }
        ).populate('pilgrim_ids', 'full_name email phone_number national_id');

        if (!group) return res.status(404).json({ message: "Group not found" });

        res.json({ message: "Pilgrim added to group", group });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 6. Remove pilgrim from group
exports.remove_pilgrim_from_group = async (req, res) => {
    try {
        const { group_id } = req.params; // Get from URL parameter, not body
        const { user_id } = req.body;

        const group = await Group.findByIdAndUpdate(
            group_id,
            { $pull: { pilgrim_ids: user_id } },
            { new: true }
        ).populate('pilgrim_ids', 'full_name email phone_number national_id');

        if (!group) return res.status(404).json({ message: "Group not found" });

        res.json({ message: "Pilgrim removed from group", group });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 7. Delete a group (unassigns all pilgrims automatically)
exports.delete_group = async (req, res) => {
    try {
        const { group_id } = req.params;

        // Verify the user is a moderator of this group
        const group = await Group.findById(group_id);
        if (!group) return res.status(404).json({ message: "Group not found" });

        if (!group.moderator_ids.includes(req.user.id)) {
            return res.status(403).json({ message: "Only group moderators can delete the group" });
        }

        // Delete the group (pilgrims are automatically unassigned)
        await Group.findByIdAndDelete(group_id);

        res.json({ message: "Group deleted successfully", group_id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
