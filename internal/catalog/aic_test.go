package catalog

import "testing"

func TestNormalizeAIC(t *testing.T) {
	t.Parallel()
	for _, tc := range []struct {
		in, want string
		ok       bool
	}{{"012345678", "012345678", true}, {"12345678", "012345678", true}, {" 123 ", "000000123", true}, {"12A", "", false}, {"", "", false}, {"1234567890", "", false}} {
		got, err := NormalizeAIC(tc.in)
		if tc.ok && (err != nil || got != tc.want) {
			t.Fatalf("NormalizeAIC(%q)=(%q,%v), want %q", tc.in, got, err, tc.want)
		}
		if !tc.ok && err == nil {
			t.Fatalf("NormalizeAIC(%q) unexpectedly succeeded", tc.in)
		}
	}
}
