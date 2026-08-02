import { registerRootComponent } from "expo";
/** Register background Family location task before the app mounts. */
import "./src/backgroundLocation";
import App from "./App";

registerRootComponent(App);
