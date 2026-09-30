<?php

namespace App\GraphQL\Inputs;

use GraphQL\Type\Definition\Type;
use Rebing\GraphQL\Support\InputType;

class ProfileInput extends InputType
{
    protected $attributes = [
        'name' => 'ProfileInput',
        'description' => 'Изменение профиля',
    ];

    public function fields(): array
    {
        return [
            'name' => ['type' => Type::string()],
            'email' => ['type' => Type::string(), 'description' => 'Смена почты снимает отметку о подтверждении'],
            'avatar' => ['type' => Type::string(), 'description' => 'data:-изображение; null — удалить'],
            'marketingOptIn' => ['type' => Type::boolean(), 'description' => 'Согласие на информационные сообщения (дать или отозвать)'],
        ];
    }
}
