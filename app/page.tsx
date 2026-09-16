import SkateScene from "@/components/SkateScene";

const SPECS: Array<[string, string]> = [
  ["Deck", "810 × 209.55 × 9.17 mm, six-ply maple"],
  ["Concave", "Rounded edges, asymmetric nose/tail kicks"],
  ["Griptape", "Deterministic abrasive grain, ~0.53 mm spacing"],
  ["Logo", "32 mm, centered between the rear bolts"],
  ["Trucks", "Cast silver hangers, 61.5 × 77.5 mm baseplate"],
  ["Kingpin", "15° tilt from the deck normal, inward-facing"],
  ["Wheels", "54 × 32 mm urethane, four total"],
  ["Bearings", "Eight 608s, 8 × 22 × 7 mm, with spacers"],
];

export default function Home() {
  return (
    <main>
      <SkateScene />

      <div className="landing">
        <p className="eyebrow">Skatehive Pro Shape</p>
        <h1 className="headline pixel">VLAD</h1>
        <p className="lede">
          Six-ply maple, cast trucks, the full hardware stack — no shortcuts.
          Built by the Skatehive crew, for the crew.
        </p>

        <div className="specGrid">
          {SPECS.map(([label, value]) => (
            <div className="specCell" key={label}>
              <div className="specLabel">{label}</div>
              <div className="specValue">{value}</div>
            </div>
          ))}
        </div>

        <div className="ctaBox">
          <h2 className="ctaTitle pixel">Get one</h2>
          <p className="ctaText">
            Limited run. Hit the Discord to ask about availability, sizing and
            drop dates.
          </p>
          <a
            className="ctaButton"
            href="https://discord.gg/skatehive"
            target="_blank"
            rel="noopener noreferrer"
          >
            Ask in Discord →
          </a>
        </div>

        <footer className="footer">
          <span>© {new Date().getFullYear()} Skatehive</span>
          <nav style={{ display: "flex", gap: 16 }}>
            <a href="https://skatehive.app" target="_blank" rel="noopener noreferrer">
              skatehive.app
            </a>
            <a href="https://instagram.com/skatehive" target="_blank" rel="noopener noreferrer">
              Instagram
            </a>
            <a href="https://discord.gg/skatehive" target="_blank" rel="noopener noreferrer">
              Discord
            </a>
          </nav>
        </footer>
      </div>
    </main>
  );
}
