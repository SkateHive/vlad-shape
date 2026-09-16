import Image from "next/image";
import SkateScene from "@/components/SkateScene";

const SPECS: string[] = [
  "Six-ply maple deck — 810 × 209.55 × 9.17 mm",
  "Concave, rounded edges, asymmetric nose/tail kicks",
  "Griptape: deterministic abrasive grain, ~0.53 mm spacing",
  "Logo: 32 mm, centered between the rear bolts",
  "Trucks: cast silver hangers, 61.5 × 77.5 mm baseplate",
  "Kingpin: 15° tilt from the deck normal, inward-facing",
  "Wheels: 54 × 32 mm urethane, four total",
  "Bearings: eight 608s, 8 × 22 × 7 mm, with spacers",
];

export default function Home() {
  return (
    <main>
      <SkateScene />

      <div className="landing">
        <section className="product">
          <div className="productImage">
            <Image
              src="/vlad-deck.png"
              alt="The Vlad shape — six-ply maple deck, red graphic underside"
              width={340}
              height={760}
              priority={false}
            />
          </div>

          <div>
            <p className="eyebrow">Skatehive Pro Shape</p>
            <h1 className="headline pixel">VLAD</h1>
            <p className="lede">
              Six-ply maple, cast trucks, the full hardware stack — no
              shortcuts. Built by the Skatehive crew, for the crew.
            </p>

            <ul className="specList">
              {SPECS.map((spec) => (
                <li key={spec}>{spec}</li>
              ))}
            </ul>

            <div className="ctaBox">
              <h2 className="ctaTitle pixel">Get one</h2>
              <p className="ctaText">
                Limited run. Hit the Discord to ask about availability,
                sizing and drop dates.
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
          </div>
        </section>

        <section className="speech">
          <div className="speechBubble">
            <p className="speechName">Vlad</p>
            <p className="speechText">
              If you stake with me, you can always ask a puff of my joints.
            </p>
          </div>
          <div className="speechAvatar">
            <Image src="/vlad-head.png" alt="Vlad" width={140} height={140} />
          </div>
        </section>
      </div>
    </main>
  );
}
