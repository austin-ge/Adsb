import Link from "next/link";
import { ArrowLeft, Key, Plane, Radio, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function ApiDocsPage() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://your-domain.com";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to Home
            </Link>
            <Link href="/login">
              <Button variant="outline">Sign In</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Title */}
          <div>
            <h1 className="text-3xl font-bold text-balance">API Documentation</h1>
            <p className="text-muted-foreground mt-2">
              Access real-time ADS-B flight data through our REST API
            </p>
          </div>

          {/* Authentication */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" aria-hidden="true" />
                Authentication
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>
                Include your API key in the <code className="bg-muted px-1 rounded">x-api-key</code> header:
              </p>
              <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
{`curl -H "x-api-key: YOUR_API_KEY" \\
  ${baseUrl}/api/v1/aircraft`}
              </pre>
              <p className="text-sm text-muted-foreground">
                Don&apos;t have an API key?{" "}
                <Link href="/register" className="text-primary underline">
                  Create an account
                </Link>{" "}
                to get one.
              </p>
            </CardContent>
          </Card>

          {/* Rate Limits */}
          <Card>
            <CardHeader>
              <CardTitle>Rate Limits</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p>
                  Rate limits are based on your API tier. Headers are included in
                  every response:
                </p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>
                    <code>X-RateLimit-Limit</code> - Your rate limit
                  </li>
                  <li>
                    <code>X-RateLimit-Remaining</code> - Requests remaining
                  </li>
                  <li>
                    <code>X-RateLimit-Reset</code> - Unix timestamp when limit
                    resets
                  </li>
                </ul>
                <div className="grid gap-2 mt-4">
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">FREE</Badge>
                      <span>No API key required</span>
                    </div>
                    <span className="font-mono">100 req/min</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-2">
                      <Badge variant="default">FEEDER</Badge>
                      <span>Active feeder contributors</span>
                    </div>
                    <span className="font-mono">1,000 req/min</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-2">
                      <Badge>PRO</Badge>
                      <span>Commercial applications</span>
                    </div>
                    <span className="font-mono">10,000 req/min</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Endpoints */}
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-balance">Endpoints</h2>

            {/* GET /api/v1/aircraft */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plane className="h-5 w-5" aria-hidden="true" />
                  <span className="font-mono text-lg">
                    GET /api/v1/aircraft
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>Get live aircraft data from the network.</p>

                <div>
                  <h4 className="font-semibold mb-2">Query Parameters</h4>
                  <div className="space-y-2 text-sm">
                    <div className="grid grid-cols-3 gap-2 p-2 bg-muted rounded">
                      <code>bounds</code>
                      <span className="col-span-2">
                        Filter by bounding box: <code>lat1,lon1,lat2,lon2</code>
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 p-2 bg-muted rounded">
                      <code>min_alt</code>
                      <span className="col-span-2">
                        Minimum altitude in feet
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 p-2 bg-muted rounded">
                      <code>max_alt</code>
                      <span className="col-span-2">
                        Maximum altitude in feet
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 p-2 bg-muted rounded">
                      <code>flight</code>
                      <span className="col-span-2">
                        Filter by callsign (partial match)
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 p-2 bg-muted rounded">
                      <code>limit</code>
                      <span className="col-span-2">
                        Max results (default: 1000, max: 5000)
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Example Response</h4>
                  <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
{`{
  "now": 1706000000.123,
  "total": 1234,
  "filtered": 50,
  "aircraft": [
    {
      "hex": "A12345",
      "flight": "UAL123",
      "registration": "N12345",
      "type": "B738",
      "lat": 40.7128,
      "lon": -74.0060,
      "altitude": 35000,
      "ground_speed": 450,
      "track": 90,
      "vertical_rate": 0,
      "squawk": "1200",
      "category": "A3",
      "seen": 0.5,
      "seen_pos": 1.2,
      "rssi": -28.5
    }
  ]
}`}
                  </pre>
                </div>
              </CardContent>
            </Card>

            {/* GET /api/v1/aircraft/[hex] */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plane className="h-5 w-5" aria-hidden="true" />
                  <span className="font-mono text-lg">
                    GET /api/v1/aircraft/:hex
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>Get a single aircraft by ICAO hex address.</p>

                <div>
                  <h4 className="font-semibold mb-2">Path Parameters</h4>
                  <div className="space-y-2 text-sm">
                    <div className="grid grid-cols-3 gap-2 p-2 bg-muted rounded">
                      <code>hex</code>
                      <span className="col-span-2">
                        ICAO 24-bit hex address (e.g., A12345)
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Example</h4>
                  <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
{`curl -H "x-api-key: YOUR_API_KEY" \\
  ${baseUrl}/api/v1/aircraft/A12345`}
                  </pre>
                </div>
              </CardContent>
            </Card>

            {/* GET /api/v1/stats */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" aria-hidden="true" />
                  <span className="font-mono text-lg">GET /api/v1/stats</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>Get network-wide statistics.</p>

                <div>
                  <h4 className="font-semibold mb-2">Example Response</h4>
                  <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
{`{
  "network": {
    "feeders": {
      "total": 150,
      "online": 120
    },
    "messages_total": "1234567890",
    "positions_total": "987654321",
    "aircraft_tracked": 50000
  },
  "live": {
    "aircraft": 1234,
    "aircraft_with_position": 1100,
    "message_rate": 5000,
    "timestamp": 1706000000.123
  }
}`}
                  </pre>
                </div>
              </CardContent>
            </Card>

            {/* GET /api/v1/feeders */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Radio className="h-5 w-5" aria-hidden="true" />
                  <span className="font-mono text-lg">GET /api/v1/feeders</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p>Get list of feeders in the network.</p>
                <p className="text-sm text-muted-foreground">
                  <Badge variant="outline" className="mr-1">
                    FEEDER+
                  </Badge>
                  Location data requires FEEDER tier or higher.
                </p>

                <div>
                  <h4 className="font-semibold mb-2">Query Parameters</h4>
                  <div className="space-y-2 text-sm">
                    <div className="grid grid-cols-3 gap-2 p-2 bg-muted rounded">
                      <code>online</code>
                      <span className="col-span-2">
                        Filter to only online feeders: <code>true</code>
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 p-2 bg-muted rounded">
                      <code>limit</code>
                      <span className="col-span-2">
                        Max results (default: 100, max: 500)
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 p-2 bg-muted rounded">
                      <code>offset</code>
                      <span className="col-span-2">
                        Pagination offset (default: 0)
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Example Response</h4>
                  <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
{`{
  "total": 150,
  "limit": 100,
  "offset": 0,
  "has_more": true,
  "feeders": [
    {
      "id": "abc123",
      "name": "My Home Feeder",
      "owner": "John Doe",
      "latitude": 40.7128,  // FEEDER+ only
      "longitude": -74.006, // FEEDER+ only
      "stats": {
        "messages_total": "1234567",
        "positions_total": "987654",
        "aircraft_seen": 5000
      },
      "is_online": true,
      "last_seen": "2024-01-23T12:00:00Z",
      "member_since": "2024-01-01T00:00:00Z"
    }
  ]
}`}
                  </pre>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Error Responses */}
          <Card>
            <CardHeader>
              <CardTitle>Error Responses</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>All errors return JSON with an error message:</p>
              <div className="space-y-2 text-sm">
                <div className="grid grid-cols-4 gap-2 p-2 bg-muted rounded">
                  <code>401</code>
                  <span className="col-span-3">Invalid or missing API key</span>
                </div>
                <div className="grid grid-cols-4 gap-2 p-2 bg-muted rounded">
                  <code>403</code>
                  <span className="col-span-3">
                    Insufficient tier for this endpoint
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2 p-2 bg-muted rounded">
                  <code>404</code>
                  <span className="col-span-3">Resource not found</span>
                </div>
                <div className="grid grid-cols-4 gap-2 p-2 bg-muted rounded">
                  <code>429</code>
                  <span className="col-span-3">Rate limit exceeded</span>
                </div>
                <div className="grid grid-cols-4 gap-2 p-2 bg-muted rounded">
                  <code>503</code>
                  <span className="col-span-3">Service temporarily unavailable</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* CTA */}
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="py-8 text-center">
              <h3 className="text-xl font-semibold">Ready to get started?</h3>
              <p className="text-muted-foreground mt-2">
                Create an account to get your API key and start building.
              </p>
              <div className="flex gap-2 justify-center mt-4">
                <Link href="/register">
                  <Button>Create Account</Button>
                </Link>
                <Link href="/login">
                  <Button variant="outline">Sign In</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
