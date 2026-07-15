package messaging

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/rabbitmq/amqp091-go"
	"log/slog"
	"time"
)

const (
	Exchange     = "medicine.events"
	DeadExchange = "medicine.events.dlx"
	Queue        = "medicine.ingestion"
	DeadQueue    = "medicine.ingestion.dlq"
	RetryQueue   = "medicine.ingestion.retry"
)

type Broker struct {
	conn   *amqp091.Connection
	ch     *amqp091.Channel
	logger *slog.Logger
}

func NewBroker(url string, prefetch int, logger *slog.Logger) (*Broker, error) {
	conn, err := amqp091.Dial(url)
	if err != nil {
		return nil, fmt.Errorf("dial rabbitmq: %w", err)
	}
	ch, err := conn.Channel()
	if err != nil {
		conn.Close()
		return nil, err
	}
	b := &Broker{conn: conn, ch: ch, logger: logger}
	if err := b.declare(prefetch); err != nil {
		b.Close()
		return nil, err
	}
	return b, nil
}
func (b *Broker) declare(prefetch int) error {
	for _, x := range []struct{ name, kind string }{{Exchange, "topic"}, {DeadExchange, "topic"}} {
		if err := b.ch.ExchangeDeclare(x.name, x.kind, true, false, false, false, nil); err != nil {
			return err
		}
	}
	args := amqp091.Table{"x-dead-letter-exchange": DeadExchange}
	if _, err := b.ch.QueueDeclare(Queue, true, false, false, false, args); err != nil {
		return err
	}
	if err := b.ch.QueueBind(Queue, "ingestion.#", Exchange, false, nil); err != nil {
		return err
	}
	retry := amqp091.Table{"x-message-ttl": int32(30000), "x-dead-letter-exchange": Exchange, "x-dead-letter-routing-key": "ingestion.requested"}
	if _, err := b.ch.QueueDeclare(RetryQueue, true, false, false, false, retry); err != nil {
		return err
	}
	if _, err := b.ch.QueueDeclare(DeadQueue, true, false, false, false, nil); err != nil {
		return err
	}
	if err := b.ch.QueueBind(DeadQueue, "#", DeadExchange, false, nil); err != nil {
		return err
	}
	if err := b.ch.Qos(prefetch, 0, false); err != nil {
		return err
	}
	return b.ch.Confirm(false)
}
func (b *Broker) Publish(ctx context.Context, e Envelope) error {
	body, err := json.Marshal(e)
	if err != nil {
		return err
	}
	confirmation, err := b.ch.PublishWithDeferredConfirmWithContext(ctx, Exchange, e.EventType, false, false, amqp091.Publishing{DeliveryMode: amqp091.Persistent, ContentType: "application/json", MessageId: e.EventID.String(), CorrelationId: e.CorrelationID.String(), Timestamp: e.OccurredAt, Body: body})
	if err != nil {
		return err
	}
	if ok, err := confirmation.WaitContext(ctx); err != nil {
		return err
	} else if !ok {
		return fmt.Errorf("rabbitmq negative publisher confirm")
	}
	return nil
}
func (b *Broker) Deliveries(ctx context.Context) (<-chan amqp091.Delivery, error) {
	return b.ch.ConsumeWithContext(ctx, Queue, "", false, false, false, false, nil)
}
func (b *Broker) Retry(ctx context.Context, d amqp091.Delivery, reason string) error {
	count := int32(0)
	if v, ok := d.Headers["x-retry-count"].(int32); ok {
		count = v
	}
	return b.ch.PublishWithContext(ctx, "", RetryQueue, false, false, amqp091.Publishing{DeliveryMode: amqp091.Persistent, ContentType: d.ContentType, Headers: amqp091.Table{"x-retry-reason": reason, "x-retried-at": time.Now().UTC().Format(time.RFC3339), "x-retry-count": count + 1}, Body: d.Body})
}
func (b *Broker) DeadLetter(ctx context.Context, d amqp091.Delivery, reason string) error {
	return b.ch.PublishWithContext(ctx, DeadExchange, "ingestion.failed", false, false, amqp091.Publishing{DeliveryMode: amqp091.Persistent, ContentType: d.ContentType, Headers: amqp091.Table{"x-failure-reason": reason}, Body: d.Body})
}
func (b *Broker) Close() {
	if b.ch != nil {
		_ = b.ch.Close()
	}
	if b.conn != nil {
		_ = b.conn.Close()
	}
}
