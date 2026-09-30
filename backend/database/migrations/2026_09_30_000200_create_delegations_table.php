<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Делегирование ветки: владелец древа передаёт родственнику продолжение ветки (персона + потомки + их супруги).
 * После принятия у родственника появляется своё древо с этой веткой, а в исходном древе ветка
 * показывается из его древа только для просмотра, пока владелец не склонирует её себе.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('delegations', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('source_tree_id')->constrained('trees')->cascadeOnDelete();
            $table->string('root_person_id', 64);
            // Персоны исходного древа, закрытые для правки на время делегирования (заполняется при принятии)
            $table->json('person_ids')->nullable();
            $table->foreignUlid('created_by')->constrained('users')->cascadeOnDelete();
            $table->string('invitee_email', 190)->nullable();
            $table->text('message')->nullable();
            // Ссылка-приглашение: хеш для поиска и зашифрованный токен, чтобы владелец мог снова скопировать ссылку
            $table->char('token_hash', 64)->nullable()->unique();
            $table->text('token_encrypted')->nullable();
            $table->string('status', 16)->index();
            $table->foreignUlid('target_tree_id')->nullable()->constrained('trees')->nullOnDelete();
            $table->foreignUlid('target_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('accepted_at')->nullable();
            $table->timestamp('ended_at')->nullable();
            $table->timestamp('expires_at');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('delegations');
    }
};
