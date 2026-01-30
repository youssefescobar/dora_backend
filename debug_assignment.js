const mongoose = require('mongoose');
const HardwareBand = require('./models/hardware_band_model');
const Group = require('./models/group_model');
const User = require('./models/user_model');
const Pilgrim = require('./models/pilgrim_model');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://youssefhussain9000_db_user:Jlw2PXUidIsew3iE@doradb.rloewty.mongodb.net/?appName=DoraDB';

async function runDebug() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB');

        const groups = await Group.find().lean();
        console.log(`Found ${groups.length} groups.`);

        for (const group of groups) {
            console.log(`\nGroup: ${group.group_name} (${group._id})`);
            console.log(`Available Band IDs in Group: ${group.available_band_ids ? group.available_band_ids.length : 0}`);

            if (group.available_band_ids && group.available_band_ids.length > 0) {
                const bands = await HardwareBand.find({ _id: { $in: group.available_band_ids } }).lean();
                console.log(`Found ${bands.length} bands in HardwareBand collection matching these IDs.`);

                for (const band of bands) {
                    console.log(` - Band ${band.serial_number} (${band._id}): current_user_id=${band.current_user_id}, status=${band.status}`);
                    if (band.current_user_id !== null) {
                        console.warn(`   WARNING: Band is in group's available list but has current_user_id set!`);
                        // Find who has it
                        const pilgrim = await Pilgrim.findById(band.current_user_id);
                        if (pilgrim) {
                            console.log(`   Assigned to Pilgrim: ${pilgrim.full_name} (${pilgrim._id})`);
                        } else {
                            const user = await User.findById(band.current_user_id);
                            if (user) {
                                console.log(`   Assigned to User: ${user.full_name} (${user._id})`);
                            } else {
                                console.log(`   Assigned to UNKNOWN USER (ID: ${band.current_user_id})`);
                            }
                        }
                    }
                }
            } else {
                console.log("No available bands assigned to this group.");
            }
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

runDebug();
