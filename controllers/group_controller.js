const Group = require('../models/group_model');
const User = require('../models/user_model');
const Pilgrim = require('../models/pilgrim_model');
const HardwareBand = require('../models/hardware_band_model');

// Get a single group by ID (moderator/admin only)
exports.get_single_group = async (req, res) => {
    try {
        const { group_id } = req.params;

        const group = await Group.findById(group_id)
            .populate('moderator_ids', 'full_name email')
            .populate('available_band_ids', 'serial_number imei status')
            .lean(); // Use lean for easier object manipulation

        if (!group) {
            return res.status(404).json({ message: "Group not found" });
        }

        // Check if user is admin or a moderator of this group
        const is_admin = req.user.role === 'admin';
        const is_group_moderator = group.moderator_ids.some(mod => mod._id.toString() === req.user.id);

        if (!is_admin && !is_group_moderator) {
            return res.status(403).json({ message: "Not authorized to view this group" });
        }

        // Enrich pilgrims with their details and band info
        const pilgrims_with_details = await Promise.all(group.pilgrim_ids.map(async (pilgrim_id) => {
            const pilgrim = await Pilgrim.findById(pilgrim_id)
                .select('full_name national_id email phone_number medical_history age gender')
                .lean();

            if (!pilgrim) return null;

            const band = await HardwareBand.findOne({ current_user_id: pilgrim_id }).lean();

            return {
                ...pilgrim,
                band_info: band ? {
                    serial_number: band.serial_number,
                    last_location: { lat: band.last_latitude, lng: band.last_longitude },
                    last_updated: band.last_updated,
                    battery_percent: band.battery_percent
                } : null
            };
        }));

        group.pilgrims = pilgrims_with_details.filter(Boolean); // Add enriched pilgrims to group object
        delete group.pilgrim_ids; // Remove raw pilgrim_ids array

        // Remove __v from top-level group object
        delete group.__v;
        // The populated moderator_ids already exclude __v due to 'lean()' and selected fields.

        res.status(200).json(group);

    } catch (error) {
        console.error("Error in get_single_group:", error);
        res.status(500).json({ error: error.message });
    }
};

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

        const group_obj = new_group.toObject();
        delete group_obj.__v;

        res.status(201).json(group_obj);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 2. Dashboard: Get groups I belong to + Pilgrim info + Locations
exports.get_my_groups = async (req, res) => {
    try {
        const { page = 1, limit = 25 } = req.query || {};

        const pageNum = Math.max(1, parseInt(page) || 1);
        const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 25)); // Max 50 per page
        const skip = (pageNum - 1) * limitNum;

        if (!req.user || !req.user.id) {
            return res.status(401).json({ message: "User not authenticated" });
        }

        const query = { moderator_ids: req.user.id };
        const groups = await Group.find(query)
            .populate('moderator_ids', 'full_name email')
            .skip(skip)
            .limit(limitNum);

        const total = await Group.countDocuments(query);

        const enriched_data = await Promise.all(groups.map(async (group) => {
            if (!group) return null;

            const groupObj = group.toObject ? group.toObject() : group;
            const pilgrim_ids = group.pilgrim_ids || [];

            const pilgrims_with_locations = (await Promise.all(pilgrim_ids.map(async (pilgrim_id) => {
                if (!pilgrim_id) return null;

                const pilgrim = await Pilgrim.findById(pilgrim_id).select('full_name email phone_number national_id medical_history age gender');

                if (!pilgrim) return null;

                const band = await HardwareBand.findOne({ current_user_id: pilgrim_id });

                const pilgrimObj = pilgrim.toObject ? pilgrim.toObject() : pilgrim;

                return {
                    ...pilgrimObj,
                    band_info: band ? {
                        serial_number: band.serial_number,
                        last_location: { lat: band.last_latitude, lng: band.last_longitude },
                        last_updated: band.last_updated,
                        battery_percent: band.battery_percent // Include battery_percent
                    } : null
                };
            }))).filter(Boolean); // Remove nulls

            // Rename pilgrim_ids to pilgrims to match docs
            delete groupObj.pilgrim_ids;
            groupObj.pilgrims = pilgrims_with_locations;

            return groupObj;
        }));

        res.json({
            success: true,
            data: enriched_data.filter(Boolean),
            pagination: {
                page: pageNum,
                limit: limitNum,
                total: total,
                pages: Math.ceil(total / limitNum)
            }
        });
    } catch (error) {
        console.error("Error in get_my_groups:", error);
        res.status(500).json({ error: error.message });
    }
};

// 3. Band Reassignment: Link a physical band to a pilgrim
exports.assign_band_to_pilgrim = async (req, res) => {
    try {
        const { serial_number, user_id, group_id } = req.body; // group_id is required

        // Validate the pilgrim exists
        const pilgrim = await Pilgrim.findById(user_id);
        if (!pilgrim) {
            return res.status(404).json({ message: "Pilgrim not found" });
        }

        // Validate the group exists
        const group = await Group.findById(group_id);
        if (!group) {
            return res.status(404).json({ message: "Group not found" });
        }

        // Validate the band exists and is not currently assigned
        const band = await HardwareBand.findOne({ serial_number });
        if (!band) {
            return res.status(404).json({ message: "Band not found" });
        }
        if (band.current_user_id) {
            return res.status(400).json({ message: "Band is already assigned to another pilgrim" });
        }

        // Unassign from any previous user (if any) - This covers cases where a pilgrim might have multiple bands assigned (though ideal would be one-to-one)
        // Or if the same band was previously assigned to this user and for some reason current_user_id was not cleared.
        // This line is potentially problematic if current_user_id is not unique (e.g. one pilgrim can have many bands).
        // If a pilgrim can only have one band, then this is correct. If they can have many, this logic needs adjustment.
        // Assuming one pilgrim, one band for now.
        const previously_assigned_band = await HardwareBand.findOneAndUpdate(
            { current_user_id: user_id },
            { $set: { current_user_id: null } }
        );

        // Enforce that the band is available for this group (admin should assign bands to group first)
        if (Array.isArray(group.available_band_ids) && group.available_band_ids.length > 0) {
            const isAvailable = group.available_band_ids.some(id => id.toString() === band._id.toString());
            if (!isAvailable) {
                return res.status(400).json({ message: "Band is not available for this group" });
            }
        }
        // If a band was previously assigned to this user, we should add it back to the group's available bands
        // Only if we intend to manage group.available_band_ids. Given the change to get_available_bands_for_group,
        // we might deprecate group.available_band_ids entirely.
        // For now, removing the logic related to group.available_band_ids.

        // Assign to the new user
        const updated_band_doc = await HardwareBand.findOneAndUpdate(
            { serial_number },
            { $set: { current_user_id: user_id, status: 'active' } },
            { new: true }
        );

        const updated_band = updated_band_doc.toObject();
        delete updated_band.__v;

        // Remove this band from the group's available list (if present)
        await Group.findByIdAndUpdate(group_id, { $pull: { available_band_ids: updated_band._id } }).catch(() => { });

        res.json({ message: "Band successfully assigned to pilgrim", band: updated_band });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Unassign band from pilgrim (moderator/admin only)
exports.unassign_band_from_pilgrim = async (req, res) => {
    try {
        const { user_id, group_id } = req.body; // group_id is required

        // Validate the pilgrim exists
        const pilgrim = await Pilgrim.findById(user_id);
        if (!pilgrim) {
            return res.status(404).json({ message: "Pilgrim not found" });
        }

        // Validate the group exists
        const group = await Group.findById(group_id);
        if (!group) {
            return res.status(404).json({ message: "Group not found" });
        }

        // Find the band assigned to this pilgrim
        const assigned_band = await HardwareBand.findOne({ current_user_id: user_id });
        if (!assigned_band) {
            return res.status(404).json({ message: "No band assigned to this pilgrim" });
        }

        // Unassign the band
        const updated_band_doc = await HardwareBand.findOneAndUpdate(
            { current_user_id: user_id },
            { $set: { current_user_id: null } },
            { new: true }
        );



        const updated_band = updated_band_doc.toObject();
        delete updated_band.__v;
        // The docs example shows battery_percent, last_latitude, etc. as null.
        // If they were present before unassignment, they should still be.
        // We will explicitly set them to null in the response for consistency with example if they are not already there.
        updated_band.current_user_id = null; // Ensure null in response

        // Add this band back to the group's available list (if group exists)
        await Group.findByIdAndUpdate(group_id, { $addToSet: { available_band_ids: updated_band._id } }).catch(() => { });

        res.json({ message: "Band successfully unassigned from pilgrim", band: updated_band });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get available bands for a group
exports.get_available_bands_for_group = async (req, res) => {
    try {
        const { group_id } = req.params;
        // If the group exists and has an available_band_ids list, return those bands that are currently unassigned
        const group = await Group.findById(group_id).lean();
        if (!group) return res.status(404).json({ message: 'Group not found' });

        const bandIds = Array.isArray(group.available_band_ids) ? group.available_band_ids : [];

        const available_bands = await HardwareBand.find({ _id: { $in: bandIds }, current_user_id: null }).lean();

        res.json({ success: true, data: available_bands });
    } catch (error) {
        console.error("Error in get_available_bands_for_group:", error);
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

        // Validate pilgrim exists
        const pilgrim = await Pilgrim.findById(user_id);
        if (!pilgrim) {
            return res.status(404).json({ message: "Pilgrim not found" });
        }

        // Get the band assigned to this pilgrim
        const band = await HardwareBand.findOne({ current_user_id: user_id });
        if (!band) {
            return res.status(400).json({ message: "Pilgrim does not have a band assigned" });
        }

        // Logic for sending alert to specific wristband
        res.json({
            status: "queued",
            message: `Alert "${message_text}" sent to pilgrim ${pilgrim.full_name}`,
            band_serial: band.serial_number
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 5. Add pilgrim to group
exports.add_pilgrim_to_group = async (req, res) => {
    try {
        const { group_id } = req.params;
        const { user_id } = req.body;

        if (user_id === req.user.id) {
            return res.status(400).json({ message: "You cannot add yourself as a pilgrim to the group" });
        }

        const pilgrim = await Pilgrim.findById(user_id);
        if (!pilgrim) {
            return res.status(400).json({ message: "Pilgrim not found" });
        }

        const updated_group = await Group.findByIdAndUpdate(
            group_id,
            { $addToSet: { pilgrim_ids: user_id } },
            { new: true }
        ).populate('pilgrim_ids', 'full_name email phone_number national_id age gender');

        if (!updated_group) return res.status(404).json({ message: "Group not found" });

        res.json({
            message: "Pilgrim added to group",
            group: {
                _id: updated_group._id,
                group_name: updated_group.group_name,
                pilgrim_ids: updated_group.pilgrim_ids
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 6. Remove pilgrim from group
exports.remove_pilgrim_from_group = async (req, res) => {
    try {
        const { group_id } = req.params;
        const { user_id } = req.body;

        const updated_group = await Group.findByIdAndUpdate(
            group_id,
            { $pull: { pilgrim_ids: user_id } },
            { new: true }
        );

        if (!updated_group) return res.status(404).json({ message: "Group not found" });

        res.json({
            message: "Pilgrim removed from group",
            group: {
                _id: updated_group._id,
                group_name: updated_group.group_name,
                pilgrim_ids: updated_group.pilgrim_ids
            }
        });
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

        const is_group_moderator = group.moderator_ids.some(mod => mod.toString() === req.user.id);
        if (!is_group_moderator) {
            return res.status(403).json({ message: "Only group moderators can delete the group" });
        }

        // Delete the group (pilgrims are automatically unassigned)
        await Group.findByIdAndDelete(group_id);

        res.json({ message: "Group deleted successfully", group_id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Update group details
exports.update_group_details = async (req, res) => {
    try {
        const { group_id } = req.params;
        const { group_name } = req.body;

        const group = await Group.findById(group_id);
        if (!group) {
            return res.status(404).json({ message: "Group not found" });
        }

        const is_admin = req.user.role === 'admin';
        const is_group_moderator = group.moderator_ids.some(mod => mod.toString() === req.user.id);

        if (!is_admin && !is_group_moderator) {
            return res.status(403).json({ message: "Not authorized to update this group" });
        }

        // Check if new group name already exists for this moderator (only if moderator is updating)
        if (group_name && !is_admin) {
            const existing_group_with_name = await Group.findOne({
                group_name,
                moderator_ids: req.user.id,
                _id: { $ne: group_id } // Exclude current group
            });
            if (existing_group_with_name) {
                return res.status(400).json({ message: "You already have a group with this name" });
            }
        }

        group.group_name = group_name || group.group_name;
        await group.save();

        const updated_group = await Group.findById(group_id)
            .populate('moderator_ids', 'full_name email')
            .lean();

        // Clean up __v and pilgrim_ids for response to match docs
        delete updated_group.__v;
        // The docs show pilgrim_ids as an array of IDs in the PUT response, so no need to delete or populate details for it

        res.status(200).json({ message: "Group updated successfully", group: updated_group });

    } catch (error) {
        console.error("Error in update_group_details:", error);
        res.status(500).json({ error: error.message });
    }
};