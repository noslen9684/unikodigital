# Stripe Integration — To Do

This is the single source of truth for what's left before Stripe payments work on unikodigital.com.

## Values to Replace

All Price IDs are filled in. The endpoint picks **live** prices when the secret key is a live key (`sk_live_…` or restricted `rk_live_…`), and **test** prices otherwise, so switching keys in `stripe-config.php` is all that's needed.

**Files containing these values:**
- [api/create-checkout-session.php](api/create-checkout-session.php) (the `$plans` list)

| Plan (`checkout.html?plan=…`) | mode | Live Price ID | Test Price ID |
|------|------|---------------|---------------|
| `makeover` (default) — $150 one-time | `payment` | `price_1UUgDzCq5Nkv0OY1IWUC2KiI` | `price_1UUfJ1CxJrrDe7qiUFJIgI0F` |
| `rebranding` — $200/month | `subscription` | `price_1UUgE4Cq5Nkv0OY1iTtIrUaB` | `price_1UUfILCxJrrDe7qiDyT0UTE7` |

The live account also has a duplicate of each product (`prod_VVggWW5vq23MRN`, `prod_VVgfLJbtIcC0j8`) that the site doesn't use; archive them in the Dashboard to avoid confusion.

## Configured Parameters

These parameters were configured in Checkout Studio and are already set correctly.

**Files containing these parameters:**
- [api/create-checkout-session.php](api/create-checkout-session.php)

| Parameter | Value |
|-----------|-------|
| ui_mode | `form` |
| billing_address_collection | `auto` |
| phone_number_collection | `{ enabled: false }` |
| automatic_tax | `{ enabled: false }` |
| payment_method_collection | `always` (sent only when `mode` is `subscription`) |
| submit_type | `auto` (sent only when `mode` is `payment`) |
| integration_identifier | `custom_embedded_web_0001` |

Client appearance (theme `stripe`, spaced inputs, white background) and the `expanded` form layout are set in [js/checkout.js](js/checkout.js).

## Setup

### 1. Add your API keys on Hostinger (never in GitHub)

The GitHub repo is **public**, so keys must not be committed. The endpoint reads them from a file **one folder above `public_html`**, which the web can't reach.

1. Get your keys at https://dashboard.stripe.com/apikeys (use **test** keys `pk_test_…` / `sk_test_…` first).
2. In hPanel → **File Manager**, go to the folder that **contains** `public_html` (for example `domains/unikodigital.com/`).
3. Create a file named `stripe-config.php` there with:

```php
<?php
return [
    'STRIPE_SECRET_KEY'      => 'sk_test_...',
    'STRIPE_PUBLISHABLE_KEY' => 'pk_test_...',
    'DOMAIN'                 => 'https://unikodigital.com',
];
```

`stripe-config.php` and `.env` are listed in `.gitignore` as a safety net.

### 2. Dependencies

None. The endpoint uses PHP's built-in cURL (available on Hostinger) and calls the Stripe API with `Stripe-Version: 2026-03-25.dahlia`. Stripe.js loads from `https://js.stripe.com/dahlia/stripe.js`.

## New files

```
api/create-checkout-session.php   Server: creates the Checkout Session, returns { client_secret, publishable_key }
checkout.html                     Checkout page with the embedded form (also the return page)
js/checkout.js                    Client: fetches the session, mounts the form, handles confirm
STRIPE_INTEGRATION_TODO.md        This file
```

`css/styles.css` gained a small "Checkout page" block, and `.gitignore` now excludes key files.

## How it works

1. A visitor opens `https://unikodigital.com/checkout.html?plan=makeover` (or `plan=rebranding`).
2. `js/checkout.js` POSTs the plan name to `api/create-checkout-session.php`.
3. The PHP endpoint looks up that plan's Price ID and mode, creates a Checkout Session (`ui_mode: form`) with your secret key and returns the `client_secret` and publishable key.
4. Stripe.js renders the embedded payment form in a secure Stripe iframe.
5. On confirm, Stripe processes the payment and redirects to `checkout.html?session_id=…`, which shows a thank-you message.

## Testing

1. Use keys from the **same** Stripe environment as the Price IDs (test keys for test prices).
2. Open `https://unikodigital.com/checkout.html?plan=makeover` and `…?plan=rebranding`, and pay with test card **4242 4242 4242 4242**, any future expiry date, any CVC, any ZIP.
3. Other useful test cards: **4000 0025 0000 3155** (requires 3D Secure authentication), **4000 0000 0000 9995** (declined, insufficient funds). Full list: https://docs.stripe.com/testing
4. Check the payment in the Stripe Dashboard → **Payments** (test mode).
5. When it works, switch to **live** keys and a live Price ID.

Note: the endpoint can't run on the local preview (no PHP there), so test on the live domain with test keys.

## Next steps

- **Link to checkout from the site:** add buttons pointing to `checkout.html` (for example on the Pricing cards). Not done yet.
- **More products:** add an entry to `$plans` in the endpoint and link to `checkout.html?plan=<name>`. Custom quote amounts would need a different approach (never accept a raw price from the browser).
- **Fulfillment & order tracking:** add a webhook endpoint for `checkout.session.completed` (and `customer.subscription.*` for the care plan) in Dashboard → Workbench → Webhooks. Until then, use Stripe's email receipts and the Dashboard to track payments. Guide: https://docs.stripe.com/checkout/fulfillment
- **Customer emails:** turn on successful-payment receipts in Dashboard → Settings → Customer emails.
- **Spanish:** the checkout page text is English only; Stripe's form localizes itself automatically.

## Resources

- https://support.stripe.com
- https://docs.stripe.com/mcp
- Embedded form quickstart: https://docs.stripe.com/checkout/form/quickstart
