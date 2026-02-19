import React from "react";
import { Composition } from "remotion";
import { PlainerDemo } from "./PlainerDemo";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="PlainerDemo"
      component={PlainerDemo}
      durationInFrames={900}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};
