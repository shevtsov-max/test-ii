<?php

namespace App\GraphQL\Support;

use GraphQL\Error\Error;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Validation\ValidationException;
use Rebing\GraphQL\Error\AuthorizationError;
use Rebing\GraphQL\Error\ValidationError;
use Rebing\GraphQL\GraphQL;

/**
 * Единый формат ошибок GraphQL: { message, extensions: { code, fields? } }.
 * Коды совпадают с ApiError на фронтенде; остальное — INTERNAL без подробностей (в режиме отладки — с ними).
 */
final class ErrorFormatter
{
    public static function format(Error $e): array
    {
        $base = GraphQL::formatError($e);
        $previous = $e->getPrevious();

        [$code, $message, $fields] = match (true) {
            $previous instanceof ApiError => [$previous->errorCode, $previous->getMessage(), $previous->fields],
            $previous instanceof ValidationError => ['VALIDATION', self::firstMessage($previous->getValidatorMessages()->getMessages()), self::fields($previous->getValidatorMessages()->getMessages())],
            $previous instanceof ValidationException => ['VALIDATION', self::firstMessage($previous->errors()), self::fields($previous->errors())],
            $previous instanceof AuthenticationException => ['UNAUTHENTICATED', 'Войдите в учётную запись', []],
            $e instanceof AuthorizationError => ['FORBIDDEN', 'Недостаточно прав', []],
            $previous instanceof ModelNotFoundException => ['NOT_FOUND', 'Не найдено', []],
            // Ошибки разбора запроса и типов (без исключения внутри) безопасны для клиента
            $previous === null => ['BAD_REQUEST', $e->getMessage(), []],
            default => ['INTERNAL', 'Внутренняя ошибка сервера. Попробуйте позже.', []],
        };

        $out = [
            'message' => $message,
            'extensions' => array_filter(['code' => $code, 'fields' => $fields ?: null]),
        ];
        if (isset($base['locations'])) {
            $out['locations'] = $base['locations'];
        }
        if (isset($base['path'])) {
            $out['path'] = $base['path'];
        }
        if (config('app.debug') && $code === 'INTERNAL' && $previous) {
            $out['extensions']['debug'] = $previous->getMessage().' @ '.$previous->getFile().':'.$previous->getLine();
        }

        return $out;
    }

    /** input.email → email: поля формы на фронтенде не знают об обёртке input */
    private static function fields(array $messages): array
    {
        $out = [];
        foreach ($messages as $key => $list) {
            $field = preg_replace('/^(input|changes)\./', '', (string) $key);
            $out[$field] ??= is_array($list) ? (string) reset($list) : (string) $list;
        }

        return $out;
    }

    private static function firstMessage(array $messages): string
    {
        foreach ($messages as $list) {
            return is_array($list) ? (string) reset($list) : (string) $list;
        }

        return 'Проверьте введённые данные';
    }
}
