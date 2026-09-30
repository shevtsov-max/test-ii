<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/** Приглашение в древо (совместный доступ). */
class TreeInvitationMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(public string $inviter, public string $treeName, public string $role, public string $link) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: "{$this->inviter} приглашает вас в древо «{$this->treeName}»");
    }

    public function content(): Content
    {
        return new Content(markdown: 'mail.tree-invitation');
    }
}
