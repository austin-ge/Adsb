import Link from "next/link";
import {
  ArrowLeft,
  Zap,
  Container,
  Radio,
  Radar,
  Terminal,
  Wrench,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CopyButton } from "@/components/copy-button";

function CodeBlock({ code, language = "bash" }: { code: string; language?: string }) {
  return (
    <div className="relative group">
      <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
        <code className={`language-${language}`}>{code}</code>
      </pre>
      <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <CopyButton text={code} />
      </div>
    </div>
  );
}

function RequirementsList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item, index) => (
        <li key={index} className="flex items-start gap-2 text-sm">
          <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" aria-hidden="true" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function StepCard({ step, title, children }: { step: number; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
          {step}
        </span>
        <h4 className="font-semibold">{title}</h4>
      </div>
      <div className="ml-10 space-y-3">{children}</div>
    </div>
  );
}

export default function InstallDocsPage() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://radar.hangartrak.com";
  const serverHost = process.env.NEXT_PUBLIC_SERVER_HOST || "radar.hangartrak.com";
  const beastPort = process.env.BEAST_PORT || "30004";

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
            <h1 className="text-3xl font-bold text-balance">Feeder Installation Guide</h1>
            <p className="text-muted-foreground mt-2">
              Connect your ADS-B receiver to the HangarTrak Radar network
            </p>
          </div>

          {/* Prerequisites */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5" aria-hidden="true" />
                Before You Begin
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>
                To feed data to HangarTrak Radar, you need a working ADS-B receiver setup.
                You&apos;ll also need a feeder UUID from your dashboard.
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h4 className="font-semibold mb-2">Requirements</h4>
                  <RequirementsList
                    items={[
                      "Raspberry Pi (or similar SBC) with ADS-B receiver",
                      "Working readsb, dump1090, or Ultrafeeder installation",
                      "Network connectivity to the internet",
                      "SSH access to your device",
                    ]}
                  />
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Get Your Feeder UUID</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Register a feeder in your dashboard to get a unique UUID for installation.
                  </p>
                  <Link href="/register">
                    <Button size="sm">
                      Create Account
                      <ExternalLink className="ml-2 h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tabbed Installation Instructions */}
          <Tabs defaultValue="auto-install" className="space-y-6">
            <TabsList className="flex flex-wrap h-auto gap-1 p-1">
              <TabsTrigger value="auto-install" className="flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">Auto-Install</span>
                <span className="sm:hidden">Auto</span>
              </TabsTrigger>
              <TabsTrigger value="ultrafeeder" className="flex items-center gap-1.5">
                <Container className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">Ultrafeeder</span>
                <span className="sm:hidden">Docker</span>
              </TabsTrigger>
              <TabsTrigger value="piaware" className="flex items-center gap-1.5">
                <Radio className="h-3.5 w-3.5" aria-hidden="true" />
                PiAware
              </TabsTrigger>
              <TabsTrigger value="fr24" className="flex items-center gap-1.5">
                <Radar className="h-3.5 w-3.5" aria-hidden="true" />
                FR24
              </TabsTrigger>
              <TabsTrigger value="readsb" className="flex items-center gap-1.5">
                <Terminal className="h-3.5 w-3.5" aria-hidden="true" />
                readsb
              </TabsTrigger>
              <TabsTrigger value="dump1090" className="flex items-center gap-1.5">
                <Terminal className="h-3.5 w-3.5" aria-hidden="true" />
                dump1090
              </TabsTrigger>
              <TabsTrigger value="troubleshooting" className="flex items-center gap-1.5">
                <Wrench className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">Troubleshooting</span>
                <span className="sm:hidden">Help</span>
              </TabsTrigger>
            </TabsList>

            {/* Auto-Install Tab */}
            <TabsContent value="auto-install" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-amber-500" aria-hidden="true" />
                    Automatic Installation
                    <Badge className="ml-2">Recommended</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <p>
                    The fastest way to get started. Our install script automatically detects your
                    ADS-B software and configures everything for you.
                  </p>

                  <StepCard step={1} title="Get your install command">
                    <p className="text-sm text-muted-foreground">
                      After registering a feeder in your dashboard, you&apos;ll receive a personalized
                      install command with your unique UUID:
                    </p>
                    <CodeBlock
                      code={`curl -sSL ${baseUrl}/api/install/YOUR-FEEDER-UUID | sudo bash`}
                    />
                  </StepCard>

                  <StepCard step={2} title="Run on your Raspberry Pi">
                    <p className="text-sm text-muted-foreground">
                      SSH into your Pi and paste the command. The script requires root privileges
                      to configure system services.
                    </p>
                  </StepCard>

                  <StepCard step={3} title="Verify the connection">
                    <p className="text-sm text-muted-foreground">
                      After installation, check that data is flowing:
                    </p>
                    <CodeBlock code="sudo journalctl -u hangartrak-radar-stats -f" />
                    <p className="text-sm text-muted-foreground">
                      You should see periodic &quot;OK&quot; messages with aircraft counts.
                    </p>
                  </StepCard>

                  <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                    <h4 className="font-semibold text-sm">What the script does:</h4>
                    <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                      <li>Detects your ADS-B software (readsb, dump1090, Ultrafeeder)</li>
                      <li>Adds a Beast output connection to {serverHost}:{beastPort}</li>
                      <li>Installs a stats reporter service for tracking your contribution</li>
                      <li>Enables automatic startup on boot</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Ultrafeeder / adsb.im Tab */}
            <TabsContent value="ultrafeeder" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Container className="h-5 w-5 text-blue-500" aria-hidden="true" />
                    Ultrafeeder / adsb.im Docker Setup
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <p>
                    If you&apos;re using{" "}
                    <a
                      href="https://adsb.im/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline"
                    >
                      adsb.im
                    </a>{" "}
                    or the Ultrafeeder Docker container, add our network to your configuration.
                  </p>

                  <StepCard step={1} title="Edit your .env file">
                    <p className="text-sm text-muted-foreground">
                      Open your Ultrafeeder configuration file (usually at{" "}
                      <code className="bg-muted px-1 rounded">/opt/adsb/config/ultrafeeder/.env</code>):
                    </p>
                    <CodeBlock code="sudo nano /opt/adsb/config/ultrafeeder/.env" />
                  </StepCard>

                  <StepCard step={2} title="Add HangarTrak Radar to ULTRAFEEDER_CONFIG">
                    <p className="text-sm text-muted-foreground">
                      Find the <code className="bg-muted px-1 rounded">ULTRAFEEDER_CONFIG</code> line
                      and append our feed:
                    </p>
                    <CodeBlock
                      code={`ULTRAFEEDER_CONFIG="...existing config...;adsb,${serverHost},${beastPort},beast_reduce_plus_out"`}
                    />
                    <p className="text-sm text-muted-foreground">
                      If starting fresh, use:
                    </p>
                    <CodeBlock
                      code={`ULTRAFEEDER_CONFIG="adsb,${serverHost},${beastPort},beast_reduce_plus_out"`}
                    />
                  </StepCard>

                  <StepCard step={3} title="Restart the container">
                    <CodeBlock code="cd /opt/adsb && docker compose down && docker compose up -d" />
                  </StepCard>

                  <StepCard step={4} title="Verify the connection">
                    <p className="text-sm text-muted-foreground">
                      Check the container logs for connection status:
                    </p>
                    <CodeBlock code="docker logs ultrafeeder 2>&1 | grep -i hangartrak" />
                  </StepCard>
                </CardContent>
              </Card>
            </TabsContent>

            {/* PiAware Tab */}
            <TabsContent value="piaware" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Radio className="h-5 w-5 text-green-500" aria-hidden="true" />
                    FlightAware PiAware Setup
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <p>
                    PiAware uses dump1090-fa. You can add an additional Beast output to feed
                    HangarTrak Radar alongside FlightAware.
                  </p>

                  <StepCard step={1} title="Install socat (if not present)">
                    <CodeBlock code="sudo apt-get update && sudo apt-get install -y socat" />
                  </StepCard>

                  <StepCard step={2} title="Create a systemd service">
                    <p className="text-sm text-muted-foreground">
                      Create a service file to forward Beast data:
                    </p>
                    <CodeBlock
                      code={`sudo tee /etc/systemd/system/hangartrak-feed.service << 'EOF'
[Unit]
Description=HangarTrak Radar Beast Feed
After=dump1090-fa.service
Requires=dump1090-fa.service

[Service]
Type=simple
ExecStart=/usr/bin/socat -u TCP:localhost:30005 TCP:${serverHost}:${beastPort}
Restart=always
RestartSec=30

[Install]
WantedBy=multi-user.target
EOF`}
                    />
                  </StepCard>

                  <StepCard step={3} title="Enable and start the service">
                    <CodeBlock
                      code={`sudo systemctl daemon-reload
sudo systemctl enable hangartrak-feed
sudo systemctl start hangartrak-feed`}
                    />
                  </StepCard>

                  <StepCard step={4} title="Verify the connection">
                    <CodeBlock code="sudo systemctl status hangartrak-feed" />
                    <p className="text-sm text-muted-foreground">
                      The service should show as &quot;active (running)&quot;.
                    </p>
                  </StepCard>
                </CardContent>
              </Card>
            </TabsContent>

            {/* FlightRadar24 Tab */}
            <TabsContent value="fr24" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Radar className="h-5 w-5 text-orange-500" aria-hidden="true" />
                    FlightRadar24 Pi Image Setup
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <p>
                    The FR24 Pi image typically uses dump1090 or readsb. You can add a Beast
                    output using socat or netcat.
                  </p>

                  <StepCard step={1} title="Check your decoder">
                    <p className="text-sm text-muted-foreground">
                      First, identify which decoder you&apos;re running:
                    </p>
                    <CodeBlock code="ls /run/dump1090* /run/readsb 2>/dev/null" />
                  </StepCard>

                  <StepCard step={2} title="Install socat">
                    <CodeBlock code="sudo apt-get update && sudo apt-get install -y socat" />
                  </StepCard>

                  <StepCard step={3} title="Create a feed service">
                    <p className="text-sm text-muted-foreground">
                      Adjust the port based on your decoder (30005 for dump1090, 30005 for readsb):
                    </p>
                    <CodeBlock
                      code={`sudo tee /etc/systemd/system/hangartrak-feed.service << 'EOF'
[Unit]
Description=HangarTrak Radar Beast Feed
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/socat -u TCP:localhost:30005 TCP:${serverHost}:${beastPort}
Restart=always
RestartSec=30

[Install]
WantedBy=multi-user.target
EOF`}
                    />
                  </StepCard>

                  <StepCard step={4} title="Enable and start the service">
                    <CodeBlock
                      code={`sudo systemctl daemon-reload
sudo systemctl enable hangartrak-feed
sudo systemctl start hangartrak-feed`}
                    />
                  </StepCard>

                  <StepCard step={5} title="Verify the connection">
                    <CodeBlock code="sudo systemctl status hangartrak-feed" />
                  </StepCard>
                </CardContent>
              </Card>
            </TabsContent>

            {/* readsb Standalone Tab */}
            <TabsContent value="readsb" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Terminal className="h-5 w-5 text-purple-500" aria-hidden="true" />
                    readsb Standalone Setup
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <p>
                    If you&apos;re running readsb directly (not via Docker), add a network connector
                    to your configuration.
                  </p>

                  <StepCard step={1} title="Edit readsb configuration">
                    <p className="text-sm text-muted-foreground">
                      Open the readsb defaults file:
                    </p>
                    <CodeBlock code="sudo nano /etc/default/readsb" />
                  </StepCard>

                  <StepCard step={2} title="Add the net-connector option">
                    <p className="text-sm text-muted-foreground">
                      Find or add the <code className="bg-muted px-1 rounded">READSB_NET_CONNECTOR</code>{" "}
                      line:
                    </p>
                    <CodeBlock
                      code={`READSB_NET_CONNECTOR="${serverHost},${beastPort},beast_reduce_plus_out"`}
                    />
                    <p className="text-sm text-muted-foreground">
                      Or if you have multiple feeds, separate them with semicolons:
                    </p>
                    <CodeBlock
                      code={`READSB_NET_CONNECTOR="existing-feed;${serverHost},${beastPort},beast_reduce_plus_out"`}
                    />
                  </StepCard>

                  <StepCard step={3} title="Restart readsb">
                    <CodeBlock code="sudo systemctl restart readsb" />
                  </StepCard>

                  <StepCard step={4} title="Verify the connection">
                    <p className="text-sm text-muted-foreground">
                      Check the readsb logs for connection status:
                    </p>
                    <CodeBlock code="sudo journalctl -u readsb -n 50 | grep -i connect" />
                  </StepCard>

                  <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-4">
                    <h4 className="font-semibold text-sm text-amber-500 mb-1">Note on beast_reduce_plus_out</h4>
                    <p className="text-sm text-muted-foreground">
                      We recommend <code className="bg-muted px-1 rounded">beast_reduce_plus_out</code>{" "}
                      for bandwidth efficiency. It sends reduced-rate position updates while
                      preserving all aircraft data. If you have issues, try{" "}
                      <code className="bg-muted px-1 rounded">beast_out</code> instead.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* dump1090-mutability Tab */}
            <TabsContent value="dump1090" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Terminal className="h-5 w-5 text-gray-500" aria-hidden="true" />
                    dump1090-mutability Setup
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <p>
                    For older dump1090 variants (mutability, mal, etc.), use socat to forward
                    the Beast output to our network.
                  </p>

                  <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-4 mb-4">
                    <h4 className="font-semibold text-sm text-amber-500 mb-1">Consider Upgrading</h4>
                    <p className="text-sm text-muted-foreground">
                      dump1090-mutability is no longer maintained. We recommend upgrading to{" "}
                      <a
                        href="https://github.com/wiedehopf/readsb"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline"
                      >
                        readsb
                      </a>{" "}
                      for better performance and features.
                    </p>
                  </div>

                  <StepCard step={1} title="Install socat">
                    <CodeBlock code="sudo apt-get update && sudo apt-get install -y socat" />
                  </StepCard>

                  <StepCard step={2} title="Find your Beast output port">
                    <p className="text-sm text-muted-foreground">
                      Check which port dump1090 is using for Beast output:
                    </p>
                    <CodeBlock code="sudo netstat -tlnp | grep dump1090" />
                    <p className="text-sm text-muted-foreground">
                      Common ports: 30005 (Beast), 30002 (raw), 30003 (SBS)
                    </p>
                  </StepCard>

                  <StepCard step={3} title="Create a feed service">
                    <CodeBlock
                      code={`sudo tee /etc/systemd/system/hangartrak-feed.service << 'EOF'
[Unit]
Description=HangarTrak Radar Beast Feed
After=dump1090-mutability.service
Requires=dump1090-mutability.service

[Service]
Type=simple
ExecStart=/usr/bin/socat -u TCP:localhost:30005 TCP:${serverHost}:${beastPort}
Restart=always
RestartSec=30

[Install]
WantedBy=multi-user.target
EOF`}
                    />
                  </StepCard>

                  <StepCard step={4} title="Enable and start the service">
                    <CodeBlock
                      code={`sudo systemctl daemon-reload
sudo systemctl enable hangartrak-feed
sudo systemctl start hangartrak-feed`}
                    />
                  </StepCard>

                  <StepCard step={5} title="Verify the connection">
                    <CodeBlock code="sudo systemctl status hangartrak-feed" />
                  </StepCard>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Troubleshooting Tab */}
            <TabsContent value="troubleshooting" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wrench className="h-5 w-5 text-red-500" aria-hidden="true" />
                    Troubleshooting
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Connection Issues */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg">Connection Issues</h3>

                    <div className="space-y-2">
                      <h4 className="font-medium">Check if your decoder is running</h4>
                      <CodeBlock
                        code={`# For readsb
sudo systemctl status readsb

# For dump1090-fa (PiAware)
sudo systemctl status dump1090-fa

# For dump1090-mutability
sudo systemctl status dump1090-mutability`}
                      />
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-medium">Verify Beast output is available locally</h4>
                      <CodeBlock code="nc -zv localhost 30005" />
                      <p className="text-sm text-muted-foreground">
                        You should see &quot;Connection to localhost 30005 port [tcp/*] succeeded!&quot;
                      </p>
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-medium">Test connection to HangarTrak Radar</h4>
                      <CodeBlock code={`nc -zv ${serverHost} ${beastPort}`} />
                      <p className="text-sm text-muted-foreground">
                        If this fails, check your firewall and internet connection.
                      </p>
                    </div>
                  </div>

                  {/* Stats Reporter Issues */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg">Stats Reporter Issues</h3>

                    <div className="space-y-2">
                      <h4 className="font-medium">Check service status</h4>
                      <CodeBlock code="sudo systemctl status hangartrak-radar-stats" />
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-medium">View recent logs</h4>
                      <CodeBlock code="sudo journalctl -u hangartrak-radar-stats -n 100" />
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-medium">Restart the stats service</h4>
                      <CodeBlock code="sudo systemctl restart hangartrak-radar-stats" />
                    </div>
                  </div>

                  {/* Firewall Issues */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg">Firewall Configuration</h3>
                    <p className="text-sm text-muted-foreground">
                      If you have a firewall, ensure outbound connections to port {beastPort} are allowed:
                    </p>

                    <div className="space-y-2">
                      <h4 className="font-medium">For UFW (Ubuntu/Debian)</h4>
                      <CodeBlock code={`sudo ufw allow out ${beastPort}/tcp`} />
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-medium">For iptables</h4>
                      <CodeBlock
                        code={`sudo iptables -A OUTPUT -p tcp --dport ${beastPort} -j ACCEPT`}
                      />
                    </div>
                  </div>

                  {/* Verify Data Flow */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg">Verify Data is Flowing</h3>

                    <div className="space-y-2">
                      <h4 className="font-medium">Check your feeder status in the dashboard</h4>
                      <p className="text-sm text-muted-foreground">
                        Visit your feeder page to see if we&apos;re receiving data. The &quot;Last Seen&quot;
                        timestamp should update every 30 seconds.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-medium">Monitor local Beast output</h4>
                      <CodeBlock code="nc localhost 30005 | hexdump -C | head -20" />
                      <p className="text-sm text-muted-foreground">
                        You should see binary data scrolling. If nothing appears, your decoder
                        may not be receiving aircraft data.
                      </p>
                    </div>
                  </div>

                  {/* Common Errors */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg">Common Errors</h3>

                    <div className="space-y-3">
                      <div className="rounded-lg bg-muted p-4">
                        <code className="text-sm text-red-400">Connection refused</code>
                        <p className="text-sm text-muted-foreground mt-1">
                          The local decoder is not running or not listening on the expected port.
                          Check the decoder service status.
                        </p>
                      </div>

                      <div className="rounded-lg bg-muted p-4">
                        <code className="text-sm text-red-400">Connection timed out</code>
                        <p className="text-sm text-muted-foreground mt-1">
                          Cannot reach HangarTrak Radar servers. Check your internet connection
                          and firewall settings.
                        </p>
                      </div>

                      <div className="rounded-lg bg-muted p-4">
                        <code className="text-sm text-red-400">Invalid UUID</code>
                        <p className="text-sm text-muted-foreground mt-1">
                          The feeder UUID in your configuration is incorrect. Re-run the install
                          script with your correct UUID from the dashboard.
                        </p>
                      </div>

                      <div className="rounded-lg bg-muted p-4">
                        <code className="text-sm text-red-400">No heartbeat token found</code>
                        <p className="text-sm text-muted-foreground mt-1">
                          The stats reporter cannot find its authentication token. Re-run the
                          install script to regenerate credentials.
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Get Help */}
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="py-6">
                  <h3 className="font-semibold text-lg mb-2">Still having issues?</h3>
                  <p className="text-muted-foreground mb-4">
                    If you&apos;ve tried the above steps and still can&apos;t connect, please reach out
                    with details about your setup, the error messages you&apos;re seeing, and the
                    output of the diagnostic commands above.
                  </p>
                  <div className="flex gap-2">
                    <Link href="mailto:support@hangartrak.com">
                      <Button variant="outline">Contact Support</Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* CTA */}
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="py-8 text-center">
              <h3 className="text-xl font-semibold">Ready to start feeding?</h3>
              <p className="text-muted-foreground mt-2">
                Create an account to register your feeder and get your personalized install command.
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
