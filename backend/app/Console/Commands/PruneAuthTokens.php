<?php

namespace App\Console\Commands;

use App\Models\RefreshToken;
use App\Models\UserToken;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('auth:prune-tokens')]
#[Description('Удалить истёкшие токены обновления и одноразовые токены')]
class PruneAuthTokens extends Command
{
    public function handle(): int
    {
        $a = RefreshToken::where('expires_at', '<', now()->subDay())->delete();
        $b = UserToken::where('expires_at', '<', now()->subDay())->delete();
        $this->info("Удалено: {$a} токенов обновления, {$b} одноразовых");

        return self::SUCCESS;
    }
}
