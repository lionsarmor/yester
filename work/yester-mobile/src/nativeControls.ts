import { requireOptionalNativeModule } from "expo";
type Events = { shortcut: (event: { action: string }) => void };
type Controls = {
  tick(): Promise<void>;
  addListener: (
    name: "shortcut",
    listener: Events["shortcut"],
  ) => { remove: () => void };
} & { configure: (quiet: boolean, tap: boolean) => Promise<boolean> };
export const nativeControls =
  requireOptionalNativeModule<Controls>("YesterControls");
