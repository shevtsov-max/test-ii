<?php

namespace App\GraphQL\Enums;

use Rebing\GraphQL\Support\EnumType;

class InvitationKindEnum extends EnumType
{
    protected $attributes = [
        'name' => 'InvitationKind',
        'description' => 'Вид приглашения: доступ к древу или передача ветки',
        'values' => [
            'member' => ['value' => 'member'],
            'delegation' => ['value' => 'delegation'],
        ],
    ];
}
