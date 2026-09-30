<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/** Письмо со ссылкой подтверждения почты. */
class VerifyEmailMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(public string $name, public string $link) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: 'Подтвердите почту — Родословная');
    }

    public function content(): Content
    {
        return new Content(markdown: 'mail.verify-email');
    }
}
