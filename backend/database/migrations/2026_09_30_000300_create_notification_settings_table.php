<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Настройки ежедневных уведомлений о памятных датах (сейчас — Telegram). */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('notification_settings', function (Blueprint $table) {
            $table->foreignUlid('user_id')->primary()->constrained()->cascadeOnDelete();
            $table->boolean('enabled')->default(true);
            $table->string('telegram_chat_id', 32)->nullable()->unique();
            $table->string('telegram_username', 64)->nullable();
            $table->timestamp('telegram_linked_at')->nullable();
            // Местное время отправки «ЧЧ:ММ» и часовой пояс пользователя
            $table->char('send_time', 5)->default('09:00');
            $table->string('timezone', 64)->default('Europe/Moscow');
            $table->boolean('birthdays')->default(true);
            $table->boolean('anniversaries')->default(true);
            $table->boolean('memorials')->default(false);
            // Дата (по часовому поясу пользователя), за которую сводка уже отправлена
            $table->date('last_sent_on')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notification_settings');
    }
};
