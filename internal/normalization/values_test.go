package normalization

import (
	"testing"
	"time"
)

func TestSourceValues(t *testing.T) {
	if got, err := MoneyEUR("5,63 €"); err != nil || got != "5.63" {
		t.Fatalf("money=%q err=%v", got, err)
	}
	if got, err := MoneyEUR("4.888,84 €"); err != nil || got != "4888.84" {
		t.Fatalf("money with thousands=%q err=%v", got, err)
	}
	if got, err := Decimal("100,00"); err != nil || got != "100" {
		t.Fatalf("decimal=%q err=%v", got, err)
	}
	d, err := ItalianDate("15/07/2026")
	if err != nil || d.Format(time.DateOnly) != "2026-07-15" {
		t.Fatalf("date=%v err=%v", d, err)
	}
	if unit, ok := Unit("milligrammi"); !ok || unit != "mg" {
		t.Fatalf("unit=%q", unit)
	}
}
