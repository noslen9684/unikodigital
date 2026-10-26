/* Stripe embedded payment form for checkout.html.
   The server endpoint (api/create-checkout-session.php) creates the Checkout Session
   and returns { client_secret, publishable_key }. No secret keys live in this file. */
(function () {
  "use strict";
  var statusEl = document.getElementById("checkout-status");
  var params = new URLSearchParams(window.location.search);

  function setStatus(text, isError) {
    statusEl.textContent = text;
    statusEl.classList.toggle("is-error", !!isError);
  }

  // Back from Stripe after paying (return_url includes ?session_id=...)
  if (params.get("session_id")) {
    document.getElementById("checkout-title").textContent = "Thank you!";
    document.getElementById("checkout-lead").textContent =
      "Your payment was submitted. You'll receive a receipt by email, and we'll be in touch shortly.";
    setStatus("");
    return;
  }

  if (typeof window.Stripe !== "function") {
    setStatus("The payment form couldn't load. Please check your connection and refresh the page.", true);
    return;
  }

  var appearance = {
    "theme": "stripe",
    "labels": "auto",
    "inputs": "spaced",
    "variables": {
      "borderRadius": "4px",
      "colorBackground": "#ffffff",
      "colorDanger": "#df1b41",
      "colorPrimary": "#0570de",
      "colorSuccess": "#00c853",
      "colorText": "#30313d",
      "fontFamily": "default",
      "fontSizeBase": "16px",
      "spacingUnit": "4px"
    }
  };

  fetch("api/create-checkout-session.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan: params.get("plan") || "makeover" })
  })
    .then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (json) {
        if (!response.ok || !json.client_secret) throw new Error(json.error || "Could not start checkout.");
        return json;
      });
    })
    .then(async function (json) {
      var stripe = window.Stripe(json.publishable_key);
      var checkout = stripe.initCheckoutFormSdk({ clientSecret: json.client_secret, appearance: appearance });

      var form = checkout.createForm({ layout: "expanded" });
      form.mount("#checkout-form");
      setStatus("");

      var loadActionsResult = await checkout.loadActions();
      if (loadActionsResult.type === "success") {
        form.on("confirm", async function (event) {
          try {
            await loadActionsResult.actions.confirm({ formConfirmEvent: event });
          } catch (error) {
            console.error("Payment confirmation error:", error);
            setStatus("Something went wrong confirming your payment. Please try again.", true);
          }
        });
      } else {
        setStatus("The payment form couldn't load. Please refresh the page.", true);
      }
    })
    .catch(function (error) {
      setStatus(error.message + " You can also contact us at nelson@unikodigital.com.", true);
    });
})();
