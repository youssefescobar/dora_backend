const User = require('../models/user_model');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Public Signup: Defaults to 'moderator'
exports.register_user = async (req, res) => {
    try {
        const { full_name, email, password, phone_number } = req.body;

        // Check if email is already registered for a non-pilgrim user
        const existing_user = await User.findOne({ email, role: { $ne: 'pilgrim' } });
        if (existing_user) {
            return res.status(400).json({ message: "Email is already registered" });
        }

        const hashed_password = await bcrypt.hash(password, 10);
        
        const user = await User.create({
            full_name,
            email,
            password: hashed_password,
            role: 'moderator', // Public signups default to moderator
            phone_number
        });

        res.status(201).json({ message: "User created successfully", user_id: user._id });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.login_user = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        const token = jwt.sign(
            { id: user._id, role: user.role }, 
            process.env.JWT_SECRET, 
            { expiresIn: '24h' }
        );

        res.json({ token, role: user.role, full_name: user.full_name, user_id: user._id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get current user profile
exports.get_profile = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('_id full_name email role phone_number created_at');
        
        if (!user) return res.status(404).json({ message: "User not found" });
        
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Update user profile
exports.update_profile = async (req, res) => {
    try {
        const { full_name, phone_number } = req.body;

        const user = await User.findByIdAndUpdate(
            req.user.id,
            { 
                ...(full_name && { full_name }),
                ...(phone_number && { phone_number })
            },
            { new: true }
        ).select('_id full_name email role phone_number created_at');

        res.json({ message: "Profile updated successfully", user });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Register a pilgrim (by moderator/admin) - no password required
exports.register_pilgrim = async (req, res) => {
    try {
        const { full_name, national_id, medical_history, email, age, gender } = req.body;

        // Check if pilgrim already exists with this national ID
        const existing = await User.findOne({ national_id });
        if (existing) {
            return res.status(400).json({ message: "Pilgrim with this ID already exists" });
        }

        const pilgrim = await User.create({
            full_name,
            national_id,
            medical_history,
            email,
            age,
            gender,
            role: 'pilgrim',
            password: null // Pilgrims don't need passwords
        });

        res.status(201).json({ 
            message: "Pilgrim registered successfully", 
            pilgrim_id: pilgrim._id,
            national_id: pilgrim.national_id
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Search for pilgrims by national ID or name
exports.search_pilgrims = async (req, res) => {
    try {
        const { search, page = 1, limit = 20 } = req.query;

        if (!search || search.trim().length === 0) {
            return res.status(400).json({ message: "Search query is required" });
        }

        const pageNum = Math.max(1, parseInt(page) || 1);
        const limitNum = Math.min(20, Math.max(1, parseInt(limit) || 20)); // Max 20 per page for search
        const skip = (pageNum - 1) * limitNum;

        const searchQuery = {
            role: 'pilgrim',
            $or: [
                { national_id: { $regex: search, $options: 'i' } },
                { full_name: { $regex: search, $options: 'i' } }
            ]
        };

        const pilgrims = await User.find(searchQuery)
            .select('_id full_name national_id email phone_number medical_history age gender')
            .skip(skip)
            .limit(limitNum);

        const total = await User.countDocuments(searchQuery);

        res.json({ 
            success: true,
            data: pilgrims,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total: total,
                pages: Math.ceil(total / limitNum)
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get pilgrim by ID (moderator/admin only)
exports.get_pilgrim_by_id = async (req, res) => {
    try {
        const { pilgrim_id } = req.params;

        const pilgrim = await User.findOne({ _id: pilgrim_id, role: 'pilgrim' })
            .select('_id full_name national_id email phone_number medical_history age gender created_at');

        if (!pilgrim) {
            return res.status(404).json({ message: "Pilgrim not found" });
        }

        res.json(pilgrim);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};