const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://avantis.superapp.gg";

export default function Head() {
  const miniAppMetadata = {
    version: "next",
    imageUrl: `${APP_URL.replace(/\/$/, "")}/trading-illustration.svg`,
    button: {
      title: "Launch PrepX",
      action: {
        type: "launch_miniapp",
        name: "PrepX AI Trading",
        url: APP_URL.replace(/\/$/, "") + "/"
      }
    }
  };

  const miniAppContent = JSON.stringify(miniAppMetadata).replace(/"/g, "&quot;");

  return (
    <>
      <meta name="fc:miniapp" content={miniAppContent} />
    </>
  );
}

