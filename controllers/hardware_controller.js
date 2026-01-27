const HardwareBand = require('../models/hardware_band_model');

// Endpoint for the physical wristband to report GPS data
exports.report_location = async (req, res) => {
    try {
        const { serial_number, lat, lng } = req.body;

        const updated_band = await HardwareBand.findOneAndUpdate(
            { serial_number },
            { 
                last_latitude: lat, 
                last_longitude: lng, 
                last_updated: new Date() 
            },
            { new: true }
        );

        if (!updated_band) return res.status(404).json({ message: "Band not registered" });
        
        res.json({ status: "success", server_time: new Date() });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get all bands (admin only)
exports.get_all_bands = async (req, res) => {
    try {
        const { page = 1, limit = 20, status } = req.query;

        const pageNum = Math.max(1, parseInt(page) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
        const skip = (pageNum - 1) * limitNum;

        // Build query
        const query = status ? { status } : {};

        // Get bands with pagination
        const bands = await HardwareBand.find(query)
            .populate('current_user_id', 'full_name email phone_number national_id')
            .skip(skip)
            .limit(limitNum);

        // Get total count
        const total = await HardwareBand.countDocuments(query);

        res.json({
            bands,
            page: pageNum,
            limit: limitNum,
            total,
            pages: Math.ceil(total / limitNum)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get single band details
exports.get_band = async (req, res) => {
    try {
        const { serial_number } = req.params;
        
        const band = await HardwareBand.findOne({ serial_number })
            .populate('current_user_id', 'full_name email phone_number');
        
        if (!band) return res.status(404).json({ message: "Band not found" });
        
        res.json(band);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Register a new band (admin only)
exports.register_band = async (req, res) => {
    try {
        const { serial_number, imei } = req.body;

        const existing = await HardwareBand.findOne({ serial_number });
        if (existing) {
            return res.status(400).json({ message: "Band with this serial number already exists" });
        }

        const new_band = await HardwareBand.create({
            serial_number,
            imei,
            status: 'active'
        });

        res.status(201).json({ message: "Band registered successfully", band: new_band });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Deactivate band (admin only)
exports.deactivate_band = async (req, res) => {
    try {
        const { serial_number } = req.params;

        const band = await HardwareBand.findOneAndUpdate(
            { serial_number },
            { status: 'inactive', current_user_id: null },
            { new: true }
        );

        if (!band) return res.status(404).json({ message: "Band not found" });

        res.json({ message: "Band deactivated successfully", band });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};