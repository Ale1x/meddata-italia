-- +goose Up
CREATE FUNCTION parse_aifa_money(raw text) RETURNS numeric
LANGUAGE sql IMMUTABLE STRICT
AS $$
  SELECT CASE
    WHEN regexp_replace(raw, '[^0-9,.-]', '', 'g') ~ '^[0-9]{1,3}(\.[0-9]{3})+,[0-9]{1,4}$'
      THEN replace(replace(regexp_replace(raw, '[^0-9,.-]', '', 'g'), '.', ''), ',', '.')::numeric
    WHEN regexp_replace(raw, '[^0-9,.-]', '', 'g') ~ '^[0-9]+,[0-9]{1,4}$'
      THEN replace(regexp_replace(raw, '[^0-9,.-]', '', 'g'), ',', '.')::numeric
    WHEN regexp_replace(raw, '[^0-9,.-]', '', 'g') ~ '^[0-9]+(\.[0-9]{1,4})?$'
      THEN regexp_replace(raw, '[^0-9,.-]', '', 'g')::numeric
    ELSE NULL
  END
$$;

-- +goose Down
DROP FUNCTION IF EXISTS parse_aifa_money(text);
