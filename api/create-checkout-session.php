<?php
// Creates a Stripe Checkout Session for the embedded payment form on checkout.html.
// Runs on Hostinger's PHP and calls the Stripe API directly with cURL, so no Composer install is needed.
//
// Keys are NOT stored in this repo (it is public on GitHub). Put them in stripe-config.php
// one folder ABOVE public_html on Hostinger. See STRIPE_INTEGRATION_TODO.md.

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$config = [];
$configFile = dirname(__DIR__, 2) . '/stripe-config.php';
if (is_readable($configFile)) {
    $config = require $configFile;
}
$secretKey = $config['STRIPE_SECRET_KEY'] ?? getenv('STRIPE_SECRET_KEY');
$publishableKey = $config['STRIPE_PUBLISHABLE_KEY'] ?? getenv('STRIPE_PUBLISHABLE_KEY');
$domain = rtrim($config['DOMAIN'] ?? (getenv('DOMAIN') ?: 'https://unikodigital.com'), '/');

if (!$secretKey || !$publishableKey) {
    http_response_code(500);
    echo json_encode(['error' => 'Payments are not configured yet.']);
    exit;
}

// Each plan maps to a Stripe Price and a mode ("payment" = one-time, "subscription" = recurring).
// Prices are fixed here on the server so visitors can't change the amount.
$plans = [
    'makeover' => ['price' => 'price_1UUfJ1CxJrrDe7qiUFJIgI0F', 'mode' => 'payment'],      // website makeover, $150 one-time
    'rebranding' => ['price' => 'price_1UUfILCxJrrDe7qiDyT0UTE7', 'mode' => 'subscription'], // Website Rebranding, $200/month
];
$input = json_decode(file_get_contents('php://input') ?: '', true) ?: [];
$planKey = $input['plan'] ?? 'makeover';
if (!isset($plans[$planKey]) || strpos($plans[$planKey]['price'], 'price_...') === 0) {
    http_response_code(400);
    echo json_encode(['error' => 'This plan is not available for online checkout yet.']);
    exit;
}
$mode = $plans[$planKey]['mode'];

$params = [
    'ui_mode' => 'form',
    'mode' => $mode,
    'line_items' => [
        ['price' => $plans[$planKey]['price'], 'quantity' => 1],
    ],
    'billing_address_collection' => 'auto',
    'phone_number_collection' => ['enabled' => 'false'],
    'automatic_tax' => ['enabled' => 'false'],
    'submit_type' => 'auto',
    'integration_identifier' => 'custom_embedded_web_0001',
    'return_url' => $domain . '/checkout.html?plan=' . $planKey . '&session_id={CHECKOUT_SESSION_ID}',
];
if ($mode === 'subscription') {
    $params['payment_method_collection'] = 'always';
    unset($params['submit_type']);
}

$ch = curl_init('https://api.stripe.com/v1/checkout/sessions');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_USERPWD => $secretKey . ':',
    CURLOPT_HTTPHEADER => ['Stripe-Version: 2026-03-25.dahlia'],
    CURLOPT_POSTFIELDS => http_build_query($params),
    CURLOPT_TIMEOUT => 20,
]);
$body = curl_exec($ch);
$status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

$session = json_decode($body ?: '', true);
if ($status !== 200 || empty($session['client_secret'])) {
    error_log('Stripe Checkout Session error: ' . ($session['error']['message'] ?? 'no response'));
    http_response_code(502);
    echo json_encode(['error' => 'Could not start checkout. Please try again or contact us.', 'debug' => $session['error']['message'] ?? 'no response']); // TEMP: remove after setup
    exit;
}

echo json_encode([
    'client_secret' => $session['client_secret'],
    'publishable_key' => $publishableKey,
]);
