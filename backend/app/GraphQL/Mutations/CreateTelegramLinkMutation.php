<?php

namespace App\GraphQL\Mutations;

use App\GraphQL\Support\ApiError;
use App\GraphQL\Support\BaseMutation;
use App\Models\UserToken;
use App\Services\Auth\OneTimeTokens;
use App\Services\Notifications\TelegramClient;
use GraphQL\Type\Definition\Type;
use Rebing\GraphQL\Support\Facades\GraphQL;

/** Ссылка t.me/<бот>?start=<токен>: пользователь открывает её, бот привязывает чат к учётной записи. */
class CreateTelegramLinkMutation extends BaseMutation
{
    protected $attributes = ['name' => 'createTelegramLink', 'description' => 'Ссылка для подключения Telegram'];

    public function type(): Type
    {
        return Type::nonNull(GraphQL::type('TelegramLink'));
    }

    public function resolve($root, array $args, $ctx, OneTimeTokens $tokens, TelegramClient $telegram): array
    {
        if (! $telegram->configured()) {
            throw new ApiError('Уведомления в Telegram пока не настроены на сервере', ApiError::UNSUPPORTED);
        }
        // Токен в deep-link Telegram: только латиница и цифры, до 64 символов
        $token = $tokens->create($this->user(), UserToken::TELEGRAM_LINK, 30);

        return [
            'url' => 'https://t.me/'.$telegram->username().'?start='.$token,
            'expiresAt' => now()->addMinutes(30),
        ];
    }
}
