<?php

use App\Services\Trees\TreeRepository;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Древа и их содержимое.
 *
 * Сущности древа (персоны, семьи, места, медиа, источники, роды) хранятся JSON-документами в отдельных
 * таблицах с составным ключом (tree_id, id): id создаёт клиент, поэтому изменения можно готовить офлайн
 * и присылать пачками. Колонка version — версия древа, в которой запись менялась последний раз:
 * по ней applyTreeChanges находит конфликты только там, где двое правили одно и то же.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('trees', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('owner_id')->constrained('users')->cascadeOnDelete();
            $table->string('name', 200);
            $table->text('description');
            $table->string('home_person_id', 64)->nullable();
            $table->json('custom_fields');
            // Миллисекунды Unix последнего сохранения; растёт монотонно
            $table->unsignedBigInteger('version');
            // Сводка для списка «Мои древа» — пересчитывается при сохранении
            $table->unsignedInteger('persons_count')->default(0);
            $table->unsignedInteger('families_count')->default(0);
            $table->unsignedInteger('media_count')->default(0);
            $table->string('home_name', 200)->nullable();
            $table->text('home_thumb')->nullable();
            $table->char('home_gender', 1)->nullable();
            $table->timestamps();
        });

        foreach (TreeRepository::TABLES as $name) {
            Schema::create($name, function (Blueprint $table) {
                $table->foreignUlid('tree_id')->constrained('trees')->cascadeOnDelete();
                // id задаёт клиент; сравнение с учётом регистра и букв «е/ё» — иначе разные записи совпадут
                $id = $table->string('id', 64);
                if (Schema::getConnection()->getDriverName() === 'mysql') {
                    $id->collation('utf8mb4_bin');
                }
                $table->json('data');
                $table->unsignedBigInteger('version');
                $table->primary(['tree_id', 'id']);
            });
        }

        // Совместный доступ: приглашённые участники древа (владелец хранится в trees.owner_id)
        Schema::create('tree_members', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('tree_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('user_id')->nullable()->constrained()->cascadeOnDelete();
            $table->string('invited_email', 190)->nullable();
            $table->string('role', 16);
            $table->string('status', 16);
            $table->char('token_hash', 64)->nullable()->unique();
            $table->foreignUlid('invited_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('accepted_at')->nullable();
            $table->timestamps();
            $table->unique(['tree_id', 'user_id']);
        });

        // Загрузки файлов: подписанная ссылка → PUT файла → файл доступен по /files/<path>
        Schema::create('uploads', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('tree_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('path');
            $table->string('mime', 100);
            $table->unsignedInteger('size');
            $table->timestamp('completed_at')->nullable();
            $table->timestamp('expires_at');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('uploads');
        Schema::dropIfExists('tree_members');
        foreach (TreeRepository::TABLES as $name) {
            Schema::dropIfExists($name);
        }
        Schema::dropIfExists('trees');
    }
};
