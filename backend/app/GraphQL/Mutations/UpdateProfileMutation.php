<?php

namespace App\GraphQL\Mutations;

use App\GraphQL\Support\ApiError;
use App\GraphQL\Support\BaseMutation;
use App\Services\Auth\EmailVerification;
use App\Services\Legal\ConsentService;
use GraphQL\Type\Definition\Type;
use Illuminate\Validation\Rule;
use Rebing\GraphQL\Support\Facades\GraphQL;

class UpdateProfileMutation extends BaseMutation
{
    protected $attributes = ['name' => 'updateProfile', 'description' => 'Изменить имя, почту, фото или согласие на рассылку'];

    public function type(): Type
    {
        return Type::nonNull(GraphQL::type('User'));
    }

    public function args(): array
    {
        return ['input' => ['type' => Type::nonNull(GraphQL::type('ProfileInput'))]];
    }

    protected function rules(array $args = []): array
    {
        $user = $this->user();

        return [
            'input.name' => ['sometimes', 'string', 'min:1', 'max:100'],
            'input.email' => ['sometimes', 'string', 'email:rfc', 'max:190', Rule::unique('users', 'email')->ignore($user->id)],
            'input.avatar' => ['sometimes', 'nullable', 'string', 'max:400000'],
            'input.marketingOptIn' => ['sometimes', 'boolean'],
        ];
    }

    public function resolve($root, array $args, $ctx, EmailVerification $verification, ConsentService $consents)
    {
        $user = $this->user();
        $input = $args['input'];
        if (array_key_exists('avatar', $input) && $input['avatar'] !== null && ! preg_match('~^data:image/(jpeg|png|webp);base64,~', $input['avatar'])) {
            throw ApiError::validation('Фото должно быть изображением', ['avatar' => 'Неподдерживаемый формат']);
        }
        if (isset($input['name'])) {
            $user->name = trim($input['name']) ?: $user->name;
        }
        if (array_key_exists('avatar', $input)) {
            $user->avatar = $input['avatar'];
        }
        $emailChanged = isset($input['email']) && mb_strtolower(trim($input['email'])) !== $user->email;
        if ($emailChanged) {
            $user->email = mb_strtolower(trim($input['email']));
            $user->email_verified_at = null;
        }
        $user->save();
        if (isset($input['marketingOptIn'])) {
            $consents->setMarketing($user, $input['marketingOptIn'], request());
        }
        if ($emailChanged) {
            $verification->send($user);
        }

        return $user;
    }
}
