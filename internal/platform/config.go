package platform

import (
	"fmt"
	"time"

	"github.com/kelseyhightower/envconfig"
)

type Config struct {
	Environment        string        `default:"development"`
	Version            string        `default:"dev"`
	HTTPAddress        string        `split_words:"true" default:":8080"`
	MetricsAddress     string        `split_words:"true" default:":9091"`
	DatabaseURL        string        `split_words:"true" default:"postgres://medicine:medicine@localhost:5432/medicine?sslmode=disable"`
	RabbitMQURL        string        `envconfig:"RABBIT_MQ_URL" default:"amqp://medicine:medicine@localhost:5672/"`
	RabbitMQPrefetch   int           `split_words:"true" default:"10"`
	MinioEndpoint      string        `split_words:"true" default:"localhost:9000"`
	MinioAccessKey     string        `split_words:"true" default:"minioadmin"`
	MinioSecretKey     string        `split_words:"true" default:"minioadmin"`
	MinioBucket        string        `split_words:"true" default:"medicine-data"`
	MinioUseSSL        bool          `split_words:"true" default:"false"`
	SourcesDir         string        `split_words:"true" default:"configs/sources"`
	DownloadTimeout    time.Duration `split_words:"true" default:"60s"`
	ShutdownTimeout    time.Duration `split_words:"true" default:"15s"`
	CORSAllowedOrigins string        `envconfig:"CORS_ALLOWED_ORIGINS" default:"http://localhost:3000,http://localhost:5173"`
}

func LoadConfig() (Config, error) {
	var cfg Config
	if err := envconfig.Process("MEDICINE", &cfg); err != nil {
		return cfg, fmt.Errorf("load environment: %w", err)
	}
	return cfg, nil
}
