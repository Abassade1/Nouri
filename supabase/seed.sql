-- =============================================================================
-- Seed: languages, countries, cities, services, and which services each city offers.
-- Calgary is the only LIVE city; the others exist so the waitlist, multi-currency
-- and multi-language configuration can be exercised from day one.
--
-- !! Tax rates and the 15% commission are PLACEHOLDERS. Confirm with your
-- !! accountant before launch (see README "Needs your input").
-- !! French and Arabic strings are first drafts: native-speaker review needed.
-- =============================================================================

insert into public.languages (code, name, is_rtl, sort_order) values
  ('en', 'English',  false, 1),
  ('fr', 'Français', false, 2),
  ('ar', 'العربية',  true,  3),
  ('zh', '中文',      false, 4)
on conflict (code) do nothing;

insert into public.countries
  (code, name_i18n, default_currency, default_language, phone_prefix, postal_code_regex, postal_code_example, region_label, is_active)
values
  ('CA', '{"en":"Canada","fr":"Canada","ar":"كندا","zh":"加拿大"}', 'CAD', 'en', '+1',
   '^[ABCEGHJ-NPRSTVXY][0-9][ABCEGHJ-NPRSTV-Z] [0-9][ABCEGHJ-NPRSTV-Z][0-9]$', 'T3H 0A1', 'Province', true),
  ('AE', '{"en":"United Arab Emirates","fr":"Émirats arabes unis","ar":"الإمارات العربية المتحدة","zh":"阿拉伯联合酋长国"}', 'AED', 'ar', '+971',
   null, null, 'Emirate', false)
on conflict (code) do nothing;

insert into public.cities
  (slug, country_code, region_code, name_i18n, timezone, currency, default_language,
   tax_components, commission_rate, launch_areas, latitude, longitude, is_active, launched_at)
values
  ('calgary', 'CA', 'AB', '{"en":"Calgary","fr":"Calgary","ar":"كالغاري","zh":"卡尔加里"}', 'America/Edmonton', 'CAD', 'en',
   '[{"code":"GST","rate":0.05}]', 0.15,
   array['Aspen Woods','Springbank Hill','West Springs','Signal Hill','Discovery Ridge','Strathcona Park','Patterson','Coach Hill'],
   51.0447, -114.0719, true, now()),
  ('edmonton', 'CA', 'AB', '{"en":"Edmonton","fr":"Edmonton","ar":"إدمونتون","zh":"埃德蒙顿"}', 'America/Edmonton', 'CAD', 'en',
   '[{"code":"GST","rate":0.05}]', 0.15, '{}', 53.5461, -113.4938, false, null),
  ('toronto', 'CA', 'ON', '{"en":"Toronto","fr":"Toronto","ar":"تورنتو","zh":"多伦多"}', 'America/Toronto', 'CAD', 'en',
   '[{"code":"HST","rate":0.13}]', 0.15, '{}', 43.6532, -79.3832, false, null),
  ('vancouver', 'CA', 'BC', '{"en":"Vancouver","fr":"Vancouver","ar":"فانكوفر","zh":"温哥华"}', 'America/Vancouver', 'CAD', 'en',
   '[{"code":"GST","rate":0.05},{"code":"PST","rate":0.07}]', 0.15, '{}', 49.2827, -123.1207, false, null),
  ('montreal', 'CA', 'QC', '{"en":"Montréal","fr":"Montréal","ar":"مونتريال","zh":"蒙特利尔"}', 'America/Toronto', 'CAD', 'fr',
   '[{"code":"GST","rate":0.05},{"code":"QST","rate":0.09975}]', 0.15, '{}', 45.5019, -73.5674, false, null),
  ('dubai', 'AE', 'Dubai', '{"en":"Dubai","fr":"Dubaï","ar":"دبي","zh":"迪拜"}', 'Asia/Dubai', 'AED', 'ar',
   '[{"code":"VAT","rate":0.05}]', 0.15, '{}', 25.2048, 55.2708, false, null)
on conflict (slug) do nothing;

insert into public.services (slug, name_i18n, description_i18n, rate_unit, icon, sort_order) values
  ('dog_walking',
   '{"en":"Dog walking","fr":"Promenade de chien","ar":"تمشية الكلاب","zh":"遛狗"}',
   '{"en":"A private walk tailored to your dog''s pace and routine.","fr":"Une promenade privée adaptée au rythme et à la routine de votre chien.","ar":"جولة خاصة تناسب وتيرة كلبك وروتينه.","zh":"根据您爱犬的节奏和习惯，量身定制的私人遛狗。"}',
   'per_walk', 'walk', 1),
  ('drop_in',
   '{"en":"Drop-in visit","fr":"Visite à domicile","ar":"زيارة منزلية قصيرة","zh":"上门探访"}',
   '{"en":"A short check-in for feeding, play and medication.","fr":"Une courte visite pour les repas, le jeu et les médicaments.","ar":"زيارة قصيرة للتغذية واللعب وإعطاء الدواء.","zh":"短时探访，负责喂食、玩耍和喂药。"}',
   'per_visit', 'home', 2),
  ('overnight_sitting',
   '{"en":"Overnight in-home sitting","fr":"Garde de nuit à domicile","ar":"رعاية ليلية في المنزل","zh":"夜间居家陪护"}',
   '{"en":"A carer stays overnight so your pet keeps their routine at home.","fr":"Un intervenant reste la nuit pour que votre animal garde sa routine à la maison.","ar":"يبقى مقدّم الرعاية ليلاً ليحافظ حيوانك على روتينه في المنزل.","zh":"照护者留宿陪伴，让宠物在家保持日常习惯。"}',
   'per_night', 'moon', 3),
  ('senior_medical',
   '{"en":"Senior & medical pet care","fr":"Soins pour animaux âgés ou malades","ar":"رعاية الحيوانات المسنّة والمرضى","zh":"老年及医疗宠物护理"}',
   '{"en":"Skilled care for older pets and pets with medical needs.","fr":"Des soins qualifiés pour les animaux âgés ou ayant des besoins médicaux.","ar":"رعاية متخصصة للحيوانات الكبيرة في السن أو ذات الاحتياجات الطبية.","zh":"为年长或有医疗需求的宠物提供专业护理。"}',
   'per_visit', 'heart', 4),
  ('pet_taxi',
   '{"en":"Pet taxi to vet or groomer","fr":"Taxi pour animaux (vétérinaire ou toiletteur)","ar":"نقل الحيوانات إلى الطبيب البيطري أو المصفّف","zh":"宠物接送（兽医或美容）"}',
   '{"en":"Safe, calm transport to appointments.","fr":"Un transport sûr et calme vers vos rendez-vous.","ar":"نقل آمن وهادئ إلى المواعيد.","zh":"安全、平稳地接送宠物前往预约地点。"}',
   'per_trip', 'car', 5)
on conflict (slug) do nothing;

-- Calgary offers all launch services.
insert into public.city_services (city_id, service_id)
select c.id, s.id from public.cities c cross join public.services s where c.slug = 'calgary'
on conflict do nothing;
