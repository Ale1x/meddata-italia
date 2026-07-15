package ingestion

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"time"
)

type Download struct {
	Bytes        []byte
	SHA256       string
	Size         int64
	MediaType    string
	Headers      http.Header
	DownloadedAt time.Time
}

func DownloadArtifact(ctx context.Context, client *http.Client, url string, maxBytes int64) (Download, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return Download{}, err
	}
	resp, err := client.Do(req)
	if err != nil {
		return Download{}, fmt.Errorf("download artifact: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode/100 != 2 {
		return Download{}, fmt.Errorf("download status %d", resp.StatusCode)
	}
	if resp.ContentLength > maxBytes {
		return Download{}, fmt.Errorf("artifact content length %d exceeds %d", resp.ContentLength, maxBytes)
	}
	b, err := io.ReadAll(io.LimitReader(resp.Body, maxBytes+1))
	if err != nil {
		return Download{}, err
	}
	if int64(len(b)) > maxBytes {
		return Download{}, fmt.Errorf("artifact exceeds maximum size %d", maxBytes)
	}
	sum := sha256.Sum256(b)
	return Download{Bytes: b, SHA256: hex.EncodeToString(sum[:]), Size: int64(len(b)), MediaType: resp.Header.Get("Content-Type"), Headers: resp.Header.Clone(), DownloadedAt: time.Now().UTC()}, nil
}
