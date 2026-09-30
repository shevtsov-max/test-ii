<?php

namespace Tests\Feature;

use App\Mail\ResetPasswordMail;
use App\Mail\VerifyEmailMail;
use App\Models\Consent;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    private const REGISTER = 'mutation($input: RegisterInput!) { register(input: $input) { accessToken refreshToken user { id email emailVerified pendingConsents } } }';

    private const ME = '{ me { id email name emailVerified pendingConsents } }';

    public function test_registration_requires_all_documents(): void
    {
        $res = $this->graphql(self::REGISTER, ['input' => ['name' => 'Иван', 'email' => 'ivan@example.com', 'password' => 'secret123', 'consents' => []]]);
        $this->assertSame('VALIDATION', $res->json('errors.0.extensions.code'));
        $this->assertSame(0, User::count());
    }

    public function test_registration_records_consents_and_sends_verification(): void
    {
        Mail::fake();
        $data = $this->gqlData(self::REGISTER, ['input' => ['name' => 'Иван', 'email' => 'Ivan@Example.com', 'password' => 'secret123', 'consents' => $this->consents()]]);

        $user = User::firstOrFail();
        $this->assertSame('ivan@example.com', $user->email);
        $this->assertFalse($data['register']['user']['emailVerified']);
        $this->assertSame([], $data['register']['user']['pendingConsents']);
        $this->assertSame(3, Consent::where('user_id', $user->id)->count());
        $this->assertNotNull(Consent::first()->ip);
        Mail::assertQueued(VerifyEmailMail::class);

        // Токен доступа работает
        $me = $this->gqlData(self::ME, [], $data['register']['accessToken']);
        $this->assertSame($user->id, $me['me']['id']);
    }

    public function test_validation_errors_are_mapped_to_fields(): void
    {
        User::factory()->create(['email' => 'taken@example.com']);
        $res = $this->graphql(self::REGISTER, ['input' => ['name' => 'Иван', 'email' => 'taken@example.com', 'password' => 'short', 'consents' => $this->consents()]]);
        $this->assertSame('VALIDATION', $res->json('errors.0.extensions.code'));
        $this->assertArrayHasKey('email', $res->json('errors.0.extensions.fields'));
        $this->assertArrayHasKey('password', $res->json('errors.0.extensions.fields'));
    }

    public function test_login_and_wrong_password(): void
    {
        User::factory()->create(['email' => 'a@example.com']);
        $q = 'mutation($e: String!, $p: String!) { login(email: $e, password: $p) { accessToken user { email } } }';
        $this->assertSame('VALIDATION', $this->gqlErrorCode($q, ['e' => 'a@example.com', 'p' => 'wrong123']));
        $this->assertSame('a@example.com', $this->gqlData($q, ['e' => 'A@example.com ', 'p' => 'password1'])['login']['user']['email']);
    }

    public function test_me_is_null_without_token_and_protected_fields_require_auth(): void
    {
        $this->assertNull($this->gqlData(self::ME)['me']);
        $this->assertSame('UNAUTHENTICATED', $this->gqlErrorCode('{ trees { id } }'));
    }

    public function test_refresh_rotates_and_detects_reuse(): void
    {
        User::factory()->create(['email' => 'a@example.com']);
        $login = $this->gqlData('mutation { login(email: "a@example.com", password: "password1") { refreshToken } }')['login'];
        $q = 'mutation($t: String!) { refreshToken(refreshToken: $t) { accessToken refreshToken } }';

        $first = $this->gqlData($q, ['t' => $login['refreshToken']])['refreshToken'];
        $this->assertNotSame($login['refreshToken'], $first['refreshToken']);
        // Повторное использование старого токена → вся цепочка отозвана
        $this->assertSame('UNAUTHENTICATED', $this->gqlErrorCode($q, ['t' => $login['refreshToken']]));
        $this->assertSame('UNAUTHENTICATED', $this->gqlErrorCode($q, ['t' => $first['refreshToken']]));
    }

    public function test_password_reset_flow(): void
    {
        Mail::fake();
        $user = User::factory()->unverified()->create(['email' => 'a@example.com']);
        $this->gqlData('mutation { requestPasswordReset(email: "a@example.com") }');
        // Неизвестный адрес — тот же ответ
        $this->gqlData('mutation { requestPasswordReset(email: "nobody@example.com") }');

        $link = null;
        Mail::assertQueued(ResetPasswordMail::class, function ($m) use (&$link) {
            $link = $m->link;

            return true;
        });
        Mail::assertQueuedCount(1);
        parse_str(parse_url(str_replace('#/reset-password', '', $link), PHP_URL_QUERY), $q);

        $res = $this->gqlData('mutation($t: String!) { resetPassword(token: $t, password: "newpass456") { user { emailVerified } } }', ['t' => $q['token']]);
        $this->assertTrue($res['resetPassword']['user']['emailVerified']);
        $this->assertTrue(\Hash::check('newpass456', $user->fresh()->password));
        // Одноразовая ссылка
        $this->assertSame('VALIDATION', $this->gqlErrorCode('mutation($t: String!) { resetPassword(token: $t, password: "other789x") { accessToken } }', ['t' => $q['token']]));
    }

    public function test_email_verification(): void
    {
        Mail::fake();
        [$user, $token] = $this->login(User::factory()->unverified()->create());
        $this->gqlData('mutation { resendVerificationEmail }', [], $token);
        $link = null;
        Mail::assertQueued(VerifyEmailMail::class, function ($m) use (&$link) {
            $link = $m->link;

            return true;
        });
        parse_str(parse_url(str_replace('#/verify-email', '', $link), PHP_URL_QUERY), $q);
        $this->gqlData('mutation($t: String!) { verifyEmail(token: $t) }', ['t' => $q['token']]);
        $this->assertNotNull($user->fresh()->email_verified_at);
    }

    public function test_updated_documents_must_be_accepted_again(): void
    {
        [$user, $token] = $this->login();
        $this->assertSame(['terms', 'privacy', 'personal_data'], $this->gqlData(self::ME, [], $token)['me']['pendingConsents']);
        $this->gqlData('mutation($c: [ConsentInput!]!) { acceptDocuments(consents: $c) { id } }', ['c' => $this->consents()], $token);
        $this->assertSame([], $this->gqlData(self::ME, [], $token)['me']['pendingConsents']);

        config(['rodoslovnaya.legal.terms.version' => '2099-01-01']);
        $this->assertSame(['terms'], $this->gqlData(self::ME, [], $token)['me']['pendingConsents']);
    }

    public function test_marketing_consent_can_be_given_and_withdrawn(): void
    {
        [$user, $token] = $this->login();
        $set = 'mutation($v: Boolean!) { updateProfile(input: { marketingOptIn: $v }) { marketingOptIn } }';

        $this->assertTrue($this->gqlData($set, ['v' => true], $token)['updateProfile']['marketingOptIn']);
        $this->assertSame(1, Consent::where('user_id', $user->id)->where('document', 'marketing')->whereNull('revoked_at')->count());

        $this->assertFalse($this->gqlData($set, ['v' => false], $token)['updateProfile']['marketingOptIn']);
        // Отзыв остаётся в журнале
        $this->assertSame(1, Consent::where('user_id', $user->id)->where('document', 'marketing')->whereNotNull('revoked_at')->count());
    }

    public function test_delete_account_removes_trees(): void
    {
        [$user, $token] = $this->login();
        $this->gqlData('mutation { createTree(input: { name: "Моё древо" }) { id } }', [], $token);
        $this->assertSame('VALIDATION', $this->gqlErrorCode('mutation { deleteAccount(password: "nope") }', [], $token));
        $this->gqlData('mutation { deleteAccount(password: "password1") }', [], $token);
        $this->assertSame(0, User::count());
        $this->assertDatabaseCount('trees', 0);
    }
}
