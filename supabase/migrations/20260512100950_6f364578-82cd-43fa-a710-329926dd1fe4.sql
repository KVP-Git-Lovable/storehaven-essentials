INSERT INTO public.whatsapp_config (sender_number, business_name, throughput, webhook_url) 
SELECT '+917411677878', 'QuickApp', '80 messages per second', 'https://pdtasnfsdnfttayxibqy.supabase.co/functions/v1/whatsapp-inbound'
WHERE NOT EXISTS (SELECT 1 FROM public.whatsapp_config);