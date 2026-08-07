# Fix: Ad Set publishing fails with Meta 400

## What is actually wrong

This is not a permissions problem. Your app does have the ads permissions.

The error names the object `120244861360380358`. I checked the database: that is the
Meta **campaign** ID of "First Ad Campaign". The backend is creating the ad set by
posting to the campaign object:

```text
POST /120244861360380358/adsets      <-- campaign has no "adsets" create edge
```

Meta does not accept ad-set creation on a campaign. Ad sets are created on the
**ad account**, with the campaign passed inside the request body:

```text
POST /act_2291759651601682/adsets    body: { campaign_id: "120244861360380358", ... }
```

So Meta reports the campaign ID as an object that "does not support this operation".

## Fix

In the `publish_adset` handler of the Meta backend function:

1. Resolve the ad account the same way campaign publishing does: the campaign's
   `ad_account_id`, falling back to the connection's default ad account. Error clearly
   if neither is set.
2. Post to `/{ad_account}/adsets` and include `campaign_id: campaign.external_id` in the body.
3. Keep the existing name, budget, optimization goal, billing event, bid strategy,
   schedule and targeting mapping unchanged.

## Two smaller issues in the same handler that will fail next

4. When placements are set, the code sends `promoted_object: { pixel_id: "0" }`. `"0"` is
   not a real pixel and Meta rejects it. This block will be removed; `instagram_actor_id`
   will only be sent when a default Instagram account actually exists.
5. Targeting `geo_locations.countries` is filled from a free-text location field. It will be
   normalised to uppercase two-letter country codes, defaulting to `IN` when the value is
   not a valid code, so Meta does not reject the targeting spec.

No UI, schema, or campaign/post logic changes. The edge function is redeployed after the fix.
