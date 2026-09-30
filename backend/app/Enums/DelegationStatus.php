<?php

namespace App\Enums;

/**
 * pending  — приглашение отправлено, ветка ещё редактируется владельцем;
 * active   — родственник принял: у него своё древо, у владельца ветка только для просмотра;
 * cloned   — владелец скопировал ветку себе, связь завершена;
 * declined — родственник отказался; revoked — владелец отозвал приглашение;
 * ended    — древо родственника удалено (ветка автоматически вернулась владельцу).
 */
enum DelegationStatus: string
{
    case Pending = 'pending';
    case Active = 'active';
    case Cloned = 'cloned';
    case Declined = 'declined';
    case Revoked = 'revoked';
    case Ended = 'ended';

    public function isOpen(): bool
    {
        return $this === self::Pending || $this === self::Active;
    }
}
