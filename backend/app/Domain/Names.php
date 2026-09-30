<?php

namespace App\Domain;

/** Имена для писем и уведомлений. Повторяет shortName/formalName из frontend/src/domain/names.js. */
final class Names
{
    public const NONAME = 'Без имени';

    /** «Николай Романов» */
    public static function short(?array $p): string
    {
        if (! $p) {
            return self::NONAME;
        }
        $s = trim(implode(' ', array_filter([$p['firstName'] ?? '', $p['lastName'] ?? ''])));

        return $s !== '' ? $s : self::NONAME;
    }

    /** «Романов Николай Александрович» */
    public static function formal(?array $p): string
    {
        if (! $p) {
            return self::NONAME;
        }
        $last = $p['lastName'] ?? '';
        if (! empty($p['birthName']) && $p['birthName'] !== $last) {
            $last = $last ? "{$last} ({$p['birthName']})" : $p['birthName'];
        }
        $s = trim(implode(' ', array_filter([$last, $p['firstName'] ?? '', $p['middleName'] ?? ''])));

        return $s !== '' ? $s : self::NONAME;
    }
}
