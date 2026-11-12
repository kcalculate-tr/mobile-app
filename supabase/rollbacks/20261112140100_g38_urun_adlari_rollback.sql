-- G38-S1 md.2 — 20261112140100_g38_urun_adlari GERİ ALMA: eski adlara döner (id ile).
-- Yalnız hâlâ YENİ adı taşıyan satırlar geri alınır (sonradan elle değişen ezilmez).
-- Not: template değerlerinde canlıda parantezli ad olmadığından geri alınacak satır yok.
begin;

update public.products set name = 'Yeşil Canlandırıcı Detoks (330ml)' where id = 17 and name = 'Yeşil Canlandırıcı Detoks';
update public.products set name = 'Tropikal Yağ Yakıcı (330ml)' where id = 18 and name = 'Tropikal Yağ Yakıcı';
update public.products set name = 'Turuncu Metabolizma Hızlandırıcı (330ml)' where id = 19 and name = 'Turuncu Metabolizma Hızlandırıcı';
update public.products set name = 'Limonlu Zencefilli Arındırıcı (330ml)' where id = 20 and name = 'Limonlu Zencefilli Arındırıcı';
update public.products set name = 'Salatalıklı Ferahlatıcı (330ml)' where id = 21 and name = 'Salatalıklı Ferahlatıcı';
update public.products set name = 'Kırmızı Antioksidan Güç (330ml)' where id = 22 and name = 'Kırmızı Antioksidan Güç';

update public.option_items set name = 'Yeşil Canlandırıcı Detoks (330ml)'
where name = 'Yeşil Canlandırıcı' and id = any(array[
    '04ad3df8-322d-4d19-a7e2-c29974a006eb',
    '0c07c357-ca53-40c3-8a4f-165783bcc669',
    '211ca96b-ca28-47f1-b8a2-08b075cd93cd',
    '22f028af-dc4b-422c-bc9c-7fbcc1860f89',
    '3376fbd9-971c-42e5-aed4-4605f0bba56e',
    '4ed78b7a-afab-4f97-a533-2d8d36198936',
    '4f44f268-af71-46cb-99fb-de11186468d9',
    'a6aa3e77-947f-4978-9ff5-94e1ed04f899',
    'b028c252-4d0d-404f-9e19-d3c976ab94b6',
    'ea7df59a-32a6-4a08-b9f9-217212ea06ce',
    'f320406a-047e-458c-88b2-002b3c501248',
    'f93b6ae3-484c-4f5d-a46c-400a094952fd'
  ]::uuid[]);

update public.option_items set name = 'Tropikal Yağ Yakıcı (330ml)'
where name = 'Tropikal Yağ Yakıcı' and id = any(array[
    '133a01d4-01fa-4bd3-bc07-0fcbc6dfa3bf',
    '1b847d2a-0400-4a7b-bc7a-985e8bf21255',
    '371e9eb0-2ca1-4955-90b0-6baee4ee0252',
    '668d1778-7871-441f-a4a4-b4f8b9ca2c44',
    '752f4f12-d64d-416d-84de-018ed666d98e',
    '93c28ecf-2e41-491e-a774-ee1abb7f0cee',
    '9b46b60d-5114-4ecb-96f0-5dc3c37c6913',
    'ac4a240b-6f0f-479f-851c-949912631f9c',
    'b2c80254-3adf-4095-a1e8-2791ea9ebaef',
    'dd5f4057-3075-4ffc-ab31-b3fc5bfdd962',
    'f4d343ed-2def-47c6-9a9c-b30abc36ce01',
    'fc0694e0-6a9c-408d-9278-805ff3579b8e'
  ]::uuid[]);

update public.option_items set name = 'Turuncu Metabolizma Hızlandırıcı (330ml)'
where name = 'Turuncu Metabolizma' and id = any(array[
    '12495824-6111-40f2-9bc7-7ce6301307f9',
    '13e446a9-aaf5-4871-a72e-96039aacb3b5',
    '16356152-68e2-4573-9c23-1b5436cb6400',
    '1af071ea-7363-4c63-bea1-6037459f6dda',
    '2a4fa30f-0cc9-44d1-975b-304279739ac3',
    '4499eedc-b4e9-45ba-b2d0-6a6d9f09bf66',
    '67babc10-bbd0-472f-b100-ae9362ea45e8',
    '843f881d-5978-4a0f-a696-4e683cd1a24a',
    '8519dc19-b4a8-492f-bab9-d311770cc3f2',
    'ab8c7098-f2d6-408a-93f5-3268ddade125',
    'ab9ebff2-b41d-43b7-a6fe-5c9e76116d5f',
    'f635c8df-bb5c-4407-bbfb-c9cea2e9b1a1'
  ]::uuid[]);

update public.option_items set name = 'Limonlu Zencefilli Arındırıcı (330ml)'
where name = 'Limonlu Zencefilli' and id = any(array[
    '196b07ce-a92e-45d3-bcca-c8bdeb825926',
    '1e2891ae-664a-4374-bb97-0c56495faf3a',
    '4e2139ef-a7ce-462e-a06d-20c42ed44033',
    '536bf236-fe9f-44cf-b7eb-5efa35678787',
    '536f00cb-d29f-423e-b939-baa53fea1be9',
    '6e099d22-208f-4741-bab2-02a227a1808b',
    '946a00b9-d4a4-451c-b05c-e94abd8f87d5',
    '99eddb0b-0b1a-4dab-8e04-51d5809ec7c0',
    'ba39e4de-34a2-400b-945d-297b13640266',
    'd5fad945-c513-4639-8ddd-b943606178f0',
    'e8ac0b24-b421-4fd6-89ec-e6d3550587cc',
    'f2042c9e-66c7-4921-b0c0-2d3f444ef223'
  ]::uuid[]);

update public.option_items set name = 'Salatalıklı Ferahlatıcı (330ml)'
where name = 'Salatalıklı Ferahlatıcı' and id = any(array[
    '07835d22-7f43-4160-a1be-2e5c37ae6a05',
    '0d97ad98-b6c2-4a7b-b080-9d892b508ed2',
    '2e0e0884-eb7b-4281-942e-094c6422b6b2',
    '32a49b63-c935-46d1-9cf4-164d290def31',
    '4aee09ed-9f9a-44a7-bc3c-b35120ec112a',
    '92c378b9-10d1-418e-9dab-9dc69d59cfd0',
    '9e021083-2e38-486a-9d6f-3feed4455a5b',
    'b2ee1a72-0190-4e65-8601-ca7c58e695f9',
    'c8ba9ab1-51b1-455b-80f3-dfba21463895',
    'cdbe3bf1-3338-433f-a2f8-b14bda464f08',
    'e65bad9b-3185-4831-9210-fe843c1afd0e',
    'ef27ea35-29b3-41b6-8ed8-3e2c769c8acd'
  ]::uuid[]);

update public.option_items set name = 'Kırmızı Antioksidan Güç (330ml)'
where name = 'Kırmızı Antioksidan' and id = any(array[
    '166d0074-fe9c-4e09-8398-cfabfb7324c9',
    '1ddc11f7-f1b4-4bb7-9cb0-d6d2559498a9',
    '232f0bff-e396-4d79-8232-abd43ce981c3',
    '384e35f2-f704-4b62-93f6-9d1e14c26fcb',
    '3a2866dd-9c49-49e8-a65b-9198b044b1e7',
    '48bdc3a4-c83c-4a42-a395-9753328a446c',
    '4a226c6b-38cf-4634-bf70-62c43aee25c7',
    '85f0379b-0234-4c17-89e4-f8df076718eb',
    '938c9f2c-f095-425b-b80e-05fbd8aab0ec',
    '95e92895-dac6-4de6-b766-b4f38ec59406',
    'e3e97c92-d41d-45ca-ae18-be8a69235d19',
    'fdaccd68-71b9-4382-a461-487850da0ef7'
  ]::uuid[]);

update public.option_items set name = 'Basmati Üzeri Tavuk Fileto ve Brokoli'
where name = 'Protein Tavuk Fileto' and id = any(array[
    '05a51799-5cd7-4c53-9f1c-514a81cc1f34',
    '252ece5a-490d-4384-9601-844e9bccd2d1',
    '34a97b53-dcd4-42b2-a02f-3e2778c70369',
    '381ff018-e102-4c4e-b63b-ac59675f3e80',
    '39bcf026-a1ce-4cf0-84fc-5002fe666efa',
    '46631de5-51a9-4c8c-961a-1ce0a03aeb47',
    '4782e20f-f2ee-4a27-ab9f-c29f1a6e081d',
    '4c1b2027-f40e-4808-bfdc-10261a8a2469',
    '4c801f4c-350b-4483-94e0-1be0eb872696',
    '5f05e546-eedf-4e55-9451-dd3722c71810',
    '7219f0fe-9b6a-48b7-ae88-2d2830df5c0a',
    '7d3e47fe-c872-413e-acb6-a5c2c0b5b0e6',
    '95511d48-a13e-46c0-bad4-6d00deb811f0',
    'a5a628e4-0bd3-49bf-9d8f-ffe4fe658da9',
    'b0f9a48d-cd63-4845-b22e-eb37235bb6ad',
    'd7620713-058d-48f1-ad2f-11840f98885a',
    'd8d5596c-9bdc-4007-bf23-950e041c4f73'
  ]::uuid[]);

update public.option_items set name = 'Basmati Üzeri Tavuk Sote ve Brokoli'
where name = 'Protein Tavuk Sote' and id = any(array[
    '350007c7-885b-43db-aca4-100feea094a2',
    '5e265eb6-9e9d-4e87-b35c-543e93ce1b5c',
    '6f0b4ca3-cbfc-4a31-bbc0-b7896b71f28a',
    '6fa01692-93fa-4a68-8cf9-7f7d9d167b3e',
    '7de6cf26-24cb-458b-9fb0-aa167d9733da',
    'c0092ac7-3cfc-49e5-9a6c-37e2cbd90260',
    'c668b1ec-2ebc-4d28-bf97-01c57d95b80b',
    'c89d941b-6643-402f-96c5-d0745fa43054',
    'ccadb076-2cb2-46bc-9eae-e07f8d0e40eb',
    'cd97c426-ba3f-436c-bcd6-3a2321efed1b',
    'ef01137f-7d04-4781-8fda-f5055b289aed'
  ]::uuid[]);

update public.option_items set name = 'Basmati Üzeri Tavuk Sote ve Brokoli Sebze'
where name = 'Protein Tavuk Sote' and id = any(array[
    '04de3a4b-d04d-438b-9bed-ace3c16a2f8a',
    '3313c534-9f77-4650-a1ed-dbba155cc447',
    '3bac5759-aa01-4c21-b26a-68208f3212f5',
    '59898a51-763e-467a-8fed-76f968b386c7',
    '72cc6b1f-106c-48a4-bddb-11ba101dc374',
    'b32114e8-fb62-4936-9158-c51d1c21a7fa'
  ]::uuid[]);

update public.option_items set name = 'Basmati Üzeri Izgara Köfte ve Brokoli'
where name = 'Protein Izgara Köfte' and id = any(array[
    '014ceb8c-17bf-4341-82de-7656c3822e0c',
    '0b9f88fb-4764-4cbe-9b5b-6bce3360fb1f',
    '1d495b03-fa2f-400c-ad93-d134677a1770',
    '5ce0873b-d355-47e6-ba34-e91115539b58',
    '709edeaf-dd5c-44bd-a8bf-72ce112c435e',
    '7d7818dd-d105-4bd9-b0bf-1a9678dcfae7',
    '82c4d1bb-ce36-4e00-afee-059a310a8992',
    '936c7009-30cb-47fb-ab7c-ca6339f36c3a',
    'cecc4142-0238-4ebf-85e2-780f448080a8',
    'e3f6ff9a-dc2d-4220-bd03-2c34fb4a5138',
    'eb77ce7f-86de-4acd-a17a-7f1c55ae57d9'
  ]::uuid[]);

update public.option_items set name = 'Basmati Üzeri Izgara Köfte ve Brokoli Sebze'
where name = 'Protein Izgara Köfte' and id = any(array[
    '196f6935-02a5-4a5e-9722-6fb25e604c65',
    '1dd4eed8-4952-4191-ac50-a964c669ad5e',
    '4c5c32b8-f9c5-4da1-8c99-ee5f20558012',
    '76bdbf1a-b025-4184-956f-a7d321b86f9f',
    'd322e96a-df6b-4701-98fa-8743c2e1129a',
    'e3ab8c75-53a0-4e50-bd93-658e5913255c'
  ]::uuid[]);

update public.option_items set name = 'Tavuk Fileto Basmati ve Brokoli Sebze'
where name = 'Dengeli Tavuk Fileto' and id = any(array[
    '2e08efac-e98b-423d-a8c8-6ea6e2c459e7',
    '3fec302c-dc76-486e-9fd1-39620b0cc0bb',
    '6d26dac7-3f5c-4cc4-9237-afda2eb085eb',
    'a8d2b90f-b895-4ed5-b775-1693d7a29fb9',
    'b19fb4bc-c666-47ab-bc70-46f278dbc2cf',
    'f910ac97-4152-496e-a505-c1d464e98cd9',
    'f9d375d6-7938-4fff-9bf5-0834001c106e'
  ]::uuid[]);

update public.option_items set name = 'Tavuk Sote Basmati ve Brokoli Sebze'
where name = 'Dengeli Tavuk Sote' and id = any(array[
    '2df19960-9ccd-46d3-b99e-77ed6b6c34a4',
    '47b0582d-d799-4ed6-8cc4-af2de028600b',
    '6643a52e-2d97-4afc-98ee-da263e0e8613',
    '7917bff0-23d1-4960-9c7e-b194e776e778',
    'a52c9737-fc6d-4c35-be70-53de2a7b4ac7',
    'b6286d9b-d412-45b9-87b6-1c00b3e34b7d',
    'e69b29dc-cca2-4ce6-9560-589dc1e3a730'
  ]::uuid[]);

update public.option_items set name = 'Izgara Köfte Basmati ve Brokoli Sebze'
where name = 'Dengeli Izgara Köfte' and id = any(array[
    '02389947-821f-499e-9c44-9c0fc943b3c5',
    '3038f08e-a6c6-44f4-b524-47dec660f5d0',
    '4e66f68a-0198-4d32-bf99-2f17f7ea9071',
    '817a6561-d5b1-4df1-8f03-ec21d112c624',
    '97c4dbf8-547d-4944-a53b-9648ab4886bc',
    '9bcec3eb-c8b3-48c3-a820-eba2f4d26a52',
    '9cc92705-ca36-4f41-ad2f-04080e60d0d8'
  ]::uuid[]);

update public.option_items set name = 'Brokoli Sebze Üzeri Tavuk Fileto Bowl'
where name = 'Tavuk Fileto Bowl' and id = any(array[
    '1a18d6b2-2dfd-40ac-8583-94207b53b11a',
    '33098b7a-b8d6-4825-94ca-4cc551cdaeb9',
    '3b764db1-5bd8-4e6a-bfca-67b5db552ff5',
    'a827483b-951a-4793-9dfe-1b4194ffe36d',
    'cdc27346-ca42-45f6-919b-1ccca74e1535',
    'd3212d77-1e1f-4eb0-bad3-21ecf461a5f8',
    'e285d697-3d14-4201-8a8b-5182d1bdb571',
    'e5858555-ab7c-4d65-99c6-329bd8e843ed',
    'e638ae8b-98d6-41d5-86bf-cfe1c927caa9'
  ]::uuid[]);

update public.option_items set name = 'Brokoli Sebze Üzeri Tavuk Sote Bowl'
where name = 'Tavuk Sote Bowl' and id = any(array[
    '029e76d7-9520-46ae-88b4-1f97347abfcc',
    '0838b77e-1288-42cf-bf60-84fd06a47eee',
    '4b331658-8093-45f0-a47b-40dd65e1f96c',
    '5eff854a-2feb-4f9d-8f9c-147b9cf43140',
    '60561e93-1e97-4943-a035-e29706339f1c',
    '80234046-ff58-42f8-b8ff-f11529e741db',
    '984c64c7-7697-4582-9b15-be8e01369571',
    '9bf55b54-fae6-4738-b7f7-ac9a96d45792',
    'e9c4b70a-d427-4c0b-83eb-8967eba32e21'
  ]::uuid[]);

update public.option_items set name = 'Brokoli Sebze Üzeri Izgara Köfte Bowl'
where name = 'Izgara Köfte Bowl' and id = any(array[
    '07ce2b28-6f3b-4359-b8b3-4ab59fc03079',
    '0f352df0-5952-41d3-8b07-d81e1557a979',
    '2f6f25da-2c75-451a-9042-0c52e78b1f00',
    '5a9a08b4-5b8c-45fb-84d7-73830750d8b8',
    '63690b51-5b21-4254-a46c-8a4ea9cca34d',
    'b1920137-a26e-4f69-9693-4b7785b747e2',
    'b53120a8-19c6-4673-971c-f355ac8d40bb',
    'd2b7288a-713f-4906-92ed-9a19472ccabb',
    'f1fd2b52-6685-4db6-b7b9-10b520b00660'
  ]::uuid[]);

update public.option_items set name = 'Protein Shake Kakao Fıstık Ezmeli'
where name = 'Fıstık Ezmeli Shake' and id = any(array[
    '22160d25-be9d-4b5f-bef2-3ae8fcd433cd',
    '5f56f4e5-a91e-455a-a696-8d056fd06c90',
    '92b06546-206c-402a-b944-ebe0db71861b',
    '9cafac10-0082-4238-9bb4-6396259b2fbf',
    'a344b26e-14d6-4dc7-94d8-ef391bf52435',
    'e285063e-57c7-4489-9bae-74fae24e4f10'
  ]::uuid[]);

update public.option_items set name = 'Protein Shake Kakao Hindistan Cevizli'
where name = 'Hindistan Cevizli Shake' and id = any(array[
    '0190ffd4-fb7b-4d24-82d1-2ff17f1da316',
    '46c335e3-b4a0-461e-bd1e-527c726560a6',
    '4786f018-d8f5-456d-9f69-798f5b96151c',
    '60b99b12-10d0-4db3-978b-748af0c29ec8',
    'a6a36364-020b-4587-8af4-3f09249ef086',
    'b15bc0eb-d44b-4715-9c85-49ba392fc9b2'
  ]::uuid[]);

update public.option_items set name = 'Protein Shake Kakao Yulaf Vanilyalı'
where name = 'Yulaf Vanilyalı Shake' and id = any(array[
    '01696aed-2219-49c5-8680-8d646e8bf33f',
    '02e84a52-f28d-4669-814e-acbf955b3aa2',
    '04817a81-410d-499a-a86f-961e607ef66d',
    '0f0371c0-8f28-49f1-a912-879bbce96079',
    '3054d238-9a75-4c39-9b7f-b5edb2533de1',
    '416c967c-63f0-498b-b079-913890c6946a'
  ]::uuid[]);

update public.option_items set name = 'Dana Roastbeef 50g'
where name = 'Roastbeef 50g' and id = any(array[
    'd5afc840-f957-4a48-b475-e15454c48df4'
  ]::uuid[]);

update public.option_items set name = 'Dana Roastbeef 80g'
where name = 'Roastbeef 80g' and id = any(array[
    'c6c8a0e6-89fc-4e84-a3cf-59554318eb38'
  ]::uuid[]);

update public.option_items set name = 'Dana Roastbeef 100g'
where name = 'Roastbeef 100g' and id = any(array[
    '27886a7f-722a-4527-8f95-225528f9e236'
  ]::uuid[]);

update public.option_items set name = 'Fıstıklı Mortadella Salam 50g'
where name = 'Mortadella 50g' and id = any(array[
    '23c04d63-915c-4781-8025-6ac21ed4f3d7'
  ]::uuid[]);

update public.option_items set name = 'Fıstıklı Mortadella Salam 80g'
where name = 'Mortadella 80g' and id = any(array[
    '391581f7-450b-4de0-b41e-951c3ae5e3cc'
  ]::uuid[]);

update public.option_items set name = 'Fıstıklı Mortadella Salam 100g'
where name = 'Mortadella 100g' and id = any(array[
    'f85d1677-e670-4f69-8821-ef30d4e5bdb5'
  ]::uuid[]);

update public.option_items set name = 'Soya Soslu Tavuk Sote 150g'
where name = 'Soya Soslu Sote 150g' and id = any(array[
    '56cb54d2-4b20-442f-a170-66641e6ea93e'
  ]::uuid[]);

update public.option_items set name = 'Soya Soslu Tavuk Sote 250g'
where name = 'Soya Soslu Sote 250g' and id = any(array[
    '98eeee73-7940-40da-ab52-0482d3482ff4'
  ]::uuid[]);

update public.option_items set name = 'Soya Soslu Tavuk Sote 350g'
where name = 'Soya Soslu Sote 350g' and id = any(array[
    'f4aeccf8-b934-4cc8-8267-cee1df50b0e9'
  ]::uuid[]);

update public.option_items set name = 'Mavi Haşhaşlı Amerikan Bagel'
where name = 'Mavi Haşhaşlı Bagel' and id = any(array[
    '14baf302-22c5-43fe-87f6-9fb3ca018f18'
  ]::uuid[]);

update public.option_items set name = 'Basmati & Lolorosso Karışık'
where name = 'Basmati & Lolorosso' and id = any(array[
    'f52e3cd8-a5f3-4c7a-8369-44367fa549ff'
  ]::uuid[]);

commit;
