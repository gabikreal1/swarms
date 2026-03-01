import React from "react";
import { Composition, Sequence } from "remotion";
import { VIDEO, SCENE } from "./theme";
import { TrustVacuum } from "./scenes/TrustVacuum";
import { DiscoveryProblem } from "./scenes/DiscoveryProblem";
import { EnterSwarms } from "./scenes/EnterSwarms";
import { Butler } from "./scenes/Butler";
import { Bidding } from "./scenes/Bidding";
import { Lock } from "./scenes/Lock";
import { Validation } from "./scenes/Validation";
import { Reputation } from "./scenes/Reputation";
import { ForBuilders } from "./scenes/ForBuilders";
import { Future } from "./scenes/Future";

const scenes = [
  { id: "trustVacuum", Component: TrustVacuum, duration: SCENE.trustVacuum },
  { id: "discoveryProblem", Component: DiscoveryProblem, duration: SCENE.discoveryProblem },
  { id: "enterSwarms", Component: EnterSwarms, duration: SCENE.enterSwarms },
  { id: "butler", Component: Butler, duration: SCENE.butler },
  { id: "bidding", Component: Bidding, duration: SCENE.bidding },
  { id: "lock", Component: Lock, duration: SCENE.lock },
  { id: "validation", Component: Validation, duration: SCENE.validation },
  { id: "reputation", Component: Reputation, duration: SCENE.reputation },
  { id: "forBuilders", Component: ForBuilders, duration: SCENE.forBuilders },
  { id: "future", Component: Future, duration: SCENE.future },
] as const;

const SwarmsVideo: React.FC = () => {
  let offset = 0;
  return (
    <div style={{ background: "#000", width: "100%", height: "100%" }}>
      {scenes.map(({ id, Component, duration }) => {
        const from = offset;
        offset += duration;
        return (
          <Sequence key={id} from={from} durationInFrames={duration} name={id}>
            <Component />
          </Sequence>
        );
      })}
    </div>
  );
};

export const Root: React.FC = () => {
  return (
    <Composition
      id="SwarmsVideo"
      component={SwarmsVideo}
      durationInFrames={VIDEO.totalFrames}
      fps={VIDEO.fps}
      width={VIDEO.width}
      height={VIDEO.height}
    />
  );
};
