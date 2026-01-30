const mongoose = require('mongoose');
const HardwareBand = require('./models/hardware_band_model');
require('dotenv').config();

const API_URL = 'http://localhost:5000/api/hardware/ping';
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://youssefhussain9000_db_user:Jlw2PXUidIsew3iE@doradb.rloewty.mongodb.net/?appName=DoraDB';

// Mock coordinates around Mecca (Kaaba)
const MECCA_LAT = 21.4225;
const MECCA_LNG = 39.8262;

async function simulate() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB');

        // Find an assigned band
        let band = await HardwareBand.findOne({ current_user_id: { $ne: null } });

        if (!band) {
            console.log('No assigned bands found. Auto-assigning one for simulation...');
            const Pilgrim = require('./models/pilgrim_model');

            const pilgrim = await Pilgrim.findOne();
            const freeBand = await HardwareBand.findOne({ current_user_id: null });

            if (pilgrim && freeBand) {
                freeBand.current_user_id = pilgrim._id;
                freeBand.status = 'active';
                await freeBand.save();
                band = freeBand;
                console.log(`Assigned Band ${band.serial_number} to Pilgrim ${pilgrim.full_name}`);
            } else {
                console.error('Could not find available pilgrim or band to assign.');
                process.exit(1);
            }
        }

        console.log(`Simulating updates for Band: ${band.serial_number} (Assigned to: ${band.current_user_id})`);

        let step = 0;
        const maxSteps = 5;

        const interval = setInterval(async () => {
            if (step >= maxSteps) {
                clearInterval(interval);
                console.log('Simulation complete.');
                mongoose.disconnect();
                process.exit(0);
            }

            const lat = MECCA_LAT + (Math.random() - 0.5) * 0.001; // Small variation
            const lng = MECCA_LNG + (Math.random() - 0.5) * 0.001;

            try {
                const response = await fetch(API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        serial_number: band.serial_number,
                        lat: lat,
                        lng: lng,
                        battery_percent: 85 - step // Fake drain
                    })
                });
                const data = await response.json();
                console.log(`[Step ${step + 1}/${maxSteps}] Updated location: ${lat.toFixed(6)}, ${lng.toFixed(6)} - Status: ${response.status}`);
            } catch (err) {
                console.error('API Error:', err.message);
            }

            step++;
        }, 2000); // Update every 2 seconds

    } catch (error) {
        console.error('Startup Error:', error);
        mongoose.disconnect();
    }
}

simulate();
