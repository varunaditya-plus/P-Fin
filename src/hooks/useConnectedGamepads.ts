import { useEffect, useState } from "react";

function connectedGamepads() {
  try {
    return Array.from(navigator.getGamepads?.() ?? []).filter(
      (pad): pad is Gamepad => !!pad?.connected,
    );
  } catch {
    // Browser permissions policies can expose the API but prevent reading it.
    return [];
  }
}

export function useConnectedGamepads() {
  const [controllers, setControllers] = useState(connectedGamepads);
  useEffect(() => {
    const update = () => setControllers(connectedGamepads());
    window.addEventListener("gamepadconnected", update);
    window.addEventListener("gamepaddisconnected", update);
    return () => {
      window.removeEventListener("gamepadconnected", update);
      window.removeEventListener("gamepaddisconnected", update);
    };
  }, []);
  return controllers;
}
