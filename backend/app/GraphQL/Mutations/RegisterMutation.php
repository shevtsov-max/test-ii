<?php

namespace App\GraphQL\Mutations;

use App\GraphQL\Support\BaseMutation;
use App\GraphQL\Support\Throttle;
use App\Models\User;
use App\Services\Auth\EmailVerification;
use App\Services\Auth\TokenService;
use App\Services\Legal\ConsentService;
use GraphQL\Type\Definition\Type;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rules\Password;
use Rebing\GraphQL\Support\Facades\GraphQL;

/** Регистрация: учётная запись + журнал согласий + письмо для подтверждения почты. */
class RegisterMutation extends BaseMutation
{
    protected $attributes = ['name' => 'register', 'description' => 'Создать учётную запись'];

    public function type(): Type
    {
        return Type::nonNull(GraphQL::type('AuthPayload'));
    }

    public function args(): array
    {
        return ['input' => ['type' => Type::nonNull(GraphQL::type('RegisterInput'))]];
    }

    protected function rules(array $args = []): array
    {
        return [
            'input.name' => ['required', 'string', 'max:100'],
            'input.email' => ['required', 'string', 'email:rfc', 'max:190', 'unique:users,email'],
            'input.password' => ['required', 'string', Password::min(8)->letters()->numbers()],
            'input.consents' => ['array'],
        ];
    }

    public function resolve($root, array $args, $ctx, Request $request, TokenService $tokens, ConsentService $consents, EmailVerification $verification): array
    {
        Throttle::hit('register:'.$request->ip(), 10, 3600);
        $input = $args['input'];
        $consents->assertRequiredAccepted($input['consents']);

        $user = DB::transaction(function () use ($input, $request, $consents) {
            $user = User::create([
                'name' => trim($input['name']),
                'email' => mb_strtolower(trim($input['email'])),
                'password' => $input['password'],
            ]);
            $consents->record($user, $input['consents'], $request);

            return $user;
        });
        $verification->send($user);

        return $tokens->issue($user, $request);
    }
}
