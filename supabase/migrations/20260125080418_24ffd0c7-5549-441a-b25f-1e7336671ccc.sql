-- Add new columns to programs table for category support
ALTER TABLE public.programs ADD COLUMN IF NOT EXISTS wc_id INTEGER;
ALTER TABLE public.programs ADD COLUMN IF NOT EXISTS sku TEXT;
ALTER TABLE public.programs ADD COLUMN IF NOT EXISTS categories TEXT[];

-- Delete existing test data
DELETE FROM public.audio_files;
DELETE FROM public.purchases;
DELETE FROM public.programs;

-- Insert programs from WooCommerce export (only published, visible products with price > 0 or is gratis)
INSERT INTO public.programs (wc_id, sku, title, description, short_description, price, image_url, categories, is_active) VALUES

-- Swedish programs
(1638, '10201', 'Andas dig till ett bättre liv!', 'Den här programserien är framtagen för att du ska ha kraftfulla verktyg för att andas dig till ett bättre liv! Det innehåller 7 delar, där varje del hjälper din kropp att lära sig den bästa andningsåterhämtningen för din kropp. Programmet är mindfulnessinspirerat.', 'Kraftfulla verktyg för bättre andning och återhämtning', 500, 'https://xn--mentaltrning-ncb.nu/wp-content/uploads/2023/05/2192575088.jpg', ARRAY['Bättre hälsa'], true),

(1639, '10122', 'Avslappning för barn och ungdom', 'Åtta program som syftar till att lära sig muskulär och mental avslappning. Programmen anknyter till den träning som funnits med i många skolor. Här får man lära sig det som brukar kallas för Mental Grundträning.', 'Lär dig muskulär och mental avslappning', 500, 'https://xn--mentaltrning-ncb.nu/wp-content/uploads/2023/05/2192622930.jpg', ARRAY['Barn & Ungdom'], true),

(1640, '10001', 'Avspänning', 'Med den här programserien får du en kort introduktion till de fyra första stegen i Mental Träning. Du bör använda varje program mellan 5 och 10 gånger innan du fortsätter med nästa.', 'Introduktion till de fyra första stegen i Mental Träning', 300, 'https://xn--mentaltrning-ncb.nu/wp-content/uploads/2023/05/2163593012-scaled.jpg', ARRAY['Personlig Utveckling'], true),

(1642, '10007', 'Bättre sömn genom mental träning', 'Programmen på detta träningsprogram har utarbetats för att både underlätta insomnandet och höja sömnkvaliteten. Ett av dom är också till för aktiv vila.', 'Underlätta insomnande och höj sömnkvaliteten', 500, 'https://xn--mentaltrning-ncb.nu/wp-content/uploads/2023/05/2163392574-scaled.jpg', ARRAY['Bättre hälsa'], true),

(1644, '10135', 'Divine: Det gyllene rummet', 'Section divine, Golden ratio eller på svenska Det gyllene snittet har trots att det funnits och använts i tusentals år varit ett okänt begrepp för flertalet människor.', 'Musik och meditation baserat på det gyllene snittet', 100, 'https://xn--mentaltrning-ncb.nu/wp-content/uploads/2023/05/114366934.jpg', ARRAY['Personlig Utveckling'], true),

(1645, '10124', 'Dreamteam pedagogisk uppladdning', 'TEAMET ÄR IDAG NYCKELN till effektivitets- och prestationshöjningar inom arbetslivet. De 10 programmen på denna cd hjälper teamet till bättre prestationer genom en pedagogisk uppladdning.', 'Hjälp teamet till bättre prestationer', 600, 'https://xn--mentaltrning-ncb.nu/wp-content/uploads/2023/05/2195910161.jpg', ARRAY['Personlig Utveckling'], true),

(1647, '10131', 'Framgång i skolan', 'Du får möjlighet att träna upp ett antal faktorer som ökar förutsättningar för att du ska lyckas bra i skolan. Dit hör en bra koncentrationsförmåga, att bli motiverad för det man läser.', 'Träna faktorer för skolframgång', 300, 'https://xn--mentaltrning-ncb.nu/wp-content/uploads/2023/05/2192858497.jpg', ARRAY['Barn & Ungdom'], true),

(1648, '10196', 'Framtiden', 'Programmet handlar om hur du vill ha din framtid. Du blir guidad av Lars-Eric Unestål att programmera in ditt önskade läge i framtiden på tre viktiga områden i livet.', 'Programmera in din önskade framtid', 0, 'https://xn--mentaltrning-ncb.nu/wp-content/uploads/2023/05/2192899561.jpg', ARRAY['Gratisprogram', 'Personlig Utveckling'], true),

(1649, '10199', 'För ungdomar som har det tufft!', 'Dessa program gjordes från början på uppdrag av Röda Korset och vände sig till mobbade elever i skolan. Programmen har modifierats och riktar sig nu till alla ungdomar.', 'Mental träning för ungdomar i svåra situationer', 700, 'https://xn--mentaltrning-ncb.nu/wp-content/uploads/2023/05/2192872003.jpg', ARRAY['Barn & Ungdom'], true),

(1651, '10005', 'Humor & glädje', 'De flesta människor har alltid vetat att humor, skratt och glädje hjälper oss att både fungera bättre och att må bättre. Till din hjälp finns detta träningsprogram med fem ljudspår.', 'Träningsprogram för humor, skratt och glädje', 500, 'https://xn--mentaltrning-ncb.nu/wp-content/uploads/2023/05/2192957153.jpg', ARRAY['Bättre hälsa'], true),

(1653, '10008', 'Idealvikt', 'Nå din idealvikt med hjälp av mental träning. Genom målprogrammering och en ny livsstil når du din idealvikt på ett naturligt sätt.', 'Nå din idealvikt med mental träning', 300, 'https://xn--mentaltrning-ncb.nu/wp-content/uploads/2023/05/2163459419-scaled.jpg', ARRAY['Bättre hälsa'], true),

(1655, '10200', 'Inre & Yttre Trygghet', 'Stärk ditt immunförsvar och skapa en inre och yttre trygghet.', 'Stärk immunförsvaret och skapa trygghet', 0, 'https://xn--mentaltrning-ncb.nu/wp-content/uploads/2023/05/2192906343.jpg', ARRAY['Gratisprogram', 'Bättre hälsa'], true),

(1660, '10002', 'Mental Grundträning', 'Ett 7 veckors träningsprogram för muskulär och mental avslappning. Lär dig effektiv avspänning och skapa en inre arbetsplats.', 'Grundläggande mental träning i 7 veckor', 400, 'https://xn--mentaltrning-ncb.nu/wp-content/uploads/2023/05/2163593049-scaled.jpg', ARRAY['Personlig Utveckling'], true),

(1662, '10004', 'Mental styrketräning', 'Ett 8 veckors träningsprogram för attityd- och livskvalitetsträning. Inkluderar koncentrationsträning, mental tuffhetsträning och livskvalitetsträning.', 'Attityd- och livskvalitetsträning i 8 veckor', 600, 'https://xn--mentaltrning-ncb.nu/wp-content/uploads/2023/05/2163588092-scaled.jpg', ARRAY['Personlig Utveckling'], true),

(1663, '10150', 'Mental träning för barn & ungdom', 'Tio program som lär ut den mentala träningen och där man får möjlighet att arbeta med sin egen personliga utveckling.', 'Personlig utveckling för barn och ungdomar', 700, 'https://xn--mentaltrning-ncb.nu/wp-content/uploads/2023/05/2192866202.jpg', ARRAY['Barn & Ungdom'], true),

(1664, '10139', 'Mental träning för seniorer', 'På detta träningsprogram hittar du fem olika program för seniorer. Mental Träning arbetar med ett livslångt lärande och en personlig utveckling.', 'Mental träning anpassad för seniorer', 300, 'https://xn--mentaltrning-ncb.nu/wp-content/uploads/2023/05/2192887345.jpg', ARRAY['Bättre hälsa'], true),

(1665, '10140', 'Mental träning golf', 'Den här programserien kan användas för att förbättra ditt golfspel. Det ideala är att man är klar med den mentala grundträningen innan man startar.', 'Förbättra ditt golfspel med mental träning', 400, 'https://xn--mentaltrning-ncb.nu/wp-content/uploads/2023/05/2192906156.jpg', ARRAY['Sport excellens'], true),

(1666, '10142', 'Mental träning i fotboll Programserie 1', 'Mental träning i fotboll innebär att man genom en daglig systematisk träning lär in och automatiserar tankar, bilder, attityder och känslor.', 'Mental träning för fotbollsspelare - Serie 1', 200, 'https://xn--mentaltrning-ncb.nu/wp-content/uploads/2023/05/2192858594.jpg', ARRAY['Sport excellens'], true),

(1667, '10143', 'Mental träning i fotboll Programserie 2', 'Fortsättning av mental träning i fotboll med fokus på självbild och målbilder.', 'Mental träning för fotbollsspelare - Serie 2', 200, 'https://xn--mentaltrning-ncb.nu/wp-content/uploads/2023/05/2192872041.jpg', ARRAY['Sport excellens'], true),

(1668, '10144', 'Mental träning i fotboll Programserie 3', 'Tredje delen av mental träning i fotboll med fokus på optimism, attityd, självdisciplin och koncentration.', 'Mental träning för fotbollsspelare - Serie 3', 400, 'https://xn--mentaltrning-ncb.nu/wp-content/uploads/2023/05/2192866317.jpg', ARRAY['Sport excellens'], true),

(1669, '10145', 'Mental träning i fotboll Programserie 4', 'Fjärde delen med säsongsförberedelser och matchförberedelser.', 'Mental träning för fotbollsspelare - Serie 4', 200, 'https://xn--mentaltrning-ncb.nu/wp-content/uploads/2023/05/2192858640.jpg', ARRAY['Sport excellens'], true),

(3106, '12121', 'Stresshantering', 'Stresshantering II med hjälp av Mental Träning. Fem program för att hantera stress effektivt.', 'Verktyg för effektiv stresshantering', 500, 'https://xn--mentaltrning-ncb.nu/wp-content/uploads/2024/10/cd-stresshantering-2-150x150-1.jpg', ARRAY['Personlig Utveckling'], true),

(3163, '12125', 'Avslappning för barn', 'Avslappning för barn innehåller 7 korta ljudprogram på 10-15 minuter. Det är lugn musik och en lugn röst som pratar till din hjärna.', 'Korta avslappningsprogram för barn', 300, 'https://xn--mentaltrning-ncb.nu/wp-content/uploads/2024/10/66095f30df64d22d58a8ab354fd7089b34356aa126a02056bb88d6664259fa92.png', ARRAY['Barn & Ungdom'], true),

-- English programs
(1656, '10106', 'Introduction to Mental Training', 'This session introduces you to Mental training with Muscular Relaxation, Mental Relaxation, Self Image Integration and Goal Image Training.', 'Introduction to mental training techniques', 300, 'https://xn--mentaltrning-ncb.nu/wp-content/uploads/2023/05/39914999.jpg', ARRAY['English'], true);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_programs_wc_id ON public.programs(wc_id);
CREATE INDEX IF NOT EXISTS idx_programs_categories ON public.programs USING GIN(categories);