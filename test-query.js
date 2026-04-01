require('dotenv').config();
const mongoose = require('mongoose');
const Registration = require('./models/Registration');

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    const reg = await Registration.findOne({ 'categories.1': { $exists: true } });
    console.log(JSON.stringify(reg?.categories, null, 2));
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
