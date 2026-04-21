# Philadelphia Movement App — MySQL Setup Guide

## STEP 1 — Install MySQL
1. Go to https://dev.mysql.com/downloads/installer/
2. Download MySQL Installer (Windows)
3. Run installer → choose Developer Default
4. Set a root password — remember it!
5. Finish installation

Verify: open terminal and type:  mysql --version

## STEP 2 — Create the Database
Open terminal and login to MySQL:
  mysql -u root -p

Then run:
  source C:/Users/WELFARE PC/Desktop/philadelphia-app/database.sql

Type exit to leave MySQL.

## STEP 3 — Edit your .env file
Open .env and set your MySQL password:
  DB_PASSWORD=your_actual_mysql_password

## STEP 4 — Install Dependencies
  npm install

## STEP 5 — Start the Server
  node server.js

You should see:
  MySQL connected successfully!
  Philadelphia Movement App running at http://localhost:3000

## Default Login Accounts
  admin@philadelphia.com  password  (Admin)
  adom@gmail.com          password  (Staff)

## Common Errors
"MySQL connection failed"   → Check password in .env
"ECONNREFUSED"             → MySQL not running, start MySQL80 service
"Table doesn't exist"      → Run database.sql again in MySQL terminal