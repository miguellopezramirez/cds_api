
// src/config/connectToMongoDB.config.js
const mongoose = require('mongoose');
const configX = require('./dotenvXConfig');

(async () => { 
    try { 
        const db = await mongoose.connect(configX.CONNECTION_STRING, { 
            // useNewUrlParser: true,  // Ya no es necesario en Mongoose 6+
            // useUnifiedTopology: true,  // Ya no es necesario en Mongoose 6+
            dbName: configX.DATABASE 
        }); 
        console.log('Database is connected to: ', db.connection.name); 
    } catch (error) { 
        console.log('Error: ', error); 
    } 
})();

module.exports = { mongoose };