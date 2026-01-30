const HardwareBand = require('../models/hardware_band_model');
const Group = require('../models/group_model');

// Endpoint for the physical wristband to report GPS data
exports.report_location = async (req, res) => {
    try {
        const { serial_number, lat, lng, battery_percent } = req.body;

        const updated_band = await HardwareBand.findOneAndUpdate(
            { serial_number },
            {
                last_latitude: lat,
                last_longitude: lng,
                last_updated: new Date(),
                ...(battery_percent !== undefined && { battery_percent })
            },
            { new: true }
        );

        if (!updated_band) return res.status(404).json({ message: "Band not registered" });

        res.json({ status: "success", server_time: new Date() });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get all bands (admin/moderator)
exports.get_all_bands = async (req, res) => {
    try {
        const { page = 1, limit = 50, status } = req.query;

        const pageNum = Math.max(1, parseInt(page) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50));
        const skip = (pageNum - 1) * limitNum;

        const query = status ? { status } : {};

        // New Logic: Exclude bands that are already assigned to any group's available_band_ids
        if (req.query.exclude_assigned_to_groups === 'true') {
            const groups = await Group.find({}, 'available_band_ids').lean();
            const assignedBandIds = groups.reduce((acc, group) => {
                if (group.available_band_ids && Array.isArray(group.available_band_ids)) {
                    group.available_band_ids.forEach(id => acc.push(id.toString()));
                }
                return acc;
            }, []);

            // Add to query: _id must NOT be in assignedBandIds AND current_user_id must be null
            query._id = { $nin: assignedBandIds };
            query.current_user_id = null;
        }

        const bands = await HardwareBand.find(query)
            .populate('current_user_id', 'full_name email phone_number')
            .skip(skip)
            .limit(limitNum)
            .lean(); // Use lean for performance and easy modification

        const total = await HardwareBand.countDocuments(query);

        res.json({
            success: true,
            data: bands,
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

// Get single band details
exports.get_band = async (req, res) => {
    try {
        const { serial_number } = req.params;

        const band_doc = await HardwareBand.findOne({ serial_number })
            .populate('current_user_id', 'full_name email phone_number');

        if (!band_doc) return res.status(404).json({ message: "Band not found" });

        const band = band_doc.toObject();
        delete band.__v;

        res.json(band);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Register a new band (admin only)
exports.register_band = async (req, res) => {
    try {
        const { serial_number, imei, battery_percent } = req.body;

        const existing = await HardwareBand.findOne({ serial_number });
        if (existing) {
            return res.status(400).json({ message: "Band with this serial number already exists" });
        }

        const new_band_doc = await HardwareBand.create({
            serial_number,
            imei,
            battery_percent, // Initialize battery_percent
            status: 'active'
        });

        const new_band = new_band_doc.toObject();
        delete new_band.__v;

        // Ensure all documented fields are present
        const response_band = {
            _id: new_band._id,
            serial_number: new_band.serial_number,
            imei: new_band.imei,
            battery_percent: new_band.battery_percent || null, // Include battery_percent
            status: new_band.status,
            current_user_id: new_band.current_user_id || null,
            last_latitude: new_band.last_latitude || null,
            last_longitude: new_band.last_longitude || null,
            last_updated: new_band.last_updated || null
        };

        res.status(201).json({ message: "Band registered successfully", band: response_band });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Deactivate band (admin only)
exports.deactivate_band = async (req, res) => {
    try {
        const { serial_number } = req.params;

        const band_doc = await HardwareBand.findOneAndUpdate(
            { serial_number },
            { status: 'inactive', current_user_id: null },
            { new: true }
        );

        if (!band_doc) return res.status(404).json({ message: "Band not found" });

        const band = band_doc.toObject();
        delete band.__v;

        res.json({ message: "Band deactivated successfully", band });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Permanently delete a band (admin only)
exports.delete_band_permanently = async (req, res) => {
    try {
        const { serial_number } = req.params;

        const deleted_band = await HardwareBand.findOneAndDelete({ serial_number });

        if (!deleted_band) {
            return res.status(404).json({ message: "Band not found" });
        }

        res.status(200).json({ message: `Band with serial number ${serial_number} has been permanently deleted.` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Activate band (admin only)
exports.activate_band = async (req, res) => {
    try {
        const { serial_number } = req.params;

        const band_doc = await HardwareBand.findOneAndUpdate(
            { serial_number },
            { status: 'active' },
            { new: true }
        );

        if (!band_doc) return res.status(404).json({ message: "Band not found" });

        const band = band_doc.toObject();
        delete band.__v;

        res.json({ message: "Band activated successfully", band });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};