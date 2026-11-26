-- 견적 제품 사진(앱에 같이 실리는 public/products/*.jpg)과 얀마 제품 추가. 새 제품은 기준가 0원(가격 미정)으로 넣고 관리 화면에서 채운다.
-- 이미 사진을 올린 제품은 건드리지 않는다. 같은 이름 제품이 있으면 새로 넣지 않는다.
UPDATE public.quote_products SET image_path = '/products/ym359a.jpg' WHERE name = 'YM359A' AND image_path IS NULL;
UPDATE public.quote_products SET image_path = '/products/yt357c.jpg' WHERE name = 'YT357-C' AND image_path IS NULL;
UPDATE public.quote_products SET image_path = '/products/yt345-yt357.jpg' WHERE name = 'YT357-O' AND image_path IS NULL;
UPDATE public.quote_products SET image_path = '/products/yt465am-yt488am.jpg' WHERE name = 'YT465A-M' AND image_path IS NULL;
UPDATE public.quote_products SET image_path = '/products/yt465am-yt488am.jpg' WHERE name = 'YT488A-M' AND image_path IS NULL;
UPDATE public.quote_products SET image_path = '/products/yt470a.jpg' WHERE name = 'YT470A' AND image_path IS NULL;
UPDATE public.quote_products SET image_path = '/products/yt470a.jpg' WHERE name = 'YT470A-G' AND image_path IS NULL;
UPDATE public.quote_products SET image_path = '/products/yh470-yh570-yh5101.jpg' WHERE name = 'YH570' AND image_path IS NULL;
UPDATE public.quote_products SET image_path = '/products/yh470-yh570-yh5101.jpg' WHERE name = 'YH570-C' AND image_path IS NULL;
UPDATE public.quote_products SET image_path = '/products/yh470-yh570-yh5101.jpg' WHERE name = 'YH5101-C' AND image_path IS NULL;
UPDATE public.quote_products SET image_path = '/products/yh6115p.jpg' WHERE name = 'YH6115-P' AND image_path IS NULL;
UPDATE public.quote_products SET image_path = '/products/yh6140-yh7140.jpg' WHERE name = 'YH6140-X' AND image_path IS NULL;
UPDATE public.quote_products SET image_path = '/products/yh6140-yh7140.jpg' WHERE name = 'YH7140-X' AND image_path IS NULL;
UPDATE public.quote_products SET image_path = '/products/yh1150.jpg' WHERE name = 'YH1150' AND image_path IS NULL;
UPDATE public.quote_products SET image_path = '/products/yh1150.jpg' WHERE name = 'YH1150-W' AND image_path IS NULL;
UPDATE public.quote_products SET image_path = '/products/yh700ma.jpg' WHERE name = 'YH700M' AND image_path IS NULL;
UPDATE public.quote_products SET image_path = '/products/yh400c.jpg' WHERE name = 'YH400-C' AND image_path IS NULL;
UPDATE public.quote_products SET image_path = '/products/rotary-folder.jpg' WHERE name = 'WLZ5700NX' AND image_path IS NULL;
UPDATE public.quote_products SET image_path = '/products/rotary-folder.jpg' WHERE name = 'WLZ6100NX' AND image_path IS NULL;
UPDATE public.quote_products SET image_path = '/products/rotary-folder.jpg' WHERE name = 'WMZ5000N' AND image_path IS NULL;
UPDATE public.quote_products SET image_path = '/products/disc-harrow.jpg' WHERE name = 'DTM-16' AND image_path IS NULL;
UPDATE public.quote_products SET image_path = '/products/disc-harrow.jpg' WHERE name = 'BETA DTM-16' AND image_path IS NULL;
UPDATE public.quote_products SET image_path = '/products/md20.jpg' WHERE name = 'MD20' AND image_path IS NULL;
UPDATE public.quote_products SET image_path = '/products/rvhc650w.jpg' WHERE name = 'RVHC650W' AND image_path IS NULL;
UPDATE public.quote_products SET image_path = '/products/rvhc650w.jpg' WHERE name = 'RVHC1000W' AND image_path IS NULL;
UPDATE public.quote_products SET image_path = '/products/ybs.jpg' WHERE name = 'YBS1000G' AND image_path IS NULL;
UPDATE public.quote_products SET image_path = '/products/ybs.jpg' WHERE name = 'YBS2000G' AND image_path IS NULL;
INSERT INTO public.quote_products (name, machine_group, category, spec, unit_price, brand, image_path, highlights, sort_order) SELECT 'YT345', '트랙터', '트랙터', '45마력 · HMT(무단변속)', 0, '얀마', '/products/yt345-yt357.jpg', '출력 45.0PS
중량 1,930~2,110kg (YT345·YT357)', 0 WHERE NOT EXISTS (SELECT 1 FROM public.quote_products WHERE lower(name) = lower('YT345'));
INSERT INTO public.quote_products (name, machine_group, category, spec, unit_price, brand, image_path, highlights, sort_order) SELECT 'YT357', '트랙터', '트랙터', '57마력 · HMT(무단변속)', 0, '얀마', '/products/yt345-yt357.jpg', '출력 57.0PS
중량 1,930~2,110kg (YT345·YT357)', 1 WHERE NOT EXISTS (SELECT 1 FROM public.quote_products WHERE lower(name) = lower('YT357'));
INSERT INTO public.quote_products (name, machine_group, category, spec, unit_price, brand, image_path, highlights, sort_order) SELECT 'YT345-M', '트랙터', '트랙터', '45마력 · 기계식 미션', 0, '얀마', '/products/yt345m-yt357m.jpg', '출력 45.0PS
중량 1,925~2,110kg (YT345-M·YT357-M)', 2 WHERE NOT EXISTS (SELECT 1 FROM public.quote_products WHERE lower(name) = lower('YT345-M'));
INSERT INTO public.quote_products (name, machine_group, category, spec, unit_price, brand, image_path, highlights, sort_order) SELECT 'YT357-M', '트랙터', '트랙터', '57마력 · 기계식 미션', 0, '얀마', '/products/yt345m-yt357m.jpg', '출력 57.0PS
중량 1,925~2,110kg (YT345-M·YT357-M)', 3 WHERE NOT EXISTS (SELECT 1 FROM public.quote_products WHERE lower(name) = lower('YT357-M'));
INSERT INTO public.quote_products (name, machine_group, category, spec, unit_price, brand, image_path, highlights, sort_order) SELECT 'YM359A-LL', '트랙터', '트랙터', '59.7마력', 0, '얀마', '/products/ym359a.jpg', '출력 59.7PS
중량 1,954~2,060kg (YM359A·YM359A-LL)', 4 WHERE NOT EXISTS (SELECT 1 FROM public.quote_products WHERE lower(name) = lower('YM359A-LL'));
INSERT INTO public.quote_products (name, machine_group, category, spec, unit_price, brand, image_path, highlights, sort_order) SELECT 'YT4105S', '트랙터', '트랙터', '102~120마력 시리즈 · HMT', 0, '얀마', '/products/yt5115s.jpg', 'YT4105S·YT5115S·YT5125S
출력 102.0~120.0PS · 중량 3,935~3,940kg', 5 WHERE NOT EXISTS (SELECT 1 FROM public.quote_products WHERE lower(name) = lower('YT4105S'));
INSERT INTO public.quote_products (name, machine_group, category, spec, unit_price, brand, image_path, highlights, sort_order) SELECT 'YT5115S', '트랙터', '트랙터', '102~120마력 시리즈 · HMT', 0, '얀마', '/products/yt5115s.jpg', 'YT4105S·YT5115S·YT5125S
출력 102.0~120.0PS · 중량 3,935~3,940kg', 6 WHERE NOT EXISTS (SELECT 1 FROM public.quote_products WHERE lower(name) = lower('YT5115S'));
INSERT INTO public.quote_products (name, machine_group, category, spec, unit_price, brand, image_path, highlights, sort_order) SELECT 'YT5125S', '트랙터', '트랙터', '120마력 · HMT', 0, '얀마', '/products/yt5115s.jpg', 'YT4105S·YT5115S·YT5125S
출력 102.0~120.0PS · 중량 3,935~3,940kg', 7 WHERE NOT EXISTS (SELECT 1 FROM public.quote_products WHERE lower(name) = lower('YT5125S'));
INSERT INTO public.quote_products (name, machine_group, category, spec, unit_price, brand, image_path, highlights, sort_order) SELECT 'YT5125S-D', '트랙터', '트랙터', '120마력 · HMT', 0, '얀마', '/products/yt5125sd.jpg', '출력 120.0PS
중량 4,480kg', 8 WHERE NOT EXISTS (SELECT 1 FROM public.quote_products WHERE lower(name) = lower('YT5125S-D'));
INSERT INTO public.quote_products (name, machine_group, category, spec, unit_price, brand, image_path, highlights, sort_order) SELECT 'YT5125S-G', '트랙터', '트랙터', '120마력 · HMT', 0, '얀마', '/products/yt5125sg.jpg', '출력 120.0PS
중량 3,940kg', 9 WHERE NOT EXISTS (SELECT 1 FROM public.quote_products WHERE lower(name) = lower('YT5125S-G'));
INSERT INTO public.quote_products (name, machine_group, category, spec, unit_price, brand, image_path, highlights, sort_order) SELECT 'YT6135', '트랙터', '트랙터', '132~143마력 · HMT', 0, '얀마', '/products/yt6135-yt6145.jpg', 'YT6135·YT6145
출력 132.0~143.0PS · 중량 5,015kg', 10 WHERE NOT EXISTS (SELECT 1 FROM public.quote_products WHERE lower(name) = lower('YT6135'));
INSERT INTO public.quote_products (name, machine_group, category, spec, unit_price, brand, image_path, highlights, sort_order) SELECT 'YT6145', '트랙터', '트랙터', '143마력 · HMT', 0, '얀마', '/products/yt6135-yt6145.jpg', 'YT6135·YT6145
출력 132.0~143.0PS · 중량 5,015kg', 11 WHERE NOT EXISTS (SELECT 1 FROM public.quote_products WHERE lower(name) = lower('YT6145'));
INSERT INTO public.quote_products (name, machine_group, category, spec, unit_price, brand, image_path, highlights, sort_order) SELECT 'FL4070PC', '작업기', '프론트로더', 'YT 프론트로더', 0, '얀마', '/products/fl-pc.jpg', 'FL4070PC / FL4090PC / FL5113PC', 12 WHERE NOT EXISTS (SELECT 1 FROM public.quote_products WHERE lower(name) = lower('FL4070PC'));
INSERT INTO public.quote_products (name, machine_group, category, spec, unit_price, brand, image_path, highlights, sort_order) SELECT 'FL4090PC', '작업기', '프론트로더', 'YT 프론트로더', 0, '얀마', '/products/fl-pc.jpg', 'FL4070PC / FL4090PC / FL5113PC', 13 WHERE NOT EXISTS (SELECT 1 FROM public.quote_products WHERE lower(name) = lower('FL4090PC'));
INSERT INTO public.quote_products (name, machine_group, category, spec, unit_price, brand, image_path, highlights, sort_order) SELECT 'FL5113PC', '작업기', '프론트로더', 'YT 프론트로더', 0, '얀마', '/products/fl-pc.jpg', 'FL4070PC / FL4090PC / FL5113PC', 14 WHERE NOT EXISTS (SELECT 1 FROM public.quote_products WHERE lower(name) = lower('FL5113PC'));
INSERT INTO public.quote_products (name, machine_group, category, spec, unit_price, brand, image_path, highlights, sort_order) SELECT 'FL5113MC', '작업기', '프론트로더', 'YT 프론트로더', 0, '얀마', '/products/fl5113mc.jpg', NULL, 15 WHERE NOT EXISTS (SELECT 1 FROM public.quote_products WHERE lower(name) = lower('FL5113MC'));
INSERT INTO public.quote_products (name, machine_group, category, spec, unit_price, brand, image_path, highlights, sort_order) SELECT 'ES·EM·EW·EL 시리즈 로터리', '작업기', '로타리', 'YT 로터리', 0, '얀마', '/products/rotary-es.jpg', 'ES시리즈 / EM시리즈 / EW시리즈 / EL시리즈', 16 WHERE NOT EXISTS (SELECT 1 FROM public.quote_products WHERE lower(name) = lower('ES·EM·EW·EL 시리즈 로터리'));
INSERT INTO public.quote_products (name, machine_group, category, spec, unit_price, brand, image_path, highlights, sort_order) SELECT 'YH470', '콤바인', '자탈형 콤바인', '4조', 0, '얀마', '/products/yh470-yh570-yh5101.jpg', 'YH470·YH570·YH5101
출력 73.0~105.0PS · 중량 3,735~4,062kg · 4·5조식', 17 WHERE NOT EXISTS (SELECT 1 FROM public.quote_products WHERE lower(name) = lower('YH470'));
INSERT INTO public.quote_products (name, machine_group, category, spec, unit_price, brand, image_path, highlights, sort_order) SELECT 'YH700M-A', '콤바인', '대두콤바인', '73마력', 0, '얀마', '/products/yh700ma.jpg', '엔진 4TN98C-1MRC3 (수냉4행정4기통 디젤)
출력 73PS', 18 WHERE NOT EXISTS (SELECT 1 FROM public.quote_products WHERE lower(name) = lower('YH700M-A'));
INSERT INTO public.quote_products (name, machine_group, category, spec, unit_price, brand, image_path, highlights, sort_order) SELECT 'PBTA1200', '기타', '대두탈립기', '자주식 대두탈립기', 0, '얀마', '/products/pbta1200.jpg', NULL, 19 WHERE NOT EXISTS (SELECT 1 FROM public.quote_products WHERE lower(name) = lower('PBTA1200'));
INSERT INTO public.quote_products (name, machine_group, category, spec, unit_price, brand, image_path, highlights, sort_order) SELECT 'YR06T-F', '이앙기', '밀묘 이앙기', '6조 · 23.4마력', 0, '얀마', '/products/yr06tf.jpg', '밀묘 이앙기 6조식(표준형)
출력 23.4PS · 중량 760~829kg · 작업속도 최고 1.85m/s', 20 WHERE NOT EXISTS (SELECT 1 FROM public.quote_products WHERE lower(name) = lower('YR06T-F'));
INSERT INTO public.quote_products (name, machine_group, category, spec, unit_price, brand, image_path, highlights, sort_order) SELECT 'YR08T-F', '이앙기', '밀묘 이앙기', '8조 · 23.4마력', 0, '얀마', '/products/yr08tf.jpg', '밀묘 이앙기 8조식(표준형)
출력 23.4PS · 중량 760~829kg · 작업속도 최고 1.85m/s', 21 WHERE NOT EXISTS (SELECT 1 FROM public.quote_products WHERE lower(name) = lower('YR08T-F'));
INSERT INTO public.quote_products (name, machine_group, category, spec, unit_price, brand, image_path, highlights, sort_order) SELECT 'YR06TG-F', '이앙기', '직진어시스트(RTK) 이앙기', '6조 · 23.4마력 · 밀묘', 0, '얀마', '/products/yr06tgf.jpg', '직진어시스트(RTK사양) 밀묘이앙기 6조식
출력 23.4PS · 중량 760~829kg · 작업속도 최고 1.85m/s', 22 WHERE NOT EXISTS (SELECT 1 FROM public.quote_products WHERE lower(name) = lower('YR06TG-F'));
INSERT INTO public.quote_products (name, machine_group, category, spec, unit_price, brand, image_path, highlights, sort_order) SELECT 'YR08TG-F', '이앙기', '직진어시스트(RTK) 이앙기', '8조 · 23.4마력 · 밀묘', 0, '얀마', '/products/yr08tgf.jpg', '직진어시스트(RTK사양) 밀묘이앙기 8조식
출력 23.4PS · 중량 760~829kg · 작업속도 최고 1.85m/s', 23 WHERE NOT EXISTS (SELECT 1 FROM public.quote_products WHERE lower(name) = lower('YR08TG-F'));
INSERT INTO public.quote_products (name, machine_group, category, spec, unit_price, brand, image_path, highlights, sort_order) SELECT 'YR06G-F', '이앙기', '직진어시스트(RTK) 이앙기', '6조 · 23.4마력 · 일반', 0, '얀마', '/products/yr06gf.jpg', '직진어시스트(RTK사양) 일반이앙기 6조식
출력 23.4PS · 중량 760~829kg · 작업속도 최고 1.85m/s', 24 WHERE NOT EXISTS (SELECT 1 FROM public.quote_products WHERE lower(name) = lower('YR06G-F'));
INSERT INTO public.quote_products (name, machine_group, category, spec, unit_price, brand, image_path, highlights, sort_order) SELECT 'YR08G-F', '이앙기', '직진어시스트(RTK) 이앙기', '8조 · 23.4마력 · 일반', 0, '얀마', '/products/yr08gf.jpg', '직진어시스트(RTK사양) 일반이앙기 8조식
출력 23.4PS · 중량 760~829kg · 작업속도 최고 1.85m/s', 25 WHERE NOT EXISTS (SELECT 1 FROM public.quote_products WHERE lower(name) = lower('YR08G-F'));
INSERT INTO public.quote_products (name, machine_group, category, spec, unit_price, brand, image_path, highlights, sort_order) SELECT 'YR60D', '이앙기', '이앙기', '6조 · 21.3마력', 0, '얀마', '/products/yr60d.jpg', '6조식(표준형)
출력 21.3PS · 작업속도 1.65m/s', 26 WHERE NOT EXISTS (SELECT 1 FROM public.quote_products WHERE lower(name) = lower('YR60D'));
INSERT INTO public.quote_products (name, machine_group, category, spec, unit_price, brand, image_path, highlights, sort_order) SELECT 'YR06-F', '이앙기', '이앙기', '6조 · 23.4마력', 0, '얀마', '/products/yr06f.jpg', '6조식(표준형)
출력 23.4PS · 중량 760~829kg · 작업속도 최고 1.85m/s', 27 WHERE NOT EXISTS (SELECT 1 FROM public.quote_products WHERE lower(name) = lower('YR06-F'));
INSERT INTO public.quote_products (name, machine_group, category, spec, unit_price, brand, image_path, highlights, sort_order) SELECT 'YR08-F', '이앙기', '이앙기', '8조 · 23.4마력', 0, '얀마', '/products/yr08f.jpg', '8조식(표준형)
출력 23.4PS · 중량 760~829kg · 작업속도 최고 1.85m/s', 28 WHERE NOT EXISTS (SELECT 1 FROM public.quote_products WHERE lower(name) = lower('YR08-F'));
INSERT INTO public.quote_products (name, machine_group, category, spec, unit_price, brand, image_path, highlights, sort_order) SELECT 'PH1AR', '기타', '이식기', '이식기', 0, '얀마', '/products/ph1ar.jpg', NULL, 29 WHERE NOT EXISTS (SELECT 1 FROM public.quote_products WHERE lower(name) = lower('PH1AR'));
INSERT INTO public.quote_products (name, machine_group, category, spec, unit_price, brand, image_path, highlights, sort_order) SELECT 'PW10A', '기타', '이식기', '이식기', 0, '얀마', '/products/pw10a.jpg', NULL, 30 WHERE NOT EXISTS (SELECT 1 FROM public.quote_products WHERE lower(name) = lower('PW10A'));
INSERT INTO public.quote_products (name, machine_group, category, spec, unit_price, brand, image_path, highlights, sort_order) SELECT 'PW10SA', '기타', '이식기', '이식기', 0, '얀마', '/products/pw10sa.jpg', NULL, 31 WHERE NOT EXISTS (SELECT 1 FROM public.quote_products WHERE lower(name) = lower('PW10SA'));
INSERT INTO public.quote_products (name, machine_group, category, spec, unit_price, brand, image_path, highlights, sort_order) SELECT 'PW10W', '기타', '이식기', '이식기', 0, '얀마', '/products/pw10w.jpg', NULL, 32 WHERE NOT EXISTS (SELECT 1 FROM public.quote_products WHERE lower(name) = lower('PW10W'));
INSERT INTO public.quote_products (name, machine_group, category, spec, unit_price, brand, image_path, highlights, sort_order) SELECT 'PW200R', '기타', '이식기', '이식기', 0, '얀마', '/products/pw200r.jpg', NULL, 33 WHERE NOT EXISTS (SELECT 1 FROM public.quote_products WHERE lower(name) = lower('PW200R'));
INSERT INTO public.quote_products (name, machine_group, category, spec, unit_price, brand, image_path, highlights, sort_order) SELECT 'HP101T', '기타', '양파수집기', '양파수집기', 0, '얀마', '/products/hp101t.jpg', NULL, 34 WHERE NOT EXISTS (SELECT 1 FROM public.quote_products WHERE lower(name) = lower('HP101T'));
INSERT INTO public.quote_products (name, machine_group, category, spec, unit_price, brand, image_path, highlights, sort_order) SELECT 'NC20', '기타', '운반차', '동력 운반차', 0, '얀마', '/products/nc20.jpg', NULL, 35 WHERE NOT EXISTS (SELECT 1 FROM public.quote_products WHERE lower(name) = lower('NC20'));
INSERT INTO public.quote_products (name, machine_group, category, spec, unit_price, brand, image_path, highlights, sort_order) SELECT '육묘준비제품', '옵션·부속', '육묘준비제품', '육묘상자·부속', 0, '얀마', '/products/seedling-kit.jpg', NULL, 36 WHERE NOT EXISTS (SELECT 1 FROM public.quote_products WHERE lower(name) = lower('육묘준비제품'));
INSERT INTO public.quote_products (name, machine_group, category, spec, unit_price, brand, image_path, highlights, sort_order) SELECT 'SV410', '기타', '기타', NULL, 0, '얀마', '/products/sv410.jpg', NULL, 37 WHERE NOT EXISTS (SELECT 1 FROM public.quote_products WHERE lower(name) = lower('SV410'));
INSERT INTO public.quote_products (name, machine_group, category, spec, unit_price, brand, image_path, highlights, sort_order) SELECT 'TT121A', '기타', '기타', NULL, 0, '얀마', '/products/tt121a.jpg', NULL, 38 WHERE NOT EXISTS (SELECT 1 FROM public.quote_products WHERE lower(name) = lower('TT121A'));
INSERT INTO public.quote_products (name, machine_group, category, spec, unit_price, brand, image_path, highlights, sort_order) SELECT 'YK300QT', '관리기·방제기', '관리기', '미니관리기 · 2.2~2.9마력', 0, '얀마', '/products/yk300qt.jpg', 'YK300QT·YK300QT(D)
출력 2.2~2.9PS · 중량 39~45kg', 39 WHERE NOT EXISTS (SELECT 1 FROM public.quote_products WHERE lower(name) = lower('YK300QT'));
INSERT INTO public.quote_products (name, machine_group, category, spec, unit_price, brand, image_path, highlights, sort_order) SELECT 'YK300QT(D)', '관리기·방제기', '관리기', '미니관리기 · 2.2~2.9마력', 0, '얀마', '/products/yk300qt.jpg', 'YK300QT·YK300QT(D)
출력 2.2~2.9PS · 중량 39~45kg', 40 WHERE NOT EXISTS (SELECT 1 FROM public.quote_products WHERE lower(name) = lower('YK300QT(D)'));
INSERT INTO public.quote_products (name, machine_group, category, spec, unit_price, brand, image_path, highlights, sort_order) SELECT 'YK450RK-D', '관리기·방제기', '관리기', '소형관리기 · 2.3~3.1마력', 0, '얀마', '/products/yk450rkd.jpg', '출력 2.3~3.1PS · 중량 68kg', 41 WHERE NOT EXISTS (SELECT 1 FROM public.quote_products WHERE lower(name) = lower('YK450RK-D'));
INSERT INTO public.quote_products (name, machine_group, category, spec, unit_price, brand, image_path, highlights, sort_order) SELECT 'YK650RK', '관리기·방제기', '관리기', '소형관리기 · 3.9~5.3마력', 0, '얀마', '/products/yk650rk.jpg', '출력 3.9~5.3PS · 중량 87kg', 42 WHERE NOT EXISTS (SELECT 1 FROM public.quote_products WHERE lower(name) = lower('YK650RK'));
INSERT INTO public.quote_products (name, machine_group, category, spec, unit_price, brand, image_path, highlights, sort_order) SELECT 'YK650MR', '관리기·방제기', '관리기', '소형관리기 · 3.9~5.3마력', 0, '얀마', '/products/yk650mr.jpg', '출력 3.9~5.3PS · 중량 87kg', 43 WHERE NOT EXISTS (SELECT 1 FROM public.quote_products WHERE lower(name) = lower('YK650MR'));
INSERT INTO public.quote_products (name, machine_group, category, spec, unit_price, brand, image_path, highlights, sort_order) SELECT 'YK651SK', '관리기·방제기', '관리기', '가변바퀴형 관리기 · 3.9~5.3마력', 0, '얀마', '/products/yk651sk.jpg', '출력 3.9~5.3PS · 중량 80kg', 44 WHERE NOT EXISTS (SELECT 1 FROM public.quote_products WHERE lower(name) = lower('YK651SK'));
INSERT INTO public.quote_products (name, machine_group, category, spec, unit_price, brand, image_path, highlights, sort_order) SELECT 'YK750MK-D', '관리기·방제기', '관리기', '범용관리기 · 4.4~5.9마력', 0, '얀마', '/products/yk750mkd.jpg', '출력 4.4~5.9PS · 중량 115kg', 45 WHERE NOT EXISTS (SELECT 1 FROM public.quote_products WHERE lower(name) = lower('YK750MK-D'));
INSERT INTO public.quote_products (name, machine_group, category, spec, unit_price, brand, image_path, highlights, sort_order) SELECT 'HN1253D', '작업기', '마늘 수확기', '마늘 수확기', 0, '얀마', '/products/hn1253d.jpg', NULL, 46 WHERE NOT EXISTS (SELECT 1 FROM public.quote_products WHERE lower(name) = lower('HN1253D'));
INSERT INTO public.quote_products (name, machine_group, category, spec, unit_price, brand, image_path, highlights, sort_order) SELECT 'NC1250', '작업기', '마늘 수확기', '마늘 수확기', 0, '얀마', '/products/nc1250.jpg', NULL, 47 WHERE NOT EXISTS (SELECT 1 FROM public.quote_products WHERE lower(name) = lower('NC1250'));
