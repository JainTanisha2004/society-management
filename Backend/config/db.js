const mysql = require('mysql2');

const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Tanisha@2004',
    database: 'society_management',  // Replace with your actual database name
    authPlugins: {
        mysql_clear_password: () => () => Buffer.from('Tanisha@2004')
    }
});

connection.connect((err) => {
    if (err) {
        console.error('Database connection failed:', err);
        return;
    }
    console.log('Connected to MySQL!');
});

module.exports = connection;
