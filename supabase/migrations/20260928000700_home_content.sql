-- Default copy for the home page sections. Editable from Content in the admin (phase 5).
insert into public.content_blocks (key, page, sort, is_visible, data) values
('home.hero', 'home', 1, true, jsonb_build_object(
  'title_en', 'Nuts, coated in chocolate.',
  'title_ar', 'مكسرات متغطية شوكولاتة.',
  'subtitle_en', 'Cashews, almonds and peanuts in dark and white chocolate.',
  'subtitle_ar', 'كاجو ولوز وسوداني بالشوكولاتة الدارك والوايت.',
  'primary_en', 'Shop now', 'primary_ar', 'اطلب دلوقتي',
  'secondary_en', 'See bundles', 'secondary_ar', 'شوف البوكسات'
)),
('home.categories', 'home', 2, true, jsonb_build_object(
  'eyebrow_en', 'Shop by category', 'eyebrow_ar', 'تسوّق حسب النوع',
  'title_en', 'What are you craving?', 'title_ar', 'نفسك في إيه؟'
)),
('home.bestsellers', 'home', 3, true, jsonb_build_object(
  'eyebrow_en', 'Bestsellers', 'eyebrow_ar', 'الأكثر مبيعًا',
  'title_en', 'Pick a pouch', 'title_ar', 'اختار عبوتك'
)),
('home.bundles', 'home', 4, true, jsonb_build_object(
  'eyebrow_en', 'Bundles', 'eyebrow_ar', 'البوكسات',
  'title_en', 'Mix flavors, pay less', 'title_ar', 'نكهات أكتر بسعر أقل',
  'text_en', 'Ready-made boxes that cost less than buying each pouch on its own.',
  'text_ar', 'بوكسات جاهزة بسعر أقل من إنك تشتري كل عبوة لوحدها.'
)),
('home.why', 'home', 5, true, jsonb_build_object(
  'eyebrow_en', 'Why Reeta', 'eyebrow_ar', 'ليه ريتا',
  'title_en', 'Small pouches, big choice', 'title_ar', 'عبوات صغيرة واختيارات كتير',
  'points', jsonb_build_array(
    jsonb_build_object('title_en', 'Your flavor', 'title_ar', 'نكهتك',
      'text_en', 'Dark or white chocolate over cashews, almonds or peanuts.',
      'text_ar', 'شوكولاتة دارك أو وايت على كاجو أو لوز أو سوداني.'),
    jsonb_build_object('title_en', 'Your size', 'title_ar', 'الحجم اللي يناسبك',
      'text_en', 'From a 50 g snack to a 350 g pouch to share.',
      'text_ar', 'من 50 جرام للتسالي لحد 350 جرام للمشاركة.'),
    jsonb_build_object('title_en', 'To your door', 'title_ar', 'لحد باب البيت',
      'text_en', 'Delivery across Cairo and Giza. Pay cash on delivery or by InstaPay.',
      'text_ar', 'توصيل في القاهرة والجيزة. ادفع كاش عند الاستلام أو InstaPay.')
  )
)),
('home.testimonials', 'home', 6, true, jsonb_build_object(
  'eyebrow_en', 'From our customers', 'eyebrow_ar', 'من عملائنا',
  'title_en', 'People keep coming back', 'title_ar', 'اللي جرّب رجع تاني'
)),
('home.cta', 'home', 7, true, jsonb_build_object(
  'title_en', 'Ready for your first pouch?', 'title_ar', 'جاهز لأول عبوة؟',
  'text_en', 'Order in a minute. No account needed.', 'text_ar', 'اطلب في دقيقة، من غير أكونت.',
  'button_en', 'Shop now', 'button_ar', 'اطلب دلوقتي'
))
on conflict (key) do nothing;

update public.pages set
  body_en = 'Reeta makes chocolate-coated nuts and fruit. We start with cashews, almonds and peanuts, coat them in dark or white chocolate, and pack them in pouches you can pick by size.',
  body_ar = 'ريتا بتعمل مكسرات وفواكه متغطية شوكولاتة. بنبدأ بالكاجو واللوز والسوداني، بنغطيهم بشوكولاتة دارك أو وايت، ونعبيهم في عبوات تختار حجمها بنفسك.',
  is_published = true
where slug = 'about';
