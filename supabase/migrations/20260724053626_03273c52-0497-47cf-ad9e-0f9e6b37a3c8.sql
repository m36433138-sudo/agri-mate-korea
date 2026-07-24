UPDATE public.machines SET classification = NULL WHERE classification IN ('새기계','중고기계');
UPDATE public.machines SET classification = '농업용트랙터' WHERE REPLACE(classification, ' ', '') IN ('트랙터','농업용트랙터');
UPDATE public.machines SET classification = '콤바인' WHERE REPLACE(classification, ' ', '') = '콤바인';
UPDATE public.machines SET classification = '이앙기' WHERE REPLACE(classification, ' ', '') = '이앙기';