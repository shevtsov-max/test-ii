<?php

namespace App\GraphQL\Mutations;

use App\GraphQL\Support\BaseMutation;
use App\Models\NotificationSetting;
use App\Services\Notifications\NotificationSettingsPresenter;
use GraphQL\Type\Definition\Type;
use Rebing\GraphQL\Support\Facades\GraphQL;

class DisconnectTelegramMutation extends BaseMutation
{
    protected $attributes = ['name' => 'disconnectTelegram', 'description' => 'Отвязать Telegram'];

    public function type(): Type
    {
        return Type::nonNull(GraphQL::type('NotificationSettings'));
    }

    public function resolve($root, array $args, $ctx, NotificationSettingsPresenter $presenter): array
    {
        $user = $this->user();
        NotificationSetting::where('user_id', $user->id)->update(['telegram_chat_id' => null, 'telegram_username' => null, 'telegram_linked_at' => null]);

        return $presenter->present($user);
    }
}
