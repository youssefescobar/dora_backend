const User = require('../models/user_model');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Public Signup: Defaults to 'moderator'
exports.register_user = async (req, res) => {
    try {
        const { full_name, email, password, phone_number } = req.body;

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
        const user = await User.findById(req.user.id).select('-password');
        
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
        ).select('-password');

        res.json({ message: "Profile updated successfully", user });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Register a pilgrim (by moderator/admin) - no password required
exports.register_pilgrim = async (req, res) => {
    try {
        const { full_name, national_id, medical_history, email } = req.body;

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
        const { query } = req.query;

        if (!query || query.trim().length === 0) {
            return res.status(400).json({ message: "Search query is required" });
        }

        // Search by national ID or full name (case-insensitive)
        const pilgrims = await User.find({
            role: 'pilgrim',
            $or: [
                { national_id: { $regex: query, $options: 'i' } },
                { full_name: { $regex: query, $options: 'i' } }
            ]
        }).select('_id full_name national_id email phone_number medical_history').limit(20);

        res.json({ 
            count: pilgrims.length,
            pilgrims 
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};