#!/bin/sh
# Выполняется один раз при создании пустой базы (только в разработке — см. docker/compose.dev.yml):
# отдельная база для тестов бэкенда на MySQL (php artisan test с DB_CONNECTION=mysql).
set -e
mysql -uroot -p"$MYSQL_ROOT_PASSWORD" <<SQL
CREATE DATABASE IF NOT EXISTS \`${MYSQL_DATABASE}_test\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON \`${MYSQL_DATABASE}_test\`.* TO '${MYSQL_USER}'@'%';
FLUSH PRIVILEGES;
SQL
