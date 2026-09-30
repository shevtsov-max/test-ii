<?php

namespace App\Enums;

/** Роль пользователя в древе. Значения совпадают с GraphQL-перечислением TreeRole. */
enum TreeRole: string
{
    case Owner = 'owner';
    case Editor = 'editor';
    case Viewer = 'viewer';

    /** Уровень прав: viewer < editor < owner */
    public function level(): int
    {
        return match ($this) {
            self::Viewer => 1,
            self::Editor => 2,
            self::Owner => 3,
        };
    }

    public function atLeast(self $role): bool
    {
        return $this->level() >= $role->level();
    }

    public function label(): string
    {
        return match ($this) {
            self::Owner => 'владелец',
            self::Editor => 'редактор',
            self::Viewer => 'читатель',
        };
    }
}
