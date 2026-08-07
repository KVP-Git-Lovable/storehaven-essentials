import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { graph } from "../_shared/meta-graph.ts";
import { decryptSecret } from "../_shared/meta-crypto.ts";

const OBJECTIVE_MAP: Record<string, string> = {
  awareness: "OUTCOME_AWARENESS",
  traffic: "OUTCOME_TRAFFIC",
  engagement: "OUTCOME_ENGAGEMENT",
  leads: "OUTCOME_LEADS",
  sales: "OUTCOME_SALES",
  conversions: "OUTCOME_SALES",
  app_promotion: "OUTCOME_APP_PROMOTION",
};

const SPECIAL_CATEGORY_MAP: Record<string, string> = {
  housing: "HOUSING",
  employment: "EMPLOYMENT",
  credit: "CREDIT",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claims, error: claimsErr } = await authClient.auth.getClaims(
      authHeader.replace("Bearer ", ""),
    );
    if (claimsErr || !claims?.claims) return json({ error: "Unauthorized" }, 401);

    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { action, payload = {} } = await req.json();
    if (!action) return json({ error: "action is required" }, 400);

    const { data: conn } = await db
      .from("social_connections")
      .select("*")
      .eq("platform", "meta")
      .maybeSingle();
    if (!conn) return json({ error: "No Meta account is connected" }, 400);
    const userToken = await decryptSecret(conn.access_token_enc);

    const pageToken = async (pageId: string) => {
      const { data: page } = await db
        .from("social_pages")
        .select("page_token_enc")
        .eq("connection_id", conn.id)
        .eq("page_id", pageId)
        .maybeSingle();
      if (!page?.page_token_enc) throw new Error("Page access token is unavailable — reconnect Meta");
      return await decryptSecret(page.page_token_enc);
    };

    switch (action) {
      /* ------------------------------ campaigns ----------------------------- */
      case "publish_campaign": {
        const { data: c } = await db.from("social_campaigns").select("*").eq("id", payload.campaign_id).maybeSingle();
        if (!c) throw new Error("Campaign not found");
        const adAccount = c.ad_account_id || conn.default_ad_account_id;
        if (!adAccount) throw new Error("Select a default Ad Account first");

        const specials = (c.special_ad_categories || [])
          .map((s: string) => SPECIAL_CATEGORY_MAP[s])
          .filter(Boolean);

        const body: Record<string, unknown> = {
          name: c.name,
          status: c.status === "active" ? "ACTIVE" : "PAUSED",
        };
        // Objective, buying type and special categories are creation-only in Meta.
        if (!c.external_id) {
          body.objective = OBJECTIVE_MAP[c.objective] || "OUTCOME_TRAFFIC";
          body.buying_type = c.buying_type === "reach_and_frequency" ? "RESERVED" : "AUCTION";
          body.special_ad_categories = specials.length ? specials : ["NONE"];
        }
        if (c.budget_type === "daily") body.daily_budget = Math.round(Number(c.budget_amount) * 100);
        else body.lifetime_budget = Math.round(Number(c.budget_amount) * 100);
        if (c.start_date) body.start_time = c.start_date;
        if (c.end_date) body.stop_time = c.end_date;

        const published = c.external_id
          ? await graph(`/${c.external_id}`, { token: userToken, method: "POST", body })
          : await graph(`/${adAccount}/campaigns`, { token: userToken, method: "POST", body });
        const externalId = c.external_id || published.id;
        await db.from("social_campaigns").update({
          external_id: externalId,
          published_at: c.published_at || new Date().toISOString(),
          status: c.status === "active" ? "active" : "paused",
          last_synced_at: new Date().toISOString(),
        }).eq("id", c.id);
        return json({
          success: true,
          campaign_id: externalId,
          republished: Boolean(c.external_id),
          published_at: new Date().toISOString(),
        });
      }

      case "pause_campaign":
      case "resume_campaign": {
        const { data: c } = await db.from("social_campaigns").select("*").eq("id", payload.campaign_id).maybeSingle();
        if (!c) throw new Error("Campaign not found");
        const next = action === "pause_campaign" ? "PAUSED" : "ACTIVE";
        if (c.external_id) await graph(`/${c.external_id}`, { token: userToken, method: "POST", body: { status: next } });
        await db.from("social_campaigns").update({ status: next.toLowerCase() }).eq("id", c.id);
        return json({ success: true, status: next.toLowerCase() });
      }

      case "delete_campaign": {
        const { data: c } = await db.from("social_campaigns").select("*").eq("id", payload.campaign_id).maybeSingle();
        if (c?.external_id) {
          try { await graph(`/${c.external_id}`, { token: userToken, method: "DELETE" }); } catch (e) {
            console.error("Meta delete failed, removing locally:", (e as Error).message);
          }
        }
        await db.from("social_campaigns").delete().eq("id", payload.campaign_id);
        return json({ success: true });
      }

      case "sync_campaign_status": {
        const { data: rows } = await db
          .from("social_campaigns")
          .select("id,external_id")
          .not("external_id", "is", null);
        for (const r of rows || []) {
          try {
            const res = await graph(`/${r.external_id}`, { token: userToken, params: { fields: "status,effective_status" } });
            await db.from("social_campaigns").update({
              status: String(res.effective_status || res.status || "").toLowerCase() || "paused",
              last_synced_at: new Date().toISOString(),
            }).eq("id", r.id);
          } catch (e) {
            console.error("sync failed for", r.external_id, (e as Error).message);
          }
        }
        return json({ success: true, synced: rows?.length || 0 });
      }

      /* ------------------------------ ad sets -------------------------------- */
      case "publish_adset": {
        const { data: adset } = await db.from("social_ad_sets").select("*").eq("id", payload.adset_id).maybeSingle();
        if (!adset) throw new Error("Ad Set not found");
        const { data: camp } = await db.from("social_campaigns").select("*").eq("id", adset.campaign_id).maybeSingle();
        if (!camp?.external_id) throw new Error("Campaign must be published first");

        const adAccount = camp.ad_account_id || conn.default_ad_account_id;
        if (!adAccount) throw new Error("Select a default Ad Account first");

        const normalizeCountryCode = (location: string): string => {
          const code = location.toUpperCase().slice(0, 2);
          const validCodes = ["IN", "US", "GB", "DE", "FR", "AU", "CA", "JP", "IN"];
          return validCodes.includes(code) ? code : "IN";
        };

        const targeting: Record<string, unknown> = {};
        const OPT_GOAL_ALIASES: Record<string, string> = {
          LEADS: "LEAD_GENERATION",
          CONVERSIONS: "OFFSITE_CONVERSIONS",
          VIDEO_VIEWS: "THRUPLAY",
          CLICKS: "LINK_CLICKS",
          ENGAGEMENT: "POST_ENGAGEMENT",
        };
        const VALID_OPT_GOALS = [
          "NONE","APP_INSTALLS","AD_RECALL_LIFT","ENGAGED_USERS","EVENT_RESPONSES","IMPRESSIONS",
          "LEAD_GENERATION","QUALITY_LEAD","LINK_CLICKS","OFFSITE_CONVERSIONS","PAGE_LIKES",
          "POST_ENGAGEMENT","QUALITY_CALL","REACH","LANDING_PAGE_VIEWS","VISIT_INSTAGRAM_PROFILE",
          "ENGAGED_PAGE_VIEWS","VALUE","THRUPLAY","DERIVED_EVENTS","CONVERSATIONS","IN_APP_VALUE",
          "SUBSCRIBERS","REMINDERS_SET","PROFILE_VISIT","PROFILE_AND_PAGE_ENGAGEMENT",
          "AUTOMATIC_OBJECTIVE",
        ];
        const rawGoal = String(adset.optimization_goal || "").toUpperCase();
        const mappedGoal = OPT_GOAL_ALIASES[rawGoal] || rawGoal;
        const optimizationGoal = VALID_OPT_GOALS.includes(mappedGoal) ? mappedGoal : "LINK_CLICKS";

        const BILLING_ALIASES: Record<string, string> = {
          VIDEO_VIEWS: "THRUPLAY",
          CLICKS: "LINK_CLICKS",
          PURCHASE: "IMPRESSIONS",
          LEADS: "IMPRESSIONS",
          LEAD_GENERATION: "IMPRESSIONS",
          OFFSITE_CONVERSIONS: "IMPRESSIONS",
          REACH: "IMPRESSIONS",
        };
        const VALID_BILLING = ["APP_INSTALLS","CLICKS","IMPRESSIONS","LINK_CLICKS","NONE","OFFER_CLAIMS","PAGE_LIKES","POST_ENGAGEMENT","THRUPLAY","PURCHASE","LISTING_INTERACTION"];
        const rawBilling = String(adset.billing_event || "").toUpperCase();
        const mappedBilling = BILLING_ALIASES[rawBilling] || rawBilling;
        const billingEvent = VALID_BILLING.includes(mappedBilling) ? mappedBilling : "IMPRESSIONS";

        const VALID_BID_STRATEGIES = [
          "LOWEST_COST_WITHOUT_CAP",
          "LOWEST_COST_WITH_BID_CAP",
          "COST_CAP",
          "LOWEST_COST_WITH_MIN_ROAS",
        ];
        let bidStrategy = VALID_BID_STRATEGIES.includes(adset.bid_strategy)
          ? adset.bid_strategy
          : "LOWEST_COST_WITHOUT_CAP";
        // Cap/ROAS strategies require a bid amount we do not capture — fall back safely.
        if (bidStrategy !== "LOWEST_COST_WITHOUT_CAP" && !adset.bid_amount) {
          bidStrategy = "LOWEST_COST_WITHOUT_CAP";
        }
        if (adset.targeting?.age_min || adset.targeting?.age_max) {
          const ageMin = parseInt(adset.targeting.age_min || "18");
          const ageMax = adset.targeting.age_max === "65+" ? 65 : parseInt(adset.targeting.age_max || "65");
          targeting.age_min = ageMin;
          targeting.age_max = ageMax;
        }
        if (adset.targeting?.genders && adset.targeting.genders.length > 0) {
          targeting.genders = adset.targeting.genders.map((g: string) => g === "All" ? 0 : g === "Men" ? 1 : 2);
        }
        const rawLocations = String(adset.targeting?.locations || "").trim();
        targeting.geo_locations = {
          countries: [rawLocations ? normalizeCountryCode(rawLocations) : "IN"],
        };

        const campaignHasBudget = Number(camp.budget_amount) > 0;

        const body: Record<string, unknown> = {
          campaign_id: camp.external_id,
          name: adset.name,
          optimization_goal: optimizationGoal,
          billing_event: billingEvent,
          status: "PAUSED",
          targeting: Object.keys(targeting).length > 0 ? targeting : { geo_locations: { countries: ["IN"] } },
        };
        // Under Campaign Budget Optimization the bid strategy lives on the campaign.
        // Cap/ROAS strategies also need a bid_amount we do not capture.
        if (campaignHasBudget) {
          // CBO: the bid strategy lives on the campaign. Ensure it is not a
          // cap/ROAS strategy, since we do not capture a bid amount.
          try {
            const campInfo = await graph(`/${camp.external_id}`, {
              token: userToken,
              params: { fields: "bid_strategy" },
            });
            if (campInfo?.bid_strategy && campInfo.bid_strategy !== "LOWEST_COST_WITHOUT_CAP") {
              await graph(`/${camp.external_id}`, {
                token: userToken,
                method: "POST",
                body: { bid_strategy: "LOWEST_COST_WITHOUT_CAP" },
              });
            }
          } catch (e) {
            console.error("campaign bid_strategy check failed:", (e as Error).message);
          }
        } else {
          body.bid_strategy = "LOWEST_COST_WITHOUT_CAP";
        }

        // Campaign Budget Optimization: if the campaign carries the budget,
        // Meta rejects a budget on the ad set ("Invalid parameter").
        if (!campaignHasBudget) {
          if (adset.budget_type === "daily") {
            body.daily_budget = Math.round(Number(adset.budget_amount) * 100);
          } else {
            body.lifetime_budget = Math.round(Number(adset.budget_amount) * 100);
          }
        }

        // Ad set schedule must sit inside the campaign schedule.
        const campStart = camp.start_date ? new Date(camp.start_date).getTime() : null;
        const campEnd = camp.end_date ? new Date(camp.end_date).getTime() : null;
        let startMs = adset.start_at ? new Date(adset.start_at).getTime() : campStart;
        let endMs = adset.end_at ? new Date(adset.end_at).getTime() : campEnd;
        if (campStart && (!startMs || startMs < campStart)) startMs = campStart;
        if (campEnd && (!endMs || endMs > campEnd)) endMs = campEnd;
        if (startMs && endMs && endMs <= startMs) endMs = campEnd && campEnd > startMs ? campEnd : null;
        // A lifetime-budget campaign requires the ad set to be end-dated.
        if (!endMs && campEnd) endMs = campEnd;
        if (startMs) body.start_time = new Date(startMs).toISOString();
        if (endMs) body.end_time = new Date(endMs).toISOString();

        if (adset.placements && adset.placements.length > 0 && conn.default_instagram_id) {
          body.instagram_actor_id = conn.default_instagram_id;
        }

        // Lead generation ad sets must declare the Page they collect leads for.
        if (optimizationGoal === "LEAD_GENERATION") {
          const leadPage = adset.page_id || conn.default_page_id;
          if (!leadPage) throw new Error("Select a default Facebook Page before publishing a lead generation ad set");
          body.promoted_object = { page_id: leadPage };
        }

        // campaign_id is required when creating, but cannot be changed on an existing ad set.
        if (adset.external_id) delete body.campaign_id;
        const published = adset.external_id
          ? await graph(`/${adset.external_id}`, { token: userToken, method: "POST", body })
          : await graph(`/${adAccount}/adsets`, { token: userToken, method: "POST", body });
        const externalId = adset.external_id || published.id;
        await db.from("social_ad_sets").update({
          external_id: externalId,
          status: "paused",
          last_synced_at: new Date().toISOString(),
        }).eq("id", adset.id);
        return json({ success: true, adset_id: externalId, republished: Boolean(adset.external_id) });
      }

      case "pause_adset":
      case "resume_adset": {
        const { data: adset } = await db.from("social_ad_sets").select("*").eq("id", payload.adset_id).maybeSingle();
        if (!adset) throw new Error("Ad Set not found");
        const next = action === "pause_adset" ? "PAUSED" : "ACTIVE";
        if (adset.external_id) {
          await graph(`/${adset.external_id}`, { token: userToken, method: "POST", body: { status: next } });
        }
        await db.from("social_ad_sets").update({ status: next.toLowerCase() }).eq("id", adset.id);
        return json({ success: true, status: next.toLowerCase() });
      }

      case "delete_adset": {
        const { data: adset } = await db.from("social_ad_sets").select("*").eq("id", payload.adset_id).maybeSingle();
        if (adset?.external_id) {
          try {
            await graph(`/${adset.external_id}`, { token: userToken, method: "DELETE" });
          } catch (e) {
            console.error("Meta delete failed, removing locally:", (e as Error).message);
          }
        }
        await db.from("social_ad_sets").delete().eq("id", payload.adset_id);
        return json({ success: true });
      }

      case "fetch_adset_insights": {
        const { data: rows } = await db
          .from("social_ad_sets")
          .select("id,external_id")
          .not("external_id", "is", null);
        const today = new Date().toISOString().slice(0, 10);
        for (const r of rows || []) {
          try {
            const res = await graph(`/${r.external_id}/insights`, {
              token: userToken,
              params: { fields: "reach,impressions,clicks,spend,actions,action_values", date_preset: "maximum" },
            });
            const d = res?.data?.[0];
            if (!d) continue;
            const actionCount = (t: string) =>
              Number((d.actions || []).find((a: any) => a.action_type === t)?.value || 0);
            const revenue = Number(
              (d.action_values || []).find((a: any) => a.action_type === "purchase")?.value || 0,
            );
            await db.from("social_insights").upsert({
              platform: "meta",
              entity_type: "adset",
              entity_id: r.id,
              external_id: r.external_id,
              stat_date: today,
              reach: Number(d.reach || 0),
              impressions: Number(d.impressions || 0),
              clicks: Number(d.clicks || 0),
              spend: Number(d.spend || 0),
              leads: actionCount("lead"),
              purchases: actionCount("purchase"),
              conversions: actionCount("offsite_conversion"),
              revenue,
              raw: d,
            }, { onConflict: "entity_type,entity_id,stat_date" });
          } catch (e) {
            console.error("insights failed for", r.external_id, (e as Error).message);
          }
        }
        return json({ success: true });
      }

      /* -------------------------------- ads ---------------------------------- */
      case "publish_ad": {
        const { data: ad } = await db.from("social_ads").select("*").eq("id", payload.ad_id).maybeSingle();
        if (!ad) throw new Error("Ad not found");
        const { data: adset } = await db.from("social_ad_sets").select("*").eq("id", ad.ad_set_id).maybeSingle();
        if (!adset?.external_id) throw new Error("Ad Set must be published first");
        const { data: camp } = await db.from("social_campaigns").select("*").eq("id", adset.campaign_id).maybeSingle();
        const adAccount = camp?.ad_account_id || conn.default_ad_account_id;
        if (!adAccount) throw new Error("Select a default Ad Account first");
        const pageId = conn.default_page_id;
        if (!pageId) throw new Error("Select a default Facebook Page before publishing an ad");

        const media = ad.media && typeof ad.media === "object" ? ad.media : {};
        const mediaUrl = String(media.url || media.image_url || "").trim();
        const destinationUrl = String(ad.destination_url || "").trim();
        if (!destinationUrl) throw new Error("Destination URL is required");

        const linkData: Record<string, unknown> = {
          link: destinationUrl,
          message: ad.primary_text || "",
          name: ad.headline || ad.name,
          description: ad.description || "",
          call_to_action: {
            type: ad.call_to_action || "LEARN_MORE",
            value: { link: destinationUrl },
          },
        };
        if (mediaUrl) linkData.picture = mediaUrl;

        // Meta creatives are immutable. Republish creates a replacement creative,
        // then points the existing ad at it instead of creating a duplicate ad.
        const creative = await graph(`/${adAccount}/adcreatives`, {
          token: userToken,
          method: "POST",
          body: {
            name: `${ad.name} creative`,
            object_story_spec: { page_id: pageId, link_data: linkData },
          },
        });
        const adBody: Record<string, unknown> = {
          name: ad.name,
          creative: { creative_id: creative.id },
          status: ad.status === "active" ? "ACTIVE" : "PAUSED",
        };
        if (!ad.external_id) adBody.adset_id = adset.external_id;

        const published = ad.external_id
          ? await graph(`/${ad.external_id}`, { token: userToken, method: "POST", body: adBody })
          : await graph(`/${adAccount}/ads`, { token: userToken, method: "POST", body: adBody });
        const externalId = ad.external_id || published.id;
        await db.from("social_ads").update({
          external_id: externalId,
          creative_external_id: creative.id,
          status: ad.status === "active" ? "active" : "paused",
          updated_at: new Date().toISOString(),
        }).eq("id", ad.id);
        return json({ success: true, ad_id: externalId, republished: Boolean(ad.external_id) });
      }

      case "pause_ad":
      case "resume_ad": {
        const { data: ad } = await db.from("social_ads").select("*").eq("id", payload.ad_id).maybeSingle();
        if (!ad) throw new Error("Ad not found");
        const next = action === "pause_ad" ? "PAUSED" : "ACTIVE";
        if (ad.external_id) await graph(`/${ad.external_id}`, { token: userToken, method: "POST", body: { status: next } });
        await db.from("social_ads").update({ status: next.toLowerCase() }).eq("id", ad.id);
        return json({ success: true, status: next.toLowerCase() });
      }

      case "delete_ad": {
        const { data: ad } = await db.from("social_ads").select("*").eq("id", payload.ad_id).maybeSingle();
        if (ad?.external_id) {
          try { await graph(`/${ad.external_id}`, { token: userToken, method: "DELETE" }); } catch (e) {
            console.error("Meta delete failed, removing locally:", (e as Error).message);
          }
        }
        await db.from("social_ads").delete().eq("id", payload.ad_id);
        return json({ success: true });
      }

      /* --------------------------- organic posting -------------------------- */
      case "publish_post": {
        const { data: p } = await db.from("social_posts").select("*").eq("id", payload.post_id).maybeSingle();
        if (!p) throw new Error("Post not found");

        const pageId = p.page_id || conn.default_page_id;
        const igId = p.instagram_id || conn.default_instagram_id;
        let fbPostId: string | null = null;
        let igPostId: string | null = null;

        try {
          if (p.destination === "facebook" || p.destination === "both") {
            if (!pageId) throw new Error("No Facebook Page selected");
            const token = await pageToken(pageId);
            if (p.post_type === "image" && p.media_url) {
              const r = await graph(`/${pageId}/photos`, {
                token, method: "POST", body: { url: p.media_url, caption: p.message ?? "" },
              });
              fbPostId = r.post_id || r.id;
            } else if (p.post_type === "video" && p.media_url) {
              const r = await graph(`/${pageId}/videos`, {
                token, method: "POST", body: { file_url: p.media_url, description: p.message ?? "" },
              });
              fbPostId = r.id;
            } else {
              const r = await graph(`/${pageId}/feed`, { token, method: "POST", body: { message: p.message ?? "" } });
              fbPostId = r.id;
            }
          }

          if (p.destination === "instagram" || p.destination === "both") {
            if (!igId) throw new Error("No Instagram account selected");
            if (!p.media_url) throw new Error("Instagram posts require an image or video");
            const token = await pageToken(pageId!);
            const container = await graph(`/${igId}/media`, {
              token,
              method: "POST",
              body: p.post_type === "video"
                ? { media_type: "REELS", video_url: p.media_url, caption: p.message ?? "" }
                : { image_url: p.media_url, caption: p.message ?? "" },
            });
            const published = await graph(`/${igId}/media_publish`, {
              token, method: "POST", body: { creation_id: container.id },
            });
            igPostId = published.id;
          }
        } catch (e) {
          await db.from("social_posts").update({
            status: "failed", error_message: (e as Error).message,
          }).eq("id", p.id);
          throw e;
        }

        await db.from("social_posts").update({
          status: "published",
          facebook_post_id: fbPostId,
          instagram_post_id: igPostId,
          published_at: new Date().toISOString(),
          error_message: null,
        }).eq("id", p.id);

        return json({ success: true, facebook_post_id: fbPostId, instagram_post_id: igPostId });
      }

      /* ------------------------------ insights ------------------------------ */
      case "fetch_campaign_insights": {
        const { data: rows } = await db
          .from("social_campaigns")
          .select("id,external_id")
          .not("external_id", "is", null);
        const today = new Date().toISOString().slice(0, 10);
        for (const r of rows || []) {
          try {
            const res = await graph(`/${r.external_id}/insights`, {
              token: userToken,
              params: { fields: "reach,impressions,clicks,spend,actions,action_values", date_preset: "maximum" },
            });
            const d = res?.data?.[0];
            if (!d) continue;
            const actionCount = (t: string) =>
              Number((d.actions || []).find((a: any) => a.action_type === t)?.value || 0);
            const revenue = Number(
              (d.action_values || []).find((a: any) => a.action_type === "purchase")?.value || 0,
            );
            await db.from("social_insights").upsert({
              platform: "meta",
              entity_type: "campaign",
              entity_id: r.id,
              external_id: r.external_id,
              stat_date: today,
              reach: Number(d.reach || 0),
              impressions: Number(d.impressions || 0),
              clicks: Number(d.clicks || 0),
              spend: Number(d.spend || 0),
              leads: actionCount("lead"),
              purchases: actionCount("purchase"),
              conversions: actionCount("offsite_conversion"),
              revenue,
              raw: d,
            }, { onConflict: "entity_type,entity_id,stat_date" });
          } catch (e) {
            console.error("insights failed for", r.external_id, (e as Error).message);
          }
        }
        return json({ success: true });
      }

      case "resync_accounts": {
        return json({ success: true, note: "Reconnect via Facebook to refresh pages and ad accounts" });
      }

      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (err) {
    console.error("meta-api error:", (err as Error).message);
    return json({ error: (err as Error).message }, 500);
  }
});