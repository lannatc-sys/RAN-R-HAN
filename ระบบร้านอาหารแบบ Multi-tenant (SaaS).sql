shops        (id, slug, name, logo, promptpay_id, promptpay_name,
              plan, status, expires_at, service_charge, vat_mode,
              signup_source) -- friend | facebook | sales | other
users        (id, shop_id, role) -- superadmin | owner | staff
categories   (id, shop_id, name, sort_order)
menu_items   (id, shop_id, category_id, name, description,
              price, image_url, is_available, sort_order)
options      (id, menu_item_id, name, price_delta) -- เผ็ดน้อย/พิเศษ/ไข่ดาว
tables       (id, shop_id, table_no, qr_token, status)
orders       (id, shop_id, table_id, order_no, type,        -- dine_in | takeaway
              status, subtotal, total, note, customer_phone,
              pickup_at, created_at)
order_items  (id, order_id, menu_item_id, name_snapshot,
              price_snapshot, qty, options_json)
payments     (id, order_id, method, amount, ref,            -- promptpay | cash
              slip_url, verified_at, status)