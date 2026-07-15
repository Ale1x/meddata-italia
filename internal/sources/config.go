package sources

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/go-playground/validator/v10"
	"gopkg.in/yaml.v3"
)

type Config struct {
	ID                string          `yaml:"id" validate:"required"`
	Name              string          `yaml:"name" validate:"required"`
	Authority         string          `yaml:"authority" validate:"required"`
	Enabled           bool            `yaml:"enabled"`
	IndexURL          string          `yaml:"index_url" validate:"required,url"`
	DeclaredFrequency string          `yaml:"declared_frequency"`
	StaticURLOverride string          `yaml:"static_url_override"`
	Discovery         DiscoveryConfig `yaml:"discovery" validate:"required"`
	Download          DownloadConfig  `yaml:"download"`
	Parser            ParserConfig    `yaml:"parser" validate:"required"`
}

type DiscoveryConfig struct {
	Type             string   `yaml:"type"`
	PreferredFormats []string `yaml:"preferred_formats"`
	LinkTextPatterns []string `yaml:"link_text_patterns"`
	URLPatterns      []string `yaml:"url_patterns"`
}
type Duration struct{ time.Duration }

func (d *Duration) UnmarshalYAML(value *yaml.Node) error {
	parsed, err := time.ParseDuration(value.Value)
	if err != nil {
		return err
	}
	d.Duration = parsed
	return nil
}

type DownloadConfig struct {
	Timeout      Duration `yaml:"timeout"`
	MaxSizeBytes int64    `yaml:"max_size_bytes"`
}
type ParserConfig struct {
	Type        string `yaml:"type"`
	Encoding    string `yaml:"encoding"`
	SkipRecords int    `yaml:"skip_records"`
}

func LoadDir(dir string) (map[string]Config, error) {
	paths, err := filepath.Glob(filepath.Join(dir, "*.yaml"))
	if err != nil {
		return nil, err
	}
	sort.Strings(paths)
	out := map[string]Config{}
	validate := validator.New()
	for _, path := range paths {
		b, err := os.ReadFile(path)
		if err != nil {
			return nil, err
		}
		var cfg Config
		if err := yaml.Unmarshal(b, &cfg); err != nil {
			return nil, fmt.Errorf("%s: %w", path, err)
		}
		if cfg.Download.Timeout.Duration == 0 {
			cfg.Download.Timeout.Duration = 60 * time.Second
		}
		if cfg.Download.MaxSizeBytes == 0 {
			cfg.Download.MaxSizeBytes = 100 << 20
		}
		if err := validate.Struct(cfg); err != nil {
			return nil, fmt.Errorf("%s: %w", path, err)
		}
		if _, exists := out[cfg.ID]; exists {
			return nil, fmt.Errorf("duplicate source %q", cfg.ID)
		}
		out[cfg.ID] = cfg
	}
	if len(out) == 0 {
		return nil, fmt.Errorf("no source configurations in %s", dir)
	}
	return out, nil
}

func (c Config) FormatAllowed(ext string) bool {
	ext = strings.TrimPrefix(strings.ToLower(ext), ".")
	for _, f := range c.Discovery.PreferredFormats {
		if strings.EqualFold(f, ext) {
			return true
		}
	}
	return false
}
