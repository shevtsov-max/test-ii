<?php

namespace Tests\Feature;

use App\Models\NotificationSetting;
use App\Services\Notifications\DailyDigest;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class MediaAndNotificationsTest extends TestCase
{
    use RefreshDatabase;

    public function test_upload_by_signed_url_and_download(): void
    {
        Storage::fake('media');
        [, $token] = $this->login();
        $tree = $this->gqlData('mutation { createTree(input: { name: "Фото" }) { id } }', [], $token)['createTree']['id'];
        $up = $this->gqlData('mutation($t: ID!) { createUpload(treeId: $t, filename: "дед.jpg", mime: "image/jpeg", size: 11) { uploadUrl fileUrl } }', ['t' => $tree], $token)['createUpload'];

        $this->call('PUT', $up['uploadUrl'], [], [], [], ['CONTENT_TYPE' => 'image/jpeg', 'CONTENT_LENGTH' => 11], 'jpeg-binary')->assertOk();
        $this->get($up['fileUrl'])->assertOk();
        // Повторно по той же ссылке — нельзя; подделанная подпись — нельзя
        $this->call('PUT', $up['uploadUrl'], [], [], [], [], 'again')->assertStatus(422);
        $this->call('PUT', preg_replace('/signature=[^&]+/', 'signature=bad', $up['uploadUrl']), [], [], [], [], 'x')->assertStatus(403);
        // Неподдерживаемый тип файла
        $this->assertSame('VALIDATION', $this->gqlErrorCode('mutation($t: ID!) { createUpload(treeId: $t, filename: "x.exe", mime: "application/x-msdownload", size: 10) { uploadUrl } }', ['t' => $tree], $token));
    }

    public function test_embedded_data_urls_become_files(): void
    {
        Storage::fake('media');
        [, $token] = $this->login();
        $png = 'data:image/png;base64,'.base64_encode('fake-png');
        $tree = $this->gqlData('mutation($i: CreateTreeInput!) { createTree(input: $i) { id } }', ['i' => ['name' => 'Импорт', 'data' => [
            'persons' => ['p1' => ['id' => 'p1', 'firstName' => 'Иван']],
            'media' => ['m1' => ['id' => 'm1', 'kind' => 'photo', 'src' => $png, 'personIds' => ['p1']]],
        ]]], $token)['createTree']['id'];
        $src = $this->gqlData('query($id: ID!) { tree(id: $id) { media { src size } } }', ['id' => $tree], $token)['tree']['media'][0];
        $this->assertStringStartsWith('/files/', $src['src']);
        $this->assertSame(8, $src['size']);
    }

    public function test_upcoming_events_and_daily_digest(): void
    {
        CarbonImmutable::setTestNow('2026-10-05 10:00:00');
        [$user, $token] = $this->login();
        $data = $this->sampleTreeData();
        $data['persons']['me']['birth']['date'] = ['qualifier' => 'exact', 'day' => 5, 'month' => 10, 'year' => 1985];
        // Старый стиль: 22 сентября 1900 ст. ст. = 5 октября по новому
        $data['persons']['gf']['birth']['date'] = ['qualifier' => 'exact', 'day' => 22, 'month' => 9, 'year' => 1900, 'calendar' => 'julian'];
        $data['persons']['sis']['birth']['date'] = ['qualifier' => 'exact', 'day' => 7, 'month' => 10, 'year' => 1989];
        $this->gqlData('mutation($i: CreateTreeInput!) { createTree(input: $i) { id } }', ['i' => ['name' => 'Орловы', 'data' => $data]], $token);

        $events = $this->gqlData('{ upcomingEvents(days: 7, timezone: "Europe/Moscow") { kind inDays years names treeName } }', [], $token)['upcomingEvents'];
        $this->assertSame(['kind' => 'birthday', 'inDays' => 0, 'years' => 41, 'names' => ['Алексей Орлов'], 'treeName' => 'Орловы'], $events[0]);
        $this->assertContains('memory_birth', array_column($events, 'kind'));
        $this->assertContains(2, array_column($events, 'inDays'));

        // Сводка в Telegram
        config(['rodoslovnaya.telegram.bot_token' => 'test', 'rodoslovnaya.telegram.bot_username' => 'rodoslovnaya_bot']);
        Http::fake(['*' => Http::response(['ok' => true])]);
        NotificationSetting::create(['user_id' => $user->id, 'telegram_chat_id' => '42', 'send_time' => '09:00', 'timezone' => 'Europe/Moscow']);
        $this->assertSame(1, app(DailyDigest::class)->sendDue());
        $this->assertSame(0, app(DailyDigest::class)->sendDue(), 'второй раз за день не отправляем');
        Http::assertSent(fn (HttpRequest $r) => str_contains($r['text'], 'Алексей Орлов — исполняется 41 год') && $r['chat_id'] === '42');
        CarbonImmutable::setTestNow();
    }

    public function test_telegram_linking_through_bot(): void
    {
        config(['rodoslovnaya.telegram.bot_token' => 'test', 'rodoslovnaya.telegram.bot_username' => 'rodoslovnaya_bot', 'rodoslovnaya.telegram.webhook_secret' => 'hook-secret']);
        Http::fake(['*' => Http::response(['ok' => true])]);
        [$user, $token] = $this->login();

        $settings = $this->gqlData('{ notificationSettings { available telegramLinked botUsername } }', [], $token)['notificationSettings'];
        $this->assertSame(['available' => true, 'telegramLinked' => false, 'botUsername' => 'rodoslovnaya_bot'], $settings);

        $url = $this->gqlData('mutation { createTelegramLink { url } }', [], $token)['createTelegramLink']['url'];
        $start = substr($url, strpos($url, 'start=') + 6);

        $update = ['update_id' => 1, 'message' => ['chat' => ['id' => 777, 'type' => 'private'], 'from' => ['username' => 'ivan'], 'text' => '/start '.$start]];
        $this->postJson('/telegram/webhook', $update)->assertForbidden();
        $this->postJson('/telegram/webhook', $update, ['X-Telegram-Bot-Api-Secret-Token' => 'hook-secret'])->assertNoContent();

        $this->assertSame('777', NotificationSetting::find($user->id)->telegram_chat_id);
        $this->assertTrue($this->gqlData('{ notificationSettings { telegramLinked } }', [], $token)['notificationSettings']['telegramLinked']);
        $this->gqlData('mutation { updateNotificationSettings(input: { sendTime: "08:30", memorials: true }) { sendTime memorials } }', [], $token);
        $this->assertSame('VALIDATION', $this->gqlErrorCode('mutation { updateNotificationSettings(input: { sendTime: "25:00" }) { sendTime } }', [], $token));
    }
}
