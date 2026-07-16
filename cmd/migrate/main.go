package main

import (
	"database/sql"
	"fmt"
	"github.com/Ale1x/meddata-italia/internal/platform"
	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"
	"os"
)

func main() {
	cfg, err := platform.LoadConfig()
	if err != nil {
		fatal(err)
	}
	db, err := sql.Open("pgx", cfg.DatabaseURL)
	if err != nil {
		fatal(err)
	}
	defer db.Close()
	if err := goose.SetDialect("postgres"); err != nil {
		fatal(err)
	}
	command := "up"
	if len(os.Args) > 1 {
		command = os.Args[1]
	}
	if err := goose.Run(command, db, "db/migrations"); err != nil {
		fatal(err)
	}
}
func fatal(err error) { fmt.Fprintln(os.Stderr, err); os.Exit(1) }
