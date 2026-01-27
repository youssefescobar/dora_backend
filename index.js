const express = require('express');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const cors = require('cors');
const connectDB = require('./config/db');
const auth_routes = require('./routes/auth_routes');
const hardware_routes = require('./routes/hardware_routes');
const group_routes = require('./routes/group_routes');
const admin_routes = require('./routes/admin_routes');

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());

// Simple request logging middleware
app.use((req, res, next) => {
    console.log(`\n[${new Date().toISOString()}] ${req.method} ${req.path}`);
    if (req.body && Object.keys(req.body).length > 0) {
        console.log('Body:', JSON.stringify(req.body, null, 2));
    }
    next();
});

// Database Connection
connectDB();

// Routes
app.use('/api/auth', auth_routes);
app.use('/api/hardware', hardware_routes);
app.use('/api/groups', group_routes);
app.use('/api/admin', admin_routes);

app.use((err, req, res, next) => {
    console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);
    res.status(500).json({ success: false, message: err.message });
});

app.get('/', (req, res) => res.send("Hajj API Running"));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));