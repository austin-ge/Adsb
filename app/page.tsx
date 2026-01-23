import Link from "next/link";
import { Plane, Radio, BarChart3, Key } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Navigation */}
      <nav className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-semibold text-lg">
          <Plane className="h-6 w-6 text-primary" aria-hidden="true" />
          HangarTrak Radar
        </Link>
        <div className="flex items-center gap-4">
          <Button variant="ghost" asChild>
            <Link href="/login">Sign In</Link>
          </Button>
          <Button asChild>
            <Link href="/register">Get Started</Link>
          </Button>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-16">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 mb-4 text-balance">
            Community Flight Tracking
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Join the HangarTrak community ADS-B network. Feed flight data from your
            Raspberry Pi and power aircraft tracking for everyone.
          </p>
          <div className="flex gap-4 justify-center">
            <Button size="lg" asChild>
              <Link href="/register">Start Feeding</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link
                href={process.env.NEXT_PUBLIC_MAP_URL || "#"}
                target="_blank"
              >
                View Live Map
              </Link>
            </Button>
          </div>
        </div>

        {/* Stats Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          <div className="bg-white rounded-xl shadow-sm p-6 text-center border">
            <div className="text-4xl font-bold text-primary mb-2 tabular-nums">0</div>
            <div className="text-gray-600">Active Feeders</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6 text-center border">
            <div className="text-4xl font-bold text-primary mb-2 tabular-nums">0</div>
            <div className="text-gray-600">Aircraft Tracked</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6 text-center border">
            <div className="text-4xl font-bold text-primary mb-2 tabular-nums">0</div>
            <div className="text-gray-600">Messages/sec</div>
          </div>
        </div>

        {/* Features Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-xl shadow-sm p-6 border">
            <Radio className="h-8 w-8 text-primary mb-4" aria-hidden="true" />
            <h3 className="text-xl font-semibold mb-2">Easy Setup</h3>
            <p className="text-gray-600">
              One command to start feeding from your Raspberry Pi running readsb.
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6 border">
            <Key className="h-8 w-8 text-primary mb-4" aria-hidden="true" />
            <h3 className="text-xl font-semibold mb-2">Free API Access</h3>
            <p className="text-gray-600">
              Active feeders get free API access with 1000 requests/minute.
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6 border">
            <BarChart3 className="h-8 w-8 text-primary mb-4" aria-hidden="true" />
            <h3 className="text-xl font-semibold mb-2">Statistics</h3>
            <p className="text-gray-600">
              Track your feeder performance with detailed analytics and charts.
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6 border">
            <Plane className="h-8 w-8 text-primary mb-4" aria-hidden="true" />
            <h3 className="text-xl font-semibold mb-2">Live Map</h3>
            <p className="text-gray-600">
              View real-time aircraft positions on our tar1090-powered map.
            </p>
          </div>
        </div>

        {/* How It Works */}
        <div className="mt-20 text-center">
          <h2 className="text-3xl font-bold mb-8">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div>
              <div className="w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                1
              </div>
              <h3 className="font-semibold mb-2">Create Account</h3>
              <p className="text-gray-600 text-sm">
                Sign up and register your feeder to get a unique ID
              </p>
            </div>
            <div>
              <div className="w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                2
              </div>
              <h3 className="font-semibold mb-2">Run Install Script</h3>
              <p className="text-gray-600 text-sm">
                One command configures your Pi to send data to our network
              </p>
            </div>
            <div>
              <div className="w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                3
              </div>
              <h3 className="font-semibold mb-2">Get API Access</h3>
              <p className="text-gray-600 text-sm">
                Active feeders automatically get free API access
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t mt-20">
        <div className="container mx-auto px-4 py-8 text-center text-gray-600">
          <p>HangarTrak Radar - Community-powered flight tracking</p>
        </div>
      </footer>
    </main>
  );
}
