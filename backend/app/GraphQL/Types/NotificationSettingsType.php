<?php

namespace App\GraphQL\Types;

use GraphQL\Type\Definition\Type;
use Rebing\GraphQL\Support\Type as GraphQLType;

class NotificationSettingsType extends GraphQLType
{
    protected $attributes = [
        'name' => 'NotificationSettings',
        'description' => 'Уведомления о памятных датах',
    ];

    public function fields(): array
    {
        return [
            'available' => ['type' => Type::nonNull(Type::boolean()), 'description' => 'Бот Telegram настроен на сервере'],
            'botUsername' => ['type' => Type::string()],
            'telegramLinked' => ['type' => Type::nonNull(Type::boolean())],
            'telegramUsername' => ['type' => Type::string()],
            'enabled' => ['type' => Type::nonNull(Type::boolean())],
            'sendTime' => ['type' => Type::nonNull(Type::string()), 'description' => '«ЧЧ:ММ» по местному времени'],
            'timezone' => ['type' => Type::nonNull(Type::string())],
            'birthdays' => ['type' => Type::nonNull(Type::boolean())],
            'anniversaries' => ['type' => Type::nonNull(Type::boolean()), 'description' => 'Годовщины свадеб'],
            'memorials' => ['type' => Type::nonNull(Type::boolean()), 'description' => 'Дни памяти умерших'],
        ];
    }
}
