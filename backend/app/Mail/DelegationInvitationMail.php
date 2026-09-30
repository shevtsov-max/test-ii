<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/** Приглашение продолжить ветку древа (делегирование). */
class DelegationInvitationMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(public string $inviter, public string $treeName, public string $rootName, public int $persons, public ?string $message, public string $link) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: "{$this->inviter} предлагает вам продолжить ветку семейного древа");
    }

    public function content(): Content
    {
        return new Content(markdown: 'mail.delegation-invitation');
    }
}
