<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Пользователи и всё, что относится к учётной записи: токены доступа, одноразовые ссылки из писем,
 * журнал согласий с юридическими документами.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('name', 100);
            $table->string('email', 190)->unique();
            $table->timestamp('email_verified_at')->nullable();
            $table->string('password');
            // Небольшое изображение data:URL (256×256), хранится прямо в записи
            $table->mediumText('avatar')->nullable();
            $table->boolean('marketing_opt_in')->default(false);
            $table->timestamps();
        });

        // Короткоживущие токены доступа (Sanctum): «Authorization: Bearer …»
        Schema::create('personal_access_tokens', function (Blueprint $table) {
            $table->id();
            $table->ulidMorphs('tokenable');
            $table->text('name');
            $table->string('token', 64)->unique();
            $table->text('abilities')->nullable();
            $table->timestamp('last_used_at')->nullable();
            $table->timestamp('expires_at')->nullable()->index();
            $table->timestamps();
        });

        // Долгоживущие токены обновления. Хранится только хеш; при каждом обновлении токен меняется.
        // Повторное использование старого токена отзывает всю цепочку (family) — защита от кражи.
        Schema::create('refresh_tokens', function (Blueprint $table) {
            $table->id();
            $table->foreignUlid('user_id')->constrained()->cascadeOnDelete();
            $table->char('token_hash', 64)->unique();
            $table->ulid('family')->index();
            $table->timestamp('expires_at');
            $table->timestamp('revoked_at')->nullable();
            $table->timestamp('last_used_at')->nullable();
            $table->string('ip', 45)->nullable();
            $table->string('user_agent', 255)->nullable();
            $table->timestamps();
        });

        // Одноразовые токены из писем и привязки: сброс пароля, подтверждение почты, привязка Telegram
        Schema::create('user_tokens', function (Blueprint $table) {
            $table->id();
            $table->foreignUlid('user_id')->constrained()->cascadeOnDelete();
            $table->string('type', 32);
            $table->char('token_hash', 64)->unique();
            $table->json('payload')->nullable();
            $table->timestamp('expires_at');
            $table->timestamp('used_at')->nullable();
            $table->timestamps();
            $table->index(['user_id', 'type']);
        });

        // Журнал согласий (152-ФЗ): какой документ, какой редакции, когда, с какого адреса
        Schema::create('consents', function (Blueprint $table) {
            $table->id();
            $table->foreignUlid('user_id')->constrained()->cascadeOnDelete();
            $table->string('document', 32);
            $table->string('version', 32);
            $table->timestamp('accepted_at');
            $table->timestamp('revoked_at')->nullable()->comment('Отзыв согласия (ч. 2 ст. 9 152-ФЗ)');
            $table->string('ip', 45)->nullable();
            $table->string('user_agent', 255)->nullable();
            $table->index(['user_id', 'document']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('consents');
        Schema::dropIfExists('user_tokens');
        Schema::dropIfExists('refresh_tokens');
        Schema::dropIfExists('personal_access_tokens');
        Schema::dropIfExists('users');
    }
};
