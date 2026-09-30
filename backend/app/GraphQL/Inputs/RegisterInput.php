<?php

namespace App\GraphQL\Inputs;

use GraphQL\Type\Definition\Type;
use Rebing\GraphQL\Support\Facades\GraphQL;
use Rebing\GraphQL\Support\InputType;

class RegisterInput extends InputType
{
    protected $attributes = [
        'name' => 'RegisterInput',
        'description' => 'Регистрация',
    ];

    public function fields(): array
    {
        return [
            'name' => ['type' => Type::nonNull(Type::string())],
            'email' => ['type' => Type::nonNull(Type::string())],
            'password' => ['type' => Type::nonNull(Type::string()), 'description' => 'Не короче 8 символов, буквы и цифры'],
            'consents' => ['type' => Type::nonNull(Type::listOf(Type::nonNull(GraphQL::type('ConsentInput')))), 'description' => 'Принятые документы'],
        ];
    }
}
