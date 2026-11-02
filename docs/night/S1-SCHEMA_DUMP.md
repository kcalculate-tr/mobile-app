# KCAL Supabase — public schema dump

Project ref `xtjakvinklthlvsfcncu`. Generated 2026-11-02.

- Base tables (relkind='r'): **67**
- Views: **1** (order_financials)
- Total relations with columns: **68**

## (a) Tables, columns, types

### addresses

| column | type | nullable | default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| user_id | uuid | NO | auth.uid() |
| title | text | NO |  |
| full_address | text | NO |  |
| city | text | NO |  |
| district | text | NO |  |
| created_at | timestamp with time zone | NO | now() |
| contact_name | text | YES |  |
| contact_phone | text | YES |  |
| contact_email | text | YES |  |
| neighbourhood | text | YES |  |
| first_name | text | YES |  |
| last_name | text | YES |  |
| building_no | text | YES |  |
| floor | text | YES |  |
| apartment_no | text | YES |  |
| building_name | text | YES |  |
| street | text | YES |  |
| is_default | boolean | NO | false |
| latitude | numeric | YES |  |
| longitude | numeric | YES |  |
| verified_at | timestamp with time zone | YES |  |

### adisyo_api_log

| column | type | nullable | default |
|---|---|---|---|
| id | bigint | NO | nextval('adisyo_api_log_id_seq'::regclass) |
| order_id | bigint | YES |  |
| event_type | text | NO |  |
| request_body | jsonb | YES |  |
| response_status | integer | YES |  |
| response_body | jsonb | YES |  |
| error_message | text | YES |  |
| duration_ms | integer | YES |  |
| created_at | timestamp with time zone | YES | now() |

### adisyo_webhook_events

| column | type | nullable | default |
|---|---|---|---|
| id | bigint | NO | nextval('adisyo_webhook_events_id_seq'::regclass) |
| event_id | text | NO |  |
| event_type | text | NO |  |
| adisyo_order_id | bigint | YES |  |
| order_id | bigint | YES |  |
| raw_payload | jsonb | NO |  |
| signature_valid | boolean | YES |  |
| processed | boolean | YES | false |
| processed_at | timestamp with time zone | YES |  |
| process_error | text | YES |  |
| received_at | timestamp with time zone | YES | now() |
| debug_received_sig | text | YES |  |
| debug_expected_sig | text | YES |  |
| debug_message_string | text | YES |  |

### admin_allowlist

| column | type | nullable | default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| user_id | uuid | NO |  |
| email | text | YES |  |
| created_at | timestamp with time zone | YES | now() |

### analytics_events

| column | type | nullable | default |
|---|---|---|---|
| id | bigint | NO |  |
| user_id | uuid | YES |  |
| anon_id | text | YES |  |
| session_id | text | YES |  |
| event_name | text | NO |  |
| props | jsonb | NO | '{}'::jsonb |
| platform | text | YES |  |
| app_version | text | YES |  |
| created_at | timestamp with time zone | NO | now() |

### announcement_strip

| column | type | nullable | default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| message | text | NO |  |
| speed_ms | integer | NO | 18000 |
| bg_color | text | YES |  |
| text_color | text | YES |  |
| navigate_to | text | YES |  |
| priority | integer | NO | 0 |
| starts_at | timestamp with time zone | YES |  |
| ends_at | timestamp with time zone | YES |  |
| is_active | boolean | NO | true |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | NO | now() |

### app_banners

| column | type | nullable | default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| title | text | NO |  |
| subtitle | text | YES |  |
| image_url | text | YES |  |
| deeplink | text | YES |  |
| zone_ids | ARRAY | YES |  |
| priority | integer | NO | 0 |
| starts_at | timestamp with time zone | YES |  |
| ends_at | timestamp with time zone | YES |  |
| is_active | boolean | NO | true |
| created_at | timestamp with time zone | NO | now() |

### banner_cells

| column | type | nullable | default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| row_id | uuid | NO |  |
| position | integer | NO |  |
| image_url | text | YES |  |
| title | text | YES |  |
| link | text | YES |  |
| navigate_to | text | YES | 'Home'::text |
| is_active | boolean | NO | true |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | NO | now() |

### banner_rows

| column | type | nullable | default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| type | text | NO |  |
| grid_size | integer | NO | 1 |
| order | integer | NO | 0 |
| is_active | boolean | NO | true |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | NO | now() |

### banners

| column | type | nullable | default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| image_url | text | NO |  |
| link | text | YES |  |
| is_active | boolean | NO | true |
| order | integer | NO | 0 |
| created_at | timestamp with time zone | NO | now() |
| title | text | YES |  |
| navigate_to | text | YES | 'Home'::text |
| section | text | YES | 'slider'::text |

### body_measurements

| column | type | nullable | default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| user_id | uuid | YES |  |
| date | date | NO |  |
| weight_kg | numeric | YES |  |
| waist_cm | integer | YES |  |
| hip_cm | integer | YES |  |
| chest_cm | integer | YES |  |
| note | text | YES |  |
| created_at | timestamp with time zone | YES | now() |

### branch_assignment_log

| column | type | nullable | default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| order_id | bigint | NO |  |
| from_branch_id | uuid | YES |  |
| to_branch_id | uuid | YES |  |
| reason | text | NO |  |
| changed_by | uuid | YES |  |
| created_at | timestamp with time zone | NO | now() |

### branch_product_adisyo

| column | type | nullable | default |
|---|---|---|---|
| branch_id | uuid | NO |  |
| product_id | bigint | NO |  |
| adisyo_product_unit_id | bigint | NO |  |
| adisyo_product_code | text | YES |  |
| match_source | text | YES |  |
| matched_name | text | YES |  |
| updated_at | timestamp with time zone | NO | now() |

### branch_product_stock

| column | type | nullable | default |
|---|---|---|---|
| branch_id | uuid | NO |  |
| product_id | bigint | NO |  |
| is_available | boolean | NO | true |
| note | text | YES |  |
| updated_at | timestamp with time zone | NO | now() |
| updated_by | uuid | YES |  |

### branch_service_areas

| column | type | nullable | default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| branch_id | uuid | NO |  |
| city | text | NO | 'İzmir'::text |
| district | text | NO |  |
| neighborhood | text | YES |  |
| priority | integer | NO | 0 |
| is_active | boolean | NO | true |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | NO | now() |

### branch_users

| column | type | nullable | default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| user_id | uuid | NO |  |
| branch_id | uuid | NO |  |
| role | text | YES | 'staff'::text |
| created_at | timestamp with time zone | YES | now() |

### branches

| column | type | nullable | default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| name | text | NO |  |
| address | text | YES |  |
| created_at | timestamp with time zone | NO | timezone('utc'::text, now()) |
| slug | text | YES |  |
| is_active | boolean | NO | true |
| is_default | boolean | NO | false |
| adisyo_config | jsonb | YES |  |
| latitude | double precision | YES |  |
| longitude | double precision | YES |  |

### brands

| column | type | nullable | default |
|---|---|---|---|
| key | text | NO |  |
| name | text | NO |  |
| tagline | text | YES |  |
| description | text | YES |  |
| hero_image_url | text | YES |  |
| accent_color | text | YES | '#C6F04F'::text |
| order | integer | YES | 0 |
| is_active | boolean | YES | true |
| created_at | timestamp with time zone | YES | now() |

### campaign_targets

| column | type | nullable | default |
|---|---|---|---|
| id | bigint | NO | nextval('campaign_targets_id_seq'::regclass) |
| campaign_id | uuid | NO |  |
| user_id | uuid | YES |  |
| user_email | text | YES |  |
| created_at | timestamp with time zone | NO | now() |

### campaign_uses

| column | type | nullable | default |
|---|---|---|---|
| id | bigint | NO | nextval('campaign_uses_id_seq'::regclass) |
| campaign_id | uuid | NO |  |
| user_id | uuid | NO |  |
| order_id | bigint | YES |  |
| used_at | timestamp with time zone | NO | now() |

### campaigns

| column | type | nullable | default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| title | text | NO |  |
| description | text | YES |  |
| code | text | NO |  |
| badge | text | YES | 'Fırsat'::text |
| color_from | text | YES | '#F27A1A'::text |
| color_via | text | YES | '#fb923c'::text |
| color_to | text | YES | '#facc15'::text |
| is_active | boolean | NO | true |
| order | integer | NO | 0 |
| created_at | timestamp with time zone | NO | now() |
| start_date | date | YES |  |
| end_date | date | YES |  |
| min_cart_total | numeric | NO | 0 |
| discount_type | text | YES | 'percent'::text |
| discount_value | numeric | NO | 0 |
| max_discount | numeric | NO | 0 |
| image_url | text | YES |  |
| navigate_to | text | YES | 'Offers'::text |
| max_uses_per_user | integer | YES |  |
| user_id | uuid | YES |  |
| profile_id | uuid | YES |  |
| user_email | text | YES |  |
| status | text | NO | 'active'::text |
| max_uses_total | integer | YES |  |
| first_order_only | boolean | NO | false |
| excluded_categories | ARRAY | YES |  |
| source | text | YES |  |

### card_verifications

| column | type | nullable | default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| user_id | uuid | YES |  |
| client_ref_code | text | NO |  |
| amount | numeric | NO | 1.00 |
| status | text | NO | 'initiated'::text |
| paynkolay_reference_code | text | YES |  |
| paynkolay_trx_date | text | YES |  |
| tran_id | text | YES |  |
| card_saved | boolean | NO | false |
| note | text | YES |  |
| refund_attempts | integer | NO | 0 |
| last_refund_error | text | YES |  |
| last_refund_at | timestamp with time zone | YES |  |
| refund_response | jsonb | YES |  |
| refunded_at | timestamp with time zone | YES |  |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | NO | now() |
| charged_amount | numeric | YES |  |
| report_checked_at | timestamp with time zone | YES |  |
| report_check_count | integer | NO | 0 |

### categories

| column | type | nullable | default |
|---|---|---|---|
| id | bigint | NO |  |
| name | text | NO |  |
| order | integer | YES | 9999 |
| created_at | timestamp with time zone | NO | timezone('utc'::text, now()) |
| img | text | YES |  |
| emoji | text | YES |  |
| image_url | text | YES |  |
| discount_type | text | YES |  |
| discount_value | numeric | YES |  |
| parent_id | bigint | YES |  |

### deleted_account_fingerprints

| column | type | nullable | default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| phone_hash | text | YES |  |
| email_hash | text | YES |  |
| deleted_at | timestamp with time zone | NO | now() |

### delivery_settings

| column | type | nullable | default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| district | text | NO |  |
| cargo_rules | jsonb | YES | '[]'::jsonb |
| updated_at | timestamp with time zone | YES | now() |

### delivery_zones

| column | type | nullable | default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| city | text | YES | 'İzmir'::text |
| district | text | NO |  |
| neighborhood | text | NO |  |
| is_active | boolean | YES | false |
| allow_immediate | boolean | YES | false |
| allow_scheduled | boolean | YES | false |
| created_at | timestamp with time zone | YES | timezone('utc'::text, now()) |
| min_order | numeric | YES | 0 |
| updated_at | timestamp with time zone | YES | now() |
| delivery_days | ARRAY | YES | '{1,2,3,4,5}'::integer[] |
| delivery_fee_immediate | numeric | YES |  |
| delivery_fee_scheduled | numeric | YES |  |
| free_shipping_above_immediate | numeric | YES |  |
| free_shipping_above_scheduled | numeric | YES |  |
| min_order_immediate | numeric | YES |  |
| min_order_scheduled | numeric | YES |  |
| estimated_delivery_minutes | integer | YES |  |
| delivery_days_immediate | ARRAY | YES | '{1,2,3,4,5}'::integer[] |
| delivery_days_scheduled | ARRAY | YES | '{1,2,3,4,5}'::integer[] |
| estimated_delivery_minutes_max | integer | YES |  |

### failed_payments

| column | type | nullable | default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| user_id | uuid | YES |  |
| error_message | text | YES |  |
| amount | numeric | YES | 0 |
| payment_method | text | YES |  |
| order_data | jsonb | YES |  |
| created_at | timestamp with time zone | NO | now() |

### feedback

| column | type | nullable | default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| user_id | uuid | YES |  |
| user_email | text | YES |  |
| category | text | NO | 'general'::text |
| rating | integer | YES |  |
| message | text | NO |  |
| status | text | YES | 'new'::text |
| admin_note | text | YES |  |
| created_at | timestamp with time zone | YES | now() |
| is_approved | boolean | NO | false |
| approved_at | timestamp with time zone | YES |  |

### legal_documents

| column | type | nullable | default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| slug | text | NO |  |
| title | text | NO |  |
| content | text | NO |  |
| updated_at | timestamp with time zone | YES | now() |

### macro_transactions

| column | type | nullable | default |
|---|---|---|---|
| id | bigint | NO |  |
| user_id | uuid | NO |  |
| type | text | NO |  |
| amount | integer | NO |  |
| price_paid | numeric | YES |  |
| order_id | bigint | YES |  |
| note | text | YES |  |
| created_at | timestamp with time zone | YES | now() |

### marketplace_stores

| column | type | nullable | default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| platform | text | NO | 'trendyolgo'::text |
| brand | text | NO |  |
| supplier_id | text | NO |  |
| store_id | text | NO |  |
| branch_id | uuid | NO |  |
| secret_prefix | text | NO |  |
| is_active | boolean | NO | false |
| last_polled_at | timestamp with time zone | YES |  |
| last_poll_error | text | YES |  |
| created_at | timestamp with time zone | NO | now() |
| auto_accept | boolean | NO | true |
| preparation_time_min | integer | NO | 25 |

### meal_consumptions

| column | type | nullable | default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| user_id | uuid | NO |  |
| source | text | NO |  |
| source_ref | text | YES |  |
| name | text | NO |  |
| meal_type | text | YES |  |
| calories | integer | NO | 0 |
| protein | numeric | NO | 0 |
| carbs | numeric | NO | 0 |
| fat | numeric | NO | 0 |
| note | text | YES |  |
| consumed_at | timestamp with time zone | NO | now() |
| created_at | timestamp with time zone | NO | now() |

### meal_logs

| column | type | nullable | default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| user_id | uuid | YES |  |
| date | date | NO |  |
| meal_type | text | NO |  |
| calories | integer | NO |  |
| note | text | YES |  |
| created_at | timestamp with time zone | YES | now() |

### metrics_actions

| column | type | nullable | default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| title | text | NO |  |
| owner | text | YES |  |
| due_date | date | YES |  |
| status | text | NO | 'todo'::text |
| metric_code | text | YES |  |
| target | text | YES |  |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | NO | now() |

### metrics_insights

| column | type | nullable | default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| week_start | date | NO |  |
| severity | text | NO |  |
| title | text | NO |  |
| body | text | YES |  |
| metric_code | text | YES |  |
| sort | integer | NO | 0 |
| created_at | timestamp with time zone | NO | now() |

### notification_campaigns

| column | type | nullable | default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| name | text | NO |  |
| title | text | NO |  |
| body | text | NO |  |
| deep_link | text | YES |  |
| image_url | text | YES |  |
| target_type | text | NO |  |
| target_params | jsonb | YES |  |
| scheduled_at | timestamp with time zone | YES |  |
| sent_at | timestamp with time zone | YES |  |
| status | text | NO | 'draft'::text |
| target_count | integer | YES | 0 |
| sent_count | integer | YES | 0 |
| delivered_count | integer | YES | 0 |
| opened_count | integer | YES | 0 |
| failed_count | integer | YES | 0 |
| created_by | uuid | YES |  |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | NO | now() |

### notification_preferences

| column | type | nullable | default |
|---|---|---|---|
| user_id | uuid | NO |  |
| transactional_enabled | boolean | NO | true |
| marketing_enabled | boolean | NO | true |
| reminder_enabled | boolean | NO | true |
| behavioral_enabled | boolean | NO | true |
| quiet_hours_start | time without time zone | YES |  |
| quiet_hours_end | time without time zone | YES |  |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | NO | now() |

### notification_sends

| column | type | nullable | default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| user_id | uuid | YES |  |
| template_key | text | YES |  |
| category | text | YES |  |
| title | text | NO |  |
| body | text | NO |  |
| deep_link | text | YES |  |
| data | jsonb | YES |  |
| status | text | NO |  |
| error_message | text | YES |  |
| sent_at | timestamp with time zone | YES |  |
| delivered_at | timestamp with time zone | YES |  |
| opened_at | timestamp with time zone | YES |  |
| created_at | timestamp with time zone | NO | now() |

### notification_templates

| column | type | nullable | default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| key | text | NO |  |
| category | text | NO |  |
| title_template | text | NO |  |
| body_template | text | NO |  |
| deep_link | text | YES |  |
| is_active | boolean | NO | true |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | NO | now() |

### notifications

| column | type | nullable | default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| user_id | uuid | NO |  |
| title | text | NO |  |
| body | text | YES |  |
| type | text | YES | 'general'::text |
| data | jsonb | YES | '{}'::jsonb |
| read | boolean | YES | false |
| created_at | timestamp with time zone | YES | now() |

### option_groups

| column | type | nullable | default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| name | text | NO |  |
| description | text | YES |  |
| min_selection | integer | NO | 0 |
| max_selection | integer | NO | 1 |
| is_required | boolean | NO | false |
| created_at | timestamp with time zone | NO | now() |

### option_items

| column | type | nullable | default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| group_id | uuid | NO |  |
| name | text | NO |  |
| price_adjustment | numeric | NO | 0 |
| is_available | boolean | NO | true |
| sort_order | integer | NO | 0 |
| created_at | timestamp with time zone | NO | now() |
| calories | integer | YES |  |
| protein | numeric | YES |  |
| carbs | numeric | YES |  |
| fats | numeric | YES |  |
| linked_product_id | bigint | YES |  |

### order_financials (VIEW)

| column | type | nullable | default |
|---|---|---|---|
| order_id | bigint | YES |  |
| gross_revenue | numeric | YES |  |
| discount | numeric | YES |  |
| net_revenue | numeric | YES |  |
| cogs | numeric | YES |  |
| delivery_cost | numeric | YES |  |
| contribution_margin | numeric | YES |  |

### order_items

| column | type | nullable | default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| order_id | bigint | YES |  |
| product_id | bigint | YES |  |
| quantity | integer | NO | 1 |
| unit_price | numeric | NO | 0 |
| created_at | timestamp with time zone | YES | timezone('utc'::text, now()) |
| total_price | numeric | YES |  |
| product_name | text | YES |  |
| selected_options | jsonb | YES | '[]'::jsonb |
| calories | integer | YES |  |
| protein | numeric | YES |  |
| carbs | numeric | YES |  |
| fat | numeric | YES |  |

### order_modifications

| column | type | nullable | default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| order_id | bigint | NO |  |
| user_id | uuid | NO |  |
| type | text | NO |  |
| status | text | NO | 'pending'::text |
| old_scheduled_date | date | YES |  |
| new_scheduled_date | date | YES |  |
| old_scheduled_time | text | YES |  |
| new_scheduled_time | text | YES |  |
| old_address_id | uuid | YES |  |
| new_address_id | uuid | YES |  |
| new_address_text | text | YES |  |
| reviewed_by | uuid | YES |  |
| reviewed_at | timestamp with time zone | YES |  |
| reject_reason | text | YES |  |
| customer_note | text | YES |  |
| created_at | timestamp with time zone | YES | now() |
| updated_at | timestamp with time zone | YES | now() |

### orders

| column | type | nullable | default |
|---|---|---|---|
| id | bigint | NO |  |
| created_at | timestamp with time zone | NO | now() |
| customer_name | text | YES |  |
| phone | text | YES |  |
| address | text | YES |  |
| items | jsonb | YES |  |
| total_price | double precision | YES |  |
| status | text | YES |  |
| paytr_oid | text | YES |  |
| customer_email | text | YES |  |
| customer_id | uuid | YES |  |
| payment_method | text | YES |  |
| delivery_date | date | YES | CURRENT_DATE |
| credits_applied | boolean | NO | false |
| delivery_method | text | YES | 'delivery'::text |
| delivery_time_type | text | YES | 'immediate'::text |
| scheduled_date | date | YES |  |
| scheduled_slot | text | YES |  |
| delivered_at | timestamp with time zone | YES |  |
| user_id | uuid | YES |  |
| order_code | text | YES |  |
| branch_id | uuid | YES |  |
| order_uuid | uuid | YES | gen_random_uuid() |
| payment_status | text | YES | 'pending'::text |
| tosla_oid | text | YES |  |
| updated_at | timestamp with time zone | YES | now() |
| payment_provider | text | YES |  |
| coupon_code | text | YES |  |
| coupon_id | uuid | YES |  |
| delivery_fee | numeric | YES | 0 |
| discount_amount | numeric | YES | 0 |
| district | text | YES |  |
| total_amount | numeric | YES |  |
| subtotal_amount | numeric | YES |  |
| city | text | YES |  |
| payment_error_message | text | YES |  |
| note | text | YES |  |
| scheduled_time | time without time zone | YES |  |
| delivery_type | text | YES | 'immediate'::text |
| macro_quantity | integer | YES |  |
| type | text | YES |  |
| address_id | uuid | YES |  |
| merchant_oid | text | YES |  |
| payment_total_amount | numeric | YES |  |
| payment_installment_count | integer | YES | 1 |
| payment_failure_reason | text | YES |  |
| refund_amount | numeric | YES |  |
| refunded_at | timestamp with time zone | YES |  |
| macro_discount_amount | numeric | YES | 0 |
| adisyo_order_id | bigint | YES |  |
| adisyo_synced_at | timestamp with time zone | YES |  |
| adisyo_sync_error | text | YES |  |
| adisyo_sync_status | text | YES | 'pending'::text |
| adisyo_sync_attempts | integer | YES | 0 |
| adisyo_last_attempt_at | timestamp with time zone | YES |  |
| paynkolay_reference_code | text | YES |  |
| paynkolay_trx_date | text | YES |  |
| stuck_alert_sent_at | timestamp with time zone | YES |  |
| payment_review_pending | boolean | NO | false |
| payment_review_started_at | timestamp with time zone | YES |  |
| neighbourhood | text | YES |  |
| payment_drop_stage | text | YES |  |
| source | text | NO | 'app'::text |
| external_order_id | text | YES |  |
| external_code | text | YES |  |
| external_store_id | text | YES |  |
| external_status | text | YES |  |
| external_payload | jsonb | YES |  |
| external_sync_status | text | YES |  |
| external_sync_error | text | YES |  |
| external_last_attempt_at | timestamp with time zone | YES |  |
| adisyo_web_order_suffix | text | YES |  |

### popups

| column | type | nullable | default |
|---|---|---|---|
| id | bigint | NO |  |
| title | text | YES |  |
| description | text | YES |  |
| image_url | text | YES |  |
| button_label | text | YES |  |
| button_link | text | YES |  |
| order_index | integer | NO | 0 |
| is_active | boolean | NO | true |
| starts_at | timestamp with time zone | YES |  |
| ends_at | timestamp with time zone | YES |  |
| created_at | timestamp with time zone | YES | now() |
| button_navigate_to | text | YES | 'Home'::text |

### product_option_groups

| column | type | nullable | default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| product_id | bigint | NO |  |
| group_id | uuid | NO |  |
| sort_order | integer | YES | 0 |
| created_at | timestamp with time zone | NO | now() |

### product_option_links

| column | type | nullable | default |
|---|---|---|---|
| id | bigint | NO | nextval('product_option_links_id_seq'::regclass) |
| product_id | bigint | NO |  |
| template_id | bigint | NO |  |
| is_required_override | boolean | YES |  |
| min_selections_override | integer | YES |  |
| max_selections_override | integer | YES |  |
| display_order | integer | NO | 0 |
| is_active | boolean | NO | true |
| created_at | timestamp with time zone | NO | now() |

### product_option_template_values

| column | type | nullable | default |
|---|---|---|---|
| id | bigint | NO | nextval('product_option_template_values_id_seq'::regclass) |
| template_id | bigint | NO |  |
| name | text | NO |  |
| price_modifier | numeric | NO | 0 |
| calorie_modifier | integer | NO | 0 |
| protein_modifier | numeric | NO | 0 |
| carbs_modifier | numeric | NO | 0 |
| fats_modifier | numeric | NO | 0 |
| is_default | boolean | NO | false |
| is_active | boolean | NO | true |
| display_order | integer | NO | 0 |
| created_at | timestamp with time zone | NO | now() |
| linked_product_id | bigint | YES |  |
| allow_repeats | boolean | NO | false |

### product_option_templates

| column | type | nullable | default |
|---|---|---|---|
| id | bigint | NO | nextval('product_option_templates_id_seq'::regclass) |
| name | text | NO |  |
| description | text | YES |  |
| selection_type | text | NO | 'single'::text |
| is_required_default | boolean | NO | false |
| min_selections | integer | NO | 0 |
| max_selections | integer | YES |  |
| is_active | boolean | NO | true |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | NO | now() |

### products

| column | type | nullable | default |
|---|---|---|---|
| id | bigint | NO |  |
| created_at | timestamp with time zone | NO | now() |
| name | text | YES |  |
| desc | text | YES |  |
| price | double precision | YES |  |
| category | text | YES |  |
| img | text | YES |  |
| cal | smallint | YES |  |
| slug | text | YES |  |
| protein | numeric | YES | 0 |
| carbs | numeric | YES | 0 |
| fats | numeric | YES | 0 |
| type | text | YES | 'meal'::text |
| package_credits | integer | YES | 0 |
| calories | integer | YES |  |
| in_stock | boolean | YES | true |
| is_available | boolean | YES | true |
| order | integer | YES | 9999 |
| is_favorite | boolean | YES | false |
| favorite_order | integer | YES | 9999 |
| allow_immediate | boolean | YES | true |
| allow_scheduled | boolean | YES | true |
| discount_type | text | YES |  |
| discount_value | numeric | YES |  |
| is_crosssell | boolean | YES | false |
| adisyo_product_unit_id | bigint | YES |  |
| adisyo_product_code | text | YES |  |
| gramaj_options | jsonb | YES | '[]'::jsonb |
| is_bundle | boolean | NO | false |
| brand | text | YES |  |

### profiles

| column | type | nullable | default |
|---|---|---|---|
| id | uuid | NO |  |
| full_name | text | YES |  |
| phone | text | YES |  |
| macro_points | integer | YES | 0 |
| created_at | timestamp with time zone | NO | timezone('utc'::text, now()) |
| role | text | YES | 'customer'::text |
| branch_id | uuid | YES |  |
| push_token | text | YES |  |
| macro_balance | integer | NO | 0 |
| privileged_until | timestamp with time zone | YES |  |
| total_macros_purchased | integer | NO | 0 |
| email | text | YES |  |
| avatar_url | text | YES |  |
| first_name | text | YES |  |
| last_name | text | YES |  |
| payment_customer_key | text | YES |  |

### push_notifications

| column | type | nullable | default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| user_id | uuid | YES |  |
| title | text | YES |  |
| body | text | YES |  |
| data | jsonb | YES |  |
| sent_at | timestamp with time zone | YES | now() |

### push_tokens

| column | type | nullable | default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| user_id | uuid | NO |  |
| expo_push_token | text | NO |  |
| device_type | text | YES |  |
| device_name | text | YES |  |
| app_version | text | YES |  |
| is_active | boolean | NO | true |
| last_used_at | timestamp with time zone | NO | now() |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | NO | now() |

### refunds

| column | type | nullable | default |
|---|---|---|---|
| id | bigint | NO |  |
| order_id | bigint | YES |  |
| amount | numeric | YES |  |
| reason | text | YES |  |
| created_at | timestamp with time zone | YES | now() |
| type | text | YES |  |
| paynkolay_reference | text | YES |  |
| provider_response | jsonb | YES |  |
| refunded_at | timestamp with time zone | YES |  |
| status | text | YES |  |

### review_item_feedback

| column | type | nullable | default |
|---|---|---|---|
| id | bigint | NO | nextval('review_item_feedback_id_seq'::regclass) |
| review_id | bigint | YES |  |
| order_id | integer | NO |  |
| user_id | uuid | NO |  |
| product_id | integer | NO |  |
| product_name | text | YES |  |
| liked | boolean | NO |  |
| created_at | timestamp with time zone | NO | now() |

### reviews

| column | type | nullable | default |
|---|---|---|---|
| id | bigint | NO |  |
| order_id | integer | NO |  |
| user_id | uuid | NO |  |
| rating | smallint | NO |  |
| comment | text | YES |  |
| is_approved | boolean | NO | false |
| created_at | timestamp with time zone | NO | now() |
| admin_reply | text | YES |  |
| admin_reply_at | timestamp with time zone | YES |  |
| admin_reply_by | uuid | YES |  |
| reply_seen_at | timestamp with time zone | YES |  |

### settings

| column | type | nullable | default |
|---|---|---|---|
| id | integer | NO |  |
| is_shop_open | boolean | NO | true |
| min_cart_amount | numeric | NO | 0 |
| macro_price | integer | YES | 1500 |
| macro_threshold | integer | YES | 15 |
| macro_membership_days | integer | YES | 30 |
| working_days | ARRAY | YES | '{1,2,3,4,5}'::integer[] |
| open_time | time without time zone | YES | '09:00:00'::time without time zone |
| close_time | time without time zone | YES | '21:00:00'::time without time zone |
| closed_dates | ARRAY | YES | '{}'::text[] |
| closed_dates_note | jsonb | YES | '{}'::jsonb |
| holiday_banner_active | boolean | NO | false |
| holiday_banner_message | text | YES |  |
| min_supported_version | text | YES |  |
| force_update_message | text | YES |  |
| review_banner_url | text | YES |  |
| macro_earn_threshold | numeric | NO | 500 |
| macro_meal_cost | integer | NO | 5 |
| macro_reward_valid_days | integer | NO | 90 |
| macro_meal_min_cart | numeric | NO | 0 |
| macro_meal_max_value | numeric | NO | 0 |
| macro_meal_excluded_categories | ARRAY | NO | ARRAY['Koliye Özel Fırsatlar'::text] |
| macro_rewards_enabled | boolean | NO | false |
| store_name | text | YES |  |
| store_phone | text | YES |  |
| store_email | text | YES |  |
| currency | text | YES | '₺'::text |
| notification_email | text | YES |  |

### subscription_plans

| column | type | nullable | default |
|---|---|---|---|
| id | uuid | NO | extensions.uuid_generate_v4() |
| user_id | uuid | NO |  |
| order_oid | text | NO |  |
| meal_count | integer | NO | 0 |
| selected_days | jsonb | NO | '[]'::jsonb |
| plan_end_date | date | YES |  |
| unit_price | numeric | NO | 0 |
| delivery_fee | numeric | NO | 40 |
| total_price | numeric | NO | 0 |
| created_at | timestamp with time zone | NO | now() |

### support_tickets

| column | type | nullable | default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| user_id | uuid | NO |  |
| user_email | text | NO |  |
| order_code | text | YES |  |
| subject | text | NO |  |
| message | text | NO |  |
| admin_reply | text | YES |  |
| status | text | YES | 'open'::text |
| created_at | timestamp with time zone | NO | timezone('utc'::text, now()) |
| updated_at | timestamp with time zone | NO | timezone('utc'::text, now()) |
| admin_reply_at | timestamp with time zone | YES |  |
| push_token | text | YES |  |
| attachments | jsonb | YES | '[]'::jsonb |

### sweep_locks

| column | type | nullable | default |
|---|---|---|---|
| name | text | NO |  |
| locked_until | timestamp with time zone | NO |  |
| locked_by | text | YES |  |

### user_apple_tokens

| column | type | nullable | default |
|---|---|---|---|
| user_id | uuid | NO |  |
| refresh_token | text | NO |  |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | NO | now() |

### user_card_secrets

| column | type | nullable | default |
|---|---|---|---|
| card_id | uuid | NO |  |
| card_token | text | NO |  |
| updated_at | timestamp with time zone | NO | now() |
| cs_tran_id | text | YES |  |

### user_cards

| column | type | nullable | default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| user_id | uuid | YES |  |
| card_alias | text | YES |  |
| last4 | character varying | YES |  |
| brand | character varying | YES |  |
| is_default | boolean | YES | false |
| created_at | timestamp with time zone | YES | now() |
| paynkolay_customer_key | text | YES |  |
| bank_name | text | YES |  |

### user_credits

| column | type | nullable | default |
|---|---|---|---|
| id | uuid | NO | extensions.uuid_generate_v4() |
| user_id | uuid | NO |  |
| total_credits | integer | NO | 0 |
| remaining_credits | integer | NO | 0 |
| updated_at | timestamp with time zone | NO | now() |
| meal_credits | integer | NO | 0 |
| delivery_credits | integer | NO | 0 |

### user_known_devices

| column | type | nullable | default |
|---|---|---|---|
| user_id | uuid | NO |  |
| device_id | text | NO |  |
| first_seen_at | timestamp with time zone | NO | now() |

### user_nutrition_profiles

| column | type | nullable | default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| user_id | uuid | NO |  |
| gender | text | YES |  |
| age | integer | YES |  |
| height | integer | YES |  |
| weight | numeric | YES |  |
| goal | text | YES |  |
| target_calories | integer | YES |  |
| target_protein | integer | YES |  |
| target_carbs | integer | YES |  |
| target_fat | integer | YES |  |
| target_water | numeric | YES |  |
| created_at | timestamp with time zone | YES | timezone('utc'::text, now()) |
| updated_at | timestamp with time zone | YES | timezone('utc'::text, now()) |
| waist_cm | integer | YES |  |
| hip_cm | integer | YES |  |
| chest_cm | integer | YES |  |
| activity_level | text | YES |  |
| custom_calories | integer | YES |  |
| custom_protein | integer | YES |  |
| custom_carbs | integer | YES |  |
| custom_fat | integer | YES |  |
| use_custom_macros | boolean | YES | false |

## (b) Foreign keys

| table | column | -> ref table | ref col | constraint |
|---|---|---|---|---|
| addresses | user_id | auth.users | id | addresses_user_id_fkey |
| adisyo_api_log | order_id | orders | id | adisyo_api_log_order_id_fkey |
| adisyo_webhook_events | order_id | orders | id | adisyo_webhook_events_order_id_fkey |
| analytics_events | user_id | auth.users | id | analytics_events_user_id_fkey |
| banner_cells | row_id | banner_rows | id | banner_cells_row_id_fkey |
| body_measurements | user_id | auth.users | id | body_measurements_user_id_fkey |
| branch_assignment_log | changed_by | auth.users | id | branch_assignment_log_changed_by_fkey |
| branch_assignment_log | from_branch_id | branches | id | branch_assignment_log_from_branch_id_fkey |
| branch_assignment_log | order_id | orders | id | branch_assignment_log_order_id_fkey |
| branch_assignment_log | to_branch_id | branches | id | branch_assignment_log_to_branch_id_fkey |
| branch_product_adisyo | branch_id | branches | id | branch_product_adisyo_branch_id_fkey |
| branch_product_adisyo | product_id | products | id | branch_product_adisyo_product_id_fkey |
| branch_product_stock | branch_id | branches | id | branch_product_stock_branch_id_fkey |
| branch_product_stock | product_id | products | id | branch_product_stock_product_id_fkey |
| branch_service_areas | branch_id | branches | id | branch_service_areas_branch_id_fkey |
| branch_users | branch_id | branches | id | branch_users_branch_id_fkey |
| branch_users | user_id | auth.users | id | branch_users_user_id_fkey |
| campaign_targets | campaign_id | campaigns | id | campaign_targets_campaign_id_fkey |
| campaign_uses | campaign_id | campaigns | id | campaign_uses_campaign_id_fkey |
| campaign_uses | order_id | orders | id | campaign_uses_order_id_fkey |
| card_verifications | user_id | auth.users | id | card_verifications_user_id_fkey |
| categories | parent_id | categories | id | categories_parent_id_fkey |
| failed_payments | user_id | auth.users | id | failed_payments_user_id_fkey |
| feedback | user_id | auth.users | id | feedback_user_id_fkey |
| macro_transactions | order_id | orders | id | macro_transactions_order_id_fkey |
| macro_transactions | user_id | auth.users | id | macro_transactions_user_id_fkey |
| marketplace_stores | branch_id | branches | id | marketplace_stores_branch_id_fkey |
| meal_consumptions | user_id | auth.users | id | meal_consumptions_user_id_fkey |
| meal_logs | user_id | auth.users | id | meal_logs_user_id_fkey |
| notification_campaigns | created_by | auth.users | id | notification_campaigns_created_by_fkey |
| notification_preferences | user_id | auth.users | id | notification_preferences_user_id_fkey |
| notification_sends | user_id | auth.users | id | notification_sends_user_id_fkey |
| option_items | group_id | option_groups | id | option_items_group_id_fk |
| option_items | group_id | option_groups | id | option_items_group_id_fkey |
| option_items | linked_product_id | products | id | option_items_linked_product_id_fkey |
| order_items | order_id | orders | id | order_items_order_id_fkey |
| order_items | product_id | products | id | order_items_product_id_fkey |
| orders | address_id | addresses | id | orders_address_id_fkey |
| orders | branch_id | branches | id | orders_branch_id_fkey |
| orders | coupon_id | campaigns | id | orders_coupon_id_fkey |
| product_option_groups | group_id | option_groups | id | product_option_groups_group_fk |
| product_option_groups | group_id | option_groups | id | product_option_groups_group_id_fkey |
| product_option_groups | product_id | products | id | product_option_groups_product_fk |
| product_option_groups | product_id | products | id | product_option_groups_product_id_fkey |
| product_option_links | product_id | products | id | product_option_links_product_id_fkey |
| product_option_links | template_id | product_option_templates | id | product_option_links_template_id_fkey |
| product_option_template_values | linked_product_id | products | id | product_option_template_values_linked_product_id_fkey |
| product_option_template_values | template_id | product_option_templates | id | product_option_template_values_template_id_fkey |
| profiles | branch_id | branches | id | profiles_branch_id_fkey |
| profiles | id | auth.users | id | profiles_id_fkey |
| push_tokens | user_id | auth.users | id | push_tokens_user_id_fkey |
| refunds | order_id | orders | id | refunds_order_id_fkey |
| review_item_feedback | review_id | reviews | id | review_item_feedback_review_id_fkey |
| review_item_feedback | user_id | auth.users | id | review_item_feedback_user_id_fkey |
| reviews | order_id | orders | id | reviews_order_id_fkey |
| reviews | user_id | auth.users | id | reviews_user_id_fkey |
| subscription_plans | user_id | auth.users | id | subscription_plans_user_id_fkey |
| support_tickets | user_id | auth.users | id | support_tickets_user_id_fkey |
| user_apple_tokens | user_id | auth.users | id | user_apple_tokens_user_id_fkey |
| user_card_secrets | card_id | user_cards | id | user_card_secrets_card_id_fkey |
| user_cards | user_id | auth.users | id | user_cards_user_id_fkey |
| user_credits | user_id | auth.users | id | user_credits_user_id_fkey |
| user_known_devices | user_id | auth.users | id | user_known_devices_user_id_fkey |
| user_nutrition_profiles | user_id | auth.users | id | user_nutrition_profiles_user_id_fkey |

## (c) Indexes

| table | index | definition |
|---|---|---|
| addresses | addresses_created_at_idx | CREATE INDEX addresses_created_at_idx ON public.addresses USING btree (created_at DESC) |
| addresses | addresses_pkey | CREATE UNIQUE INDEX addresses_pkey ON public.addresses USING btree (id) |
| addresses | addresses_user_id_idx | CREATE INDEX addresses_user_id_idx ON public.addresses USING btree (user_id) |
| adisyo_api_log | adisyo_api_log_pkey | CREATE UNIQUE INDEX adisyo_api_log_pkey ON public.adisyo_api_log USING btree (id) |
| adisyo_api_log | idx_adisyo_log_event | CREATE INDEX idx_adisyo_log_event ON public.adisyo_api_log USING btree (event_type, created_at DESC) |
| adisyo_api_log | idx_adisyo_log_order | CREATE INDEX idx_adisyo_log_order ON public.adisyo_api_log USING btree (order_id, created_at DESC) |
| adisyo_webhook_events | adisyo_webhook_events_event_id_key | CREATE UNIQUE INDEX adisyo_webhook_events_event_id_key ON public.adisyo_webhook_events USING btree (event_id) |
| adisyo_webhook_events | adisyo_webhook_events_pkey | CREATE UNIQUE INDEX adisyo_webhook_events_pkey ON public.adisyo_webhook_events USING btree (id) |
| adisyo_webhook_events | idx_webhook_event_type | CREATE INDEX idx_webhook_event_type ON public.adisyo_webhook_events USING btree (event_type, received_at DESC) |
| adisyo_webhook_events | idx_webhook_order | CREATE INDEX idx_webhook_order ON public.adisyo_webhook_events USING btree (adisyo_order_id) |
| adisyo_webhook_events | idx_webhook_unprocessed | CREATE INDEX idx_webhook_unprocessed ON public.adisyo_webhook_events USING btree (processed, received_at) WHERE (processed = false) |
| admin_allowlist | admin_allowlist_pkey | CREATE UNIQUE INDEX admin_allowlist_pkey ON public.admin_allowlist USING btree (id) |
| admin_allowlist | admin_allowlist_user_id_key | CREATE UNIQUE INDEX admin_allowlist_user_id_key ON public.admin_allowlist USING btree (user_id) |
| analytics_events | analytics_events_created_at_idx | CREATE INDEX analytics_events_created_at_idx ON public.analytics_events USING btree (created_at DESC) |
| analytics_events | analytics_events_event_name_created_at_idx | CREATE INDEX analytics_events_event_name_created_at_idx ON public.analytics_events USING btree (event_name, created_at) |
| analytics_events | analytics_events_pkey | CREATE UNIQUE INDEX analytics_events_pkey ON public.analytics_events USING btree (id) |
| analytics_events | analytics_events_purchase_order_id_uq | CREATE UNIQUE INDEX analytics_events_purchase_order_id_uq ON public.analytics_events USING btree ((((props ->> 'order_id'::text))::bigint)) WHERE (event_name = 'purchase'::text) |
| analytics_events | analytics_events_session_idx | CREATE INDEX analytics_events_session_idx ON public.analytics_events USING btree (session_id, created_at) |
| analytics_events | analytics_events_user_event_idx | CREATE INDEX analytics_events_user_event_idx ON public.analytics_events USING btree (user_id, event_name, created_at DESC) |
| analytics_events | analytics_events_user_id_created_at_idx | CREATE INDEX analytics_events_user_id_created_at_idx ON public.analytics_events USING btree (user_id, created_at) |
| announcement_strip | announcement_strip_is_active_priority_idx | CREATE INDEX announcement_strip_is_active_priority_idx ON public.announcement_strip USING btree (is_active, priority DESC) |
| announcement_strip | announcement_strip_pkey | CREATE UNIQUE INDEX announcement_strip_pkey ON public.announcement_strip USING btree (id) |
| app_banners | app_banners_is_active_priority_idx | CREATE INDEX app_banners_is_active_priority_idx ON public.app_banners USING btree (is_active, priority DESC) |
| app_banners | app_banners_pkey | CREATE UNIQUE INDEX app_banners_pkey ON public.app_banners USING btree (id) |
| banner_cells | banner_cells_pkey | CREATE UNIQUE INDEX banner_cells_pkey ON public.banner_cells USING btree (id) |
| banner_cells | banner_cells_row_id_position_key | CREATE UNIQUE INDEX banner_cells_row_id_position_key ON public.banner_cells USING btree (row_id, "position") |
| banner_cells | idx_banner_cells_active | CREATE INDEX idx_banner_cells_active ON public.banner_cells USING btree (is_active) |
| banner_cells | idx_banner_cells_row | CREATE INDEX idx_banner_cells_row ON public.banner_cells USING btree (row_id) |
| banner_rows | banner_rows_pkey | CREATE UNIQUE INDEX banner_rows_pkey ON public.banner_rows USING btree (id) |
| banner_rows | idx_banner_rows_type_active_order | CREATE INDEX idx_banner_rows_type_active_order ON public.banner_rows USING btree (type, is_active, "order") |
| banners | banners_order_idx | CREATE INDEX banners_order_idx ON public.banners USING btree ("order") |
| banners | banners_pkey | CREATE UNIQUE INDEX banners_pkey ON public.banners USING btree (id) |
| body_measurements | body_measurements_pkey | CREATE UNIQUE INDEX body_measurements_pkey ON public.body_measurements USING btree (id) |
| body_measurements | body_measurements_user_id_date_key | CREATE UNIQUE INDEX body_measurements_user_id_date_key ON public.body_measurements USING btree (user_id, date) |
| branch_assignment_log | branch_assignment_log_order_idx | CREATE INDEX branch_assignment_log_order_idx ON public.branch_assignment_log USING btree (order_id) |
| branch_assignment_log | branch_assignment_log_pkey | CREATE UNIQUE INDEX branch_assignment_log_pkey ON public.branch_assignment_log USING btree (id) |
| branch_product_adisyo | branch_product_adisyo_pkey | CREATE UNIQUE INDEX branch_product_adisyo_pkey ON public.branch_product_adisyo USING btree (branch_id, product_id) |
| branch_product_adisyo | idx_bpa_branch | CREATE INDEX idx_bpa_branch ON public.branch_product_adisyo USING btree (branch_id) |
| branch_product_stock | branch_product_stock_pkey | CREATE UNIQUE INDEX branch_product_stock_pkey ON public.branch_product_stock USING btree (branch_id, product_id) |
| branch_product_stock | idx_bps_product_closed | CREATE INDEX idx_bps_product_closed ON public.branch_product_stock USING btree (product_id) WHERE (is_available = false) |
| branch_service_areas | branch_service_areas_branch_idx | CREATE INDEX branch_service_areas_branch_idx ON public.branch_service_areas USING btree (branch_id) |
| branch_service_areas | branch_service_areas_lookup_idx | CREATE INDEX branch_service_areas_lookup_idx ON public.branch_service_areas USING btree (city, district, neighborhood) WHERE is_active |
| branch_service_areas | branch_service_areas_pkey | CREATE UNIQUE INDEX branch_service_areas_pkey ON public.branch_service_areas USING btree (id) |
| branch_users | branch_users_pkey | CREATE UNIQUE INDEX branch_users_pkey ON public.branch_users USING btree (id) |
| branch_users | branch_users_user_id_branch_id_key | CREATE UNIQUE INDEX branch_users_user_id_branch_id_key ON public.branch_users USING btree (user_id, branch_id) |
| branches | branches_one_default_idx | CREATE UNIQUE INDEX branches_one_default_idx ON public.branches USING btree (is_default) WHERE is_default |
| branches | branches_pkey | CREATE UNIQUE INDEX branches_pkey ON public.branches USING btree (id) |
| branches | branches_slug_key | CREATE UNIQUE INDEX branches_slug_key ON public.branches USING btree (slug) |
| brands | brands_pkey | CREATE UNIQUE INDEX brands_pkey ON public.brands USING btree (key) |
| campaign_targets | campaign_targets_campaign_ix | CREATE INDEX campaign_targets_campaign_ix ON public.campaign_targets USING btree (campaign_id) |
| campaign_targets | campaign_targets_email_ux | CREATE UNIQUE INDEX campaign_targets_email_ux ON public.campaign_targets USING btree (campaign_id, lower(user_email)) WHERE (user_email IS NOT NULL) |
| campaign_targets | campaign_targets_pkey | CREATE UNIQUE INDEX campaign_targets_pkey ON public.campaign_targets USING btree (id) |
| campaign_targets | campaign_targets_uid_ux | CREATE UNIQUE INDEX campaign_targets_uid_ux ON public.campaign_targets USING btree (campaign_id, user_id) WHERE (user_id IS NOT NULL) |
| campaign_uses | campaign_uses_pkey | CREATE UNIQUE INDEX campaign_uses_pkey ON public.campaign_uses USING btree (id) |
| campaign_uses | idx_campaign_uses_campaign | CREATE INDEX idx_campaign_uses_campaign ON public.campaign_uses USING btree (campaign_id) |
| campaign_uses | idx_campaign_uses_used_at | CREATE INDEX idx_campaign_uses_used_at ON public.campaign_uses USING btree (used_at DESC) |
| campaign_uses | idx_campaign_uses_user_campaign | CREATE INDEX idx_campaign_uses_user_campaign ON public.campaign_uses USING btree (user_id, campaign_id) |
| campaign_uses | unique_campaign_order | CREATE UNIQUE INDEX unique_campaign_order ON public.campaign_uses USING btree (campaign_id, order_id) |
| campaigns | campaigns_active_idx | CREATE INDEX campaigns_active_idx ON public.campaigns USING btree (is_active) |
| campaigns | campaigns_code_idx | CREATE INDEX campaigns_code_idx ON public.campaigns USING btree (code) |
| campaigns | campaigns_order_idx | CREATE INDEX campaigns_order_idx ON public.campaigns USING btree ("order") |
| campaigns | campaigns_pkey | CREATE UNIQUE INDEX campaigns_pkey ON public.campaigns USING btree (id) |
| campaigns | campaigns_source_user_idx | CREATE INDEX campaigns_source_user_idx ON public.campaigns USING btree (source, user_id) WHERE (source IS NOT NULL) |
| campaigns | campaigns_user_id_idx | CREATE INDEX campaigns_user_id_idx ON public.campaigns USING btree (user_id) |
| card_verifications | card_verifications_client_ref_code_key | CREATE UNIQUE INDEX card_verifications_client_ref_code_key ON public.card_verifications USING btree (client_ref_code) |
| card_verifications | card_verifications_initiated_idx | CREATE INDEX card_verifications_initiated_idx ON public.card_verifications USING btree (created_at) WHERE (status = 'initiated'::text) |
| card_verifications | card_verifications_one_initiated_per_user | CREATE UNIQUE INDEX card_verifications_one_initiated_per_user ON public.card_verifications USING btree (user_id) WHERE ((status = 'initiated'::text) AND (user_id IS NOT NULL)) |
| card_verifications | card_verifications_pkey | CREATE UNIQUE INDEX card_verifications_pkey ON public.card_verifications USING btree (id) |
| card_verifications | card_verifications_refund_pending_idx | CREATE INDEX card_verifications_refund_pending_idx ON public.card_verifications USING btree (created_at) WHERE (status = 'refund_pending'::text) |
| card_verifications | card_verifications_user_created_idx | CREATE INDEX card_verifications_user_created_idx ON public.card_verifications USING btree (user_id, created_at DESC) |
| categories | categories_name_key | CREATE UNIQUE INDEX categories_name_key ON public.categories USING btree (name) |
| categories | categories_pkey | CREATE UNIQUE INDEX categories_pkey ON public.categories USING btree (id) |
| deleted_account_fingerprints | deleted_account_fingerprints_pkey | CREATE UNIQUE INDEX deleted_account_fingerprints_pkey ON public.deleted_account_fingerprints USING btree (id) |
| deleted_account_fingerprints | idx_deleted_account_fingerprints_email_hash | CREATE INDEX idx_deleted_account_fingerprints_email_hash ON public.deleted_account_fingerprints USING btree (email_hash) |
| deleted_account_fingerprints | idx_deleted_account_fingerprints_phone_hash | CREATE INDEX idx_deleted_account_fingerprints_phone_hash ON public.deleted_account_fingerprints USING btree (phone_hash) |
| delivery_settings | delivery_settings_district_key | CREATE UNIQUE INDEX delivery_settings_district_key ON public.delivery_settings USING btree (district) |
| delivery_settings | delivery_settings_pkey | CREATE UNIQUE INDEX delivery_settings_pkey ON public.delivery_settings USING btree (id) |
| delivery_zones | delivery_zones_city_district_neighborhood_uidx | CREATE UNIQUE INDEX delivery_zones_city_district_neighborhood_uidx ON public.delivery_zones USING btree (city, district, neighborhood) |
| delivery_zones | delivery_zones_pkey | CREATE UNIQUE INDEX delivery_zones_pkey ON public.delivery_zones USING btree (id) |
| failed_payments | failed_payments_created_at_idx | CREATE INDEX failed_payments_created_at_idx ON public.failed_payments USING btree (created_at) |
| failed_payments | failed_payments_pkey | CREATE UNIQUE INDEX failed_payments_pkey ON public.failed_payments USING btree (id) |
| failed_payments | failed_payments_user_id_idx | CREATE INDEX failed_payments_user_id_idx ON public.failed_payments USING btree (user_id) |
| feedback | feedback_pkey | CREATE UNIQUE INDEX feedback_pkey ON public.feedback USING btree (id) |
| feedback | feedback_vitrin_idx | CREATE INDEX feedback_vitrin_idx ON public.feedback USING btree (is_approved, rating DESC, created_at DESC) WHERE is_approved |
| legal_documents | legal_documents_pkey | CREATE UNIQUE INDEX legal_documents_pkey ON public.legal_documents USING btree (id) |
| legal_documents | legal_documents_slug_key | CREATE UNIQUE INDEX legal_documents_slug_key ON public.legal_documents USING btree (slug) |
| macro_transactions | macro_transactions_order_earn_uniq | CREATE UNIQUE INDEX macro_transactions_order_earn_uniq ON public.macro_transactions USING btree (order_id) WHERE ((type = 'order_earn'::text) AND (order_id IS NOT NULL)) |
| macro_transactions | macro_transactions_pkey | CREATE UNIQUE INDEX macro_transactions_pkey ON public.macro_transactions USING btree (id) |
| marketplace_stores | marketplace_stores_pkey | CREATE UNIQUE INDEX marketplace_stores_pkey ON public.marketplace_stores USING btree (id) |
| marketplace_stores | marketplace_stores_platform_supplier_id_store_id_key | CREATE UNIQUE INDEX marketplace_stores_platform_supplier_id_store_id_key ON public.marketplace_stores USING btree (platform, supplier_id, store_id) |
| meal_consumptions | idx_meal_consumptions_user_consumed | CREATE INDEX idx_meal_consumptions_user_consumed ON public.meal_consumptions USING btree (user_id, consumed_at DESC) |
| meal_consumptions | idx_meal_consumptions_user_date | CREATE INDEX idx_meal_consumptions_user_date ON public.meal_consumptions USING btree (user_id, (((consumed_at AT TIME ZONE 'Europe/Istanbul'::text))::date)) |
| meal_consumptions | meal_consumptions_pkey | CREATE UNIQUE INDEX meal_consumptions_pkey ON public.meal_consumptions USING btree (id) |
| meal_consumptions | meal_consumptions_user_id_source_source_ref_key | CREATE UNIQUE INDEX meal_consumptions_user_id_source_source_ref_key ON public.meal_consumptions USING btree (user_id, source, source_ref) |
| meal_logs | meal_logs_pkey | CREATE UNIQUE INDEX meal_logs_pkey ON public.meal_logs USING btree (id) |
| metrics_actions | metrics_actions_pkey | CREATE UNIQUE INDEX metrics_actions_pkey ON public.metrics_actions USING btree (id) |
| metrics_actions | metrics_actions_status_idx | CREATE INDEX metrics_actions_status_idx ON public.metrics_actions USING btree (status, due_date) |
| metrics_insights | metrics_insights_pkey | CREATE UNIQUE INDEX metrics_insights_pkey ON public.metrics_insights USING btree (id) |
| metrics_insights | metrics_insights_week_idx | CREATE INDEX metrics_insights_week_idx ON public.metrics_insights USING btree (week_start DESC, sort) |
| notification_campaigns | idx_notification_campaigns_status_scheduled | CREATE INDEX idx_notification_campaigns_status_scheduled ON public.notification_campaigns USING btree (status, scheduled_at) |
| notification_campaigns | notification_campaigns_pkey | CREATE UNIQUE INDEX notification_campaigns_pkey ON public.notification_campaigns USING btree (id) |
| notification_preferences | notification_preferences_pkey | CREATE UNIQUE INDEX notification_preferences_pkey ON public.notification_preferences USING btree (user_id) |
| notification_sends | idx_notification_sends_category_created | CREATE INDEX idx_notification_sends_category_created ON public.notification_sends USING btree (category, created_at DESC) |
| notification_sends | idx_notification_sends_status_pending | CREATE INDEX idx_notification_sends_status_pending ON public.notification_sends USING btree (status) WHERE (status = ANY (ARRAY['queued'::text, 'failed'::text])) |
| notification_sends | idx_notification_sends_user_created | CREATE INDEX idx_notification_sends_user_created ON public.notification_sends USING btree (user_id, created_at DESC) |
| notification_sends | notification_sends_pkey | CREATE UNIQUE INDEX notification_sends_pkey ON public.notification_sends USING btree (id) |
| notification_templates | notification_templates_key_key | CREATE UNIQUE INDEX notification_templates_key_key ON public.notification_templates USING btree (key) |
| notification_templates | notification_templates_pkey | CREATE UNIQUE INDEX notification_templates_pkey ON public.notification_templates USING btree (id) |
| notifications | idx_notifications_user | CREATE INDEX idx_notifications_user ON public.notifications USING btree (user_id, read) |
| notifications | notifications_pkey | CREATE UNIQUE INDEX notifications_pkey ON public.notifications USING btree (id) |
| option_groups | option_groups_pkey | CREATE UNIQUE INDEX option_groups_pkey ON public.option_groups USING btree (id) |
| option_items | idx_option_items_group_sort | CREATE INDEX idx_option_items_group_sort ON public.option_items USING btree (group_id, sort_order, id) |
| option_items | option_items_group_id_sort | CREATE INDEX option_items_group_id_sort ON public.option_items USING btree (group_id, sort_order) |
| option_items | option_items_pkey | CREATE UNIQUE INDEX option_items_pkey ON public.option_items USING btree (id) |
| order_items | idx_order_items_order_id | CREATE INDEX idx_order_items_order_id ON public.order_items USING btree (order_id) |
| order_items | idx_order_items_product_id | CREATE INDEX idx_order_items_product_id ON public.order_items USING btree (product_id) |
| order_items | order_items_pkey | CREATE UNIQUE INDEX order_items_pkey ON public.order_items USING btree (id) |
| order_modifications | idx_order_modifications_order | CREATE INDEX idx_order_modifications_order ON public.order_modifications USING btree (order_id) |
| order_modifications | idx_order_modifications_status | CREATE INDEX idx_order_modifications_status ON public.order_modifications USING btree (status) WHERE (status = 'pending'::text) |
| order_modifications | order_modifications_pkey | CREATE UNIQUE INDEX order_modifications_pkey ON public.order_modifications USING btree (id) |
| orders | idx_orders_adisyo_order_id | CREATE INDEX idx_orders_adisyo_order_id ON public.orders USING btree (adisyo_order_id) WHERE (adisyo_order_id IS NOT NULL) |
| orders | idx_orders_adisyo_sync_failed | CREATE INDEX idx_orders_adisyo_sync_failed ON public.orders USING btree (adisyo_sync_status, adisyo_last_attempt_at) WHERE (adisyo_sync_status = ANY (ARRAY['failed'::text, 'retrying'::text])) |
| orders | idx_orders_coupon_id | CREATE INDEX idx_orders_coupon_id ON public.orders USING btree (coupon_id) WHERE (coupon_id IS NOT NULL) |
| orders | idx_orders_created_at | CREATE INDEX idx_orders_created_at ON public.orders USING btree (created_at DESC) |
| orders | idx_orders_customer_id | CREATE INDEX idx_orders_customer_id ON public.orders USING btree (customer_id) |
| orders | idx_orders_phone | CREATE INDEX idx_orders_phone ON public.orders USING btree (phone) |
| orders | idx_orders_source_branch | CREATE INDEX idx_orders_source_branch ON public.orders USING btree (source, branch_id) WHERE (source <> 'app'::text) |
| orders | orders_delivery_type_idx | CREATE INDEX orders_delivery_type_idx ON public.orders USING btree (delivery_type) |
| orders | orders_merchant_oid_unique_idx | CREATE UNIQUE INDEX orders_merchant_oid_unique_idx ON public.orders USING btree (merchant_oid) WHERE (merchant_oid IS NOT NULL) |
| orders | orders_payment_drop_stage_idx | CREATE INDEX orders_payment_drop_stage_idx ON public.orders USING btree (payment_drop_stage) WHERE (payment_drop_stage IS NOT NULL) |
| orders | orders_payment_review_pending_idx | CREATE INDEX orders_payment_review_pending_idx ON public.orders USING btree (payment_review_pending) WHERE payment_review_pending |
| orders | orders_pkey | CREATE UNIQUE INDEX orders_pkey ON public.orders USING btree (id) |
| orders | orders_scheduled_date_idx | CREATE INDEX orders_scheduled_date_idx ON public.orders USING btree (scheduled_date) |
| orders | uq_orders_external | CREATE UNIQUE INDEX uq_orders_external ON public.orders USING btree (source, external_order_id) WHERE (external_order_id IS NOT NULL) |
| orders | uq_orders_external_full | CREATE UNIQUE INDEX uq_orders_external_full ON public.orders USING btree (source, external_order_id) |
| popups | popups_pkey | CREATE UNIQUE INDEX popups_pkey ON public.popups USING btree (id) |
| product_option_groups | idx_product_option_groups_product_sort | CREATE INDEX idx_product_option_groups_product_sort ON public.product_option_groups USING btree (product_id, sort_order, id) |
| product_option_groups | product_option_groups_pkey | CREATE UNIQUE INDEX product_option_groups_pkey ON public.product_option_groups USING btree (id) |
| product_option_groups | product_option_groups_product_id_group_id_key | CREATE UNIQUE INDEX product_option_groups_product_id_group_id_key ON public.product_option_groups USING btree (product_id, group_id) |
| product_option_groups | product_option_groups_unique_product_group | CREATE UNIQUE INDEX product_option_groups_unique_product_group ON public.product_option_groups USING btree (product_id, group_id) |
| product_option_links | idx_links_product | CREATE INDEX idx_links_product ON public.product_option_links USING btree (product_id) WHERE (is_active = true) |
| product_option_links | idx_links_template | CREATE INDEX idx_links_template ON public.product_option_links USING btree (template_id) WHERE (is_active = true) |
| product_option_links | product_option_links_pkey | CREATE UNIQUE INDEX product_option_links_pkey ON public.product_option_links USING btree (id) |
| product_option_links | unique_product_template | CREATE UNIQUE INDEX unique_product_template ON public.product_option_links USING btree (product_id, template_id) |
| product_option_template_values | idx_template_values_linked_product | CREATE INDEX idx_template_values_linked_product ON public.product_option_template_values USING btree (linked_product_id) WHERE (linked_product_id IS NOT NULL) |
| product_option_template_values | idx_template_values_tpl | CREATE INDEX idx_template_values_tpl ON public.product_option_template_values USING btree (template_id) WHERE (is_active = true) |
| product_option_template_values | product_option_template_values_pkey | CREATE UNIQUE INDEX product_option_template_values_pkey ON public.product_option_template_values USING btree (id) |
| product_option_template_values | unique_template_value_name | CREATE UNIQUE INDEX unique_template_value_name ON public.product_option_template_values USING btree (template_id, name) |
| product_option_templates | idx_templates_active | CREATE INDEX idx_templates_active ON public.product_option_templates USING btree (is_active) WHERE (is_active = true) |
| product_option_templates | product_option_templates_name_key | CREATE UNIQUE INDEX product_option_templates_name_key ON public.product_option_templates USING btree (name) |
| product_option_templates | product_option_templates_pkey | CREATE UNIQUE INDEX product_option_templates_pkey ON public.product_option_templates USING btree (id) |
| products | idx_products_adisyo_unit_id | CREATE INDEX idx_products_adisyo_unit_id ON public.products USING btree (adisyo_product_unit_id) WHERE (adisyo_product_unit_id IS NOT NULL) |
| products | idx_products_crosssell | CREATE INDEX idx_products_crosssell ON public.products USING btree (is_crosssell) WHERE (is_crosssell = true) |
| products | products_allow_immediate_idx | CREATE INDEX products_allow_immediate_idx ON public.products USING btree (allow_immediate) |
| products | products_allow_scheduled_idx | CREATE INDEX products_allow_scheduled_idx ON public.products USING btree (allow_scheduled) |
| products | products_pkey | CREATE UNIQUE INDEX products_pkey ON public.products USING btree (id) |
| profiles | profiles_payment_customer_key_uniq | CREATE UNIQUE INDEX profiles_payment_customer_key_uniq ON public.profiles USING btree (payment_customer_key) WHERE (payment_customer_key IS NOT NULL) |
| profiles | profiles_pkey | CREATE UNIQUE INDEX profiles_pkey ON public.profiles USING btree (id) |
| push_notifications | push_notifications_pkey | CREATE UNIQUE INDEX push_notifications_pkey ON public.push_notifications USING btree (id) |
| push_tokens | idx_push_tokens_active_last_used | CREATE INDEX idx_push_tokens_active_last_used ON public.push_tokens USING btree (is_active, last_used_at) |
| push_tokens | idx_push_tokens_user_active | CREATE INDEX idx_push_tokens_user_active ON public.push_tokens USING btree (user_id) WHERE (is_active = true) |
| push_tokens | push_tokens_pkey | CREATE UNIQUE INDEX push_tokens_pkey ON public.push_tokens USING btree (id) |
| push_tokens | push_tokens_user_id_expo_push_token_key | CREATE UNIQUE INDEX push_tokens_user_id_expo_push_token_key ON public.push_tokens USING btree (user_id, expo_push_token) |
| refunds | refunds_pkey | CREATE UNIQUE INDEX refunds_pkey ON public.refunds USING btree (id) |
| review_item_feedback | review_item_feedback_order_id_user_id_product_id_key | CREATE UNIQUE INDEX review_item_feedback_order_id_user_id_product_id_key ON public.review_item_feedback USING btree (order_id, user_id, product_id) |
| review_item_feedback | review_item_feedback_order_idx | CREATE INDEX review_item_feedback_order_idx ON public.review_item_feedback USING btree (order_id) |
| review_item_feedback | review_item_feedback_pkey | CREATE UNIQUE INDEX review_item_feedback_pkey ON public.review_item_feedback USING btree (id) |
| review_item_feedback | review_item_feedback_product_idx | CREATE INDEX review_item_feedback_product_idx ON public.review_item_feedback USING btree (product_id, liked) |
| reviews | idx_reviews_is_approved | CREATE INDEX idx_reviews_is_approved ON public.reviews USING btree (is_approved) |
| reviews | idx_reviews_order_id | CREATE INDEX idx_reviews_order_id ON public.reviews USING btree (order_id) |
| reviews | idx_reviews_user_created | CREATE INDEX idx_reviews_user_created ON public.reviews USING btree (user_id, created_at DESC) |
| reviews | idx_reviews_user_id | CREATE INDEX idx_reviews_user_id ON public.reviews USING btree (user_id) |
| reviews | reviews_order_id_user_id_key | CREATE UNIQUE INDEX reviews_order_id_user_id_key ON public.reviews USING btree (order_id, user_id) |
| reviews | reviews_pkey | CREATE UNIQUE INDEX reviews_pkey ON public.reviews USING btree (id) |
| settings | settings_pkey | CREATE UNIQUE INDEX settings_pkey ON public.settings USING btree (id) |
| subscription_plans | subscription_plans_order_oid_key | CREATE UNIQUE INDEX subscription_plans_order_oid_key ON public.subscription_plans USING btree (order_oid) |
| subscription_plans | subscription_plans_pkey | CREATE UNIQUE INDEX subscription_plans_pkey ON public.subscription_plans USING btree (id) |
| support_tickets | support_tickets_pkey | CREATE UNIQUE INDEX support_tickets_pkey ON public.support_tickets USING btree (id) |
| sweep_locks | sweep_locks_pkey | CREATE UNIQUE INDEX sweep_locks_pkey ON public.sweep_locks USING btree (name) |
| user_apple_tokens | user_apple_tokens_pkey | CREATE UNIQUE INDEX user_apple_tokens_pkey ON public.user_apple_tokens USING btree (user_id) |
| user_card_secrets | user_card_secrets_pkey | CREATE UNIQUE INDEX user_card_secrets_pkey ON public.user_card_secrets USING btree (card_id) |
| user_cards | user_cards_one_default_per_user | CREATE UNIQUE INDEX user_cards_one_default_per_user ON public.user_cards USING btree (user_id) WHERE is_default |
| user_cards | user_cards_pkey | CREATE UNIQUE INDEX user_cards_pkey ON public.user_cards USING btree (id) |
| user_cards | user_cards_user_id_idx | CREATE INDEX user_cards_user_id_idx ON public.user_cards USING btree (user_id) |
| user_credits | user_credits_pkey | CREATE UNIQUE INDEX user_credits_pkey ON public.user_credits USING btree (id) |
| user_credits | user_credits_user_id_key | CREATE UNIQUE INDEX user_credits_user_id_key ON public.user_credits USING btree (user_id) |
| user_known_devices | user_known_devices_pkey | CREATE UNIQUE INDEX user_known_devices_pkey ON public.user_known_devices USING btree (user_id, device_id) |
| user_nutrition_profiles | user_nutrition_profiles_pkey | CREATE UNIQUE INDEX user_nutrition_profiles_pkey ON public.user_nutrition_profiles USING btree (id) |
| user_nutrition_profiles | user_nutrition_profiles_user_id_key | CREATE UNIQUE INDEX user_nutrition_profiles_user_id_key ON public.user_nutrition_profiles USING btree (user_id) |

## (d) RLS policies

| table | policy | cmd | roles | qual | with_check |
|---|---|---|---|---|---|
| addresses | addresses_admin_select | SELECT | {authenticated} | (EXISTS ( SELECT 1 FROM admin_allowlist a WHERE (a.user_id = auth.uid()))) |  |
| addresses | addresses_delete_own | DELETE | {authenticated} | (user_id = auth.uid()) |  |
| addresses | addresses_insert_own | INSERT | {authenticated} |  | (user_id = auth.uid()) |
| addresses | addresses_select_own | SELECT | {authenticated} | (user_id = auth.uid()) |  |
| addresses | addresses_update_own | UPDATE | {authenticated} | (user_id = auth.uid()) | (user_id = auth.uid()) |
| addresses | branch_users_see_order_addresses | SELECT | {authenticated} | (EXISTS ( SELECT 1 FROM orders o WHERE ((o.address_id = addresses.id) AND (o.branch_id IN ( SELECT branch_users.branch_id FROM branch_users WHERE (branch_users.user_id = auth.uid())))))) |  |
| admin_allowlist | admin_allowlist_self_read | SELECT | {authenticated} | (user_id = auth.uid()) |  |
| analytics_events | insert own events | INSERT | {public} |  | ((user_id IS NULL) OR (user_id = auth.uid())) |
| announcement_strip | announcement_strip_admin_write | ALL | {public} | (EXISTS ( SELECT 1 FROM admin_allowlist a WHERE (a.user_id = auth.uid()))) | (EXISTS ( SELECT 1 FROM admin_allowlist a WHERE (a.user_id = auth.uid()))) |
| announcement_strip | read active announcement strip | SELECT | {public} | (is_active AND ((starts_at IS NULL) OR (starts_at <= now())) AND ((ends_at IS NULL) OR (ends_at > now()))) |  |
| app_banners | app_banners_admin_write | ALL | {public} | (EXISTS ( SELECT 1 FROM admin_allowlist a WHERE (a.user_id = auth.uid()))) | (EXISTS ( SELECT 1 FROM admin_allowlist a WHERE (a.user_id = auth.uid()))) |
| app_banners | read active banners | SELECT | {public} | (is_active AND ((starts_at IS NULL) OR (starts_at <= now())) AND ((ends_at IS NULL) OR (ends_at > now()))) |  |
| banner_cells | banner_cells_delete_admin | DELETE | {public} | (EXISTS ( SELECT 1 FROM admin_allowlist a WHERE (a.user_id = auth.uid()))) |  |
| banner_cells | banner_cells_insert_admin | INSERT | {public} |  | (EXISTS ( SELECT 1 FROM admin_allowlist a WHERE (a.user_id = auth.uid()))) |
| banner_cells | banner_cells_select_public | SELECT | {anon,authenticated} | true |  |
| banner_cells | banner_cells_update_admin | UPDATE | {public} | (EXISTS ( SELECT 1 FROM admin_allowlist a WHERE (a.user_id = auth.uid()))) | (EXISTS ( SELECT 1 FROM admin_allowlist a WHERE (a.user_id = auth.uid()))) |
| banner_rows | banner_rows_delete_admin | DELETE | {public} | (EXISTS ( SELECT 1 FROM admin_allowlist a WHERE (a.user_id = auth.uid()))) |  |
| banner_rows | banner_rows_insert_admin | INSERT | {public} |  | (EXISTS ( SELECT 1 FROM admin_allowlist a WHERE (a.user_id = auth.uid()))) |
| banner_rows | banner_rows_select_public | SELECT | {anon,authenticated} | true |  |
| banner_rows | banner_rows_update_admin | UPDATE | {public} | (EXISTS ( SELECT 1 FROM admin_allowlist a WHERE (a.user_id = auth.uid()))) | (EXISTS ( SELECT 1 FROM admin_allowlist a WHERE (a.user_id = auth.uid()))) |
| banners | banners_public_all | ALL | {public} | is_admin() | is_admin() |
| banners | banners_public_read | SELECT | {public} | true |  |
| body_measurements | body_measurements_own | ALL | {public} | (auth.uid() = user_id) | (auth.uid() = user_id) |
| branch_assignment_log | branch_assignment_log_insert_admin | INSERT | {public} |  | (EXISTS ( SELECT 1 FROM admin_allowlist a WHERE (a.user_id = auth.uid()))) |
| branch_assignment_log | branch_assignment_log_select_admin | SELECT | {public} | (EXISTS ( SELECT 1 FROM admin_allowlist a WHERE (a.user_id = auth.uid()))) |  |
| branch_product_adisyo | bpa_select_admin | SELECT | {public} | (EXISTS ( SELECT 1 FROM admin_allowlist a WHERE (a.user_id = auth.uid()))) |  |
| branch_product_stock | bps_delete_branch_or_admin | DELETE | {public} | ((EXISTS ( SELECT 1 FROM branch_users bu WHERE ((bu.user_id = auth.uid()) AND (bu.branch_id = branch_product_stock.branch_id)))) OR (EXISTS ( SELECT 1 FROM admin_allowlist a WHERE (a.user_id = auth.uid())))) |  |
| branch_product_stock | bps_insert_branch_or_admin | INSERT | {public} |  | ((EXISTS ( SELECT 1 FROM branch_users bu WHERE ((bu.user_id = auth.uid()) AND (bu.branch_id = branch_product_stock.branch_id)))) OR (EXISTS ( SELECT 1 FROM admin_allowlist a WHERE (a.user_id = auth.uid())))) |
| branch_product_stock | bps_select_all | SELECT | {public} | true |  |
| branch_product_stock | bps_update_branch_or_admin | UPDATE | {public} | ((EXISTS ( SELECT 1 FROM branch_users bu WHERE ((bu.user_id = auth.uid()) AND (bu.branch_id = branch_product_stock.branch_id)))) OR (EXISTS ( SELECT 1 FROM admin_allowlist a WHERE (a.user_id = auth.uid())))) | ((EXISTS ( SELECT 1 FROM branch_users bu WHERE ((bu.user_id = auth.uid()) AND (bu.branch_id = branch_product_stock.branch_id)))) OR (EXISTS ( SELECT 1 FROM admin_allowlist a WHERE (a.user_id = auth.uid())))) |
| branch_service_areas | branch_service_areas_delete_admin | DELETE | {public} | (EXISTS ( SELECT 1 FROM admin_allowlist a WHERE (a.user_id = auth.uid()))) |  |
| branch_service_areas | branch_service_areas_insert_admin | INSERT | {public} |  | (EXISTS ( SELECT 1 FROM admin_allowlist a WHERE (a.user_id = auth.uid()))) |
| branch_service_areas | branch_service_areas_select_admin | SELECT | {public} | (EXISTS ( SELECT 1 FROM admin_allowlist a WHERE (a.user_id = auth.uid()))) |  |
| branch_service_areas | branch_service_areas_update_admin | UPDATE | {public} | (EXISTS ( SELECT 1 FROM admin_allowlist a WHERE (a.user_id = auth.uid()))) |  |
| branch_users | branch_users_own | SELECT | {public} | (auth.uid() = user_id) |  |
| branches | branches_delete_admin | DELETE | {public} | (EXISTS ( SELECT 1 FROM admin_allowlist a WHERE (a.user_id = auth.uid()))) |  |
| branches | branches_insert_admin | INSERT | {public} |  | (EXISTS ( SELECT 1 FROM admin_allowlist a WHERE (a.user_id = auth.uid()))) |
| branches | branches_public_read | SELECT | {public} | true |  |
| branches | branches_update_admin | UPDATE | {public} | (EXISTS ( SELECT 1 FROM admin_allowlist a WHERE (a.user_id = auth.uid()))) |  |
| brands | brands_public_insert | INSERT | {public} |  | is_admin() |
| brands | brands_public_read | SELECT | {public} | true |  |
| brands | brands_public_write | UPDATE | {public} | is_admin() | is_admin() |
| campaign_targets | campaign_targets_admin_all | ALL | {authenticated} | (EXISTS ( SELECT 1 FROM admin_allowlist a WHERE (a.user_id = auth.uid()))) | (EXISTS ( SELECT 1 FROM admin_allowlist a WHERE (a.user_id = auth.uid()))) |
| campaign_uses | Users see their own campaign uses | SELECT | {authenticated} | (user_id = auth.uid()) |  |
| campaigns | campaigns_admin_write | ALL | {authenticated} | (EXISTS ( SELECT 1 FROM admin_allowlist a WHERE (a.user_id = auth.uid()))) | (EXISTS ( SELECT 1 FROM admin_allowlist a WHERE (a.user_id = auth.uid()))) |
| campaigns | public_read_campaigns | SELECT | {public} | (is_active AND (status = 'active'::text) AND ((start_date IS NULL) OR (start_date <= CURRENT_DATE)) AND ((end_date IS NULL) OR (end_date >= CURRENT_DATE)) AND (((NOT campaign_has_targets(id)) AND (user_id IS NULL) AND (user_email IS NULL)) OR (user_id = auth.uid()) OR ((user_email IS NOT NULL) AND (lower(user_email) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text)))) OR campaign_targets_me(id)) AND ((max_uses_per_user IS NULL) OR (auth.uid() IS NULL) OR (( SELECT count(*) AS count FROM campaign_uses cu WHERE ((cu.campaign_id = campaigns.id) AND (cu.user_id = auth.uid()))) < max_uses_per_user)) AND ((max_uses_total IS NULL) OR (( SELECT count(*) AS count FROM campaign_uses cu2 WHERE (cu2.campaign_id = campaigns.id)) < max_uses_total))) |  |
| card_verifications | card_verifications_select_admin | SELECT | {authenticated} | (EXISTS ( SELECT 1 FROM admin_allowlist a WHERE (a.user_id = auth.uid()))) |  |
| card_verifications | card_verifications_select_own | SELECT | {authenticated} | (user_id = auth.uid()) |  |
| categories | Categories are viewable by everyone | SELECT | {public} | true |  |
| categories | categories_delete_admin | DELETE | {authenticated} | (EXISTS ( SELECT 1 FROM admin_allowlist WHERE (admin_allowlist.user_id = auth.uid()))) |  |
| categories | categories_insert_admin | INSERT | {authenticated} |  | (EXISTS ( SELECT 1 FROM admin_allowlist WHERE (admin_allowlist.user_id = auth.uid()))) |
| categories | categories_update_admin | UPDATE | {authenticated} | (EXISTS ( SELECT 1 FROM admin_allowlist WHERE (admin_allowlist.user_id = auth.uid()))) |  |
| delivery_settings | admin_all_delivery_settings | ALL | {public} | (EXISTS ( SELECT 1 FROM admin_allowlist WHERE (admin_allowlist.user_id = auth.uid()))) |  |
| delivery_zones | delivery_zones_delete_admin_only | DELETE | {authenticated} | (EXISTS ( SELECT 1 FROM admin_allowlist a WHERE (a.user_id = auth.uid()))) |  |
| delivery_zones | delivery_zones_insert_admin_only | INSERT | {authenticated} |  | (EXISTS ( SELECT 1 FROM admin_allowlist a WHERE (a.user_id = auth.uid()))) |
| delivery_zones | delivery_zones_select_public | SELECT | {anon,authenticated} | true |  |
| delivery_zones | delivery_zones_update_admin_only | UPDATE | {authenticated} | (EXISTS ( SELECT 1 FROM admin_allowlist a WHERE (a.user_id = auth.uid()))) | (EXISTS ( SELECT 1 FROM admin_allowlist a WHERE (a.user_id = auth.uid()))) |
| feedback | Users insert own feedback | INSERT | {authenticated} |  | (user_id = auth.uid()) |
| feedback | Users select own feedback | SELECT | {authenticated} | (user_id = auth.uid()) |  |
| feedback | feedback_admin_read | SELECT | {authenticated} | is_admin() |  |
| feedback | feedback_delete_all | DELETE | {public} | is_admin() |  |
| feedback | feedback_update_all | UPDATE | {public} | is_admin() | is_admin() |
| legal_documents | legal_documents_public_read | SELECT | {public} | true |  |
| macro_transactions | Users insert own macro transactions | INSERT | {authenticated} |  | (user_id = auth.uid()) |
| macro_transactions | Users see own macro transactions | SELECT | {authenticated} | (user_id = auth.uid()) |  |
| macro_transactions | macro_transactions_update_all | UPDATE | {public} | true | true |
| marketplace_stores | ms_select_staff | SELECT | {public} | ((EXISTS ( SELECT 1 FROM admin_allowlist a WHERE (a.user_id = auth.uid()))) OR (EXISTS ( SELECT 1 FROM branch_users bu WHERE ((bu.user_id = auth.uid()) AND (bu.branch_id = marketplace_stores.branch_id))))) |  |
| meal_consumptions | users_delete_own_consumptions | DELETE | {public} | (auth.uid() = user_id) |  |
| meal_consumptions | users_insert_own_consumptions | INSERT | {public} |  | (auth.uid() = user_id) |
| meal_consumptions | users_select_own_consumptions | SELECT | {public} | (auth.uid() = user_id) |  |
| meal_consumptions | users_update_own_consumptions | UPDATE | {public} | (auth.uid() = user_id) | (auth.uid() = user_id) |
| meal_logs | meal_logs_own | ALL | {public} | (auth.uid() = user_id) | (auth.uid() = user_id) |
| metrics_actions | metrics_actions_admin_all | ALL | {authenticated} | is_admin() | is_admin() |
| metrics_insights | metrics_insights_admin_all | ALL | {authenticated} | is_admin() | is_admin() |
| notification_campaigns | notification_campaigns_admin_all | ALL | {authenticated} | (EXISTS ( SELECT 1 FROM admin_allowlist a WHERE (a.user_id = auth.uid()))) | (EXISTS ( SELECT 1 FROM admin_allowlist a WHERE (a.user_id = auth.uid()))) |
| notification_preferences | notification_preferences_admin_select | SELECT | {authenticated} | (EXISTS ( SELECT 1 FROM admin_allowlist a WHERE (a.user_id = auth.uid()))) |  |
| notification_preferences | notification_preferences_user_all | ALL | {authenticated} | (user_id = auth.uid()) | (user_id = auth.uid()) |
| notification_sends | notification_sends_admin_delete | DELETE | {authenticated} | (EXISTS ( SELECT 1 FROM admin_allowlist a WHERE (a.user_id = auth.uid()))) |  |
| notification_sends | notification_sends_admin_insert | INSERT | {authenticated} |  | (EXISTS ( SELECT 1 FROM admin_allowlist a WHERE (a.user_id = auth.uid()))) |
| notification_sends | notification_sends_admin_select | SELECT | {authenticated} | (EXISTS ( SELECT 1 FROM admin_allowlist a WHERE (a.user_id = auth.uid()))) |  |
| notification_sends | notification_sends_admin_update | UPDATE | {authenticated} | (EXISTS ( SELECT 1 FROM admin_allowlist a WHERE (a.user_id = auth.uid()))) | (EXISTS ( SELECT 1 FROM admin_allowlist a WHERE (a.user_id = auth.uid()))) |
| notification_sends | notification_sends_user_select | SELECT | {authenticated} | (user_id = auth.uid()) |  |
| notification_sends | notification_sends_user_update_opened | UPDATE | {authenticated} | (user_id = auth.uid()) | (user_id = auth.uid()) |
| notification_templates | notification_templates_admin_delete | DELETE | {authenticated} | (EXISTS ( SELECT 1 FROM admin_allowlist a WHERE (a.user_id = auth.uid()))) |  |
| notification_templates | notification_templates_admin_insert | INSERT | {authenticated} |  | (EXISTS ( SELECT 1 FROM admin_allowlist a WHERE (a.user_id = auth.uid()))) |
| notification_templates | notification_templates_admin_update | UPDATE | {authenticated} | (EXISTS ( SELECT 1 FROM admin_allowlist a WHERE (a.user_id = auth.uid()))) | (EXISTS ( SELECT 1 FROM admin_allowlist a WHERE (a.user_id = auth.uid()))) |
| notification_templates | notification_templates_select_authenticated | SELECT | {authenticated} | true |  |
| notifications | Authenticated insert notifications | INSERT | {authenticated} |  | is_admin() |
| notifications | Staff can insert notifications | INSERT | {authenticated} |  | is_admin() |
| notifications | Users can read own notifications | SELECT | {authenticated} | (auth.uid() = user_id) |  |
| option_groups | option_groups_delete_admin | DELETE | {authenticated} | (EXISTS ( SELECT 1 FROM admin_allowlist WHERE (admin_allowlist.user_id = auth.uid()))) |  |
| option_groups | option_groups_insert_admin | INSERT | {authenticated} |  | (EXISTS ( SELECT 1 FROM admin_allowlist WHERE (admin_allowlist.user_id = auth.uid()))) |
| option_groups | option_groups_select_public | SELECT | {public} | true |  |
| option_groups | option_groups_update_admin | UPDATE | {authenticated} | (EXISTS ( SELECT 1 FROM admin_allowlist WHERE (admin_allowlist.user_id = auth.uid()))) |  |
| option_items | option_items_delete_admin | DELETE | {authenticated} | (EXISTS ( SELECT 1 FROM admin_allowlist WHERE (admin_allowlist.user_id = auth.uid()))) |  |
| option_items | option_items_insert_admin | INSERT | {authenticated} |  | (EXISTS ( SELECT 1 FROM admin_allowlist WHERE (admin_allowlist.user_id = auth.uid()))) |
| option_items | option_items_select_public | SELECT | {public} | true |  |
| option_items | option_items_update_admin | UPDATE | {authenticated} | (EXISTS ( SELECT 1 FROM admin_allowlist WHERE (admin_allowlist.user_id = auth.uid()))) |  |
| order_items | order_items_insert_own | INSERT | {authenticated} |  | (EXISTS ( SELECT 1 FROM orders o WHERE ((o.id = order_items.order_id) AND (o.user_id = auth.uid())))) |
| order_items | order_items_select_own | SELECT | {authenticated} | (EXISTS ( SELECT 1 FROM orders o WHERE ((o.id = order_items.order_id) AND (o.user_id = auth.uid())))) |  |
| order_modifications | Authenticated can update modifications | UPDATE | {authenticated} | (is_admin() OR (EXISTS ( SELECT 1 FROM (orders o JOIN branch_users bu ON ((bu.branch_id = o.branch_id))) WHERE ((o.id = order_modifications.order_id) AND (bu.user_id = auth.uid()))))) | (is_admin() OR (EXISTS ( SELECT 1 FROM (orders o JOIN branch_users bu ON ((bu.branch_id = o.branch_id))) WHERE ((o.id = order_modifications.order_id) AND (bu.user_id = auth.uid()))))) |
| order_modifications | Authenticated can view all modifications | SELECT | {authenticated} | ((user_id = auth.uid()) OR is_admin() OR (EXISTS ( SELECT 1 FROM (orders o JOIN branch_users bu ON ((bu.branch_id = o.branch_id))) WHERE ((o.id = order_modifications.order_id) AND (bu.user_id = auth.uid()))))) |  |
| order_modifications | Service role full access | ALL | {service_role} | true | true |
| order_modifications | Staff can update modifications | UPDATE | {authenticated} | (is_admin() OR (EXISTS ( SELECT 1 FROM (orders o JOIN branch_users bu ON ((bu.branch_id = o.branch_id))) WHERE ((o.id = order_modifications.order_id) AND (bu.user_id = auth.uid()))))) | (is_admin() OR (EXISTS ( SELECT 1 FROM (orders o JOIN branch_users bu ON ((bu.branch_id = o.branch_id))) WHERE ((o.id = order_modifications.order_id) AND (bu.user_id = auth.uid()))))) |
| order_modifications | Staff can view all modifications | SELECT | {authenticated} | ((user_id = auth.uid()) OR is_admin() OR (EXISTS ( SELECT 1 FROM (orders o JOIN branch_users bu ON ((bu.branch_id = o.branch_id))) WHERE ((o.id = order_modifications.order_id) AND (bu.user_id = auth.uid()))))) |  |
| order_modifications | Users can create own modifications | INSERT | {authenticated} |  | (auth.uid() = user_id) |
| orders | orders_insert_own | INSERT | {authenticated} |  | (user_id = auth.uid()) |
| orders | orders_select_admin_branch | SELECT | {public} | ((auth.uid() = user_id) OR (EXISTS ( SELECT 1 FROM admin_allowlist WHERE (admin_allowlist.user_id = auth.uid()))) OR (EXISTS ( SELECT 1 FROM branch_users WHERE ((branch_users.user_id = auth.uid()) AND (branch_users.branch_id = orders.branch_id))))) |  |
| orders | orders_select_own | SELECT | {authenticated} | (user_id = auth.uid()) |  |
| orders | orders_update_admin_branch | UPDATE | {public} | ((auth.uid() = user_id) OR (EXISTS ( SELECT 1 FROM admin_allowlist WHERE (admin_allowlist.user_id = auth.uid()))) OR (EXISTS ( SELECT 1 FROM branch_users WHERE ((branch_users.user_id = auth.uid()) AND (branch_users.branch_id = orders.branch_id))))) |  |
| orders | orders_update_own | UPDATE | {authenticated} | (user_id = auth.uid()) | (user_id = auth.uid()) |
| popups | Admin full access popups | ALL | {public} | is_admin() | is_admin() |
| popups | Public read active popups | SELECT | {public} | (is_active = true) |  |
| product_option_groups | product_option_groups_delete_admin | DELETE | {public} | (EXISTS ( SELECT 1 FROM admin_allowlist a WHERE (a.user_id = auth.uid()))) |  |
| product_option_groups | product_option_groups_insert_admin | INSERT | {public} |  | (EXISTS ( SELECT 1 FROM admin_allowlist a WHERE (a.user_id = auth.uid()))) |
| product_option_groups | product_option_groups_select_public | SELECT | {public} | true |  |
| product_option_groups | product_option_groups_update_admin | UPDATE | {public} | (EXISTS ( SELECT 1 FROM admin_allowlist a WHERE (a.user_id = auth.uid()))) | (EXISTS ( SELECT 1 FROM admin_allowlist a WHERE (a.user_id = auth.uid()))) |
| product_option_links | Anyone authenticated can delete links | DELETE | {authenticated} | is_admin() |  |
| product_option_links | Anyone authenticated can update links | UPDATE | {authenticated} | is_admin() | is_admin() |
| product_option_links | Anyone can read active links | SELECT | {anon,authenticated} | (is_active = true) |  |
| product_option_links | Authenticated can insert links | INSERT | {authenticated} |  | is_admin() |
| product_option_template_values | Anyone can read active template values | SELECT | {anon,authenticated} | (is_active = true) |  |
| product_option_template_values | Authenticated can delete template values | DELETE | {authenticated} | is_admin() |  |
| product_option_template_values | Authenticated can insert template values | INSERT | {authenticated} |  | is_admin() |
| product_option_template_values | Authenticated can update template values | UPDATE | {authenticated} | is_admin() | is_admin() |
| product_option_templates | Anyone can read active templates | SELECT | {anon,authenticated} | (is_active = true) |  |
| product_option_templates | Authenticated can delete templates | DELETE | {authenticated} | is_admin() |  |
| product_option_templates | Authenticated can insert templates | INSERT | {authenticated} |  | is_admin() |
| product_option_templates | Authenticated can update templates | UPDATE | {authenticated} | is_admin() | is_admin() |
| products | Products are deletable by authenticated users | DELETE | {authenticated} | is_admin() |  |
| products | Products are editable by authenticated users | UPDATE | {authenticated} | is_admin() | is_admin() |
| products | Products are insertable by authenticated users | INSERT | {authenticated} |  | is_admin() |
| products | Products are viewable by everyone | SELECT | {public} | true |  |
| profiles | profiles_select_own_or_admin | SELECT | {public} | ((id = auth.uid()) OR (EXISTS ( SELECT 1 FROM admin_allowlist a WHERE (a.user_id = auth.uid()))) OR (EXISTS ( SELECT 1 FROM (branch_users bu JOIN orders o ON ((o.branch_id = bu.branch_id))) WHERE ((bu.user_id = auth.uid()) AND (o.user_id = profiles.id))))) |  |
| profiles | profiles_update_admin | UPDATE | {public} | (EXISTS ( SELECT 1 FROM admin_allowlist a WHERE (a.user_id = auth.uid()))) | (EXISTS ( SELECT 1 FROM admin_allowlist a WHERE (a.user_id = auth.uid()))) |
| profiles | profiles_update_own | UPDATE | {public} | (id = auth.uid()) | (id = auth.uid()) |
| push_tokens | push_tokens_admin_select | SELECT | {authenticated} | (EXISTS ( SELECT 1 FROM admin_allowlist a WHERE (a.user_id = auth.uid()))) |  |
| push_tokens | push_tokens_user_all | ALL | {authenticated} | (user_id = auth.uid()) | (user_id = auth.uid()) |
| review_item_feedback | review_item_feedback_admin_read | SELECT | {authenticated} | is_admin() |  |
| review_item_feedback | review_item_feedback_insert_own | INSERT | {public} |  | (auth.uid() = user_id) |
| review_item_feedback | review_item_feedback_select_own | SELECT | {public} | (auth.uid() = user_id) |  |
| reviews | reviews_admin_read | SELECT | {authenticated} | is_admin() |  |
| reviews | reviews_admin_update | UPDATE | {authenticated} | is_admin() | is_admin() |
| reviews | reviews_delete_own | DELETE | {authenticated} | (auth.uid() = user_id) |  |
| reviews | reviews_insert_own | INSERT | {authenticated} |  | (auth.uid() = user_id) |
| reviews | reviews_read_approved_or_owner | SELECT | {anon,authenticated} | ((is_approved = true) OR (auth.uid() = user_id)) |  |
| reviews | reviews_update_own | UPDATE | {authenticated} | (auth.uid() = user_id) | (auth.uid() = user_id) |
| settings | settings_admin_write | ALL | {public} | (EXISTS ( SELECT 1 FROM admin_allowlist WHERE (admin_allowlist.email = auth.email()))) |  |
| settings | settings_public_read | SELECT | {public} | true |  |
| settings | settings_read_all | SELECT | {anon,authenticated} | true |  |
| settings | settings_update_authenticated | UPDATE | {authenticated} | is_admin() | is_admin() |
| settings | settings_write_authenticated | INSERT | {authenticated} |  | is_admin() |
| subscription_plans | sp_insert_own | INSERT | {authenticated} |  | (user_id = auth.uid()) |
| subscription_plans | sp_select_own | SELECT | {authenticated} | (user_id = auth.uid()) |  |
| support_tickets | tickets_admin_read | SELECT | {authenticated} | is_admin() |  |
| support_tickets | tickets_insert_own | INSERT | {authenticated} |  | (user_id = auth.uid()) |
| support_tickets | tickets_select_own | SELECT | {authenticated} | (user_id = auth.uid()) |  |
| support_tickets | tickets_update_all | UPDATE | {authenticated} | is_admin() | is_admin() |
| support_tickets | users can insert own tickets | INSERT | {public} |  | (auth.uid() = user_id) |
| support_tickets | users can select own tickets | SELECT | {public} | (auth.uid() = user_id) |  |
| user_cards | cards_select_own | SELECT | {authenticated} | (user_id = auth.uid()) |  |
| user_credits | uc_insert_own | INSERT | {authenticated} |  | (user_id = auth.uid()) |
| user_credits | uc_select_own | SELECT | {authenticated} | (user_id = auth.uid()) |  |
| user_credits | uc_update_own | UPDATE | {authenticated} | (user_id = auth.uid()) | (user_id = auth.uid()) |
| user_nutrition_profiles | nutrition_admin_select | SELECT | {authenticated} | (EXISTS ( SELECT 1 FROM admin_allowlist a WHERE (a.user_id = auth.uid()))) |  |
| user_nutrition_profiles | nutrition_delete_own | DELETE | {authenticated} | (user_id = auth.uid()) |  |
| user_nutrition_profiles | nutrition_insert_own | INSERT | {authenticated} |  | (user_id = auth.uid()) |
| user_nutrition_profiles | nutrition_select_own | SELECT | {authenticated} | (user_id = auth.uid()) |  |
| user_nutrition_profiles | nutrition_update_own | UPDATE | {authenticated} | (user_id = auth.uid()) | (user_id = auth.uid()) |

## (e) RLS enabled + estimated rows per table

Note: `est_rows = -1` means the table has never been ANALYZEd (planner has no stats) — it does NOT mean empty; treat as 'unknown/small'.

| table | rls_enabled | est_rows |
|---|---|---|
| addresses | True | 419 |
| adisyo_api_log | True | 859 |
| adisyo_webhook_events | True | 9356 |
| admin_allowlist | True | -1 |
| analytics_events | True | 7796 |
| announcement_strip | True | -1 |
| app_banners | True | -1 |
| banner_cells | True | -1 |
| banner_rows | True | -1 |
| banners | True | -1 |
| body_measurements | True | 116 |
| branch_assignment_log | True | 132 |
| branch_product_adisyo | True | 65 |
| branch_product_stock | True | -1 |
| branch_service_areas | True | -1 |
| branch_users | True | -1 |
| branches | True | 1 |
| brands | True | -1 |
| campaign_targets | True | 42 |
| campaign_uses | True | 69 |
| campaigns | True | 7 |
| card_verifications | True | 9 |
| categories | True | 11 |
| deleted_account_fingerprints | True | -1 |
| delivery_settings | True | 25 |
| delivery_zones | True | 1297 |
| failed_payments | True | -1 |
| feedback | True | 5 |
| legal_documents | True | -1 |
| macro_transactions | True | 53 |
| marketplace_stores | True | 6 |
| meal_consumptions | True | 71 |
| meal_logs | True | -1 |
| metrics_actions | True | -1 |
| metrics_insights | True | -1 |
| notification_campaigns | True | -1 |
| notification_preferences | True | 726 |
| notification_sends | True | 4035 |
| notification_templates | True | -1 |
| notifications | True | -1 |
| option_groups | True | 52 |
| option_items | True | 334 |
| order_items | True | 537 |
| order_modifications | True | -1 |
| orders | True | 474 |
| popups | True | -1 |
| product_option_groups | True | 391 |
| product_option_links | True | -1 |
| product_option_template_values | True | 9 |
| product_option_templates | True | -1 |
| products | True | 65 |
| profiles | True | 754 |
| push_notifications | True | -1 |
| push_tokens | True | 372 |
| refunds | True | -1 |
| review_item_feedback | True | -1 |
| reviews | True | 31 |
| settings | True | -1 |
| subscription_plans | True | -1 |
| support_tickets | True | -1 |
| sweep_locks | True | 1 |
| user_apple_tokens | True | 48 |
| user_card_secrets | True | -1 |
| user_cards | True | -1 |
| user_credits | True | -1 |
| user_known_devices | True | -1 |
| user_nutrition_profiles | True | 351 |

---

## (f) Orphan analysis — code references

Method: ripgrep `-i -F` (case-insensitive, fixed-string) of each table name across `src/`, `admin-panel/` (checked-out copy at `~/Desktop/kcal-mobile/admin-panel`), `branch-panel/`, `landing-page/` (= app code) and separately `supabase/` (migrations + edge functions). Counts are total matching lines per group.

| table | src | admin | branch | land | APP total | supabase | class |
|---|---|---|---|---|---|---|---|
| addresses | 145 | 31 | 3 | 0 | 179 | 29 | used |
| adisyo_api_log | 0 | 0 | 0 | 0 | 0 | 10 | backend-only |
| adisyo_webhook_events | 0 | 0 | 0 | 0 | 0 | 11 | backend-only |
| admin_allowlist | 7 | 57 | 2 | 0 | 66 | 79 | used |
| analytics_events | 4 | 1 | 0 | 0 | 5 | 34 | used |
| announcement_strip | 3 | 0 | 0 | 0 | 3 | 6 | used |
| app_banners | 4 | 7 | 0 | 0 | 11 | 9 | used |
| banner_cells | 3 | 39 | 0 | 0 | 42 | 0 | used |
| banner_rows | 5 | 43 | 0 | 0 | 48 | 0 | used |
| banners | 28 | 100 | 0 | 0 | 128 | 16 | used |
| body_measurements | 3 | 0 | 0 | 0 | 3 | 0 | used |
| branch_assignment_log | 0 | 2 | 0 | 0 | 2 | 33 | used |
| branch_product_adisyo | 0 | 0 | 0 | 0 | 0 | 18 | backend-only |
| branch_product_stock | 1 | 0 | 3 | 0 | 4 | 17 | used |
| branch_service_areas | 0 | 6 | 0 | 0 | 6 | 41 | used |
| branch_users | 0 | 0 | 15 | 0 | 15 | 28 | used |
| branches | 58 | 42 | 8 | 0 | 108 | 56 | used |
| brands | 5 | 23 | 0 | 0 | 28 | 6 | used |
| campaign_targets | 0 | 6 | 0 | 0 | 6 | 9 | used |
| campaign_uses | 0 | 1 | 0 | 0 | 1 | 23 | used |
| campaigns | 14 | 212 | 0 | 0 | 226 | 49 | used |
| card_verifications | 1 | 0 | 0 | 0 | 1 | 51 | used |
| categories | 60 | 78 | 0 | 0 | 138 | 54 | used |
| deleted_account_fingerprints | 0 | 0 | 0 | 0 | 0 | 13 | backend-only |
| delivery_settings | 3 | 16 | 0 | 0 | 19 | 0 | used |
| delivery_zones | 24 | 66 | 0 | 0 | 90 | 16 | used |
| failed_payments | 1 | 3 | 0 | 0 | 4 | 29 | used |
| feedback | 94 | 59 | 0 | 0 | 153 | 66 | used |
| legal_documents | 0 | 0 | 0 | 0 | 0 | 0 | TRUE ORPHAN |
| macro_transactions | 2 | 4 | 0 | 0 | 6 | 32 | used |
| marketplace_stores | 0 | 0 | 0 | 0 | 0 | 19 | backend-only |
| meal_consumptions | 14 | 0 | 0 | 0 | 14 | 4 | used |
| meal_logs | 0 | 3 | 0 | 0 | 3 | 5 | used |
| metrics_actions | 0 | 0 | 0 | 0 | 0 | 18 | backend-only |
| metrics_insights | 0 | 0 | 0 | 0 | 0 | 11 | backend-only |
| notification_campaigns | 0 | 62 | 0 | 0 | 62 | 8 | used |
| notification_preferences | 3 | 21 | 0 | 0 | 24 | 2 | used |
| notification_sends | 1 | 42 | 0 | 0 | 43 | 9 | used |
| notification_templates | 0 | 32 | 0 | 0 | 32 | 3 | used |
| notifications | 25 | 76 | 2 | 0 | 103 | 7 | used |
| option_groups | 2 | 172 | 0 | 0 | 174 | 54 | used |
| option_items | 8 | 79 | 0 | 0 | 87 | 56 | used |
| order_financials | 1 | 0 | 0 | 0 | 1 | 4 | used |
| order_items | 28 | 2 | 0 | 0 | 30 | 9 | used |
| order_modifications | 3 | 26 | 5 | 0 | 34 | 12 | used |
| orders | 179 | 410 | 120 | 0 | 709 | 299 | used |
| popups | 16 | 40 | 0 | 0 | 56 | 3 | used |
| product_option_groups | 1 | 95 | 0 | 0 | 96 | 44 | used |
| product_option_links | 1 | 11 | 0 | 0 | 12 | 3 | used |
| product_option_template_values | 1 | 9 | 0 | 0 | 10 | 8 | used |
| product_option_templates | 1 | 6 | 0 | 0 | 7 | 3 | used |
| products | 134 | 333 | 10 | 0 | 477 | 177 | used |
| profiles | 48 | 40 | 3 | 0 | 91 | 119 | used |
| push_notifications | 0 | 5 | 0 | 0 | 5 | 1 | used |
| push_tokens | 3 | 24 | 0 | 0 | 27 | 6 | used |
| refunds | 25 | 6 | 0 | 0 | 31 | 35 | used |
| review_item_feedback | 1 | 0 | 0 | 0 | 1 | 40 | used |
| reviews | 24 | 126 | 0 | 0 | 150 | 39 | used |
| settings | 145 | 122 | 0 | 0 | 267 | 61 | used |
| subscription_plans | 1 | 0 | 0 | 0 | 1 | 3 | used |
| support_tickets | 2 | 5 | 0 | 0 | 7 | 17 | used |
| sweep_locks | 0 | 0 | 0 | 0 | 0 | 6 | backend-only |
| user_apple_tokens | 0 | 0 | 0 | 0 | 0 | 8 | backend-only |
| user_card_secrets | 0 | 0 | 0 | 0 | 0 | 24 | backend-only |
| user_cards | 2 | 19 | 0 | 0 | 21 | 54 | used |
| user_credits | 0 | 0 | 0 | 0 | 0 | 0 | TRUE ORPHAN |
| user_known_devices | 1 | 0 | 0 | 0 | 1 | 2 | used |
| user_nutrition_profiles | 5 | 1 | 0 | 0 | 6 | 5 | used |

### TRUE ORPHANS (2) — zero refs in app AND supabase
- **legal_documents** — app 0 / supabase 0
- **user_credits** — app 0 / supabase 0

### BACKEND-ONLY (10) — refs only in supabase/, not in app code
- **adisyo_api_log** — app 0 / supabase 10
- **adisyo_webhook_events** — app 0 / supabase 11
- **branch_product_adisyo** — app 0 / supabase 18
- **deleted_account_fingerprints** — app 0 / supabase 13
- **marketplace_stores** — app 0 / supabase 19
- **metrics_actions** — app 0 / supabase 18
- **metrics_insights** — app 0 / supabase 11
- **sweep_locks** — app 0 / supabase 6
- **user_apple_tokens** — app 0 / supabase 8
- **user_card_secrets** — app 0 / supabase 24
