package discovery

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/Ale1x/meddata-italia/internal/sources"
	"golang.org/x/net/html"
)

type Artifact struct {
	URL               string
	LinkText          string
	Format            string
	PublishedAt       *time.Time
	DeclaredSizeBytes int64
}
type Result struct {
	IndexURL    string
	ObservedAt  time.Time
	HTTPStatus  int
	HTTPHeaders http.Header
	HTML        []byte
	PageSHA256  string
	Artifact    Artifact
}
type Discoverer struct{ Client *http.Client }

func (d Discoverer) Discover(ctx context.Context, cfg sources.Config) (Result, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, cfg.IndexURL, nil)
	if err != nil {
		return Result{}, err
	}
	resp, err := d.Client.Do(req)
	if err != nil {
		return Result{}, fmt.Errorf("fetch source index: %w", err)
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 5<<20))
	if err != nil {
		return Result{}, err
	}
	if resp.StatusCode/100 != 2 {
		return Result{}, fmt.Errorf("source index status %d", resp.StatusCode)
	}
	sum := sha256.Sum256(body)
	result := Result{IndexURL: cfg.IndexURL, ObservedAt: time.Now().UTC(), HTTPStatus: resp.StatusCode, HTTPHeaders: resp.Header.Clone(), HTML: body, PageSHA256: hex.EncodeToString(sum[:])}
	if cfg.StaticURLOverride != "" {
		result.Artifact = Artifact{URL: cfg.StaticURLOverride, Format: strings.TrimPrefix(strings.ToLower(path.Ext(cfg.StaticURLOverride)), ".")}
		return result, nil
	}
	base, _ := url.Parse(cfg.IndexURL)
	doc, err := html.Parse(strings.NewReader(string(body)))
	if err != nil {
		return Result{}, fmt.Errorf("parse source index: %w", err)
	}
	var candidates []Artifact
	var walk func(*html.Node)
	walk = func(n *html.Node) {
		if n.Type == html.ElementNode && n.Data == "a" {
			href := ""
			for _, a := range n.Attr {
				if a.Key == "href" {
					href = a.Val
				}
			}
			if href != "" {
				u, parseErr := base.Parse(href)
				if parseErr == nil {
					text := strings.Join(strings.Fields(nodeText(n)), " ")
					ext := strings.TrimPrefix(strings.ToLower(path.Ext(u.Path)), ".")
					if cfg.FormatAllowed(ext) && matches(text, u.String(), cfg.Discovery.LinkTextPatterns, cfg.Discovery.URLPatterns) {
						candidates = append(candidates, Artifact{URL: u.String(), LinkText: text, Format: ext, PublishedAt: parseDate(text), DeclaredSizeBytes: parseSize(text)})
					}
				}
			}
		}
		for child := n.FirstChild; child != nil; child = child.NextSibling {
			walk(child)
		}
	}
	walk(doc)
	if len(candidates) == 0 {
		return Result{}, fmt.Errorf("no artifact matched discovery rules for %s", cfg.ID)
	}
	for _, preferred := range cfg.Discovery.PreferredFormats {
		for _, candidate := range candidates {
			if strings.EqualFold(preferred, candidate.Format) {
				result.Artifact = candidate
				return result, nil
			}
		}
	}
	result.Artifact = candidates[0]
	return result, nil
}
func nodeText(n *html.Node) string {
	if n.Type == html.TextNode {
		return n.Data
	}
	var b strings.Builder
	for c := n.FirstChild; c != nil; c = c.NextSibling {
		b.WriteString(nodeText(c))
		b.WriteByte(' ')
	}
	return b.String()
}
func matches(text, u string, textPatterns, urlPatterns []string) bool {
	if len(textPatterns) == 0 && len(urlPatterns) == 0 {
		return true
	}
	for _, p := range textPatterns {
		if strings.Contains(strings.ToLower(text), strings.ToLower(p)) {
			return true
		}
	}
	for _, p := range urlPatterns {
		ok, _ := regexp.MatchString(p, u)
		if ok {
			return true
		}
	}
	return false
}
func parseDate(s string) *time.Time {
	re := regexp.MustCompile(`\b(\d{1,2})[./-](\d{1,2})[./-](\d{4})\b`)
	m := re.FindStringSubmatch(s)
	if m == nil {
		return nil
	}
	t, err := time.Parse("2/1/2006", m[1]+"/"+m[2]+"/"+m[3])
	if err != nil {
		return nil
	}
	return &t
}
func parseSize(s string) int64 {
	re := regexp.MustCompile(`(?i)\[([0-9]+(?:[.,][0-9]+)?)\s*(KB|MB|GB)\]`)
	m := re.FindStringSubmatch(s)
	if m == nil {
		return 0
	}
	v, _ := strconv.ParseFloat(strings.ReplaceAll(m[1], ",", "."), 64)
	mult := float64(1 << 10)
	if strings.EqualFold(m[2], "MB") {
		mult = 1 << 20
	} else if strings.EqualFold(m[2], "GB") {
		mult = 1 << 30
	}
	return int64(v * mult)
}
