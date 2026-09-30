<?php

namespace App\GraphQL\Support;

use GraphQL\Error\ClientAware;
use GraphQL\Error\ProvidesExtensions;

/**
 * Ошибка, понятная клиенту: сообщение показывается пользователю, код — в extensions.code,
 * ошибки полей формы — в extensions.fields. Фронтенд превращает её в ApiError (frontend/src/api/errors.js).
 */
class ApiError extends \RuntimeException implements ClientAware, ProvidesExtensions
{
    public const UNAUTHENTICATED = 'UNAUTHENTICATED';

    public const FORBIDDEN = 'FORBIDDEN';

    public const NOT_FOUND = 'NOT_FOUND';

    public const VALIDATION = 'VALIDATION';

    public const CONFLICT = 'CONFLICT';

    public const RATE_LIMITED = 'RATE_LIMITED';

    public const UNSUPPORTED = 'UNSUPPORTED';

    /** @param array<string, string> $fields */
    public function __construct(string $message, public readonly string $errorCode, public readonly array $fields = [])
    {
        parent::__construct($message);
    }

    public static function unauthenticated(string $message = 'Войдите в учётную запись'): self
    {
        return new self($message, self::UNAUTHENTICATED);
    }

    public static function forbidden(string $message = 'Недостаточно прав'): self
    {
        return new self($message, self::FORBIDDEN);
    }

    public static function notFound(string $message = 'Не найдено'): self
    {
        return new self($message, self::NOT_FOUND);
    }

    /** @param array<string, string> $fields */
    public static function validation(string $message, array $fields = []): self
    {
        return new self($message, self::VALIDATION, $fields);
    }

    public static function conflict(string $message): self
    {
        return new self($message, self::CONFLICT);
    }

    public static function tooManyAttempts(int $seconds): self
    {
        $minutes = max(1, (int) ceil($seconds / 60));

        return new self("Слишком много попыток. Повторите через {$minutes} мин.", self::RATE_LIMITED);
    }

    public function isClientSafe(): bool
    {
        return true;
    }

    public function getExtensions(): ?array
    {
        return array_filter(['code' => $this->errorCode, 'fields' => $this->fields ?: null]);
    }
}
