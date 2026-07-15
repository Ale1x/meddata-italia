package platform

import "testing"

func TestLoadConfigRabbitMQURL(t *testing.T) {
	t.Setenv("MEDICINE_RABBIT_MQ_URL", "amqp://configured-rabbitmq:5672/")
	cfg, err := LoadConfig()
	if err != nil {
		t.Fatal(err)
	}
	if cfg.RabbitMQURL != "amqp://configured-rabbitmq:5672/" {
		t.Fatalf("RabbitMQURL = %q", cfg.RabbitMQURL)
	}
}
