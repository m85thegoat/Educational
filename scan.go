package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"
)

type Result struct {
	Proxy     string
	Working   bool
	Latency   int64
	Elite     bool
	VisibleIP string
	ProxyType string
}

type IPResponse struct {
	Origin string `json:"origin"`
}

type HeadersResponse struct {
	Headers map[string]string `json:"headers"`
}

func checkProxy(proxyURL string, wg *sync.WaitGroup, results chan<- Result, sem chan struct{}) {
	defer wg.Done()
	defer func() { <-sem }()

	result := Result{Proxy: proxyURL}

	// Parse proxy URL
	parsedProxy, err := url.Parse(proxyURL)
	if err != nil {
		results <- result
		return
	}

	// Detect proxy type
	switch strings.ToLower(parsedProxy.Scheme) {
	case "http", "https":
		result.ProxyType = "HTTP"
	case "socks4":
		result.ProxyType = "SOCKS4"
	case "socks5":
		result.ProxyType = "SOCKS5"
	default:
		result.ProxyType = "UNKNOWN"
	}

	transport := &http.Transport{
		Proxy: http.ProxyURL(parsedProxy),
	}

	client := &http.Client{
		Transport: transport,
		Timeout:   5 * time.Second,
	}

	// Test connectivity & get IP
	start := time.Now()
	resp, err := client.Get("http://httpbin.org/ip")
	if err != nil {
		results <- result
		return
	}
	defer resp.Body.Close()

	latency := time.Since(start).Milliseconds()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		results <- result
		return
	}

	var ipResp IPResponse
	if err := json.Unmarshal(body, &ipResp); err != nil {
		results <- result
		return
	}

	// Check anonymity
	resp2, err := client.Get("http://httpbin.org/headers")
	if err != nil {
		results <- result
		return
	}
	defer resp2.Body.Close()

	body2, _ := io.ReadAll(resp2.Body)
	var headersResp HeadersResponse
	json.Unmarshal(body2, &headersResp)

	isElite := true
	leakHeaders := []string{"X-Forwarded-For", "Via", "X-Real-Ip", "Proxy-Connection"}
	for _, h := range leakHeaders {
		if _, found := headersResp.Headers[h]; found {
			isElite = false
			break
		}
	}

	result.Working = true
	result.Latency = latency
	result.Elite = isElite
	result.VisibleIP = ipResp.Origin
	results <- result
}

func loadProxies(filename string) ([]string, error) {
	file, err := os.Open(filename)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	var proxies []string
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		// Auto-add scheme if missing
		if !strings.Contains(line, "://") {
			line = "http://" + line
		}
		proxies = append(proxies, line)
	}
	return proxies, scanner.Err()
}

func main() {
	inputFile := "proxies.txt"
	outputFile := "working.txt"
	concurrency := 200

	if len(os.Args) > 1 {
		inputFile = os.Args[1]
	}
	if len(os.Args) > 2 {
		outputFile = os.Args[2]
	}

	proxies, err := loadProxies(inputFile)
	if err != nil {
		fmt.Printf("❌ Error loading proxies: %v\n", err)
		os.Exit(1)
	}

	total := len(proxies)
	fmt.Printf("🔍 Checking %d proxies | Concurrency: %d | Timeout: 5s\n\n", total, concurrency)

	results := make(chan Result, total)
	sem := make(chan struct{}, concurrency)
	var wg sync.WaitGroup

	// Progress counter
	var mu sync.Mutex
	checked := 0

	go func() {
		for _, proxy := range proxies {
			sem <- struct{}{}
			wg.Add(1)
			go func(p string) {
				checkProxy(p, &wg, results, sem)
				mu.Lock()
				checked++
				fmt.Printf("\r⏳ Progress: %d/%d", checked, total)
				mu.Unlock()
			}(proxy)
		}
		wg.Wait()
		close(results)
	}()

	// Collect results
	var working []Result
	for r := range results {
		if r.Working {
			working = append(working, r)
		}
	}

	// Save working proxies
	out, err := os.Create(outputFile)
	if err != nil {
		fmt.Printf("\n❌ Error creating output file: %v\n", err)
		os.Exit(1)
	}
	defer out.Close()

	fmt.Printf("\n\n%-35s %-8s %-8s %-16s %-10s\n",
		"PROXY", "TYPE", "LATENCY", "IP", "ANONYMITY")
	fmt.Println(strings.Repeat("-", 85))

	for _, r := range working {
		anonymity := "Anonymous"
		if r.Elite {
			anonymity = "Elite ⭐"
		}
		fmt.Printf("%-35s %-8s %-8s %-16s %-10s\n",
			r.Proxy, r.ProxyType, fmt.Sprintf("%dms", r.Latency), r.VisibleIP, anonymity)
		fmt.Fprintln(out, r.Proxy)
	}

	fmt.Printf("\n✅ Working : %d/%d\n", len(working), total)
	fmt.Printf("❌ Dead    : %d/%d\n", total-len(working), total)
	fmt.Printf("💾 Saved to: %s\n", outputFile)
}