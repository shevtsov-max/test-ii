<?php

namespace App\GraphQL\Inputs;

use GraphQL\Type\Definition\Type;
use Rebing\GraphQL\Support\InputType;

class NotificationSettingsInput extends InputType
{
    protected $attributes = [
        'name' => 'NotificationSettingsInput',
        'description' => 'Настройки уведомлений',
    ];

    public function fields(): array
    {
        return [
            'enabled' => ['type' => Type::boolean()],
            'sendTime' => ['type' => Type::string(), 'description' => '«ЧЧ:ММ»'],
            'timezone' => ['type' => Type::string(), 'description' => 'Например, Europe/Moscow'],
            'birthdays' => ['type' => Type::boolean()],
            'anniversaries' => ['type' => Type::boolean()],
            'memorials' => ['type' => Type::boolean()],
        ];
    }
}
