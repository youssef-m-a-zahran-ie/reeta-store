-- Starting FAQs, based on how the store works. Edit from Content in the admin (phase 5).
insert into public.faqs (question_en, question_ar, answer_en, answer_ar, sort) values
('Where do you deliver?', 'بتوصلوا فين؟',
 'We deliver across Cairo and Giza.', 'بنوصل في القاهرة والجيزة.', 1),
('How much is delivery?', 'التوصيل بكام؟',
 'Delivery depends on the distance to your location. You see the exact fee at checkout before you order.',
 'سعر التوصيل على حسب المسافة لمكانك، وهتشوفه بالظبط في صفحة الطلب قبل ما تأكد.', 2),
('How can I pay?', 'أدفع إزاي؟',
 'Cash on delivery, or InstaPay. With InstaPay we confirm the transfer before we send your order.',
 'كاش عند الاستلام، أو InstaPay. لو اخترت InstaPay هنأكد التحويل قبل ما نبعت الطلب.', 3),
('Do I need an account to order?', 'محتاج أعمل أكونت عشان أطلب؟',
 'No. Your name, phone number and address are enough.', 'لأ. اسمك ورقمك وعنوانك كفاية.', 4);
