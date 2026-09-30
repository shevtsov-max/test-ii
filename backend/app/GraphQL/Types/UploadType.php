<?php

namespace App\GraphQL\Types;

use GraphQL\Type\Definition\Type;
use Rebing\GraphQL\Support\Facades\GraphQL;
use Rebing\GraphQL\Support\Type as GraphQLType;

class UploadType extends GraphQLType
{
    protected $attributes = [
        'name' => 'Upload',
        'description' => 'Подписанная ссылка для загрузки файла',
    ];

    public function fields(): array
    {
        return [
            'uploadUrl' => ['type' => Type::nonNull(Type::string()), 'description' => 'PUT сюда тело файла'],
            'fileUrl' => ['type' => Type::nonNull(Type::string()), 'description' => 'Адрес файла после загрузки'],
            'thumbUrl' => ['type' => Type::string()],
            'headers' => ['type' => GraphQL::type('JSON'), 'description' => 'Дополнительные заголовки PUT'],
        ];
    }
}
