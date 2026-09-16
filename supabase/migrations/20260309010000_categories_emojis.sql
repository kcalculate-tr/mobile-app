UPDATE public.categories SET emoji = CASE id
  WHEN 8 THEN '💪'
  WHEN 9 THEN '🔥'
  WHEN 10 THEN '🥗'
  WHEN 11 THEN '🥤'
  WHEN 12 THEN '🥛'
END WHERE id IN (8,9,10,11,12);
