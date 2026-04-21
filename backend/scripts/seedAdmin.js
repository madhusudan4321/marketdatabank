/**
 * Admin Seeder Script
 * Run once: node scripts/seedAdmin.js
 * Creates the one-and-only admin account.
 * Will abort if an admin already exists.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const User = require('../models/User');

const ADMIN = {
  name: 'Admin',
  email: 'madhusudan@marketdatabank.com',
  password: 'Admin@MDB#2024',
  role: 'admin',
};

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const existing = await User.findOne({ role: 'admin' });
    if (existing) {
      console.log(`\n⚠️  Admin already exists: ${existing.email}`);
      console.log('Only one admin is allowed. Aborting.\n');
      process.exit(0);
    }

    const admin = await User.create(ADMIN);
    console.log('\n✅ Admin created successfully!');
    console.log('──────────────────────────────────');
    console.log(`  Name  : ${admin.name}`);
    console.log(`  Email : ${admin.email}`);
    console.log(`  Role  : ${admin.role}`);
    console.log('──────────────────────────────────\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seeder failed:', err.message);
    process.exit(1);
  }
})();
