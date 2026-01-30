const mongoose = require('mongoose');
const HardwareBand = require('../models/hardware_band_model');
const Group = require('../models/group_model');
require('dotenv').config({ path: '../.env' }); // Load .env from parent directory

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://youssefhussain9000_db_user:Jlw2PXUidIsew3iE@doradb.rloewty.mongodb.net/?appName=DoraDB';

async function cleanupBands() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB');

        const groups = await Group.find();
        console.log(`Scanning ${groups.length} groups for inconsistencies...`);

        let totalRemoved = 0;

        for (const group of groups) {
            if (!group.available_band_ids || group.available_band_ids.length === 0) continue;

            const bands_in_group = await HardwareBand.find({ _id: { $in: group.available_band_ids } });

            const bands_to_remove = bands_in_group.filter(band => band.current_user_id !== null);
            const ids_to_remove = bands_to_remove.map(b => b._id);

            if (ids_to_remove.length > 0) {
                console.log(`Group "${group.group_name}": Found ${ids_to_remove.length} assigned bands in available list. Removing...`);

                // Show details
                bands_to_remove.forEach(b => {
                    console.log(`  - Removing Band ${b.serial_number} (Assigned to: ${b.current_user_id})`);
                });

                await Group.findByIdAndUpdate(group._id, {
                    $pull: { available_band_ids: { $in: ids_to_remove } }
                });

                totalRemoved += ids_to_remove.length;
            }
        }

        console.log(`\nCleanup complete. Removed ${totalRemoved} invalid band references.`);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

cleanupBands();
