#!/bin/sh
# Creates the separate database used by integration tests (TEST_DATABASE_URL), so test
# fixtures never land in the development database. Runs once, on a fresh MySQL volume.
set -eu
mysql -uroot -p"$MYSQL_ROOT_PASSWORD" <<SQL
CREATE DATABASE IF NOT EXISTS pragya_test CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
GRANT ALL PRIVILEGES ON pragya_test.* TO '${MYSQL_USER}'@'%';
SQL
