<?php

namespace App\GraphQL\Mutations;

use App\GraphQL\Support\ApiError;
use App\GraphQL\Support\BaseMutation;
use App\GraphQL\Support\Throttle;
use GraphQL\Type\Definition\Type;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;

class ChangePasswordMutation extends BaseMutation
{
    protected $attributes = ['name' => 'changePassword', 'description' => 'Сменить пароль'];

    public function type(): Type
    {
        return Type::nonNull(Type::boolean());
    }

    public function args(): array
    {
        return [
            'current' => ['type' => Type::nonNull(Type::string())],
            'next' => ['type' => Type::nonNull(Type::string())],
        ];
    }

    protected function rules(array $args = []): array
    {
        return ['next' => ['required', 'string', Password::min(8)->letters()->numbers()]];
    }

    public function resolve($root, array $args): bool
    {
        $user = $this->user();
        Throttle::hit('change-password:'.$user->id, 10, 3600);
        if (! Hash::check($args['current'], $user->password)) {
            throw ApiError::validation('Текущий пароль указан неверно', ['current' => 'Неверный пароль']);
        }
        $user->update(['password' => $args['next']]);
        // Остальные устройства выходят: текущий токен доступа остаётся, чужие — нет
        $current = $user->currentAccessToken();
        $user->tokens()->when($current?->id, fn ($q, $id) => $q->where('id', '!=', $id))->delete();

        return true;
    }
}
