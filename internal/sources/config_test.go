package sources

import "testing"

func TestLoadRepositoryConfigs(t *testing.T) {
	configs, err := LoadDir("../../configs/sources")
	if err != nil {
		t.Fatal(err)
	}
	if len(configs) != 7 {
		t.Fatalf("sources=%d", len(configs))
	}
	if configs["aifa-packages"].Download.Timeout.Duration == 0 {
		t.Fatal("duration not parsed")
	}
}
