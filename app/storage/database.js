const fs = require("fs");
const mySQL = require("mysql");
const dotenv = require('dotenv');

dotenv.config();

const dbFile = fs.readFileSync(`${__dirname}/initialization.sql`);

// MySQL connection configurations
const mysql = mySQL.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_SCHEMA,
    multipleStatements: true
});

const secureSQL = mySQL.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_SCHEMA,
    multipleStatements: true
});

// SQL Class
class SQL {
    constructor() {
        this._unsecure_connection = mysql;
        this._secure_connection = secureSQL;
    }

    // Initialization Query (with Callback)
    initQuery(query, callback) {
        this._unsecure_connection.query(query, (err, results) => {
            if (err) throw err;
            callback(results);
        });
    }

    // Secure Query (with Callback)
    secureQuery(query, params, callback) {
        console.log('Executing query:', query, 'with params:', params);
    
        this._secure_connection.query(query, params, (err, results) => {
            if (err) {
                console.error('Database query error:', err);
                throw err;
            }
            callback(results);
        });
    }
    

    // Initialise DB with external SQL file
    initialise(callback) {
        const query = dbFile.toString().replace(/\r/g, "").replace(/\n/g, "");
        this.initQuery(query, (results) => {
            if (callback) callback(results);
        });
    }
}

// Export the SQL class
module.exports = SQL;