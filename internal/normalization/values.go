package normalization

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"
)

var decimalRE = regexp.MustCompile(`^[+-]?[0-9]+(?:[.,][0-9]+)?$`)

func Decimal(raw string) (string, error) {
	value := strings.TrimSpace(strings.ReplaceAll(raw, ",", "."))
	if !decimalRE.MatchString(value) {
		return "", fmt.Errorf("invalid decimal %q", raw)
	}
	parts := strings.SplitN(value, ".", 2)
	if len(parts) == 1 {
		return parts[0], nil
	}
	fraction := strings.TrimRight(parts[1], "0")
	if fraction == "" {
		return parts[0], nil
	}
	return parts[0] + "." + fraction, nil
}
func MoneyEUR(raw string) (string, error) {
	value := strings.TrimSpace(strings.ReplaceAll(raw, "€", ""))
	if value == "" || value == "-" {
		return "", fmt.Errorf("missing money")
	}
	if strings.Contains(value, ",") {
		value = strings.ReplaceAll(value, ".", "")
	}
	return Decimal(value)
}
func ItalianDate(raw string) (time.Time, error) {
	return time.Parse("02/01/2006", strings.TrimSpace(raw))
}
func Unit(raw string) (string, bool) {
	key := strings.ToLower(strings.TrimSpace(raw))
	units := map[string]string{"milligrammi": "mg", "milligram(s)/millilitre": "mg/mL", "grammi": "g", "microgrammi": "µg", "millilitri": "mL"}
	v, ok := units[key]
	return v, ok
}
func PositiveInt(raw string) (int, error) {
	v, err := strconv.Atoi(strings.TrimSpace(raw))
	if err != nil || v < 0 {
		return 0, fmt.Errorf("invalid positive integer %q", raw)
	}
	return v, nil
}
