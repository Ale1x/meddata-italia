package catalog

import (
	"errors"
	"strings"
	"unicode"
)

var ErrInvalidAIC = errors.New("AIC must contain between 1 and 9 digits")

func NormalizeAIC(value string) (string, error) {
	value = strings.TrimSpace(value)
	if value == "" || len(value) > 9 {
		return "", ErrInvalidAIC
	}
	for _, r := range value {
		if !unicode.IsDigit(r) {
			return "", ErrInvalidAIC
		}
	}
	return strings.Repeat("0", 9-len(value)) + value, nil
}
