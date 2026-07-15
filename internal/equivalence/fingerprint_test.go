package equivalence

import "testing"

func TestMemberFingerprintOrderIndependent(t *testing.T) {
	a, err := MemberFingerprint("AIFA", "AIFA_TRANSPARENCY_OFFICIAL", " Group ", []string{"44155024", "038835144"})
	if err != nil {
		t.Fatal(err)
	}
	b, err := MemberFingerprint("AIFA", "AIFA_TRANSPARENCY_OFFICIAL", "group", []string{"038835144", "044155024"})
	if err != nil {
		t.Fatal(err)
	}
	if a != b {
		t.Fatalf("fingerprints differ: %s %s", a, b)
	}
}
