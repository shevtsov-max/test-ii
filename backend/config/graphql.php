<?php

declare(strict_types=1);

use App\GraphQL\Enums\CalendarEnum;
use App\GraphQL\Enums\CustomFieldTypeEnum;
use App\GraphQL\Enums\DateQualifierEnum;
use App\GraphQL\Enums\DelegationStatusEnum;
use App\GraphQL\Enums\EventTypeEnum;
use App\GraphQL\Enums\FamilyStatusEnum;
use App\GraphQL\Enums\GenderEnum;
use App\GraphQL\Enums\InvitationKindEnum;
use App\GraphQL\Enums\MediaKindEnum;
use App\GraphQL\Enums\MemberStatusEnum;
use App\GraphQL\Enums\PlaceTypeEnum;
use App\GraphQL\Enums\PrivacyEnum;
use App\GraphQL\Enums\SourceTypeEnum;
use App\GraphQL\Enums\TreeRoleEnum;
use App\GraphQL\Enums\UpcomingEventKindEnum;
use App\GraphQL\Inputs\ConsentInput;
use App\GraphQL\Inputs\CreateTreeInput;
use App\GraphQL\Inputs\NotificationSettingsInput;
use App\GraphQL\Inputs\ProfileInput;
use App\GraphQL\Inputs\RegisterInput;
use App\GraphQL\Inputs\TreeChangesInput;
use App\GraphQL\Inputs\TreeInfoInput;
use App\GraphQL\Mutations\AcceptDocumentsMutation;
use App\GraphQL\Mutations\AcceptInvitationMutation;
use App\GraphQL\Mutations\ApplyTreeChangesMutation;
use App\GraphQL\Mutations\ChangePasswordMutation;
use App\GraphQL\Mutations\CloneDelegationMutation;
use App\GraphQL\Mutations\CreateDelegationMutation;
use App\GraphQL\Mutations\CreateTelegramLinkMutation;
use App\GraphQL\Mutations\CreateTreeMutation;
use App\GraphQL\Mutations\CreateUploadMutation;
use App\GraphQL\Mutations\DeclineInvitationMutation;
use App\GraphQL\Mutations\DeleteAccountMutation;
use App\GraphQL\Mutations\DeleteTreeMutation;
use App\GraphQL\Mutations\DisconnectTelegramMutation;
use App\GraphQL\Mutations\InviteMemberMutation;
use App\GraphQL\Mutations\LoginMutation;
use App\GraphQL\Mutations\LogoutMutation;
use App\GraphQL\Mutations\RefreshTokenMutation;
use App\GraphQL\Mutations\RegisterMutation;
use App\GraphQL\Mutations\RemoveMemberMutation;
use App\GraphQL\Mutations\RequestPasswordResetMutation;
use App\GraphQL\Mutations\ResendVerificationEmailMutation;
use App\GraphQL\Mutations\ResetPasswordMutation;
use App\GraphQL\Mutations\RevokeDelegationMutation;
use App\GraphQL\Mutations\SendTestNotificationMutation;
use App\GraphQL\Mutations\UpdateMemberMutation;
use App\GraphQL\Mutations\UpdateNotificationSettingsMutation;
use App\GraphQL\Mutations\UpdateProfileMutation;
use App\GraphQL\Mutations\VerifyEmailMutation;
use App\GraphQL\Queries\DelegatedBranchesQuery;
use App\GraphQL\Queries\DelegationsQuery;
use App\GraphQL\Queries\InvitationQuery;
use App\GraphQL\Queries\MeQuery;
use App\GraphQL\Queries\NotificationSettingsQuery;
use App\GraphQL\Queries\TreeMembersQuery;
use App\GraphQL\Queries\TreeQuery;
use App\GraphQL\Queries\TreesQuery;
use App\GraphQL\Queries\UpcomingEventsQuery;
use App\GraphQL\Scalars\JsonScalar;
use App\GraphQL\Scalars\TimestampScalar;
use App\GraphQL\Support\ErrorFormatter;
use App\GraphQL\Types\AcceptInvitationResultType;
use App\GraphQL\Types\AuthPayloadType;
use App\GraphQL\Types\CitationType;
use App\GraphQL\Types\ClanType;
use App\GraphQL\Types\CreateDelegationResultType;
use App\GraphQL\Types\CustomFieldDefType;
use App\GraphQL\Types\DeathPointType;
use App\GraphQL\Types\DelegatedBranchType;
use App\GraphQL\Types\DelegationType;
use App\GraphQL\Types\FamilyType;
use App\GraphQL\Types\GDateType;
use App\GraphQL\Types\InvitationType;
use App\GraphQL\Types\LifeEventType;
use App\GraphQL\Types\LifePointType;
use App\GraphQL\Types\MediaType;
use App\GraphQL\Types\NotificationSettingsType;
use App\GraphQL\Types\PersonType;
use App\GraphQL\Types\PlaceType;
use App\GraphQL\Types\SaveResultType;
use App\GraphQL\Types\SourceType;
use App\GraphQL\Types\TelegramLinkType;
use App\GraphQL\Types\TreeMemberType;
use App\GraphQL\Types\TreeSummaryType;
use App\GraphQL\Types\TreeType;
use App\GraphQL\Types\UpcomingEventType;
use App\GraphQL\Types\UploadType;
use App\GraphQL\Types\UserType;
use Illuminate\Support\Str;
use Rebing\GraphQL\GraphQL;
use Rebing\GraphQL\GraphQLController;
use Rebing\GraphQL\Support\CursorPaginationType;
use Rebing\GraphQL\Support\ExecutionMiddleware\AddAuthUserContextValueMiddleware;
use Rebing\GraphQL\Support\ExecutionMiddleware\AutomaticPersistedQueriesMiddleware;
use Rebing\GraphQL\Support\ExecutionMiddleware\ValidateOperationParamsMiddleware;
use Rebing\GraphQL\Support\PaginationType;
use Rebing\GraphQL\Support\SimplePaginationType;

return [
    'route' => [
        // The prefix for routes; do NOT use a leading slash!
        'prefix' => 'graphql',

        // The controller/method to use in GraphQL request.
        // Also supported array syntax: `[\Rebing\GraphQL\GraphQLController::class, 'query']`
        'controller' => GraphQLController::class.'@query',

        // Any middleware for the graphql route group
        // This middleware will apply to all schemas
        //
        // To protect against CSRF when using cookie/session authentication,
        // add the CsrfGuard middleware:
        //
        // \Rebing\GraphQL\Support\Middleware\CsrfGuard::class,
        //
        // Or with custom options (e.g. permissive mode for mixed browser/API clients):
        //
        // \Rebing\GraphQL\Support\Middleware\CsrfGuard::using(strictWhenAmbiguous: false),
        //
        'middleware' => [],

        // Additional route group attributes
        //
        // Example:
        //
        // 'group_attributes' => ['guard' => 'api']
        //
        'group_attributes' => [],
    ],

    // The name of the default schema
    // Used when the route group is directly accessed
    'default_schema' => 'default',

    'batching' => [
        // Whether to support GraphQL batching or not.
        // See e.g. https://www.apollographql.com/blog/batching-client-graphql-queries-a685f5bcd41b/
        // for pro and con
        'enable' => false,

        // Maximum number of operations allowed in a single batched request.
        // This limits DoS amplification by preventing an attacker from sending
        // thousands of operations in one HTTP request. Set to null for no limit.
        'max_batch_size' => 10,
    ],

    // The schemas for query and/or mutation. It expects an array of schemas to provide
    // both the 'query' fields and the 'mutation' fields.
    //
    // You can also provide a middleware that will only apply to the given schema
    //
    // Example:
    //
    //  'schemas' => [
    //      'default' => [
    //          'controller' => MyController::class . '@method',
    //          'query' => [
    //              App\GraphQL\Queries\UsersQuery::class,
    //          ],
    //          'mutation' => [
    //
    //          ]
    //      ],
    //      'user' => [
    //          'query' => [
    //              App\GraphQL\Queries\ProfileQuery::class,
    //          ],
    //          'mutation' => [
    //
    //          ],
    //          'middleware' => ['auth'],
    //      ],
    //      'user/me' => [
    //          'query' => [
    //              App\GraphQL\Queries\MyProfileQuery::class,
    //          ],
    //          'mutation' => [
    //
    //          ],
    //          'middleware' => ['auth'],
    //      ],
    //  ]
    //
    'schemas' => [
        'default' => [
            'query' => [
                DelegatedBranchesQuery::class,
                DelegationsQuery::class,
                InvitationQuery::class,
                MeQuery::class,
                NotificationSettingsQuery::class,
                TreeMembersQuery::class,
                TreeQuery::class,
                TreesQuery::class,
                UpcomingEventsQuery::class,
            ],
            'mutation' => [
                AcceptDocumentsMutation::class,
                AcceptInvitationMutation::class,
                ApplyTreeChangesMutation::class,
                ChangePasswordMutation::class,
                CloneDelegationMutation::class,
                CreateDelegationMutation::class,
                CreateTelegramLinkMutation::class,
                CreateTreeMutation::class,
                CreateUploadMutation::class,
                DeclineInvitationMutation::class,
                DeleteAccountMutation::class,
                DeleteTreeMutation::class,
                DisconnectTelegramMutation::class,
                InviteMemberMutation::class,
                LoginMutation::class,
                LogoutMutation::class,
                RefreshTokenMutation::class,
                RegisterMutation::class,
                RemoveMemberMutation::class,
                RequestPasswordResetMutation::class,
                ResendVerificationEmailMutation::class,
                ResetPasswordMutation::class,
                RevokeDelegationMutation::class,
                SendTestNotificationMutation::class,
                UpdateMemberMutation::class,
                UpdateNotificationSettingsMutation::class,
                UpdateProfileMutation::class,
                VerifyEmailMutation::class,
            ],
            'types' => [],
            // Ограничение частоты запросов (AppServiceProvider: RateLimiter::for('graphql'))
            'middleware' => ['throttle:graphql'],
            'method' => ['POST'],
            'execution_middleware' => null,
            'route_attributes' => [],
        ],
    ],

    // The global types available to all schemas.
    // You can then access it from the facade like this: GraphQL::type('user')
    //
    // Example:
    //
    // 'types' => [
    //     App\GraphQL\Types\UserType::class
    // ]
    //
    'types' => [
        JsonScalar::class,
        TimestampScalar::class,
        CalendarEnum::class,
        CustomFieldTypeEnum::class,
        DateQualifierEnum::class,
        DelegationStatusEnum::class,
        EventTypeEnum::class,
        FamilyStatusEnum::class,
        GenderEnum::class,
        InvitationKindEnum::class,
        MediaKindEnum::class,
        MemberStatusEnum::class,
        PlaceTypeEnum::class,
        PrivacyEnum::class,
        SourceTypeEnum::class,
        TreeRoleEnum::class,
        UpcomingEventKindEnum::class,
        AcceptInvitationResultType::class,
        AuthPayloadType::class,
        CitationType::class,
        ClanType::class,
        CreateDelegationResultType::class,
        CustomFieldDefType::class,
        DeathPointType::class,
        DelegatedBranchType::class,
        DelegationType::class,
        FamilyType::class,
        GDateType::class,
        InvitationType::class,
        LifeEventType::class,
        LifePointType::class,
        MediaType::class,
        NotificationSettingsType::class,
        PersonType::class,
        PlaceType::class,
        SaveResultType::class,
        SourceType::class,
        TelegramLinkType::class,
        TreeMemberType::class,
        TreeSummaryType::class,
        TreeType::class,
        UpcomingEventType::class,
        UploadType::class,
        UserType::class,
        ConsentInput::class,
        CreateTreeInput::class,
        NotificationSettingsInput::class,
        ProfileInput::class,
        RegisterInput::class,
        TreeChangesInput::class,
        TreeInfoInput::class,
    ],

    // This callable will be passed the Error object for each errors GraphQL catch.
    // The method should return an array representing the error.
    // Typically:
    // [
    //     'message' => '',
    //     'locations' => []
    // ]
    'error_formatter' => [ErrorFormatter::class, 'format'],

    /*
     * Custom Error Handling
     *
     * Expected handler signature is: function (array $errors, callable $formatter): array
     *
     * The default handler will pass exceptions to laravel Error Handling mechanism
     */
    'errors_handler' => [GraphQL::class, 'handleErrors'],

    /*
     * Options to limit the query complexity and depth. See the doc
     * @ https://webonyx.github.io/graphql-php/security
     * for details.
     *
     * It is highly recommended to have limits to prevent denial-of-service
     * attacks via deeply nested or overly complex queries.
     */
    'security' => [
        'query_max_complexity' => 2000,
        'query_max_depth' => 13,
        'disable_introspection' => env('GRAPHQL_DISABLE_INTROSPECTION', true),
    ],

    /*
     * Tracing / observability
     *
     * When a driver is set, GraphQL operations are instrumented with timing data.
     * The built-in OpenTelemetryTracingDriver emits spans via the OpenTelemetry
     * API following the GraphQL semantic conventions. Requires the
     * `open-telemetry/api` package (install separately).
     *
     * You can also implement the TracingDriver interface to create a custom driver.
     *
     * Set `driver` to null to disable tracing entirely (the default).
     *
     * This global config applies to all schemas by default. Individual schemas
     * can override tracing by adding a `tracing` key to their schema config:
     *
     *   - `'tracing' => false`           — disable tracing for this schema
     *   - `'tracing' => ['driver' => ..]` — full override, deep-merged over global
     *
     * See the README for detailed per-schema tracing examples.
     */
    'tracing' => [
        // The tracing driver class, or null to disable.
        // Example: \Rebing\GraphQL\Support\Tracing\OpenTelemetryTracingDriver::class
        'driver' => null,

        // Enable per-field resolver tracing (opt-in).
        // When true, each field resolution is individually instrumented.
        // This produces high-cardinality data and should only be used for debugging.
        'field_tracing' => false,

        // Driver-specific options
        'driver_options' => [
            // OpenTelemetryTracingDriver: include the GraphQL document (query string) in spans.
            // The document may contain sensitive data; disabled by default.
            'include_document' => false,
        ],
    ],

    /*
     * You can define your own pagination type.
     * Reference \Rebing\GraphQL\Support\PaginationType::class
     */
    'pagination_type' => PaginationType::class,

    /*
     * You can define your own simple pagination type.
     * Reference \Rebing\GraphQL\Support\SimplePaginationType::class
     */
    'simple_pagination_type' => SimplePaginationType::class,

    /*
     * You can define your own cursor pagination type.
     * Reference Rebing\GraphQL\Support\CursorPaginationType::class
     */
    'cursor_pagination_type' => CursorPaginationType::class,

    /*
     * Overrides the default field resolver
     * See http://webonyx.github.io/graphql-php/data-fetching/#default-field-resolver
     *
     * Example:
     *
     * ```php
     * 'defaultFieldResolver' => function ($root, $args, $context, $info) {
     * },
     * ```
     * or
     * ```php
     * 'defaultFieldResolver' => [SomeKlass::class, 'someMethod'],
     * ```
     */
    'defaultFieldResolver' => null,

    /*
     * Any headers that will be added to the response returned by the default controller
     */
    'headers' => [],

    /*
     * Any JSON encoding options when returning a response from the default controller
     * See http://php.net/manual/function.json-encode.php for the full list of options
     */
    'json_encoding_options' => 0,

    /*
     * Automatic Persisted Queries (APQ)
     * See https://www.apollographql.com/docs/apollo-server/performance/apq/
     *
     * Note 1: this requires the `AutomaticPersistedQueriesMiddleware` being enabled
     *
     * Note 2: even if APQ is disabled per configuration and, according to the "APQ specs" (see above),
     *         to return a correct response in case it's not enabled, the middleware needs to be active.
     *         Of course if you know you do not have a need for APQ, feel free to remove the middleware completely.
     */
    'apq' => [
        // Enable/Disable APQ - See https://www.apollographql.com/docs/apollo-server/performance/apq/#disabling-apq
        'enable' => env('GRAPHQL_APQ_ENABLE', false),

        // The cache driver used for APQ
        'cache_driver' => env('GRAPHQL_APQ_CACHE_DRIVER', env('CACHE_STORE', 'database')),

        // The cache prefix
        'cache_prefix' => env('CACHE_PREFIX', Str::slug((string) env('APP_NAME', 'laravel')).'-cache-').':graphql.apq',

        // The cache ttl in seconds - See https://www.apollographql.com/docs/apollo-server/performance/apq/#adjusting-cache-time-to-live-ttl
        'cache_ttl' => 300,
    ],

    /*
     * Execution middlewares
     */
    'execution_middleware' => [
        ValidateOperationParamsMiddleware::class,
        // AutomaticPersistedQueriesMiddleware listed even if APQ is disabled, see the docs for the `'apq'` configuration
        AutomaticPersistedQueriesMiddleware::class,
        // Reject non-`query` operations (mutations, subscriptions) submitted via GET.
        // When used together with `AutomaticPersistedQueriesMiddleware`, list this
        // entry AFTER it (as below): APQ materialises the query body from cache,
        // and running this middleware first would fail APQ-only requests with a
        // "No GraphQL query available" error.
        // \Rebing\GraphQL\Support\ExecutionMiddleware\ReadOnlyOperationMiddleware::class,
        AddAuthUserContextValueMiddleware::class,
        // \Rebing\GraphQL\Support\ExecutionMiddleware\UnusedVariablesMiddleware::class,
    ],

    /*
     * Globally registered ResolverMiddleware
     */
    'resolver_middleware_append' => null,
];
