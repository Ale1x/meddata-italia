package main

import (
	"reflect"
	"testing"
)

func TestSortSourceIDsHonorsCanonicalDependencies(t *testing.T) {
	ids := []string{
		"aifa-transparency-list",
		"aifa-package-ingredients",
		"aifa-shortages",
		"aifa-packages",
		"aifa-atc",
		"aifa-class-h",
		"aifa-class-a",
	}

	sortSourceIDs(ids)

	want := []string{
		"aifa-atc",
		"aifa-packages",
		"aifa-package-ingredients",
		"aifa-class-a",
		"aifa-class-h",
		"aifa-shortages",
		"aifa-transparency-list",
	}
	if !reflect.DeepEqual(ids, want) {
		t.Fatalf("unexpected source order: got %v want %v", ids, want)
	}
}
