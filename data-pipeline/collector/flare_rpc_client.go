package collector

import (
    "context"
    "fmt"
    "log"
    "os"

    "github.com/ethereum/go-ethereum/ethclient"
)

// Client wraps an ethclient.Client for Flare/Coston2 RPC usage.
type Client struct {
    RPC string
    Eth *ethclient.Client
}

// NewClient initializes a client using FLARE_RPC env var or provided url.
func NewClient(rpcURL string) (*Client, error) {
    if rpcURL == "" {
        rpcURL = os.Getenv("FLARE_RPC")
    }
    if rpcURL == "" {
        rpcURL = "https://coston2-api.flare.network/ext/C/rpc"
    }
    c, err := ethclient.Dial(rpcURL)
    if err != nil {
        return nil, err
    }
    return &Client{RPC: rpcURL, Eth: c}, nil
}

// BlockNumber returns the latest block number.
func (c *Client) BlockNumber(ctx context.Context) (uint64, error) {
    return c.Eth.BlockNumber(ctx)
}

func Example() {
    ctx := context.Background()
    client, err := NewClient("")
    if err != nil {
        log.Fatal(err)
    }
    bn, err := client.BlockNumber(ctx)
    if err != nil {
        log.Fatal(err)
    }
    fmt.Printf("Connected to %s, latest block %d\n", client.RPC, bn)
}
