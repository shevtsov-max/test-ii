<?php

namespace App\GraphQL\Mutations;

use App\GraphQL\Support\ApiError;
use App\GraphQL\Support\BaseMutation;
use App\GraphQL\Support\Throttle;
use App\Models\NotificationSetting;
use App\Services\Notifications\DailyDigest;
use App\Services\Notifications\TelegramClient;
use Carbon\CarbonImmutable;
use GraphQL\Type\Definition\Type;

/** Прислать сводку «на сегодня» прямо сейчас — проверить, что уведомления доходят. */
class SendTestNotificationMutation extends BaseMutation
{
    protected $attributes = ['name' => 'sendTestNotification', 'description' => 'Отправить пробное уведомление'];

    public function type(): Type
    {
        return Type::nonNull(Type::boolean());
    }

    public function resolve($root, array $args, $ctx, DailyDigest $digest, TelegramClient $telegram): bool
    {
        $user = $this->user();
        Throttle::hit('test-notification:'.$user->id, 5, 600);
        $s = NotificationSetting::where('user_id', $user->id)->whereNotNull('telegram_chat_id')->first()
            ?? throw ApiError::validation('Сначала подключите Telegram');
        $text = $digest->compose($s, CarbonImmutable::now($s->timezone)->startOfDay(), true);
        if (! $telegram->send($s->telegram_chat_id, $text)) {
            throw ApiError::conflict('Telegram не принял сообщение. Проверьте, что бот не заблокирован, и подключите его заново.');
        }

        return true;
    }
}
