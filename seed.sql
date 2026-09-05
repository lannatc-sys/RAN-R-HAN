-- ==============================================================================
-- Seed Data สำหรับระบบร้านอาหาร Multi-tenant (SaaS)
-- ตัวอย่าง: ร้าน "ครัวคุณยาย อาหารตามสั่ง & คาเฟ่" (1 ร้าน, 4 หมวดหมู่, 15 เมนู, 8 โต๊ะ)
-- ==============================================================================

-- ล้างข้อมูลตัวอย่างเดิมของร้านนี้ก่อน (ถ้ามี)
DO $$
DECLARE
    v_shop_id UUID := 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
    v_owner_id UUID := 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22';
    
    -- Category IDs
    v_cat_single_dish UUID := 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380001';
    v_cat_soup_curry  UUID := 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380002';
    v_cat_stir_fried  UUID := 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380003';
    v_cat_drinks_dessert UUID := 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380004';

    -- Menu Item IDs (15 items)
    v_m1 UUID := 'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380001';
    v_m2 UUID := 'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380002';
    v_m3 UUID := 'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380003';
    v_m4 UUID := 'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380004';
    v_m5 UUID := 'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380005';
    v_m6 UUID := 'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380006';
    v_m7 UUID := 'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380007';
    v_m8 UUID := 'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380008';
    v_m9 UUID := 'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380009';
    v_m10 UUID := 'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380010';
    v_m11 UUID := 'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380011';
    v_m12 UUID := 'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380012';
    v_m13 UUID := 'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380013';
    v_m14 UUID := 'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380014';
    v_m15 UUID := 'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380015';
BEGIN

    -- 1. สร้างข้อมูลร้าน (Shops)
    INSERT INTO shops (
        id, slug, name, logo, promptpay_id, promptpay_name,
        plan, status, expires_at, service_charge, vat_mode
    ) VALUES (
        v_shop_id,
        'krua-khun-yai',
        'ครัวคุณยาย อาหารตามสั่ง & คาเฟ่',
        'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=300&auto=format&fit=crop',
        '0891234567',
        'นางสมศรี มีโชค (ครัวคุณยาย)',
        'standard',
        'active',
        NOW() + INTERVAL '1 year',
        0.00,
        'none'
    )
    ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        slug = EXCLUDED.slug,
        promptpay_id = EXCLUDED.promptpay_id,
        promptpay_name = EXCLUDED.promptpay_name;

    -- 2. ข้อมูลเจ้าของร้าน (Users)
    INSERT INTO users (id, shop_id, role)
    VALUES (v_owner_id, v_shop_id, 'owner')
    ON CONFLICT (id) DO NOTHING;

    -- 3. หมวดหมู่อาหาร (Categories)
    INSERT INTO categories (id, shop_id, name, sort_order) VALUES
        (v_cat_single_dish, v_shop_id, 'อาหารจานเดียว', 1),
        (v_cat_stir_fried,  v_shop_id, 'กับข้าว & ผัดทอด', 2),
        (v_cat_soup_curry,  v_shop_id, 'ต้ม & แกง', 3),
        (v_cat_drinks_dessert, v_shop_id, 'เครื่องดื่ม & ของหวาน', 4)
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order;

    -- 4. เมนูอาหาร 15 เมนู (Menu Items)
    INSERT INTO menu_items (
        id, shop_id, category_id, name, description, price, image_url, is_available, sort_order
    ) VALUES
        -- หมวดที่ 1: อาหารจานเดียว (5 เมนู)
        (
            v_m1, v_shop_id, v_cat_single_dish,
            'ข้าวกะเพราหมูกรอบสูตรโบราณ',
            'หมูกรอบหนังกรอบเนื้อนุ่ม ผัดพริกแห้งและใบกะเพราป่ารสจัดจ้าน',
            75.00,
            'https://images.unsplash.com/photo-1596797038530-2c107229654b?w=600&auto=format&fit=crop',
            true, 1
        ),
        (
            v_m2, v_shop_id, v_cat_single_dish,
            'ข้าวผัดปูจัมโบ้',
            'ข้าวหอมมะลิเม็ดร่วนผัดไฟแรง ใส่เนื้อปูก้อนสดหวานหอมกลิ่นกระทะ',
            120.00,
            'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=600&auto=format&fit=crop',
            true, 2
        ),
        (
            v_m3, v_shop_id, v_cat_single_dish,
            'ผัดไทยกุ้งสดแม่น้ำ',
            'เส้นจันทน์เหนียวนุ่ม ผัดซอสมะขามสูตรลับ พร้อมกุ้งแม่น้ำตัวโต',
            110.00,
            'https://images.unsplash.com/photo-1559847844-5315695dadae?w=600&auto=format&fit=crop',
            true, 3
        ),
        (
            v_m4, v_shop_id, v_cat_single_dish,
            'ข้าวคลุกกะปิชาววัง',
            'ข้าวคลุกกะปิเกาะช้างหอมละมุน เสิร์ฟเคียงหมูหวาน ไข่ซอย กุ้งแห้ง มะม่วงเปรี้ยว',
            85.00,
            'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop',
            true, 4
        ),
        (
            v_m5, v_shop_id, v_cat_single_dish,
            'ราดหน้าหมี่กรอบทะเล',
            'บะหมี่ทอดกรอบสีทอง น้ำราดหน้าเหนียวข้นกลมกล่อม หมึก กุ้ง ปลา ชิ้นโต',
            95.00,
            'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=600&auto=format&fit=crop',
            true, 5
        ),

        -- หมวดที่ 2: กับข้าว & ผัดทอด (4 เมนู)
        (
            v_m6, v_shop_id, v_cat_stir_fried,
            'ไก่ผัดเม็ดมะม่วงหิมพานต์',
            'เนื้อสะโพกไก่กรอบผัดพริกเผา เม็ดมะม่วงมันกรอบ พริกแห้งและหอมใหญ่',
            130.00,
            'https://images.unsplash.com/photo-1525755662778-989d0524087e?w=600&auto=format&fit=crop',
            true, 6
        ),
        (
            v_m7, v_shop_id, v_cat_stir_fried,
            'ปลากะพงทอดน้ำปลา (ชิ้น)',
            'ปลากะพงสดทอดกรอบนอกนุ่มใน ราดน้ำปลาปรุงรสเค็มหวาน เสิร์ฟพร้อมยำมะม่วง',
            180.00,
            'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=600&auto=format&fit=crop',
            true, 7
        ),
        (
            v_m8, v_shop_id, v_cat_stir_fried,
            'ผัดผักบุ้งไฟแดงหมูกรอบ',
            'ผักบุ้งไทยยอดอ่อน ผัดเต้าเจี้ยว กระเทียม พริกขี้หนูสด และหมูกรอบ',
            90.00,
            'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&auto=format&fit=crop',
            true, 8
        ),
        (
            v_m9, v_shop_id, v_cat_stir_fried,
            'ไข่เจียวปูฟูกรอบ',
            'ไข่เจียวทอดฟูกรอบสีเหลืองทอง อัดแน่นด้วยเนื้อปูสด',
            140.00,
            'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=600&auto=format&fit=crop',
            true, 9
        ),

        -- หมวดที่ 3: ต้ม & แกง (3 เมนู)
        (
            v_m10, v_shop_id, v_cat_soup_curry,
            'ต้มยำกุ้งแม่น้ำน้ำข้น',
            'สมุนไพรสด ข่า ตะไคร้ ใบมะกรูด น้ำพริกเผาและนมข้นสด รสชาติจัดจ้านเข้มข้น',
            180.00,
            'https://images.unsplash.com/photo-1548943487-a2e4e43b4853?w=600&auto=format&fit=crop',
            true, 10
        ),
        (
            v_m11, v_shop_id, v_cat_soup_curry,
            'แกงเขียวหวานไก่ยอดมะพร้าวอ่อน',
            'พริกแกงเขียวหวานตำเอง กะทิคั้นสด ยอดมะพร้าวกรอบหวาน ไก่นุ่ม',
            120.00,
            'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=600&auto=format&fit=crop',
            true, 11
        ),
        (
            v_m12, v_shop_id, v_cat_soup_curry,
            'ต้มข่าไก่บ้านเห็ดฟาง',
            'น้ำแกงกะทิหอมกรุ่นกลิ่นข่าอ่อนและมะนาวแท้ รสเปรี้ยวเค็มหวานมันกำลังดี',
            120.00,
            'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=600&auto=format&fit=crop',
            true, 12
        ),

        -- หมวดที่ 4: เครื่องดื่ม & ของหวาน (3 เมนู)
        (
            v_m13, v_shop_id, v_cat_drinks_dessert,
            'ชาไทยโบราณเย็นพรีเมียม',
            'ชาตรามือคัดเกรด ชงสดเข้มข้น หอมมันนมสดแท้ หวานมันกลมกล่อม',
            45.00,
            'https://images.unsplash.com/photo-1558857563-b37cf5a91f54?w=600&auto=format&fit=crop',
            true, 13
        ),
        (
            v_m14, v_shop_id, v_cat_drinks_dessert,
            'น้ำผึ้งมะนาวโซดาแท้',
            'น้ำผึ้งดอกไม้ป่าผสมน้ำมะนาวคั้นสด ท็อปด้วยโซดาซ่าเย็นชื่นใจ',
            50.00,
            'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=600&auto=format&fit=crop',
            true, 14
        ),
        (
            v_m15, v_shop_id, v_cat_drinks_dessert,
            'ข้าวเหนียวมะม่วงน้ำดอกไม้',
            'มะม่วงน้ำดอกไม้สุกหวานฉ่ำ ข้าวเหนียวมูนกะทิสด โรยถั่วทองกรุบกรอบ',
            89.00,
            'https://images.unsplash.com/photo-1621303837174-89787a7d4729?w=600&auto=format&fit=crop',
            true, 15
        )
    ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        price = EXCLUDED.price,
        description = EXCLUDED.description,
        image_url = EXCLUDED.image_url,
        sort_order = EXCLUDED.sort_order;

    -- 5. ตัวเลือกพิเศษ/ท็อปปิ้ง (Options)
    -- Options สำหรับกะเพราหมูกรอบ (v_m1)
    INSERT INTO options (id, menu_item_id, name, price_delta) VALUES
        (gen_random_uuid(), v_m1, 'เผ็ดน้อย', 0.00),
        (gen_random_uuid(), v_m1, 'เผ็ดปกติ', 0.00),
        (gen_random_uuid(), v_m1, 'เผ็ดมาก (พริก 10 เม็ด)', 0.00),
        (gen_random_uuid(), v_m1, 'พิเศษ (+เพิ่มข้าวและหมูกรอบ)', 15.00),
        (gen_random_uuid(), v_m1, 'เพิ่มไข่ดาวกรอบไข่แดงเยิ้ม', 10.00),
        (gen_random_uuid(), v_m1, 'เพิ่มไข่เจียว', 15.00);

    -- Options สำหรับข้าวผัดปู (v_m2)
    INSERT INTO options (id, menu_item_id, name, price_delta) VALUES
        (gen_random_uuid(), v_m2, 'ธรรมดา', 0.00),
        (gen_random_uuid(), v_m2, 'พิเศษ (+เนื้อปูเพิ่ม 50%)', 40.00),
        (gen_random_uuid(), v_m2, 'เพิ่มไข่ดาว', 10.00);

    -- Options สำหรับผัดไทยกุ้งสด (v_m3)
    INSERT INTO options (id, menu_item_id, name, price_delta) VALUES
        (gen_random_uuid(), v_m3, 'ไม่ใส่ถั่วงอกดิบ', 0.00),
        (gen_random_uuid(), v_m3, 'พิเศษกุ้ง', 30.00);

    -- Options สำหรับต้มยำกุ้งแม่น้ำ (v_m10)
    INSERT INTO options (id, menu_item_id, name, price_delta) VALUES
        (gen_random_uuid(), v_m10, 'น้ำข้น', 0.00),
        (gen_random_uuid(), v_m10, 'น้ำใส', 0.00),
        (gen_random_uuid(), v_m10, 'เผ็ดน้อย', 0.00);

    -- Options สำหรับชาไทยโบราณ (v_m13)
    INSERT INTO options (id, menu_item_id, name, price_delta) VALUES
        (gen_random_uuid(), v_m13, 'หวานปกติ (100%)', 0.00),
        (gen_random_uuid(), v_m13, 'หวานน้อย (50%)', 0.00),
        (gen_random_uuid(), v_m13, 'ไม่หวาน (0%)', 0.00),
        (gen_random_uuid(), v_m13, 'เพิ่มวิปครีม', 15.00);

    -- Options สำหรับน้ำผึ้งมะนาวโซดา (v_m14)
    INSERT INTO options (id, menu_item_id, name, price_delta) VALUES
        (gen_random_uuid(), v_m14, 'หวานน้อย', 0.00),
        (gen_random_uuid(), v_m14, 'เปรี้ยวสะใจ (+น้ำมะนาว)', 5.00);

    -- 6. โต๊ะอาหาร 8 โต๊ะ (Tables)
    INSERT INTO tables (id, shop_id, table_no, qr_token, status) VALUES
        ('e1eebc99-9c0b-4ef8-bb6d-6bb9bd380001', v_shop_id, 'T-01', 'qr_kky_table_01_a9f2e', 'available'),
        ('e1eebc99-9c0b-4ef8-bb6d-6bb9bd380002', v_shop_id, 'T-02', 'qr_kky_table_02_b8c3d', 'available'),
        ('e1eebc99-9c0b-4ef8-bb6d-6bb9bd380003', v_shop_id, 'T-03', 'qr_kky_table_03_c7d4e', 'occupied'),
        ('e1eebc99-9c0b-4ef8-bb6d-6bb9bd380004', v_shop_id, 'T-04', 'qr_kky_table_04_d6e5f', 'available'),
        ('e1eebc99-9c0b-4ef8-bb6d-6bb9bd380005', v_shop_id, 'T-05', 'qr_kky_table_05_e5f6a', 'available'),
        ('e1eebc99-9c0b-4ef8-bb6d-6bb9bd380006', v_shop_id, 'T-06', 'qr_kky_table_06_f4a7b', 'occupied'),
        ('e1eebc99-9c0b-4ef8-bb6d-6bb9bd380007', v_shop_id, 'T-07', 'qr_kky_table_07_a3b8c', 'available'),
        ('e1eebc99-9c0b-4ef8-bb6d-6bb9bd380008', v_shop_id, 'T-08', 'qr_kky_table_08_b2c9d', 'available')
    ON CONFLICT (id) DO UPDATE SET
        table_no = EXCLUDED.table_no,
        qr_token = EXCLUDED.qr_token,
        status = EXCLUDED.status;

END $$;
