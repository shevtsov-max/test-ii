<?php

namespace App\Services\Legal;

use App\GraphQL\Support\ApiError;
use App\Models\Consent;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/**
 * Согласия с документами (пользовательское соглашение, политика, согласие на обработку ПДн).
 * Каждое согласие записывается в журнал с редакцией документа, временем и IP — это доказательство
 * для Роскомнадзора. Если документ обновился, пользователь увидит просьбу принять новую редакцию.
 */
final class ConsentService
{
    /** @return array<string, array{version: string, required: bool}> */
    public function documents(): array
    {
        return config('rodoslovnaya.legal');
    }

    /**
     * Проверить, что приняты все обязательные документы в текущей редакции.
     *
     * @param  list<array{document: string, version: string}>  $consents
     */
    public function assertRequiredAccepted(array $consents): void
    {
        $given = collect($consents)->mapWithKeys(fn ($c) => [$c['document'] => $c['version']]);
        foreach ($this->documents() as $doc => $info) {
            if (! $info['required']) {
                continue;
            }
            if (! $given->has($doc)) {
                throw ApiError::validation('Необходимо принять условия и дать согласие на обработку персональных данных', ['consents' => 'Отметьте обязательные согласия']);
            }
            if ($given[$doc] !== $info['version']) {
                throw ApiError::validation('Документы обновились — обновите страницу и примите новую редакцию', ['consents' => 'Устаревшая редакция документа']);
            }
        }
    }

    /** @param list<array{document: string, version: string}> $consents */
    public function record(User $user, array $consents, Request $request): void
    {
        $docs = $this->documents();
        foreach ($consents as $c) {
            if (! isset($docs[$c['document']]) || $docs[$c['document']]['version'] !== $c['version']) {
                continue;
            }
            Consent::create([
                'user_id' => $user->id,
                'document' => $c['document'],
                'version' => $c['version'],
                'accepted_at' => now(),
                'ip' => $request->ip(),
                'user_agent' => Str::limit((string) $request->userAgent(), 250, ''),
            ]);
            if ($c['document'] === 'marketing') {
                $user->update(['marketing_opt_in' => true]);
            }
        }
    }

    /**
     * Согласие на информационные сообщения: дать (запись в журнал) или отозвать.
     * Отзыв тоже фиксируется — время отзыва остаётся в журнале.
     */
    public function setMarketing(User $user, bool $optIn, Request $request): void
    {
        if ($optIn === (bool) $user->marketing_opt_in) {
            return;
        }
        if ($optIn) {
            $this->record($user, [['document' => 'marketing', 'version' => $this->documents()['marketing']['version']]], $request);

            return;
        }
        Consent::where('user_id', $user->id)->where('document', 'marketing')->whereNull('revoked_at')->update(['revoked_at' => now()]);
        $user->update(['marketing_opt_in' => false]);
    }

    /**
     * Обязательные документы, которые пользователь ещё не принял в текущей редакции.
     *
     * @return list<string>
     */
    public function pending(User $user): array
    {
        $accepted = Consent::where('user_id', $user->id)->get(['document', 'version'])
            ->groupBy('document')
            ->map(fn ($rows) => $rows->pluck('version')->all());
        $out = [];
        foreach ($this->documents() as $doc => $info) {
            if ($info['required'] && ! in_array($info['version'], $accepted[$doc] ?? [], true)) {
                $out[] = $doc;
            }
        }

        return $out;
    }
}
