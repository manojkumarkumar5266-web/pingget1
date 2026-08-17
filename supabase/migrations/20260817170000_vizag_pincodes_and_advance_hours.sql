-- Correct Visakhapatnam pincode area names (India Post) + advance slots 05:00–23:00

UPDATE public.advance_settings
SET
  business_hours_start = '05:00',
  business_hours_end = '23:00',
  updated_at = now()
WHERE true;

DO $$
DECLARE
  viz_id uuid;
  rec record;
BEGIN
  SELECT id INTO viz_id FROM public.cities WHERE name = 'Visakhapatnam' LIMIT 1;
  IF viz_id IS NULL THEN
    INSERT INTO public.cities (name, commission_pct, is_active)
    VALUES ('Visakhapatnam', 10, true)
    RETURNING id INTO viz_id;
  END IF;

  FOR rec IN
    SELECT * FROM (VALUES
      ('530001', 'Visakhapatnam H.O / Fortward / Kurupam Market'),
      ('530002', 'Maharanipeta / KGH / D.C. Buildings'),
      ('530003', 'Andhra University / Chinawaltair / Pithapuram Colony'),
      ('530004', 'Waltair R.S / Gnanapuram'),
      ('530005', 'Gandhigram / Nausenabagh / Yarada'),
      ('530007', 'Industrial Estate / Muralinagar'),
      ('530008', 'Kancharapalem / IRSD Area'),
      ('530009', 'Airport / NAD / Marripalem VUDA Colony'),
      ('530011', 'Malkapuram'),
      ('530012', 'Autonagar / Sheelanagar / BHPV'),
      ('530013', 'P&T Colony (Seethammadhara)'),
      ('530014', 'Naval Base / Naval Dockyard'),
      ('530015', 'Zinc Smelter'),
      ('530016', 'Akkayyapalem / Dwarakanagar'),
      ('530017', 'MVP Colony / L B Colony'),
      ('530018', 'Marripalem'),
      ('530020', 'Dabagardens / Bus Station'),
      ('530022', 'Isakathota / H B Colony'),
      ('530024', 'Salagramapuram'),
      ('530026', 'Gajuwaka'),
      ('530027', 'Gopalapatnam / NSTL / Prahladapuram'),
      ('530028', 'Simhachalam'),
      ('530029', 'Durganagar / R R V Puram'),
      ('530031', 'Visakhapatnam Steel Project'),
      ('530032', 'Ukkunagaram / Steel Plant Township'),
      ('530040', 'Arilova / Pedagadili'),
      ('530041', 'Pothinamallayapalem'),
      ('530043', 'Visalakshinagar / Dayalnagar'),
      ('530044', 'Pedagantyada / Gangavaram'),
      ('530045', 'Yendada / Sagar Nagar / Gitam'),
      ('530046', 'Duvvada / Vadlapudi'),
      ('530047', 'Vepagunta'),
      ('530048', 'Madhurawada / Kommadi / Marikavalasa'),
      ('530049', 'SEZ'),
      ('530051', 'Sujatha Nagar'),
      ('530052', 'Anandapuram'),
      ('530053', 'Aganampudi')
    ) AS t(pincode, area_name)
  LOOP
    UPDATE public.pincodes
    SET area_name = rec.area_name, city_id = viz_id, is_active = true
    WHERE pincode = rec.pincode;

    IF NOT FOUND THEN
      INSERT INTO public.pincodes (city_id, pincode, area_name, is_active)
      VALUES (viz_id, rec.pincode, rec.area_name, true);
    END IF;
  END LOOP;

  DELETE FROM public.pincodes
  WHERE city_id = viz_id
    AND pincode IN ('530006', '530023', '530055');
END $$;
