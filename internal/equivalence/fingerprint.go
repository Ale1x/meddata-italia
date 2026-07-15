package equivalence

import (
	"crypto/sha256"
	"encoding/hex"
	"github.com/example/medicine-platform/internal/catalog"
	"sort"
	"strings"
)

func MemberFingerprint(authority, kind, label string, aics []string) (string, error) {
	normalized := make([]string, 0, len(aics))
	for _, value := range aics {
		aic, err := catalog.NormalizeAIC(value)
		if err != nil {
			return "", err
		}
		normalized = append(normalized, aic)
	}
	sort.Strings(normalized)
	sum := sha256.Sum256([]byte(strings.Join([]string{authority, kind, strings.ToLower(strings.TrimSpace(label)), strings.Join(normalized, ",")}, "|")))
	return hex.EncodeToString(sum[:]), nil
}
